/** The block most recently in edit mode, plus where its caret was.
 *
 *  Deliberately a module singleton rather than store state: the caret moves on
 *  every keystroke, and routing that through zustand would re-render every
 *  subscriber on each character. Only a click handler ever reads this, so
 *  nothing needs to re-render when it changes.
 *
 *  It has to outlive blur. Edit mode is driven by `focusedBlock`, which clears
 *  on blur (BlockEditor's onBlur) and unmounts the editor — and on touch,
 *  tapping a toolbar button blurs the textarea *before* the click handler
 *  runs. So the obvious focus-based target is already null at exactly the
 *  moment these buttons are used, which is the whole reason this exists.
 *
 *  Only BlockEditor writes to it, and only while genuinely in edit mode, so a
 *  recorded block is always one the user really was editing.
 */
export interface ActiveBlock {
  docId: string;
  blockId: string;
  pos: number;
}

let current: ActiveBlock | null = null;

export function noteActiveBlock(docId: string, blockId: string, pos: number): void {
  current = { docId, blockId, pos };
}

export function getActiveBlock(): ActiveBlock | null {
  return current;
}
