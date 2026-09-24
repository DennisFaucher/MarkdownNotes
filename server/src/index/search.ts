import { getIndex } from "./db.js";

export interface SearchResult {
  blockId: string;
  path: string;
  pageTitle: string;
  pageKind: "journal" | "page";
  snippet: string;
  // The matched block's enclosing top-level (depth-0) block content — e.g. a
  // journal day's "### Collins Intro" heading — so a nested match can show
  // which section it belongs to. Equals the matched block's own content when
  // depth is 0; the client skips rendering the breadcrumb in that case.
  topContent: string;
  depth: number;
}

/** Escapes a raw user query into an FTS5 string-literal match — treats the
 *  whole input as literal text rather than FTS5's query syntax (AND/OR/NOT,
 *  column filters, etc.), which would otherwise throw on ordinary punctuation
 *  a note-taking search box should just accept. */
function toFtsQuery(q: string): string {
  return `"${q.replace(/"/g, '""')}"`;
}

// Sentinel control characters, not HTML tags — snippet() returns note content
// verbatim with no escaping, so wrapping matches in literal "<mark>" here and
// trusting the client to render it as HTML would let a note containing literal
// "<"/">" (a code sample, a math comparison) inject arbitrary markup. Using
// non-printing sentinels instead means the client can safely split on them and
// build real, auto-escaped <mark> elements rather than raw HTML.
const SNIPPET_START = "\u0001";
const SNIPPET_END = "\u0002";

export function searchBlocks(query: string, limit = 30): SearchResult[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const db = getIndex();
  const rows = db
    .prepare(
      `SELECT blocks_fts.block_id AS blockId, blocks_fts.path AS path, files.title AS pageTitle, files.kind AS pageKind,
              snippet(blocks_fts, 0, ?, ?, '…', 12) AS snippet, blocks.top_content AS topContent, blocks.depth AS depth
       FROM blocks_fts
       JOIN files ON files.path = blocks_fts.path
       JOIN blocks ON blocks.id = blocks_fts.block_id
       WHERE blocks_fts MATCH ?
       ORDER BY rank
       LIMIT ?`,
    )
    .all(SNIPPET_START, SNIPPET_END, toFtsQuery(trimmed), limit) as unknown as SearchResult[];
  return rows;
}

export interface TagSummary {
  tag: string;
  count: number;
}

export function listTags(): TagSummary[] {
  const db = getIndex();
  return db
    .prepare("SELECT tag, COUNT(*) AS count FROM tags GROUP BY tag ORDER BY count DESC, tag ASC")
    .all() as unknown as TagSummary[];
}

export interface TaggedBlock {
  blockId: string;
  path: string;
  pageTitle: string;
  pageKind: "journal" | "page";
  content: string;
  topContent: string;
  depth: number;
}

export function getBlocksForTag(tag: string): TaggedBlock[] {
  const db = getIndex();
  return db
    .prepare(
      `SELECT blocks.id AS blockId, blocks.path AS path, blocks.content AS content, blocks.top_content AS topContent, blocks.depth AS depth,
              files.title AS pageTitle, files.kind AS pageKind
       FROM tags
       JOIN blocks ON blocks.id = tags.block_id
       JOIN files ON files.path = tags.path
       WHERE tags.tag = ?
       ORDER BY files.kind ASC, files.path DESC, blocks.block_index ASC`,
    )
    .all(tag) as unknown as TaggedBlock[];
}

const OPEN_MARKERS = ["TODO", "DOING", "NOW", "LATER", "WAITING"];

export interface TodoItem {
  path: string;
  blockIndex: number;
  marker: string;
  content: string;
  topContent: string;
  depth: number;
  pageTitle: string;
  pageKind: "journal" | "page";
  /** Whichever of the block's tags ends in "ToDo" (case-insensitive), e.g.
   *  #WWTToDo — the grouping key for the dashboard. null if the block has no
   *  such tag, grouped under "Uncategorized" client-side. A block with two
   *  such tags surfaces once per tag; rare enough not to special-case. */
  category: string | null;
}

/**
 * Every open (non-DONE, non-CANCELED) TODO/DOING/NOW/LATER/WAITING block
 * across the whole vault, for the "To Dos" dashboard — grouped client-side
 * by `category`. block_index (not block id — see vault/toggleMarker.ts for
 * why) is what a later "check off" click uses to find this exact block
 * again.
 */
export function getOpenTodos(): TodoItem[] {
  const db = getIndex();
  const placeholders = OPEN_MARKERS.map(() => "?").join(", ");
  const rows = db
    .prepare(
      `SELECT blocks.path AS path, blocks.block_index AS blockIndex, blocks.marker AS marker,
              blocks.content AS content, blocks.top_content AS topContent, blocks.depth AS depth,
              files.title AS pageTitle, files.kind AS pageKind,
              GROUP_CONCAT(tags.tag) AS allTags
       FROM blocks
       JOIN files ON files.path = blocks.path
       LEFT JOIN tags ON tags.block_id = blocks.id
       WHERE blocks.marker IN (${placeholders})
       GROUP BY blocks.id
       ORDER BY files.kind ASC, files.path DESC, blocks.block_index ASC`,
    )
    .all(...OPEN_MARKERS) as unknown as (Omit<TodoItem, "category"> & { allTags: string | null })[];

  return rows.map(({ allTags, ...row }) => {
    const tags = allTags ? allTags.split(",") : [];
    const category = tags.find((t) => /todo$/i.test(t)) ?? null;
    return { ...row, category };
  });
}
