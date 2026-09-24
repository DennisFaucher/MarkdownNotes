import { useEffect, useRef, useState } from "react";
import { useDocStore } from "../state/useDocStore";
import { useTabsStore } from "../state/useTabsStore";
import { useUiStore } from "../state/useUiStore";
import { scheduleSave } from "../sync/autosave";
import { findMatches, type FindMatch } from "./findReplace";
import * as ops from "./ops";

/** Jumps a match into view: expands any collapsed ancestor so its block is
 *  actually mounted, then focuses it with the match text selected — the
 *  selection itself is the "highlight", reusing the textarea's native one
 *  rather than building a separate overlay for it. */
function jumpTo(docId: string, m: FindMatch) {
  const blocks = useDocStore.getState().docs[docId]?.blocks;
  if (!blocks) return;
  const expanded = ops.ensureVisible(blocks, m.blockIndex);
  if (expanded !== blocks) {
    useDocStore.getState().updateBlocks(docId, () => expanded, false);
    scheduleSave(docId);
  }
  // Expanding a collapsed ancestor mounts new BlockEditor/BlockStatic rows —
  // give React a frame to commit that before requesting focus on one of them.
  requestAnimationFrame(() => {
    useUiStore.getState().requestFocus({ docId, blockId: m.blockId, pos: m.offset, selectionLength: m.length });
  });
}

export function FindReplaceBar() {
  const open = useUiStore((s) => s.findReplaceOpen);
  const closeFindReplace = useUiStore((s) => s.closeFindReplace);
  const tabs = useTabsStore((s) => s.tabs);
  const activeKey = useTabsStore((s) => s.activeKey);
  const focusedDocId = useUiStore((s) => s.focusedBlock?.docId ?? null);
  const active = tabs.find((t) => t.key === activeKey);
  const docId =
    active?.target.kind === "page" || active?.target.kind === "journal-day"
      ? active.target.id
      : active?.target.kind === "journals"
        ? focusedDocId
        : null;
  const doc = useDocStore((s) => (docId ? s.docs[docId] : undefined));

  const [query, setQuery] = useState("");
  const [replacement, setReplacement] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [matchIndex, setMatchIndex] = useState(0);
  const queryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setMatchIndex(0);
      requestAnimationFrame(() => queryInputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // A container-level onKeyDown can't catch this: clicking "Replace All"
    // disables that same button once it hits 0 remaining matches, and a
    // disabled element can't hold focus — it reverts to document.body,
    // outside the bar's DOM subtree, so bubbling never reaches it.
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") useUiStore.getState().closeFindReplace();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  if (!open) return null;

  if (!doc || !docId) {
    return (
      <div className="mn-findreplace-bar">
        <span className="mn-findreplace-empty">Open a journal entry or page to find &amp; replace</span>
        <button className="mn-findreplace-close" onClick={closeFindReplace} title="Close (Esc)">
          ✕
        </button>
      </div>
    );
  }

  const matches = findMatches(doc.blocks, query, caseSensitive);
  const clampedIndex = matches.length ? ((matchIndex % matches.length) + matches.length) % matches.length : 0;
  const current = matches[clampedIndex];

  const goNext = () => {
    if (!matches.length) return;
    const next = (clampedIndex + 1) % matches.length;
    setMatchIndex(next);
    jumpTo(docId, matches[next]);
  };

  const goPrev = () => {
    if (!matches.length) return;
    const prev = (clampedIndex - 1 + matches.length) % matches.length;
    setMatchIndex(prev);
    jumpTo(docId, matches[prev]);
  };

  const replaceCurrent = () => {
    if (!current) return;
    const freshBlocks = useDocStore.getState().docs[docId]!.blocks;
    const { blocks: nb } = ops.replaceRange(freshBlocks, current.blockIndex, current.offset, current.length, replacement);
    useDocStore.getState().updateBlocks(docId, () => nb, false);
    scheduleSave(docId);
    // The replaced match is gone, so whatever was next has shifted into this
    // same slot — stay put rather than advancing, so repeated clicks replace
    // one-after-another instead of skipping every other match.
    requestAnimationFrame(() => {
      const fresh = findMatches(useDocStore.getState().docs[docId]!.blocks, query, caseSensitive);
      if (fresh.length) jumpTo(docId, fresh[clampedIndex % fresh.length]);
    });
  };

  const replaceAll = () => {
    if (!query) return;
    useDocStore.getState().updateBlocks(docId, (blocks) => ops.replaceAll(blocks, query, replacement, caseSensitive), true);
    scheduleSave(docId);
    setMatchIndex(0);
  };

  return (
    <div
      className="mn-findreplace-bar"
      onKeyDown={(e) => {
        // Attached here rather than on each input so Escape still works when
        // focus is on one of the buttons (e.g. right after clicking "Replace
        // All") — keydown bubbles up to this container regardless of which
        // child triggered it.
        if (e.key === "Escape") closeFindReplace();
      }}
    >
      <input
        ref={queryInputRef}
        className="mn-findreplace-input"
        placeholder="Find"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setMatchIndex(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.shiftKey) {
            e.preventDefault();
            goPrev();
          } else if (e.key === "Enter") {
            e.preventDefault();
            goNext();
          }
        }}
      />
      <span className="mn-findreplace-count">{matches.length ? `${clampedIndex + 1} of ${matches.length}` : query ? "0 matches" : ""}</span>
      <button onClick={goPrev} disabled={!matches.length} title="Previous match (Shift+Enter)">
        ↑
      </button>
      <button onClick={goNext} disabled={!matches.length} title="Next match (Enter)">
        ↓
      </button>
      <input
        className="mn-findreplace-input"
        placeholder="Replace"
        value={replacement}
        onChange={(e) => setReplacement(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            replaceCurrent();
          }
        }}
      />
      <button onClick={replaceCurrent} disabled={!current}>
        Replace
      </button>
      <button onClick={replaceAll} disabled={!matches.length}>
        Replace All
      </button>
      <label className="mn-findreplace-case">
        <input
          type="checkbox"
          checked={caseSensitive}
          onChange={(e) => {
            setCaseSensitive(e.target.checked);
            setMatchIndex(0);
          }}
        />
        Case sensitive
      </label>
      <button className="mn-findreplace-close" onClick={closeFindReplace} title="Close (Esc)">
        ✕
      </button>
    </div>
  );
}
