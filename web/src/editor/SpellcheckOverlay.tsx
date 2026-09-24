import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDocStore } from "../state/useDocStore";
import { useSpellStore } from "../state/useSpellStore";
import { useUiStore } from "../state/useUiStore";
import { scheduleSave } from "../sync/autosave";
import * as ops from "./ops";
import { usePopoverPosition } from "./usePopoverPosition";
import { addToDictionary, type SpellMatch } from "../sync/api";

interface Props {
  docId: string;
  blockId: string;
  index: number;
  text: string;
  matches: SpellMatch[];
}

interface OpenPopover {
  match: SpellMatch;
  x: number;
  // The clicked word's own rect, not a pre-computed popover position — final
  // placement (below vs. flipped above, when below would overflow the
  // viewport) is worked out post-render, once the popover's actual size is
  // known. See the positioning useLayoutEffect below.
  wordTop: number;
  wordBottom: number;
}

/**
 * Sits behind the block's textarea (same font/padding, transparent text —
 * see .mn-spellcheck-backdrop), drawing wavy underlines under LanguageTool
 * matches so they appear to be part of the textarea's own text. The textarea
 * itself has a transparent background, so this shows through underneath
 * whatever's actually typed. Only the underlined spans have pointer-events —
 * everywhere else, clicks pass straight through to the textarea for normal
 * caret placement.
 */
export function SpellcheckOverlay({ docId, blockId, index, text, matches }: Props) {
  const [open, setOpen] = useState<OpenPopover | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Consumes the one-shot request set when a misspelled word was clicked in
    // this block's *static* rendering (see BlockRow/BlockStatic) — that click
    // both entered edit mode and asked for the popover to open immediately,
    // rather than requiring a second click now that the interactive overlay
    // exists. The clicked mark's own data-spell-offset (stamped by
    // renderInline) is how we find the right DOM node here to position it.
    const pending = useUiStore.getState().pendingSpellOpen;
    if (!pending || pending.docId !== docId || pending.blockId !== blockId) return;
    useUiStore.getState().clearPendingSpellOpen();
    const match = matches.find((m) => m.offset === pending.offset);
    const markEl = containerRef.current?.querySelector<HTMLElement>(`[data-spell-offset="${pending.offset}"]`);
    if (!match || !markEl) return;
    const rect = markEl.getBoundingClientRect();
    setOpen({ match, x: rect.left, wordTop: rect.top, wordBottom: rect.bottom });
    // Runs once per mount — this popover only auto-opens for the click that
    // caused this component to exist in the first place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Defaults to opening below the word; a word near the bottom of a long
  // page would otherwise push part of the popover (suggestions, the Add to
  // Dictionary button) past the viewport edge and out of clickable range.
  usePopoverPosition(popoverRef, open ? { x: open.x, top: open.wordTop, bottom: open.wordBottom } : null, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(null);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
    }
    // Deferred via setTimeout: React 18 flushes this effect synchronously
    // while the mousedown that just opened the popover is still bubbling up
    // toward document (it's a discrete event). Attaching these listeners
    // immediately would let that same mousedown's bubble phase reach this
    // handler and close the popover the instant it opened.
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const applyReplacement = (match: SpellMatch, replacement: string) => {
    const store = useDocStore.getState();
    const blocks = store.docs[docId].blocks;
    const { blocks: nb, focus } = ops.replaceRange(blocks, index, match.offset, match.length, replacement);
    store.updateBlocks(docId, () => nb, false);
    useUiStore.getState().requestFocus({ docId, blockId: focus.blockId, pos: focus.pos });
    scheduleSave(docId);
    setOpen(null);
  };

  // Persists to the vault-backed dictionary (server/src/vault/dictionary.ts)
  // so future spellcheck requests never flag this word again — for anyone
  // using this vault, not just this browser tab. Clearing it from every
  // block's cached matches immediately (rather than waiting for their next
  // debounced re-check) is purely a client-side UX nicety on top of that.
  const addWordToDictionary = (match: SpellMatch) => {
    const word = text.slice(match.offset, match.offset + match.length);
    addToDictionary(word).catch(() => {
      // best-effort — an unreachable server just means it'll get flagged
      // again next time, not a broken editing experience
    });
    useSpellStore.getState().removeWordEverywhere(word);
    setOpen(null);
  };

  const sorted = [...matches].sort((a, b) => a.offset - b.offset);
  const nodes: ReactNode[] = [];
  let last = 0;
  sorted.forEach((m, i) => {
    if (m.offset < last) return; // overlapping match — keep it simple, first one wins
    if (m.offset > last) nodes.push(<span key={`t${i}`}>{text.slice(last, m.offset)}</span>);
    const end = m.offset + m.length;
    const cls = m.issueType === "misspelling" ? "mn-spell-misspelling" : "mn-spell-other";
    nodes.push(
      <mark
        key={`m${i}`}
        className={`mn-spell-mark ${cls}`}
        data-spell-offset={m.offset}
        onMouseDown={(e) => {
          e.preventDefault();
          const rect = e.currentTarget.getBoundingClientRect();
          setOpen({ match: m, x: rect.left, wordTop: rect.top, wordBottom: rect.bottom });
        }}
      >
        {text.slice(m.offset, end)}
      </mark>,
    );
    last = end;
  });
  if (last < text.length) nodes.push(<span key="tail">{text.slice(last)}</span>);

  return (
    <div ref={containerRef} className="mn-spellcheck-backdrop" aria-hidden="true">
      {nodes}
      {open &&
        createPortal(
          // Portalled straight to <body>: a journal day section is styled
          // content-visibility: auto for virtualization (see app.css), which
          // implicitly applies contain: paint — and per spec that makes the
          // section a containing block for any position:fixed descendant.
          // Left in place, the popover would be "fixed" relative to that
          // section's box instead of the real viewport, landing thousands of
          // pixels off-screen on a long, scrolled page. Escaping via portal
          // sidesteps the containment entirely.
          <div ref={popoverRef} className="mn-spell-popover" style={{ left: open.x, top: open.wordBottom + 4 }}>
            <div className="mn-spell-popover-message">{open.match.shortMessage}</div>
            {open.match.replacements.length > 0 ? (
              <div className="mn-spell-popover-suggestions">
                {open.match.replacements.map((r, i) => (
                  <button key={i} onMouseDown={(e) => e.preventDefault()} onClick={() => applyReplacement(open.match, r)}>
                    {r}
                  </button>
                ))}
              </div>
            ) : (
              <div className="mn-spell-popover-none">No suggestions</div>
            )}
            {open.match.issueType === "misspelling" && (
              <button
                className="mn-spell-popover-add-word"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addWordToDictionary(open.match)}
              >
                Add to Dictionary
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
