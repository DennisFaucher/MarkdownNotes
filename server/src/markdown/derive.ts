import type { Block } from "./types.js";

const PROPERTY_RE = /^([A-Za-z][A-Za-z0-9_\-.\/]*):: ?(.*)$/;
const MARKER_RE = /^(TODO|DONE|NOW|LATER|DOING|WAITING|CANCELED)(?:\s+(.*))?$/;
const TAG_RE = /#([A-Za-z][A-Za-z0-9_\-\/]*)/g;
const PAGEREF_RE = /\[\[([^\]]+)\]\]/g;

export interface DerivedBlock {
  marker?: string;
  text: string;
  properties: Record<string, string>;
  collapsed: boolean;
  tags: string[];
  refs: string[];
  /** firstLine + non-property, non-drawer continuation lines, for display/search */
  content: string;
}

/**
 * Reads structure out of a block's raw lines for rendering/indexing. Never
 * writes back — a block's persisted bytes come only from firstLine/contLines.
 */
export function deriveBlock(b: Pick<Block, "firstLine" | "contLines">): DerivedBlock {
  let text = b.firstLine;
  let marker: string | undefined;
  const mm = MARKER_RE.exec(text);
  if (mm) {
    marker = mm[1];
    text = mm[2] ?? "";
  }

  const properties: Record<string, string> = {};
  const contentLines: string[] = [];
  let inLogbook = false;
  for (const c of b.contLines) {
    const line = c.text;
    if (line === ":LOGBOOK:") {
      inLogbook = true;
      continue;
    }
    if (line === ":END:") {
      inLogbook = false;
      continue;
    }
    if (inLogbook) continue;

    const pm = PROPERTY_RE.exec(line);
    if (pm) {
      properties[pm[1]] = pm[2];
      continue;
    }
    contentLines.push(line);
  }

  const collapsed = properties.collapsed === "true";
  const content = [text, ...contentLines].join("\n");
  // A #hashtag or [[ref]] inside a fenced code block isn't a real tag/ref — the
  // client already treats fenced content as inert when rendering (BlockStatic's
  // groupDisplayLines), so the indexer needs the same exclusion or a code
  // sample's contents would pollute the tags list and backlinks.
  const contentForTags = stripFencedCode(content);
  const tags = [...contentForTags.matchAll(TAG_RE)].map((m) => m[1]);
  const refs = [...contentForTags.matchAll(PAGEREF_RE)].map((m) => m[1]);

  return { marker, text, properties, collapsed, tags, refs, content };
}

function stripFencedCode(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let inFence = false;
  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    out.push(inFence ? "" : line);
  }
  return out.join("\n");
}
