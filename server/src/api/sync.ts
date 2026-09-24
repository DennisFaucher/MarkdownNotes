import { Router } from "express";
import { join } from "node:path";
import { VAULT_PATH } from "../config.js";
import { pageTitleToFilename } from "../vault/files.js";
import { hashContent, readRaw } from "../vault/write.js";

export const syncRouter = Router();

interface SyncDocQuery {
  docId: string;
  kind: "journal" | "page";
}

function absPathFor(doc: SyncDocQuery): string | null {
  if (doc.kind === "journal") return join(VAULT_PATH, "journals", `${doc.docId}.md`);
  try {
    return join(VAULT_PATH, "pages", pageTitleToFilename(doc.docId));
  } catch {
    return null;
  }
}

/**
 * Cheap polling endpoint an open browser tab uses to notice when a file it
 * has loaded changed on disk — a plain-HTTP replacement for the WebSocket
 * push this app used to rely on (see web/src/editor/useLiveSync.ts). The
 * WebSocket approach turned out to be unreliable specifically through
 * Docker Desktop's host<->container port-forwarding: a connection that sits
 * quiet for a few seconds would silently drop server-pushed frames (both
 * ends reported success; the client just never received them), even with a
 * keepalive ping. A short-lived HTTP request/response every few seconds
 * doesn't hit that failure mode at all, at the cost of a small polling
 * interval's worth of latency instead of a true push.
 *
 * Hashes the file directly from disk on every request — deliberately *not*
 * the SQLite index's `files.hash` column, even though that's already sitting
 * there and would be cheaper to query. The index is only refreshed when
 * chokidar's watcher (usePolling, up to ~1s behind a real write — see
 * vault/watcher.ts) notices the change, while savePage() hands back a hash
 * computed synchronously from the bytes it just wrote (see vault/write.ts).
 * A poll landing in that gap would see a stale index hash matching neither
 * the client's just-saved doc.version nor autosave's recentSelfSaves record,
 * misreading its own very recent save as an external change and flashing
 * the conflict banner while the user was still typing. Reading the file
 * directly closes that race — there's no second, lagging copy of the truth
 * to disagree with the one savePage() already returned.
 */
syncRouter.post("/", async (req, res) => {
  const docs = Array.isArray(req.body?.docs) ? (req.body.docs as SyncDocQuery[]) : [];
  const hashes: Record<string, string | null> = {};
  await Promise.all(
    docs.map(async (doc) => {
      const absPath = absPathFor(doc);
      if (!absPath) {
        hashes[doc.docId] = null;
        return;
      }
      const raw = await readRaw(absPath);
      hashes[doc.docId] = raw === null ? null : hashContent(raw);
    }),
  );
  res.json({ hashes });
});
