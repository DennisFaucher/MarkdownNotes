// Matches an in-progress "#tagname" ending exactly at the caret — the same
// character set as the real tag regex (see render/renderInline.tsx, derive.ts
// TAG_RE), so whatever gets suggested here is guaranteed to actually parse as
// a tag once accepted. Anchored with $ against the text *before* the caret,
// so typing a space or any other non-tag character naturally stops matching
// and closes the dropdown — no separate "close" detection needed.
const TAG_TYPING_RE = /#([A-Za-z][A-Za-z0-9_\-/]*)$/;

export interface TagQuery {
  /** offset of the "#" itself, so the whole match can be replaced on accept */
  start: number;
  query: string;
}

export function detectTagQuery(text: string, caretPos: number): TagQuery | null {
  const before = text.slice(0, caretPos);
  const m = TAG_TYPING_RE.exec(before);
  if (!m) return null;
  return { start: m.index, query: m[1] };
}

/** Case-insensitive prefix match, exact-length-first so "#Research" ranks
 *  above "#ResearchToDo" for the query "research" — shortest/closest match
 *  first is what you want most of the time. */
export function filterTags(allTags: string[], query: string): string[] {
  const lower = query.toLowerCase();
  return allTags
    .filter((t) => t.toLowerCase().startsWith(lower))
    .sort((a, b) => a.length - b.length || a.localeCompare(b))
    .slice(0, 8);
}
