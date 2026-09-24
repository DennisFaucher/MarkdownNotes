import type { EditorBlock } from "../types/block";
import { deriveFromSource, newBlockId } from "./derive";

export interface FocusTarget {
  blockId: string;
  pos: number;
}

function withSource(b: EditorBlock, newSource: string): EditorBlock {
  const d = deriveFromSource(newSource);
  return { ...b, source: newSource, dirty: true, marker: d.marker, tags: d.tags, refs: d.refs };
}

function makeBlock(depth: number, source: string): EditorBlock {
  const d = deriveFromSource(source);
  return {
    id: newBlockId(),
    depth,
    source,
    originalContLines: [],
    originalBulletEmpty: source === "",
    dirty: true,
    collapsed: false,
    marker: d.marker,
    tags: d.tags,
    refs: d.refs,
  };
}

export function hasChildren(blocks: EditorBlock[], index: number): boolean {
  const next = blocks[index + 1];
  return !!next && next.depth > blocks[index].depth;
}

/** Indices of blocks not hidden inside a collapsed ancestor's subtree. */
export function getVisibleIndices(blocks: EditorBlock[]): number[] {
  const visible: number[] = [];
  let hideBelowDepth: number | null = null;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (hideBelowDepth !== null) {
      if (b.depth > hideBelowDepth) continue;
      hideBelowDepth = null;
    }
    visible.push(i);
    if (b.collapsed) hideBelowDepth = b.depth;
  }
  return visible;
}

/**
 * True when an odd number of ``` fence markers appear on or before the caret's
 * line — including that line's full text (not just the part before the caret),
 * since Enter is what completes that line. Without including it, finishing
 * ```js and pressing Enter would never register the fence as open.
 */
export function isInsideFence(source: string, caretPos: number): boolean {
  const before = source.slice(0, caretPos).split("\n");
  const afterCaretOnCurrentLine = source.slice(caretPos).split("\n", 1)[0];
  let count = 0;
  for (let i = 0; i < before.length; i++) {
    const isCaretLine = i === before.length - 1;
    const fullLine = isCaretLine ? before[i] + afterCaretOnCurrentLine : before[i];
    if (fullLine.trim().startsWith("```")) count++;
  }
  return count % 2 === 1;
}

export function splitBlock(
  blocks: EditorBlock[],
  index: number,
  caretPos: number,
): { blocks: EditorBlock[]; focus: FocusTarget } {
  const b = blocks[index];
  const left = b.source.slice(0, caretPos);
  const right = b.source.slice(caretPos);

  const atEnd = caretPos === b.source.length;
  const childDepth = hasChildren(blocks, index) && atEnd ? b.depth + 1 : b.depth;
  const created = makeBlock(childDepth, right);

  const next = [...blocks];
  next[index] = withSource(b, left);
  next.splice(index + 1, 0, created);
  return { blocks: next, focus: { blockId: created.id, pos: 0 } };
}

export function insertNewline(blocks: EditorBlock[], index: number, caretPos: number): { blocks: EditorBlock[]; focus: FocusTarget } {
  const b = blocks[index];
  const newSource = b.source.slice(0, caretPos) + "\n" + b.source.slice(caretPos);
  const next = [...blocks];
  next[index] = withSource(b, newSource);
  return { blocks: next, focus: { blockId: b.id, pos: caretPos + 1 } };
}

/** Indent: only valid when an immediately preceding sibling at the same depth exists. */
export function indentBlock(blocks: EditorBlock[], index: number): EditorBlock[] | null {
  const b = blocks[index];
  const prev = blocks[index - 1];
  if (!prev || prev.depth !== b.depth) return null;
  const next = [...blocks];
  next[index] = { ...b, depth: b.depth + 1, dirty: true };
  return next;
}

/** Outdent: following same-depth siblings become this block's children automatically,
 *  since nesting is derived purely from relative depth — no other block needs editing. */
export function outdentBlock(blocks: EditorBlock[], index: number): EditorBlock[] | null {
  const b = blocks[index];
  if (b.depth === 0) return null;
  const next = [...blocks];
  next[index] = { ...b, depth: b.depth - 1, dirty: true };
  return next;
}

