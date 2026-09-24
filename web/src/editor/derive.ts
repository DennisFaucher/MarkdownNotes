import type { ApiBlock, EditorBlock } from "../types/block";

const MARKER_RE = /^(TODO|DONE|NOW|LATER|DOING|WAITING|CANCELED)(?:\s+(.*))?$/;
const TAG_RE = /#([A-Za-z][A-Za-z0-9_\-/]*)/g;
const PAGEREF_RE = /\[\[([^\]]+)\]\]/g;

export function sourceOf(block: ApiBlock): string {
  return [block.firstLine, ...block.contLines.map((c) => c.text)].join("\n");
}

export function apiBlockToEditorBlock(b: ApiBlock): EditorBlock {
  const source = sourceOf(b);
  return {
    id: b.id,
    depth: b.depth,
    source,
    originalContLines: b.contLines,
    originalBulletEmpty: b.bulletEmpty,
    dirty: false,
    collapsed: b.derived.collapsed,
    marker: b.derived.marker,
    tags: b.derived.tags,
    refs: b.derived.refs,
  };
}

export function deriveFromSource(source: string): { marker?: string; text: string; tags: string[]; refs: string[] } {
  const firstLine = source.split("\n", 1)[0] ?? "";
  const mm = MARKER_RE.exec(firstLine);
  const marker = mm?.[1];
  const text = mm ? (mm[2] ?? "") : firstLine;
  const tags = [...source.matchAll(TAG_RE)].map((m) => m[1]);
  const refs = [...source.matchAll(PAGEREF_RE)].map((m) => m[1]);
  return { marker, text, tags, refs };
}

/**
 * crypto.randomUUID() only exists in "secure contexts" (HTTPS, or the special-
 * cased "localhost") — this app is commonly self-hosted and reached over
 * plain HTTP at a LAN IP, which browsers treat as insecure, so it's simply
 * undefined there and every block-creating action (new block, Enter, a new
 * page) would silently fail. Block IDs don't need cryptographic randomness,
 * just uniqueness, so this falls back to crypto.getRandomValues() — which,
 * unlike randomUUID(), is available in every context — formatted as a v4 UUID.
 */
export function newBlockId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const PROPERTY_RE = /^[A-Za-z][A-Za-z0-9_\-.\/]*:: ?.*$/;

export interface DisplayLine {
  text: string;
  /** absolute offset in `source` where `text` begins — marker prefix already excluded */
  sourceOffset: number;
}

/**
 * Lines to actually render for a block's static view — properties/drawers stay in
 * source (for persistence) but are hidden from display, matching Logseq's UI.
 * Each line carries the absolute source offset it starts at, so a click resolved
 * against the rendered text can be translated straight back into a raw-markdown
 * caret position (see BlockStatic).
 */
export function getDisplayLines(source: string): DisplayLine[] {
  const lines = source.split("\n");
  const out: DisplayLine[] = [];
  let runningOffset = 0;

  const firstLine = lines[0] ?? "";
  const mm = MARKER_RE.exec(firstLine);
  const displayFirst = mm ? (mm[2] ?? "") : firstLine;
  out.push({ text: displayFirst, sourceOffset: runningOffset + (firstLine.length - displayFirst.length) });
  runningOffset += firstLine.length + 1;

  let inLogbook = false;
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i];
    if (l === ":LOGBOOK:") {
      inLogbook = true;
    } else if (l === ":END:") {
      inLogbook = false;
    } else if (!inLogbook && !PROPERTY_RE.test(l)) {
      out.push({ text: l, sourceOffset: runningOffset });
    }
    runningOffset += l.length + 1;
  }
  return out;
}

export interface TableCell {
  text: string;
  /** absolute offset in `source` where the cell's trimmed text begins */
  sourceOffset: number;
}

export type TableAlign = "left" | "center" | "right" | undefined;

export interface ImageSegment {
  alt: string;
  src: string;
  width?: number;
  height?: number;
  /** absolute [start, end) range in `source` of the whole image reference —
   *  including the {:height H, :width W} suffix if present — so a resize can
   *  splice in a replacement without needing to re-derive this line's bounds. */
  sourceStart: number;
  sourceEnd: number;
}

export type DisplaySegment =
  | { kind: "code"; lines: DisplayLine[] }
  | { kind: "table"; header: TableCell[]; align: TableAlign[]; rows: TableCell[][] }
  | { kind: "image"; image: ImageSegment }
  | { kind: "line"; line: DisplayLine };

