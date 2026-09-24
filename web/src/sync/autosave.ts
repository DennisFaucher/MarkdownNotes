import { saveDoc, SaveConflictError, type SaveBody } from "./api";
import { useDocStore } from "../state/useDocStore";
import type { EditorDoc } from "../types/block";

const DEBOUNCE_MS = 500;
const timers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * The hash of the last version *this tab* saved, per doc — checked by
 * useLiveSync to recognize the watcher's broadcast of our own write as an
 * echo rather than a fresh external change. Deliberately a plain module-level
 * map, not the Zustand store: it's written synchronously the instant the save
 * response arrives, whereas doc.version only updates once React processes
 * markSaved's state update. The watcher's broadcast can otherwise arrive and
 * be handled before that update lands, making the two look like a genuine
 * mismatch and re-flagging a conflict that was just resolved.
 */
export const recentSelfSaves = new Map<string, string>();

function toSaveBody(doc: EditorDoc): SaveBody {
  return {
    preLines: doc.preLines,
    hadTrailingNewline: doc.hadTrailingNewline,
    baseVersion: doc.version,
    blocks: doc.blocks.map((b) => {
      const lines = b.source.split("\n");
      if (b.dirty) {
        return {
          depth: b.depth,
          bulletEmpty: b.source === "",
          firstLine: lines[0] ?? "",
          contLines: lines.slice(1).map((text) => ({ raw: false, text })),
        };
      }
      return {
        depth: b.depth,
        bulletEmpty: b.originalBulletEmpty,
        firstLine: lines[0] ?? "",
        contLines: b.originalContLines,
      };
    }),
  };
}

export async function flushSave(docId: string): Promise<void> {
  const timer = timers.get(docId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(docId);
  }
  const { docs, setSaving, markSaved, setConflict } = useDocStore.getState();
  const doc = docs[docId];
  if (!doc || !doc.dirty || doc.saving) return;

  setSaving(docId, true);
  try {
    const { version } = await saveDoc({ kind: doc.kind, id: doc.id }, toSaveBody(doc));
    recentSelfSaves.set(docId, version);
    markSaved(docId, version);
  } catch (err) {
    if (err instanceof SaveConflictError) {
      // The file changed on disk since this doc's baseVersion was set — a
      // genuine conflict, whether or not useLiveSync's next poll has noticed
      // it yet. Flagging it here directly (rather than only from that poll)
      // means the banner shows immediately instead of waiting up to a full
      // poll interval.
      console.warn(`save conflict on ${docId}; local edits kept in memory, not written`, err);
      setConflict(docId, true);
      setSaving(docId, false);
      return;
    }
    console.error(`save failed for ${docId}`, err);
    setSaving(docId, false);
  }
}

export function scheduleSave(docId: string): void {
  const existing = timers.get(docId);
  if (existing) clearTimeout(existing);
  timers.set(
    docId,
    setTimeout(() => {
      timers.delete(docId);
      void flushSave(docId);
    }, DEBOUNCE_MS),
  );
}
