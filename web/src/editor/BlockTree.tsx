import type { DragEvent } from "react";
import { useDocStore } from "../state/useDocStore";
import { useUiStore } from "../state/useUiStore";
import { BlockRow } from "./BlockRow";
import { ConflictBanner } from "./ConflictBanner";
import { insertUploadedImage } from "./imageInsert";
import { appendBlock, getVisibleIndices } from "./ops";

/** A drop lands in the currently-focused block (appended after its existing
 *  text, on its own line) if there is one focused in this doc, otherwise as
 *  a new block at the end — dropping doesn't carry a text caret position to
 *  target more precisely than that. */
function handleImageDrop(e: DragEvent<HTMLDivElement>, docId: string) {
  const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
  if (files.length === 0) return;
  e.preventDefault();
  const focused = useUiStore.getState().focusedBlock;
  for (const file of files) {
    const current = useDocStore.getState().docs[docId].blocks;
    const focusedBlock = focused?.docId === docId ? current.find((b) => b.id === focused.blockId) : undefined;
    if (focusedBlock) {
      insertUploadedImage(docId, file, { blockId: focusedBlock.id, offset: focusedBlock.source.length });
    } else {
      const lastDepth = current.length > 0 ? current[current.length - 1].depth : 0;
      insertUploadedImage(docId, file, { depth: lastDepth });
    }
  }
}

export function BlockTree({ docId }: { docId: string }) {
  const doc = useDocStore((s) => s.docs[docId]);
  const requestFocus = useUiStore((s) => s.requestFocus);
  if (!doc) return null;
  const visible = getVisibleIndices(doc.blocks);

  if (doc.blocks.length === 0) {
    return (
      <>
        {doc.conflict && <ConflictBanner doc={doc} />}
        <div
          className="mn-block-tree mn-empty-doc"
          onMouseDown={(e) => {
            e.preventDefault();
            const { blocks, focus } = appendBlock(doc.blocks, 0);
            useDocStore.getState().updateBlocks(docId, () => blocks, true);
            requestFocus({ docId, blockId: focus.blockId, pos: focus.pos });
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleImageDrop(e, docId)}
        >
          Click to start writing…
        </div>
      </>
    );
  }

  return (
    <div className="mn-block-tree" onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleImageDrop(e, docId)}>
      {doc.conflict && <ConflictBanner doc={doc} />}
      {visible.map((index) => (
        <BlockRow key={doc.blocks[index].id} docId={docId} index={index} block={doc.blocks[index]} allBlocks={doc.blocks} />
      ))}
      <div
        className="mn-tree-end-spacer"
        onMouseDown={(e) => {
          e.preventDefault();
          const lastDepth = doc.blocks[doc.blocks.length - 1].depth;
          const { blocks, focus } = appendBlock(doc.blocks, lastDepth);
          useDocStore.getState().updateBlocks(docId, () => blocks, true);
          requestFocus({ docId, blockId: focus.blockId, pos: focus.pos });
        }}
      />
    </div>
  );
}
