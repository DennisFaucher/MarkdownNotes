import { useDocStore } from "../state/useDocStore";
import { useUiStore } from "../state/useUiStore";
import { scheduleSave } from "../sync/autosave";
import { BlockEditor } from "./BlockEditor";
import { BlockStatic } from "./BlockStatic";
import { hasChildren, toggleCollapse, toggleMarker, updateBlockSource } from "./ops";
import type { EditorBlock } from "../types/block";

interface Props {
  docId: string;
  index: number;
  block: EditorBlock;
  allBlocks: EditorBlock[];
}

export function BlockRow({ docId, index, block, allBlocks }: Props) {
  const isFocused = useUiStore((s) => s.focusedBlock?.docId === docId && s.focusedBlock.blockId === block.id);
  const requestFocus = useUiStore((s) => s.requestFocus);
  const canCollapse = hasChildren(allBlocks, index);

  return (
    <div className="mn-block-row" style={{ marginLeft: block.depth * 22 }}>
      <span
        className={`mn-collapse-caret${canCollapse ? " mn-has-children" : ""}${block.collapsed ? " mn-collapsed" : ""}`}
        onMouseDown={(e) => {
          e.preventDefault();
          if (!canCollapse) return;
          useDocStore.getState().updateBlocks(docId, (blocks) => toggleCollapse(blocks, index), true);
        }}
      >
        {canCollapse ? "▸" : ""}
      </span>
      <span className="mn-bullet" />
      <div className="mn-block-content">
        {isFocused ? (
          <BlockEditor docId={docId} index={index} block={block} />
        ) : (
          <BlockStatic
            blockId={block.id}
            source={block.source}
            marker={block.marker}
            onEnterEdit={(pos, spellMatchOffset) => {
              requestFocus({ docId, blockId: block.id, pos });
              if (spellMatchOffset !== undefined) {
                useUiStore.getState().requestSpellOpen({ docId, blockId: block.id, offset: spellMatchOffset });
              }
            }}
            onResizeImage={(start, end, replacement) => {
              const newSource = block.source.slice(0, start) + replacement + block.source.slice(end);
              useDocStore.getState().updateBlocks(docId, (blocks) => updateBlockSource(blocks, index, newSource), true);
              scheduleSave(docId);
            }}
            onToggleMarker={() => {
              useDocStore.getState().updateBlocks(docId, (blocks) => toggleMarker(blocks, index), true);
              scheduleSave(docId);
            }}
          />
        )}
      </div>
    </div>
  );
}
