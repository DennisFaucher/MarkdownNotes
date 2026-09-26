import { useEffect, useRef, useState } from "react";
import { getActiveBlock, noteActiveBlock } from "../editor/activeBlock";
import { indentBlock, outdentBlock } from "../editor/ops";
import { useDocStore } from "../state/useDocStore";
import { useTabsStore } from "../state/useTabsStore";
import { useUiStore } from "../state/useUiStore";
import { scheduleSave } from "../sync/autosave";

type Direction = "in" | "out";

const NUDGE_MS = 320;

/** Promote/demote for the block last in edit mode — the pointer/touch
 *  equivalent of Tab and Shift+Tab, which the Android keyboard has no key for.
 *
 *  Acts on the block recorded in `activeBlock` rather than on live focus,
 *  because tapping either button blurs the textarea (unmounting BlockEditor)
 *  before the click handler can read it. Same order of operations as the Tab
 *  branch in keymap.ts, including reusing the pre-op caret position.
 */
export function IndentButtons() {
  const [nudge, setNudge] = useState<Direction | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const reject = (dir: Direction) => {
    setNudge(dir);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNudge(null), NUDGE_MS);
  };

  const apply = (dir: Direction) => {
    const target = getActiveBlock();
    if (!target) return reject(dir);
    const store = useDocStore.getState();
    const doc = store.docs[target.docId];
    if (!doc) return reject(dir);

    // A single-document view may only touch that document, or a block left over
    // from a background tab gets silently re-indented. The journals feed shows
    // many days at once and has no single current document, so there the block
    // identifies its own — the same fallback FindReplaceBar uses.
    const tabState = useTabsStore.getState();
    const active = tabState.tabs.find((t) => t.key === tabState.activeKey);
    const single =
      active?.target.kind === "page" || active?.target.kind === "journal-day" ? active.target.id : null;
    if (single && single !== target.docId) return reject(dir);

    const index = doc.blocks.findIndex((b) => b.id === target.blockId);
    if (index < 0) return reject(dir); // block was deleted since it was edited

    // Both ops return null when the move is impossible — a depth-0 block can't
    // be promoted, and a block with no preceding sibling at its depth can't be
    // demoted. That makes them the authority on whether the button can act,
    // rather than duplicating the depth rules here.
    const next = dir === "in" ? indentBlock(doc.blocks, index) : outdentBlock(doc.blocks, index);
    if (!next) return reject(dir);

    store.updateBlocks(target.docId, () => next, true);
    scheduleSave(target.docId);
    noteActiveBlock(target.docId, target.blockId, target.pos);
    // Re-entering edit mode is what makes this usable on touch: the block
    // unmounted when the button was tapped, and the user expects to carry on
    // typing where they left off.
    useUiStore.getState().requestFocus({ docId: target.docId, blockId: target.blockId, pos: target.pos });
  };

  return (
    <>
      <button
        type="button"
        className={`mn-indent-btn${nudge === "out" ? " is-nudge" : ""}`}
        title="Promote — outdent (Shift+Tab)"
        aria-label="Promote block (outdent)"
        // Keeps the caret in the block on pointer devices, so the editor is
        // never torn down and remounted just to change an indent. Touch still
        // blurs first; that path is covered by the recorded target above.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => apply("out")}
      >
        ←
      </button>
      <button
        type="button"
        className={`mn-indent-btn${nudge === "in" ? " is-nudge" : ""}`}
        title="Demote — indent (Tab)"
        aria-label="Demote block (indent)"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => apply("in")}
      >
        →
      </button>
    </>
  );
}
