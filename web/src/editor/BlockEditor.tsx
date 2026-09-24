import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useDocStore } from "../state/useDocStore";
import { useUiStore } from "../state/useUiStore";
import { fetchTags } from "../sync/api";
import { flushSave, scheduleSave } from "../sync/autosave";
import { getCaretCoordinates } from "./caretPosition";
import { handleBlockKeyDown } from "./keymap";
import { insertUploadedImage } from "./imageInsert";
import * as ops from "./ops";
import { parsePastedMarkdown } from "./pasteMarkdown";
import { SpellcheckOverlay } from "./SpellcheckOverlay";
import { TagAutocompletePopover } from "./TagAutocompletePopover";
import { detectTagQuery, filterTags, type TagQuery } from "./tagAutocomplete";
import { useBlockSpellCheck } from "./useBlockSpellCheck";
import type { EditorBlock } from "../types/block";

interface Props {
  docId: string;
  index: number;
  block: EditorBlock;
}

export function BlockEditor({ docId, index, block }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingFocus = useUiStore((s) => s.pendingFocus);
  const clearPendingFocus = useUiStore((s) => s.clearPendingFocus);
  const spellcheckEnabled = useUiStore((s) => s.spellcheckEnabled);
  const spellMatches = useBlockSpellCheck(block.id, block.source, spellcheckEnabled);

  // Tag autocomplete. The full tag list is fetched at most once per time the
  // block is focused (lazily, the first time a "#" query actually opens),
  // not on every keystroke — cheap enough to be fresh each time you start a
  // new tag, without hammering the index on every character typed after it.
  const [tagQuery, setTagQuery] = useState<TagQuery | null>(null);
  const [tagMatches, setTagMatches] = useState<string[]>([]);
  const [tagActiveIndex, setTagActiveIndex] = useState(0);
  const [tagAnchor, setTagAnchor] = useState<{ x: number; top: number; bottom: number } | null>(null);
  const allTagsRef = useRef<string[] | null>(null);

  const updateTagQuery = (ta: HTMLTextAreaElement) => {
    const q = detectTagQuery(ta.value, ta.selectionStart);
    if (!q) {
      setTagQuery(null);
      setTagMatches([]);
      setTagAnchor(null);
      return;
    }
    setTagQuery(q);
    setTagActiveIndex(0);
    const coords = getCaretCoordinates(ta, q.start);
    setTagAnchor({ x: coords.left, top: coords.top, bottom: coords.top + coords.height });
    if (allTagsRef.current) {
      setTagMatches(filterTags(allTagsRef.current, q.query));
    } else {
      fetchTags()
        .then((r) => {
          const tags = r.tags.map((t) => t.tag);
          allTagsRef.current = tags;
          setTagMatches(filterTags(tags, q.query));
        })
        .catch(() => {});
    }
  };

  const acceptTag = (tag: string) => {
    const ta = ref.current;
    if (!tagQuery || !ta) return;
    const end = ta.selectionStart;
    const replacement = `#${tag} `;
    const { blocks: nb, focus } = ops.replaceRange(useDocStore.getState().docs[docId].blocks, index, tagQuery.start, end - tagQuery.start, replacement);
    useDocStore.getState().updateBlocks(docId, () => nb, true);
    useUiStore.getState().requestFocus({ docId, blockId: focus.blockId, pos: focus.pos });
    scheduleSave(docId);
    setTagQuery(null);
    setTagMatches([]);
    setTagAnchor(null);
  };

  useLayoutEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${ta.scrollHeight}px`;
  }, [block.source]);

  useEffect(() => {
    const ta = ref.current;
    if (!ta) return;
    if (pendingFocus && pendingFocus.docId === docId && pendingFocus.blockId === block.id) {
      ta.focus();
      const pos = pendingFocus.pos === "end" ? ta.value.length : pendingFocus.pos;
      const end = pendingFocus.selectionLength ? pos + pendingFocus.selectionLength : pos;
      ta.setSelectionRange(pos, end);
      clearPendingFocus();
    }
  }, [pendingFocus, docId, block.id, clearPendingFocus]);

  useEffect(() => {
    // Newly-focused block without an explicit caret request (e.g. clicked into
    // edit mode elsewhere) still gets the textarea focused on mount.
    if (ref.current && document.activeElement !== ref.current) {
      ref.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Cmd-Tabbing away fires a native blur on the textarea even though we never
    // left edit mode — onBlur below detects that case and skips clearing focus,
    // so this block stays mounted as the editor. But the browser doesn't
    // automatically restore actual keyboard focus to it when the window comes
    // back; without this, Cmd-Tabbing back would show the block still "in edit
    // mode" but silently not accepting keystrokes until clicked.
    function handleWindowFocus() {
      const ui = useUiStore.getState();
      if (ui.focusedBlock?.docId === docId && ui.focusedBlock.blockId === block.id) {
        ref.current?.focus();
      }
    }
    window.addEventListener("focus", handleWindowFocus);
    return () => window.removeEventListener("focus", handleWindowFocus);
  }, [docId, block.id]);

  return (
    <div className="mn-spellcheck-wrap">
      {spellcheckEnabled && spellMatches.length > 0 && (
        <SpellcheckOverlay docId={docId} blockId={block.id} index={index} text={block.source} matches={spellMatches} />
      )}
      {tagQuery && tagAnchor && tagMatches.length > 0 && (
        <TagAutocompletePopover
          x={tagAnchor.x}
          top={tagAnchor.top}
          bottom={tagAnchor.bottom}
          matches={tagMatches}
          activeIndex={tagActiveIndex}
          onHover={setTagActiveIndex}
          onSelect={acceptTag}
        />
      )}
      <textarea
        ref={ref}
        className="mn-block-editor"
        value={block.source}
        rows={1}
        spellCheck={false}
        onChange={(e) => {
          const value = e.currentTarget.value;
          useDocStore.getState().updateBlocks(docId, (blocks) => ops.updateBlockSource(blocks, index, value), false);
          scheduleSave(docId);
          updateTagQuery(e.currentTarget);
        }}
        onSelect={(e) => updateTagQuery(e.currentTarget)}
        onKeyDown={(e) => {
          if (tagQuery && tagMatches.length > 0) {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setTagActiveIndex((i) => (i + 1) % tagMatches.length);
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setTagActiveIndex((i) => (i - 1 + tagMatches.length) % tagMatches.length);
              return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
              e.preventDefault();
              acceptTag(tagMatches[tagActiveIndex]);
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setTagQuery(null);
              setTagMatches([]);
              setTagAnchor(null);
              return;
            }
          }
          handleBlockKeyDown(e, docId, index);
        }}
        onPaste={(e) => {
          const imageItem = Array.from(e.clipboardData.items).find((it) => it.type.startsWith("image/"));
          const imageFile = imageItem?.getAsFile();
          if (imageFile) {
            e.preventDefault();
            const ta = e.currentTarget;
            insertUploadedImage(docId, imageFile, {
              blockId: block.id,
              offset: ta.selectionStart,
              length: ta.selectionEnd - ta.selectionStart,
            });
            return;
          }

          const text = e.clipboardData.getData("text/plain");
          if (!text.includes("\n")) return; // default single-line paste is already correct
          e.preventDefault();
          const ta = e.currentTarget;

          // Inside an open code fence, a multi-line paste is literal file
          // content — it must stay newlines-in-one-block, not explode into a
          // sibling block per line like a pasted list would.
          if (ops.isInsideFence(block.source, ta.selectionStart)) {
            const newSource = block.source.slice(0, ta.selectionStart) + text + block.source.slice(ta.selectionEnd);
            const newPos = ta.selectionStart + text.length;
            useDocStore.getState().updateBlocks(docId, (blocks) => ops.updateBlockSource(blocks, index, newSource), true);
            useUiStore.getState().requestFocus({ docId, blockId: block.id, pos: newPos });
            scheduleSave(docId);
            return;
          }

          const entries = parsePastedMarkdown(text, block.depth);
          const { blocks: nb, focus } = ops.pasteBlocks(
            useDocStore.getState().docs[docId].blocks,
            index,
            ta.selectionStart,
            ta.selectionEnd,
            entries,
          );
          useDocStore.getState().updateBlocks(docId, () => nb, true);
          useUiStore.getState().requestFocus({ docId, blockId: focus.blockId, pos: focus.pos });
          scheduleSave(docId);
        }}
        onBlur={() => {
          void flushSave(docId);
          // A window losing OS focus (Cmd-Tab away, clicking another app) fires a
          // native blur here too, even though the user never meant to stop
          // editing — document.hasFocus() is already false by the time this
          // runs in that case, distinguishing it from a real in-page blur (the
          // user clicking a different block or some other UI element), where
          // the window itself stays focused throughout.
          if (!document.hasFocus()) return;
          useUiStore.getState().clearFocusedBlockIfSelf(docId, block.id);
        }}
      />
    </div>
  );
}
