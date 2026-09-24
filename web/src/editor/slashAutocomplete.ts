// Matches an in-progress "/name" that starts at the very beginning of the
// block's own text — unlike the "#tag" trigger (which can appear anywhere),
// this is deliberately anchored to position 0 so that ordinary text
// containing a slash (a URL, "and/or") never opens the menu. That matches
// the one real use case (typing "/" into a brand-new empty block to insert a
// template) without needing any "was this a fresh keystroke vs. pasted"
// tracking.
const SLASH_TYPING_RE = /^\/([A-Za-z0-9_-]*)$/;

export interface SlashQuery {
  /** Always 0 — kept for symmetry with TagQuery's "start", and so callers
   *  don't need to special-case the offset when replacing the match. */
  start: number;
  query: string;
}

export function detectSlashQuery(text: string, caretPos: number): SlashQuery | null {
  const before = text.slice(0, caretPos);
  const m = SLASH_TYPING_RE.exec(before);
  if (!m) return null;
  return { start: 0, query: m[1] };
}
