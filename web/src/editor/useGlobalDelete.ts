import { useEffect } from "react";
import { deleteStaticSelection, resolveStaticSelection } from "./selectionActions";

/**
 * Delete/Backspace over a selection that spans a block's static (unfocused)
 * view — same reasoning as useGlobalCut: there's no focused textarea to attach
 * a normal onKeyDown to, so this is a document-level listener. Unlike cut,
 * nothing is written to the clipboard here, matching how Delete/Backspace
 * behave everywhere else when text is selected (they just remove it).
 */
export function useGlobalDelete(): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const match = resolveStaticSelection();
      if (!match) return;

      e.preventDefault();
      window.getSelection()?.removeAllRanges();
      deleteStaticSelection(match);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
