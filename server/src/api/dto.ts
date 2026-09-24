import { deriveBlock } from "../markdown/derive.js";
import type { Block, BlockInput, ContLine } from "../markdown/types.js";
import type { LoadedDoc } from "../vault/read.js";

export interface ApiContLine {
  raw: boolean;
  text: string;
}

export interface ApiBlock {
  id: string;
  depth: number;
  bulletEmpty: boolean;
  firstLine: string;
  contLines: ApiContLine[];
  // derived, read-only view for rendering — ignored on save
  derived: {
    marker?: string;
    text: string;
    collapsed: boolean;
    tags: string[];
    refs: string[];
  };
}

export interface ApiDoc {
  id: string;
  title: string;
  kind: "journal" | "page";
  preLines: string[];
  blocks: ApiBlock[];
  hadTrailingNewline: boolean;
  version: string;
}

function toApiBlock(b: Block): ApiBlock {
  const d = deriveBlock(b);
  return {
    id: b.id,
    depth: b.depth,
    bulletEmpty: b.bulletEmpty,
    firstLine: b.firstLine,
    contLines: b.contLines.map((c) => ({ raw: c.raw, text: c.text })),
    derived: { marker: d.marker, text: d.text, collapsed: d.collapsed, tags: d.tags, refs: d.refs },
  };
}

export function toApiDoc(
  id: string,
  title: string,
  kind: "journal" | "page",
  loaded: LoadedDoc,
): ApiDoc {
  return {
    id,
    title,
    kind,
    preLines: loaded.doc.preLines,
    blocks: loaded.doc.blocks.map(toApiBlock),
    hadTrailingNewline: loaded.doc.hadTrailingNewline,
    version: loaded.version,
  };
}

export interface SaveDocBody {
  preLines: string[];
  blocks: { depth: number; bulletEmpty: boolean; firstLine: string; contLines: ApiContLine[] }[];
  hadTrailingNewline: boolean;
  baseVersion: string;
}

export function fromApiBlocks(blocks: SaveDocBody["blocks"]): BlockInput[] {
  return blocks.map((b) => ({
    depth: b.depth,
    bulletEmpty: b.bulletEmpty,
    firstLine: b.firstLine,
    contLines: b.contLines.map((c): ContLine => ({ raw: c.raw, text: c.text })),
  }));
}

export function isValidSaveBody(body: unknown): body is SaveDocBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    Array.isArray(b.preLines) &&
    Array.isArray(b.blocks) &&
    typeof b.hadTrailingNewline === "boolean" &&
    typeof b.baseVersion === "string"
  );
}