// A line that's *only* an image reference — `![alt](src)` optionally followed
// by Logseq's `{:height H, :width W}` resize suffix — renders as an actual
// image instead of plain/inline text. An image alongside other text on the
// same line stays plain inline text; only a dedicated line gets this
// treatment, matching how Logseq itself represents a pasted/resized image.
const IMAGE_LINE_RE = /^!\[([^\]]*)\]\(([^)]+)\)(?:\{:height (\d+), :width (\d+)\})?$/;

/** Splits a `| a | b |` row into cells, each keeping the absolute source offset
 *  of its trimmed content so a click in a rendered cell still maps back to the
 *  right spot in the raw markdown. */
function splitRowCells(line: string, lineOffset: number): TableCell[] {
  const cells: TableCell[] = [];
  const startIdx = line.startsWith("|") ? 1 : 0;
  let cellStart = startIdx;
  for (let i = startIdx; i <= line.length; i++) {
    if (i === line.length || line[i] === "|") {
      const raw = line.slice(cellStart, i);
      const leadingWs = raw.length - raw.trimStart().length;
      cells.push({ text: raw.trim(), sourceOffset: lineOffset + cellStart + leadingWs });
      cellStart = i + 1;
    }
  }
  // A trailing "|" produces one extra empty trailing cell — drop it.
  if (cells.length > 0 && cells[cells.length - 1].text === "" && line.trimEnd().endsWith("|")) {
    cells.pop();
  }
  return cells;
}

const SEPARATOR_CELL_RE = /^:?-+:?$/;

export function isSeparatorRow(line: string): boolean {
  if (!line.includes("-")) return false;
  const cells = splitRowCells(line, 0);
  return cells.length > 0 && cells.every((c) => SEPARATOR_CELL_RE.test(c.text));
}

function cellAlign(separator: string): TableAlign {
  const left = separator.startsWith(":");
  const right = separator.endsWith(":");
  if (left && right) return "center";
  if (right) return "right";
  if (left) return "left";
  return undefined;
}

/**
 * Groups display lines so multi-line constructs render as one unit instead of
 * line-by-line:
 * - a fenced ``` code block — content inside it must never be tag/link-tokenized
 *   (a `#define` or URL in a code sample isn't a real tag or link), and the fence
 *   delimiter lines themselves are hidden from display, same as a heading's `#`.
 * - a `| a | b |` table — recognized by a header row followed by a `| --- | --- |`
 *   separator row, then however many further pipe-rows follow as the body.
 */
export function groupDisplayLines(lines: DisplayLine[]): DisplaySegment[] {
  const segments: DisplaySegment[] = [];
  let i = 0;
  while (i < lines.length) {
    if (lines[i].text.trim().startsWith("```")) {
      i++; // opening fence delimiter — not rendered
      const codeLines: DisplayLine[] = [];
      while (i < lines.length && !lines[i].text.trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++; // closing fence delimiter, if present
      segments.push({ kind: "code", lines: codeLines });
      continue;
    }

    if (lines[i].text.includes("|") && i + 1 < lines.length && isSeparatorRow(lines[i + 1].text)) {
      const headerLine = lines[i];
      const header = splitRowCells(headerLine.text, headerLine.sourceOffset);
      const sepCells = splitRowCells(lines[i + 1].text, lines[i + 1].sourceOffset);
      const align = sepCells.map((c) => cellAlign(c.text));
      i += 2;
      const rows: TableCell[][] = [];
      while (i < lines.length && lines[i].text.includes("|")) {
        rows.push(splitRowCells(lines[i].text, lines[i].sourceOffset));
        i++;
      }
      segments.push({ kind: "table", header, align, rows });
      continue;
    }

    const im = IMAGE_LINE_RE.exec(lines[i].text);
    if (im) {
      segments.push({
        kind: "image",
        image: {
          alt: im[1],
          src: im[2],
          height: im[3] ? Number(im[3]) : undefined,
          width: im[4] ? Number(im[4]) : undefined,
          sourceStart: lines[i].sourceOffset,
          sourceEnd: lines[i].sourceOffset + lines[i].text.length,
        },
      });
      i++;
      continue;
    }

    segments.push({ kind: "line", line: lines[i] });
    i++;
  }
  return segments;
}
