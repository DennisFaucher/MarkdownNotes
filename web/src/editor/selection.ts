import { resolveNodeOffset } from "../render/renderInline";

export interface StaticSelectionRange {
  startBlockId: string;
  startOffset: number;
  endBlockId: string;
  endOffset: number;
}

function resolveBlockPosition(node: Node, offsetInNode: number): { blockId: string; offset: number } | null {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  const blockEl = el?.closest<HTMLElement>("[data-block-id]");
  const offset = resolveNodeOffset(node, offsetInNode);
  if (!blockEl || offset === null) return null;
  return { blockId: blockEl.dataset.blockId!, offset };
}

/**
 * Reads the current window selection, if any, as block ids + source offsets.
 * Returns null when there's nothing selected — including when the selection
 * is inside a focused textarea, since a textarea's internal text selection is
 * never exposed via window.getSelection() at all, only real DOM-content
 * selections over a block's static (unfocused) view are. That's what lets a
 * single check here cleanly separate "let native textarea cut/copy proceed"
 * from "this is a cross-block selection we need to handle ourselves".
 */
export function getStaticSelectionRange(): { range: StaticSelectionRange; text: string } | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const text = selection.toString();
  if (!text) return null;

  const domRange = selection.getRangeAt(0);
  // Range boundaries are always start-before-end in document order regardless
  // of which direction the user actually dragged, so no manual reordering.
  const start = resolveBlockPosition(domRange.startContainer, domRange.startOffset);
  const end = resolveBlockPosition(domRange.endContainer, domRange.endOffset);
  if (!start || !end) return null;

  return {
    range: { startBlockId: start.blockId, startOffset: start.offset, endBlockId: end.blockId, endOffset: end.offset },
    text,
  };
}
