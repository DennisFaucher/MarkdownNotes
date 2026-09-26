/** Sync tools (Resilio) drop `*.conflict-<ISO>.md` siblings next to a journal
 *  when the same file gets edited on two machines at once. They exist only as a
 *  merge record and are never meant to be read as notes.
 *
 *  Kept in its own dependency-free module so it can be unit-tested without
 *  pulling in the SQLite layer, and so the two places that must agree on it —
 *  this filter (startup rebuild) and the watcher's `ignored` option — have one
 *  shared definition rather than two independent string checks that can drift.
 */
export function isIndexableFile(f: string): boolean {
  return f.endsWith(".md") && !f.includes(".conflict-");
}
