import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname } from "node:path";
import { DB_PATH } from "../config.js";

const SCHEMA = `
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  mtime INTEGER NOT NULL,
  hash TEXT NOT NULL
);

CREATE TABLE blocks (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  block_index INTEGER NOT NULL,
  depth INTEGER NOT NULL,
  content TEXT NOT NULL,
  marker TEXT,
  -- Content of the nearest preceding (or own) depth-0 block in the same file —
  -- stamped in at index time so search/tag results can show which top-level
  -- section a nested match belongs to, without a runtime tree-walk.
  top_content TEXT NOT NULL
);
CREATE INDEX idx_blocks_path ON blocks(path);

CREATE VIRTUAL TABLE blocks_fts USING fts5(
  content,
  block_id UNINDEXED,
  path UNINDEXED,
  tokenize = 'unicode61'
);

CREATE TABLE tags (
  tag TEXT NOT NULL,
  block_id TEXT NOT NULL,
  path TEXT NOT NULL
);
CREATE INDEX idx_tags_tag ON tags(tag);

CREATE TABLE links (
  from_path TEXT NOT NULL,
  to_title TEXT NOT NULL
);
CREATE INDEX idx_links_to_title ON links(to_title);
`;

let db: DatabaseSync;

/**
 * The index is disposable — always rebuilt from the markdown vault at startup —
 * so schema changes never need a migration path: just delete the file and
 * recreate it fresh on every boot.
 */
export function openIndex(): DatabaseSync {
  if (db) return db;
  mkdirSync(dirname(DB_PATH), { recursive: true });
  if (existsSync(DB_PATH)) rmSync(DB_PATH);
  db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA);
  return db;
}

export function getIndex(): DatabaseSync {
  if (!db) throw new Error("index not opened yet — call openIndex() first");
  return db;
}
