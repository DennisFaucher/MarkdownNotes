import type { KeyboardEvent } from "react";
import { useDocStore } from "../state/useDocStore";
import { useUiStore } from "../state/useUiStore";
import { scheduleSave } from "../sync/autosave";
import { caretColumn, isCaretOnFirstLine, isCaretOnLastLine, posAtColumnOnFirstLine, posAtColumnOnLastLine } from "./caret";
import * as ops from "./ops";

export function handleBlockKeyDown(e: KeyboardEvent<HTMLTextAreaElement>, docId: string, index: number): void {
  const ta = e.currentTarget;
  const store = useDocStore.getState();
  const doc = store.docs[docId];
  if (!doc) return;
  const blocks = doc.blocks;
  const block = blocks[index];
  const pos = ta.selectionStart;
  const collapsed = ta.selectionStart === ta.selectionEnd;
  const atStart = collapsed && pos === 0;
  const atEnd = collapsed && pos === ta.value.length;
  const isMod = e.metaKey || e.ctrlKey;
  const requestFocus = useUiStore.getState().requestFocus;

  if (isMod && e.key.toLowerCase() === "z") {
    e.preventDefault();
    store.undo(docId);
    return;
  }

  if (isMod && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
    e.preventDefault();
    const next = ops.toggleCollapse(blocks, index);
    if (next !== blocks) {
      store.updateBlocks(docId, () => next, true);
      scheduleSave(docId);
    }
    return;
  }

  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    if (ops.isInsideFence(block.source, pos)) {
      const { blocks: nb, focus } = ops.insertNewline(blocks, index, pos);
      store.updateBlocks(docId, () => nb, false);
      requestFocus({ docId, blockId: focus.blockId, pos: focus.pos });
    } else {
      const { blocks: nb, focus } = ops.splitBlock(blocks, index, pos);
      store.updateBlocks(docId, () => nb, true);
      requestFocus({ docId, blockId: focus.blockId, pos: focus.pos });
    }
    scheduleSave(docId);
    return;
  }

  if (e.key === "Enter" && e.shiftKey) {
    e.preventDefault();
    const { blocks: nb, focus } = ops.insertNewline(blocks, index, pos);
    store.updateBlocks(docId, () => nb, false);
    requestFocus({ docId, blockId: focus.blockId, pos: focus.pos });
    scheduleSave(docId);
    return;
  }

  if (e.key === "Tab") {
    e.preventDefault();
    const nb = e.shiftKey ? ops.outdentBlock(blocks, index) : ops.indentBlock(blocks, index);
    if (nb) {
      store.updateBlocks(docId, () => nb, true);
      requestFocus({ docId, blockId: block.id, pos });
      scheduleSave(docId);
    }
    return;
  }

  if (e.key === "Backspace" && atStart) {
    // An empty block is deleted rather than merged — merging it would be a
    // no-op on content and, at index 0, impossible (no previous block to merge
    // into). Checked before the adjacency test so an empty block whose
    // previous sibling sits under a collapsed ancestor is still reachable.
    if (block.source === "") {
      const removed = ops.removeBlock(blocks, index);
      if (removed) {
        e.preventDefault();
        store.updateBlocks(docId, () => removed.blocks, true);
        requestFocus({ docId, blockId: removed.focus.blockId, pos: removed.focus.pos });
        scheduleSave(docId);
        return;
      }
    }
    const visible = ops.getVisibleIndices(blocks);
    const vi = visible.indexOf(index);
    const prevIsAdjacent = vi > 0 && visible[vi - 1] === index - 1;
    if (prevIsAdjacent) {
      const result = ops.mergeWithPrevious(blocks, index);
      if (result) {
        e.preventDefault();
        store.updateBlocks(docId, () => result.blocks, true);
        requestFocus({ docId, blockId: result.focus.blockId, pos: result.focus.pos });
        scheduleSave(docId);
      }
    }
    return;
  }

  if (e.key === "Delete" && atEnd) {
    const result = ops.deleteForward(blocks, index);
    if (result) {
      e.preventDefault();
      store.updateBlocks(docId, () => result.blocks, true);
      requestFocus({ docId, blockId: result.focus.blockId, pos: result.focus.pos });
      scheduleSave(docId);
    }
    return;
  }

  // Shift+Arrow must fall through to the textarea's native selection-extend
  // behavior — without the shiftKey guard, reaching the first/last line while
  // shift-selecting would hijack the keystroke into cross-block navigation
  // instead of growing the selection.
  if (e.key === "ArrowUp" && !isMod && !e.shiftKey && isCaretOnFirstLine(ta.value, pos)) {
    const visible = ops.getVisibleIndices(blocks);
    const vi = visible.indexOf(index);
    if (vi > 0) {
      e.preventDefault();
      const col = caretColumn(ta.value, pos);
      const prevBlock = blocks[visible[vi - 1]];
      requestFocus({ docId, blockId: prevBlock.id, pos: posAtColumnOnLastLine(prevBlock.source, col) });
    }
    return;
  }

  if (e.key === "ArrowDown" && !isMod && !e.shiftKey && isCaretOnLastLine(ta.value, pos)) {
    const visible = ops.getVisibleIndices(blocks);
    const vi = visible.indexOf(index);
    if (vi < visible.length - 1) {
      e.preventDefault();
      const col = caretColumn(ta.value, pos);
      const nextBlock = blocks[visible[vi + 1]];
      requestFocus({ docId, blockId: nextBlock.id, pos: posAtColumnOnFirstLine(nextBlock.source, col) });
    }
    return;
  }

  if (e.key === "Escape") {
    ta.blur();
  }
}
