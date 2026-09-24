import { useEffect } from "react";
import { deleteStaticSelection, resolveStaticSelection } from "./selectionActions";

/**
 * Cut (Cmd+X) over a selection that spans a block's static (unfocused) view
 * needs custom handling: that content is plain read-only DOM, not an editable
 * region, so there's nothing for the browser's native cut to delete from. We
 * intercept, populate the clipboard ourselves, and delete the corresponding
 * range from the underlying block sources.
 *
 * Registered on `document` (not a React onCut prop) because a cut/copy event
 * for a plain DOM selection with nothing focused targets `document`/`body` —
 * an ancestor of React's root container, not a descendant — so a handler
 * placed anywhere inside the app tree would never see it bubble down.
 */
export function useGlobalCut(): void {
  useEffect(() => {
    function handleCut(e: ClipboardEvent) {
      const match = resolveStaticSelection();
      if (!match) return; // nothing selected, spans two docs, or inside a focused textarea — let native cut run

      e.preventDefault();
      e.clipboardData?.setData("text/plain", match.text);
      window.getSelection()?.removeAllRanges();
      deleteStaticSelection(match);
    }

    document.addEventListener("cut", handleCut);
    return () => document.removeEventListener("cut", handleCut);
  }, []);
}
