import { useEffect } from "react";
import { useDocStore } from "../state/useDocStore";
import { useUiStore } from "../state/useUiStore";
import { scheduleSave } from "../sync/autosave";
import { ensureVisible } from "./ops";

const FLASH_MS = 1600;

/**
 * Consumes a one-shot `pendingScroll` request for `docId` — a jump from a To
 * Dos entry (or anything else) to the exact block that lives in this document.
 * Waits until the doc is actually loaded, expands any collapsed ancestor so
 * the block is mounted, then scrolls it to the centre and briefly flashes it.
 *
 * Mirrors `FindReplaceBar.jumpTo`: expanding a collapsed subtree is persisted
 * (scheduleSave), since that's the same user-visible "reveal the target"
 * behaviour find uses.
 */
export function useScrollToBlock(docId: string) {
  const doc = useDocStore((s) => s.docs[docId]);
  const pendingScroll = useUiStore((s) => s.pendingScroll);

  useEffect(() => {
    if (!doc || !pendingScroll || pendingScroll.docId !== docId) return;
    const { blockIndex } = pendingScroll;
    // Clear before the expansion re-render below, so that re-render can't
    // re-trigger this effect and re-scroll.
    useUiStore.getState().clearPendingScroll();
    if (blockIndex < 0 || blockIndex >= doc.blocks.length) return;

    const expanded = ensureVisible(doc.blocks, blockIndex);
    if (expanded !== doc.blocks) {
      useDocStore.getState().updateBlocks(docId, () => expanded, false);
      scheduleSave(docId);
    }

    // Two frames: one for React to commit the expansion (mounting rows that
    // didn't exist yet), one for layout to settle before measuring/scrolling.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLElement>(`.mn-page-view [data-block-index="${blockIndex}"]`);
        if (!el) return;
        el.scrollIntoView({ block: "center" });
        el.classList.add("mn-block-flash");
        window.setTimeout(() => el.classList.remove("mn-block-flash"), FLASH_MS);
      }),
    );
  }, [doc, pendingScroll, docId]);
}
