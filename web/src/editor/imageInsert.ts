import { useDocStore } from "../state/useDocStore";
import { useUiStore } from "../state/useUiStore";
import { scheduleSave } from "../sync/autosave";
import { uploadAsset } from "../sync/api";
import * as ops from "./ops";
import type { EditorBlock } from "../types/block";

/** Whether inserting at [start, end) needs a leading/trailing newline to land
 *  on its own line — an image reference only renders as an actual image when
 *  its line contains nothing else (see the image-line detection in
 *  derive.ts), so pasting one mid-sentence, or dropping one after existing
 *  text, would otherwise silently insert dead markdown text instead of a
 *  visible image. */
function lineIsolation(source: string, start: number, end: number): { prefix: string; suffix: string } {
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  const nextNewline = source.indexOf("\n", end);
  const lineEnd = nextNewline === -1 ? source.length : nextNewline;
  const before = source.slice(lineStart, start);
  const after = source.slice(end, lineEnd);
  return {
    prefix: before.trim().length > 0 ? "\n" : "",
    suffix: after.trim().length > 0 ? "\n" : "",
  };
}

/** Uploads an image and inserts a markdown reference for it, either spliced
 *  into an existing block at a given offset (a paste, or a drop landing on
 *  the currently-focused block) or as a brand-new block (a drop with nothing
 *  focused). Shared by BlockEditor's paste handler and BlockTree's drop
 *  handler.
 *
 *  A placeholder is inserted immediately and replaced once the upload
 *  finishes — uploads aren't instant, and matching by the placeholder's own
 *  text (rather than a remembered offset) means it still lands correctly
 *  even if the user kept typing around it in the meantime. If they deleted
 *  the placeholder before the upload finished, the result is just dropped. */
export function insertUploadedImage(
  docId: string,
  file: File,
  target: { blockId: string; offset: number; length?: number } | { depth: number },
): void {
  const placeholderBody = `![Uploading ${file.name || "image"}…]()`;
  const blocks0 = useDocStore.getState().docs[docId].blocks;
  let blockId: string;
  let prefix = "";
  let suffix = "";

  if ("blockId" in target) {
    const index = blocks0.findIndex((b) => b.id === target.blockId);
    if (index === -1) return; // focused block vanished between the drop/paste and here
    const b: EditorBlock = blocks0[index];
    const start = target.offset;
    const length = target.length ?? 0;
    ({ prefix, suffix } = lineIsolation(b.source, start, start + length));
    const placeholder = `${prefix}${placeholderBody}${suffix}`;
    const { blocks: nb, focus } = ops.replaceRange(blocks0, index, start, length, placeholder);
    useDocStore.getState().updateBlocks(docId, () => nb, true);
    useUiStore.getState().requestFocus({ docId, blockId: focus.blockId, pos: focus.pos });
    blockId = focus.blockId;
  } else {
    const { blocks: nb, focus } = ops.appendBlockWithSource(blocks0, target.depth, placeholderBody);
    useDocStore.getState().updateBlocks(docId, () => nb, true);
    useUiStore.getState().requestFocus({ docId, blockId: focus.blockId, pos: focus.pos });
    blockId = focus.blockId;
  }
  scheduleSave(docId);

  const fullPlaceholder = `${prefix}${placeholderBody}${suffix}`;
  const replacePlaceholder = (replacement: string) => {
    const blocks = useDocStore.getState().docs[docId].blocks;
    const index = blocks.findIndex((b) => b.id === blockId);
    if (index === -1) return;
    const pos = blocks[index].source.indexOf(fullPlaceholder);
    if (pos === -1) return; // edited away before the upload settled
    const { blocks: nb } = ops.replaceRange(blocks, index, pos, fullPlaceholder.length, `${prefix}${replacement}${suffix}`);
    useDocStore.getState().updateBlocks(docId, () => nb, false);
    scheduleSave(docId);
  };

  uploadAsset(file)
    .then(({ path }) => replacePlaceholder(`![${file.name || "image"}](../${path})`))
    .catch(() => replacePlaceholder(`![upload failed: ${file.name || "image"}]()`));
}
