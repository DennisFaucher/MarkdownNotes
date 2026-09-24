import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, extname } from "node:path";
import { parseDoc } from "../markdown/tokenize.js";
import { serializeDoc } from "../markdown/serialize.js";
import type { BlockInput } from "../markdown/types.js";

export function hashContent(raw: string): string {
  return createHash("sha1").update(raw, "utf8").digest("hex");
}

export async function readRaw(absPath: string): Promise<string | null> {
  try {
    return await readFile(absPath, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export class ConflictError extends Error {
  currentVersion: string;
  constructor(currentVersion: string) {
    super("version conflict: file changed on disk since it was loaded");
    this.currentVersion = currentVersion;
  }
}

export interface SaveInput {
  preLines: string[];
  blocks: BlockInput[];
  hadTrailingNewline: boolean;
  /** hash of the content the client last loaded; "" means "expected not to exist yet" */
  baseVersion: string;
}

/**
 * Replaces a page's entire block region (preLines are carried over from disk
 * verbatim — the block editor never touches them). Safe because every write is
 * checked against its own round-trip before it reaches disk: if the serializer
 * can't reproduce the bytes it just produced, the write is refused rather than
 * risking a subtly corrupted file.
 */
export async function savePage(absPath: string, input: SaveInput): Promise<{ version: string }> {
  const current = await readRaw(absPath);
  const currentVersion = current === null ? "" : hashContent(current);
  if (currentVersion !== input.baseVersion) {
    throw new ConflictError(currentVersion);
  }

  const out = serializeDoc({
    preLines: input.preLines,
    blocks: input.blocks,
    hadTrailingNewline: input.hadTrailingNewline,
  });

  const reserialized = serializeDoc(parseDoc(out));
  if (reserialized !== out) {
    throw new Error("refusing to write: markdown failed its own round-trip check");
  }

  await mkdir(dirname(absPath), { recursive: true });
  const tmpPath = `${absPath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, out, "utf8");
  await rename(tmpPath, absPath);

  return { version: hashContent(out) };
}

/**
 * Moves whatever is currently on disk at absPath out of the way into a
 * `<name>.conflict-<ISO>.md` sibling, never discarding it. Used when the user
 * explicitly chooses "keep my version" after an external-edit conflict: the
 * external version is preserved under a new name, and the original path is
 * left clear for the browser's in-memory content to land on next.
 */
export async function preserveAsConflictCopy(absPath: string): Promise<void> {
  const current = await readRaw(absPath);
  if (current === null) return; // nothing on disk right now — nothing to preserve
  const ext = extname(absPath);
  const base = absPath.slice(0, absPath.length - ext.length);
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await rename(absPath, `${base}.conflict-${stamp}${ext}`);
}