/**
 * Indent/outdent every block in [startIndex, endIndex] by the same amount —
 * for Tab/Shift+Tab over a multi-block selection (dragged across several
 * blocks' static views, no single block focused). Shifting every block in the
 * range by the same delta preserves whatever relative nesting already existed
 * among them, same as single-block indent/outdent leaves descendants alone.
 */
export function indentRange(blocks: EditorBlock[], startIndex: number, endIndex: number): EditorBlock[] | null {
  const prev = blocks[startIndex - 1];
  if (!prev || prev.depth !== blocks[startIndex].depth) return null;
  const next = [...blocks];
  for (let i = startIndex; i <= endIndex; i++) next[i] = { ...next[i], depth: next[i].depth + 1, dirty: true };
  return next;
}

/** Guards against ANY block in the range going negative, not just the first —
 *  a selection can span from a nested block into an unrelated top-level one. */
export function outdentRange(blocks: EditorBlock[], startIndex: number, endIndex: number): EditorBlock[] | null {
  for (let i = startIndex; i <= endIndex; i++) {
    if (blocks[i].depth === 0) return null;
  }
  const next = [...blocks];
  for (let i = startIndex; i <= endIndex; i++) next[i] = { ...next[i], depth: next[i].depth - 1, dirty: true };
  return next;
}

export function mergeWithPrevious(
  blocks: EditorBlock[],
  index: number,
): { blocks: EditorBlock[]; focus: FocusTarget } | null {
  if (index === 0 || hasChildren(blocks, index)) return null;
  const prev = blocks[index - 1];
  const b = blocks[index];
  const joinPos = prev.source.length;
  const merged = withSource(prev, prev.source + b.source);
  const next = [...blocks];
  next[index - 1] = merged;
  next.splice(index, 1);
  return { blocks: next, focus: { blockId: merged.id, pos: joinPos } };
}

export function deleteForward(
  blocks: EditorBlock[],
  index: number,
): { blocks: EditorBlock[]; focus: FocusTarget } | null {
  if (index + 1 >= blocks.length || hasChildren(blocks, index + 1)) return null;
  const b = blocks[index];
  const nextBlock = blocks[index + 1];
  const joinPos = b.source.length;
  const merged = withSource(b, b.source + nextBlock.source);
  const next = [...blocks];
  next[index] = merged;
  next.splice(index + 1, 1);
  return { blocks: next, focus: { blockId: merged.id, pos: joinPos } };
}

const COLLAPSED_PROP_LINE = "collapsed:: true";

export function toggleCollapse(blocks: EditorBlock[], index: number): EditorBlock[] {
  if (!hasChildren(blocks, index)) return blocks;
  const b = blocks[index];
  const lines = b.source.split("\n");
  const hasProp = lines.some((l) => l === COLLAPSED_PROP_LINE);
  const newSource = hasProp
    ? lines.filter((l) => l !== COLLAPSED_PROP_LINE).join("\n")
    : [...lines, COLLAPSED_PROP_LINE].join("\n");
  const next = [...blocks];
  next[index] = { ...withSource(b, newSource), collapsed: !hasProp };
  return next;
}

const MARKER_RE = /^(TODO|DONE|NOW|LATER|DOING|WAITING|CANCELED)(?:\s+(.*))?$/;
const DONE_MARKERS = new Set(["DONE", "CANCELED"]);

/** Flips a block's own marker between "open" and DONE — the same swap the
 *  server does for the To Dos dashboard's checkoff (see
 *  server/src/vault/toggleMarker.ts), but here as a plain in-memory block
 *  edit, since a block clicked in its normal journal/page view is already
 *  fully loaded — no need to go back to the server to find it. Unchecking
 *  (DONE/CANCELED -> open) always lands on TODO, same simplification as the
 *  dashboard's version. No-ops if the block has no marker at all. */
export function toggleMarker(blocks: EditorBlock[], index: number): EditorBlock[] {
  const b = blocks[index];
  const firstLine = b.source.split("\n", 1)[0] ?? "";
  const m = MARKER_RE.exec(firstLine);
  if (!m) return blocks;
  const [, marker, rest] = m;
  const newMarker = DONE_MARKERS.has(marker) ? "TODO" : "DONE";
  const newFirstLine = rest ? `${newMarker} ${rest}` : newMarker;
  const newSource = newFirstLine + b.source.slice(firstLine.length);
  const next = [...blocks];
  next[index] = withSource(b, newSource);
  return next;
}

