import { useEffect } from "react";
import { useDocStore } from "../state/useDocStore";
import { checkSync, fetchJournalDay, fetchPage } from "../sync/api";
import { recentSelfSaves } from "../sync/autosave";

const POLL_INTERVAL_MS = 3000;

/**
 * Notices files changing on disk while their doc is open in this browser tab
 * by polling POST /api/sync (see server/src/api/sync.ts) every few seconds
 * for the current hash of every doc currently loaded.
 *
 * This used to be a WebSocket push instead — the server broadcast a message
 * the moment its file watcher saw a change. That turned out to be unreliable
 * specifically through Docker Desktop's host<->container port-forwarding: a
 * connection that had sat quiet for a few seconds would silently drop
 * server-pushed frames (both ends reported success sending/receiving; the
 * browser just never got them), and a keepalive ping only partially masked
 * it. A short-lived HTTP request/response every few seconds doesn't hit that
 * failure mode — it's the same plain HTTP path every other request already
 * uses reliably — at the cost of a small polling interval's worth of latency
 * instead of a true push.
 *
 * A hash matching either the doc's known version or autosave's
 * recentSelfSaves record (checked against both — see that module for why one
 * alone isn't enough) means nothing's changed, or it's an echo of our own
 * save; either way there's nothing to do. Otherwise, silently refresh (doc
 * has no unsaved edits) or flag a conflict (it does) rather than risk
 * clobbering newer edits made in the moment between the save and this poll.
 */
export function useLiveSync(): void {
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function handleHash(docId: string, hash: string | null) {
      const doc = useDocStore.getState().docs[docId];
      if (!doc) return; // not open anymore — nothing to reconcile

      if (hash === null) {
        if (doc.dirty) useDocStore.getState().setConflict(docId, true);
        return;
      }
      if (hash === doc.version || hash === recentSelfSaves.get(docId)) return;

      if (!doc.dirty) {
        const fresh = doc.kind === "journal" ? await fetchJournalDay(docId.replace(/_/g, "-")) : await fetchPage(docId);
        // Re-check: the doc may have been edited (become dirty) while this
        // fetch was in flight, in which case overwriting it now would lose
        // that edit — flag a conflict instead of clobbering.
        const stillClean = !useDocStore.getState().docs[docId]?.dirty;
        if (stillClean) {
          useDocStore.getState().replaceWithServerVersion(fresh);
        } else {
          useDocStore.getState().setConflict(docId, true);
        }
      } else {
        useDocStore.getState().setConflict(docId, true);
      }
    }

    async function poll() {
      if (stopped) return;
      const docs = Object.values(useDocStore.getState().docs).map((d) => ({ docId: d.id, kind: d.kind }));
      if (docs.length > 0) {
        try {
          const { hashes } = await checkSync(docs);
          for (const [docId, hash] of Object.entries(hashes)) {
            await handleHash(docId, hash);
          }
        } catch {
          // best-effort — a transient network hiccup just means the next poll retries
        }
      }
      if (!stopped) timer = setTimeout(poll, POLL_INTERVAL_MS);
    }

    void poll();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, []);
}
