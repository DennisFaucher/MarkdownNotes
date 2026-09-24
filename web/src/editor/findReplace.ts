import type { EditorBlock } from "../types/block";

export interface FindMatch {
  blockIndex: number;
  blockId: string;
  offset: number;
  length: number;
}

/** Every occurrence of `query` across a doc's blocks, in document order — a
 *  block's own source is searched as one string, so a match never crosses a
 *  block boundary (matching how a "block" is the unit of editing anyway). */
export function findMatches(blocks: EditorBlock[], query: string, caseSensitive: boolean): FindMatch[] {
  if (!query) return [];
  const matches: FindMatch[] = [];
  blocks.forEach((b, blockIndex) => {
    for (const offset of indexesOf(b.source, query, caseSensitive)) {
      matches.push({ blockIndex, blockId: b.id, offset, length: query.length });
    }
  });
  return matches;
}

/** Plain substring replace-all — deliberately not regex-based, since `query`
 *  is arbitrary user text and building a RegExp from it directly would treat
 *  regex metacharacters (e.g. a literal "." in a URL) as patterns. */
export function replaceAllInString(source: string, query: string, replacement: string, caseSensitive: boolean): string {
  const indexes = indexesOf(source, query, caseSensitive);
  if (indexes.length === 0) return source;
  let result = "";
  let last = 0;
  for (const idx of indexes) {
    result += source.slice(last, idx) + replacement;
    last = idx + query.length;
  }
  result += source.slice(last);
  return result;
}

function indexesOf(haystack: string, needle: string, caseSensitive: boolean): number[] {
  if (!needle) return [];
  const hay = caseSensitive ? haystack : haystack.toLowerCase();
  const q = caseSensitive ? needle : needle.toLowerCase();
  const indexes: number[] = [];
  let from = 0;
  while (from <= hay.length) {
    const idx = hay.indexOf(q, from);
    if (idx === -1) break;
    indexes.push(idx);
    from = idx + q.length;
  }
  return indexes;
}