export function updateBlockSource(blocks: EditorBlock[], index: number, source: string): EditorBlock[] {
  const next = [...blocks];
  next[index] = withSource(blocks[index], source);
  return next;
}

export function appendBlock(blocks: EditorBlock[], depth: number): { blocks: EditorBlock[]; focus: FocusTarget } {
  const created = makeBlock(depth, "");
  return { blocks: [...blocks, created], focus: { blockId: created.id, pos: 0 } };
}

/** Like appendBlock, but with initial content — used when an image is
 *  dropped with no block focused, so it lands as its own new block rather
 *  than needing an existing one to insert into. */
export function appendBlockWithSource(
  blocks: EditorBlock[],
  depth: number,
  source: string,
): { blocks: EditorBlock[]; focus: FocusTarget } {
  const created = makeBlock(depth, source);
  return { blocks: [...blocks, created], focus: { blockId: created.id, pos: source.length } };
}

/**
 * Deletes a range spanning from (startIndex, startOffset) to (endIndex, endOffset)
 * — used by cut over a selection that spans multiple blocks' static (unfocused)
 * views. The surviving edges (before the start, after the end) are joined into
 * one block at startIndex; every block strictly between, and endIndex itself,
 * is removed. When startIndex === endIndex this reduces to a plain same-block
 * deletion, so no special-casing is needed for the single-block case.
 */
export function deleteRange(
  blocks: EditorBlock[],
  startIndex: number,
  startOffset: number,
  endIndex: number,
  endOffset: number,
): { blocks: EditorBlock[]; focus: FocusTarget } {
  const startBlock = blocks[startIndex];
  const endBlock = blocks[endIndex];
  const merged = withSource(startBlock, startBlock.source.slice(0, startOffset) + endBlock.source.slice(endOffset));
  const next = [...blocks];
  next[startIndex] = merged;
  next.splice(startIndex + 1, endIndex - startIndex);
  return { blocks: next, focus: { blockId: merged.id, pos: startOffset } };
}

/**
 * Pastes text that contains newlines by splitting it into sibling blocks, the
 * same shape you'd get by typing each line and pressing Enter between them.
 * A plain textarea paste can't do this itself — it just drops the clipboard's
 * raw "\n" characters into the one focused block's source, which is exactly
 * what Shift+Enter produces, not what a paste of separately-copied lines should.
 * Single-line pastes (no "\n") aren't routed through here — the browser's
 * default insert-at-caret already does the right thing for those.
 */
export interface PasteEntry {
  depth: number;
  content: string;
}

/**
 * Splices in pasted (depth, content) entries — see pasteMarkdown.ts, which
 * reconstructs these from the source markdown's own indentation and table
 * shape. The first entry's depth always equals the current block's own depth
 * by construction (there's nothing on the indentation stack to compare its
 * leading whitespace against yet), so merging it onto `left` at the current
 * block's existing position is always correct.
 */
export function pasteBlocks(
  blocks: EditorBlock[],
  index: number,
  selStart: number,
  selEnd: number,
  entries: PasteEntry[],
): { blocks: EditorBlock[]; focus: FocusTarget } {
  const b = blocks[index];
  const left = b.source.slice(0, selStart);
  const right = b.source.slice(selEnd);

  const last = entries[entries.length - 1];
  const middle = entries.slice(1, -1);

  const next = [...blocks];
  next[index] = withSource(b, left + entries[0].content);

  const newBlocks = [...middle.map((e) => makeBlock(e.depth, e.content)), makeBlock(last.depth, last.content + right)];
  next.splice(index + 1, 0, ...newBlocks);

  const lastNew = newBlocks[newBlocks.length - 1];
  return { blocks: next, focus: { blockId: lastNew.id, pos: last.content.length } };
}

/** Replaces a [offset, offset+length) range in a block's source — e.g.
 *  accepting a spellcheck suggestion. A plain text edit, not structural. */
export function replaceRange(
  blocks: EditorBlock[],
  index: number,
  offset: number,
  length: number,
  replacement: string,
): { blocks: EditorBlock[]; focus: FocusTarget } {
  const b = blocks[index];
  const newSource = b.source.slice(0, offset) + replacement + b.source.slice(offset + length);
  const next = [...blocks];
  next[index] = withSource(b, newSource);
  return { blocks: next, focus: { blockId: b.id, pos: offset + replacement.length } };
}
