import chokidar from "chokidar";
import { JOURNALS_DIR, PAGES_DIR } from "../config.js";
import { indexFile, pathKind, relPath, removeFileFromIndex } from "../index/build.js";

/**
 * Keeps the SQLite index in sync with the vault on disk. Runs after the initial
 * rebuildIndex() full pass (ignoreInitial), so it only reacts to changes that
 * happen while the server is running — including our own saves (re-indexing a
 * file we just wrote is idempotent and cheap, so no self-write suppression is
 * needed) and edits made by another tool (or another machine, via a sync tool
 * like Resilio) writing into the same vault.
 *
 * An open browser tab notices those external edits by polling GET /api/sync
 * against this same index's per-file hash — see web/src/editor/useLiveSync.ts
 * and server/src/api/sync.ts for why that's a plain HTTP poll rather than a
 * server push.
 */
export function startWatcher(): void {
  const watcher = chokidar.watch([JOURNALS_DIR, PAGES_DIR], {
    // `.conflict-` is shared with listMarkdownFiles() (via isIndexableFile) on
    // purpose: if the rebuild indexed those files but the watcher ignored them,
    // deleting one could never call removeFileFromIndex and its rows would sit
    // in the index forever. `.tmp-` is this app's own atomic-write scratch file.
    ignored: (path) => path.includes(".tmp-") || path.includes(".conflict-"),
    ignoreInitial: true,
    // Native OS filesystem events (inotify/FSEvents) are well known to be
    // unreliable — often silently never firing at all — on network
    // filesystems (NFS, SMB) and through some virtualized bind-mount layers.
    // This matters here specifically because VAULT_HOST_PATH is commonly a
    // synced folder (Resilio, etc.) that can itself live on an NFS mount, and
    // the whole point of watching is to catch writes from *other* processes/
    // machines, not just this container's own saves. Polling trades a little
    // CPU for actually working everywhere, regardless of the underlying
    // filesystem — cheap for a vault of a few hundred markdown files.
    usePolling: true,
    interval: 1000,
  });

  const handleChange = (absPath: string) => {
    if (!absPath.endsWith(".md")) return;
    const kind = pathKind(absPath);
    if (!kind) return;
    indexFile(absPath, kind).catch((err) => console.error(`failed to index ${absPath}`, err));
  };

  watcher.on("add", handleChange);
  watcher.on("change", handleChange);
  watcher.on("unlink", (absPath) => {
    if (!absPath.endsWith(".md")) return;
    removeFileFromIndex(relPath(absPath));
  });
  watcher.on("error", (err) => console.error("vault watcher error", err));
}
