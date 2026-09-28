/** Whether a query is a single bare `#tag`, which is the one shape that gets
 *  date ordering instead of bm25 relevance.
 *
 *  Kept dependency-free (no db import) in its own module so it unit-tests
 *  without pulling in node:sqlite — the test runner can't resolve `sqlite`.
 *  search.ts imports it from here; see that file for why. */

const BARE_TAG_RE = /^#[^\s#]+$/;

export function isBareTagQuery(query: string): boolean {
  return BARE_TAG_RE.test(query.trim());
}
