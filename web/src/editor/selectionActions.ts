import { useDocStore } from "../state/useDocStore";
import { useUiStore } from "../state/useUiStore";
import { scheduleSave } from "../sync/autosave";
import { deleteRange } from "./ops";
import { getStaticSelectionRange } from "./selection";

export interface StaticSelectionMatch {
  docId: string;
  startIndex: number;
  endIndex: number;
  startOffset: number;
  endOffset: number;
  text: string;
}

/**
 * Resolves the current cross-block selection (if any) against the currently
 * loaded docs. Returns null when there's nothing selected, the selection is
 * inside a focused textarea (window.getSelection() only ever reports a real
 * DOM-content selection — it's empty whenever a textarea has focus, which is
 * exactly what lets this cleanly defer to keymap.ts's single-block handling
 * instead of double-handling the same keystroke), or the selection spans two
 * different open documents (there's no single block array to splice across).
 */
export function resolveStaticSelection(): StaticSelectionMatch | null {
  const result = getStaticSelectionRange();
  if (!result) return null;
  const { range, text } = result;

  const docs = useDocStore.getState().docs;
  for (const [docId, doc] of Object.entries(docs)) {
    const startIndex = doc.blocks.findIndex((b) => b.id === range.startBlockId);
    const endIndex = doc.blocks.findIndex((b) => b.id === range.endBlockId);
    if (startIndex !== -1 && endIndex !== -1) {
      return { docId, startIndex, endIndex, startOffset: range.startOffset, endOffset: range.endOffset, text };
    }
  }
  return null;
}

/** Deletes a resolved static-selection range and focuses the resulting join point. */
export function deleteStaticSelection(match: StaticSelectionMatch): void {
  const docs = useDocStore.getState().docs;
  const { blocks: nb, focus } = deleteRange(
    docs[match.docId].blocks,
    match.startIndex,
    match.startOffset,
    match.endIndex,
    match.endOffset,
  );
  useDocStore.getState().updateBlocks(match.docId, () => nb, true);
  useUiStore.getState().requestFocus({ docId: match.docId, blockId: focus.blockId, pos: focus.pos });
  scheduleSave(match.docId);
}
