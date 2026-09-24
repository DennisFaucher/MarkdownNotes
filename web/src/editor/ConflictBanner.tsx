import type { MouseEvent } from "react";
import { useDocStore } from "../state/useDocStore";
import { fetchJournalDay, fetchPage, resolveConflict } from "../sync/api";
import { flushSave } from "../sync/autosave";
import type { EditorDoc } from "../types/block";

/**
 * Shown when a file changed on disk while this doc had unsaved edits in the
 * browser — see useLiveSync. There's no auto-merge: block ids are regenerated
 * fresh on every parse, not stable identifiers, so a silent per-block merge
 * isn't reliable. Instead the user picks a side explicitly, and whichever
 * version loses is preserved as a .conflict-<ISO>.md file, never discarded.
 */
export function ConflictBanner({ doc }: { doc: EditorDoc }) {
  const keepMine = async () => {
    await resolveConflict({ kind: doc.kind, id: doc.id });
    useDocStore.getState().beginConflictResolution(doc.id);
    await flushSave(doc.id);
  };

  const takeTheirs = async () => {
    const fresh = doc.kind === "journal" ? await fetchJournalDay(doc.id.replace(/_/g, "-")) : await fetchPage(doc.id);
    useDocStore.getState().replaceWithServerVersion(fresh);
  };

  // If a block in this doc is still focused when a button is clicked, the
  // default mousedown-then-blur sequence would blur that textarea first —
  // triggering its own flushSave with the stale, pre-resolution baseVersion,
  // racing the resolve-and-save flow below and sometimes leaving `conflict`
  // stuck true even though the file ends up correct. Blocking that default
  // focus change (same technique as Chip's click-to-navigate) means the only
  // save that runs is this one, with the freshly-cleared baseVersion.
  const preventBlur = (e: MouseEvent) => e.preventDefault();

  return (
    <div className="mn-conflict-banner">
      <span>This page changed outside MarkdownNotes while you had unsaved edits here.</span>
      <div className="mn-conflict-actions">
        <button onMouseDown={preventBlur} onClick={() => void keepMine()}>
          Keep my version
        </button>
        <button onMouseDown={preventBlur} onClick={() => void takeTheirs()}>
          Discard mine, use theirs
        </button>
      </div>
    </div>
  );
}
