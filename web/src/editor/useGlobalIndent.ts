import { useEffect } from "react";
import { useDocStore } from "../state/useDocStore";
import { scheduleSave } from "../sync/autosave";
import { indentRange, outdentRange } from "./ops";
import { getStaticSelectionRange } from "./selection";

/**
 * Tab/Shift+Tab over a selection that spans a block's static (unfocused) view —
 * same reasoning as useGlobalCut: there's no focused textarea to attach a normal
 * onKeyDown to, and window.getSelection() only reports a real cross-block
 * selection (it's empty whenever a textarea has focus), so this cleanly defers
 * to the single-block Tab handling in keymap.ts whenever a block IS being
 * edited instead of double-handling the same keypress.
 */
export function useGlobalIndent(): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      const result = getStaticSelectionRange();
      if (!result) return;
      const { range } = result;

      const docs = useDocStore.getState().docs;
      let match: { docId: string; startIndex: number; endIndex: number } | null = null;
      for (const [docId, doc] of Object.entries(docs)) {
        const startIndex = doc.blocks.findIndex((b) => b.id === range.startBlockId);
        const endIndex = doc.blocks.findIndex((b) => b.id === range.endBlockId);
        if (startIndex !== -1 && endIndex !== -1) {
          match = { docId, startIndex, endIndex };
          break;
        }
      }
      if (!match) return;

      const { docId, startIndex, endIndex } = match;
      const blocks = docs[docId].blocks;
      const nb = e.shiftKey ? outdentRange(blocks, startIndex, endIndex) : indentRange(blocks, startIndex, endIndex);
      if (!nb) return; // guard failed (no valid previous sibling / would go negative) — leave selection untouched

      e.preventDefault();
      useDocStore.getState().updateBlocks(docId, () => nb, true);
      scheduleSave(docId);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
