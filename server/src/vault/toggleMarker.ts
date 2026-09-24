import { mkdir, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseDoc } from "../markdown/tokenize.js";
import { serializeDoc } from "../markdown/serialize.js";
import { readRaw } from "./write.js";

const MARKER_RE = /^(TODO|DONE|NOW|LATER|DOING|WAITING|CANCELED)(?:\s+(.*))?$/;
const DONE_MARKERS = new Set(["DONE", "CANCELED"]);

export class BlockNotFoundError extends Error {}

/**
 * Flips a block's marker between "open" (TODO/DOING/NOW/LATER/WAITING) and
 * DONE — checking off a to-do just changes this one word in place, so the
 * block and its full text stay exactly where they were for later reference,
 * never deleted. Unchecking (DONE/CANCELED -> open) always lands on TODO,
 * losing a finer original sub-state like DOING/LATER — a deliberate
 * simplification for what's meant to be a simple checkbox click, not a full
 * marker-cycling control.
 *
 * Located by (path, blockIndex) rather than a block id: ids are freshly
 * randomized on every parse (see markdown/tokenize.ts), so they aren't
 * stable across the separate requests a "load the list, then click one"
 * flow needs. block_index is stable as long as nothing else restructures
 * the file in between, which is what the to-do dashboard actually needs.
 */
export async function toggleBlockMarker(absPath: string, blockIndex: number): Promise<{ marker: string }> {
  const raw = await readRaw(absPath);
  if (raw === null) throw new BlockNotFoundError(`file not found: ${absPath}`);
  const doc = parseDoc(raw);
  const block = doc.blocks[blockIndex];
  if (!block) throw new BlockNotFoundError(`no block at index ${blockIndex} in ${absPath}`);

  const m = MARKER_RE.exec(block.firstLine);
  if (!m) throw new BlockNotFoundError(`block at index ${blockIndex} in ${absPath} has no marker`);
  const [, marker, rest] = m;
  const newMarker = DONE_MARKERS.has(marker) ? "TODO" : "DONE";
  block.firstLine = rest ? `${newMarker} ${rest}` : newMarker;

  const out = serializeDoc(doc);
  const reserialized = serializeDoc(parseDoc(out));
  if (reserialized !== out) {
    throw new Error("refusing to write: markdown failed its own round-trip check");
  }

  await mkdir(dirname(absPath), { recursive: true });
  const tmpPath = `${absPath}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(tmpPath, out, "utf8");
  await rename(tmpPath, absPath);

  return { marker: newMarker };
}
