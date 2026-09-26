import { readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { getIndex } from "./db.js";
import { isIndexableFile } from "./fileFilter.js";
import { JOURNALS_DIR, PAGES_DIR, VAULT_PATH } from "../config.js";
import { parseDoc } from "../markdown/tokenize.js";
import { deriveBlock } from "../markdown/derive.js";
import { readRaw, hashContent } from "../vault/write.js";
import { filenameToPageTitle, formatJournalTitle, journalDateFromFilename } from "../vault/files.js";

function relPath(absPath: string): string {
  return relative(VAULT_PATH, absPath).split("\\").join("/");
}

function titleFor(absPath: string, kind: "journal" | "page", filename: string): string {
  if (kind === "journal") {
    const date = journalDateFromFilename(filename);
    return date ? formatJournalTitle(date) : filename;
  }
  return filenameToPageTitle(filename);
}

// Serializes indexFile calls that land on the same path. The background
// rebuild (many paths, run concurrently — see rebuildIndex) and the file
// watcher (started immediately, not after the rebuild finishes) can now both
// end up indexing the *same* path around the same time — e.g. the watcher's
// poller notices a file rebuildIndex hasn't reached yet. Each call's own
// delete-then-insert is fine in isolation, but two interleaved without a lock
// race: the second call's DELETE runs before the first's INSERT lands, so
// nothing removes that first row before the second call tries to insert its
// own — a UNIQUE constraint violation on files.path. A per-path queue makes
// overlapping calls run one after another instead, closing that window.
const pathLocks = new Map<string, Promise<void>>();

function withPathLock<T>(path: string, fn: () => Promise<T>): Promise<T> {
  const prior = pathLocks.get(path) ?? Promise.resolve();
  const result = prior.then(fn, fn);
  const tracked = result.then(
    () => undefined,
    () => undefined,
  );
  pathLocks.set(path, tracked);
  tracked.finally(() => {
    if (pathLocks.get(path) === tracked) pathLocks.delete(path);
  });
  return result;
}

/**
 * Re-indexes a single file: clears its old rows (if any) and inserts fresh
 * ones. Used for both the initial full rebuild and incremental updates from
 * the watcher. Returns the file's content hash — the watcher forwards it in
 * the live-sync broadcast so a client can tell "this is just an echo of my
 * own save" (hash matches what it already has) from a genuine external
 * change (hash differs), without needing separate self-write suppression.
 */
export function indexFile(absPath: string, kind: "journal" | "page"): Promise<{ hash: string } | null> {
  return withPathLock(relPath(absPath), () => indexFileLocked(absPath, kind));
}

async function indexFileLocked(absPath: string, kind: "journal" | "page"): Promise<{ hash: string } | null> {
  const db = getIndex();
  const path = relPath(absPath);
  const filename = path.split("/").pop()!;

  removeFileFromIndex(path);

  const raw = await readRaw(absPath);
  if (raw === null) return null; // file was deleted between the watch event and this read

  const doc = parseDoc(raw);
  const title = titleFor(absPath, kind, filename);
  const hash = hashContent(raw);

  db.prepare("INSERT INTO files (path, kind, title, mtime, hash) VALUES (?, ?, ?, ?, ?)").run(
    path,
    kind,
    title,
    Date.now(),
    hash,
  );

  const insertBlock = db.prepare(
    "INSERT INTO blocks (id, path, block_index, depth, content, marker, top_content) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const insertFts = db.prepare("INSERT INTO blocks_fts (content, block_id, path) VALUES (?, ?, ?)");
  const insertTag = db.prepare("INSERT INTO tags (tag, block_id, path) VALUES (?, ?, ?)");
  const insertLink = db.prepare("INSERT INTO links (from_path, to_title) VALUES (?, ?)");

  // Tracks the nearest preceding (or own) depth-0 block's content as we walk
  // the file in order, so every block can be stamped with "which top-level
  // section am I under" without a parent pointer or a runtime tree-walk.
  let topContent = title;
  doc.blocks.forEach((block, index) => {
    const derived = deriveBlock(block);
    const content = derived.content.trim();
    if (block.depth === 0 && content.length > 0) topContent = content;
    if (content.length === 0) return; // nothing to search or tag

    insertBlock.run(block.id, path, index, block.depth, content, derived.marker ?? null, topContent);
    insertFts.run(content, block.id, path);
    for (const tag of derived.tags) insertTag.run(tag, block.id, path);
    for (const ref of derived.refs) insertLink.run(path, ref);
  });

  return { hash };
}

export function removeFileFromIndex(path: string): void {
  const db = getIndex();
  db.prepare("DELETE FROM files WHERE path = ?").run(path);
  db.prepare("DELETE FROM blocks WHERE path = ?").run(path);
  db.prepare("DELETE FROM blocks_fts WHERE path = ?").run(path);
  db.prepare("DELETE FROM tags WHERE path = ?").run(path);
  db.prepare("DELETE FROM links WHERE from_path = ?").run(path);
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter(isIndexableFile).map((f) => join(dir, f));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

// Bounded rather than a single Promise.all over every file: each read is a
// separate round trip to the underlying filesystem, and on a slow one (NFS,
// especially) hundreds of those in true parallel risk exhausting connections/
// file descriptors rather than helping. A modest concurrency window still
// gets nearly all of the win over doing them one at a time.
const REBUILD_CONCURRENCY = 16;

async function mapWithConcurrency<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}

/** Full rebuild from the markdown vault — the index's only source of truth. */
export async function rebuildIndex(): Promise<void> {
  const [journalFiles, pageFiles] = await Promise.all([listMarkdownFiles(JOURNALS_DIR), listMarkdownFiles(PAGES_DIR)]);
  await mapWithConcurrency(journalFiles, REBUILD_CONCURRENCY, (f) => indexFile(f, "journal").then(() => {}));
  await mapWithConcurrency(pageFiles, REBUILD_CONCURRENCY, (f) => indexFile(f, "page").then(() => {}));
}

export function pathKind(absPath: string): "journal" | "page" | null {
  const rel = relPath(absPath);
  if (rel.startsWith("journals/")) return "journal";
  if (rel.startsWith("pages/")) return "page";
  return null;
}

export { relPath };
