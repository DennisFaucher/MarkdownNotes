import type { ApiDoc } from "../types/block";
import { apiBlockToEditorBlock } from "./derive";
import type { PasteEntry } from "./ops";

export interface Template {
  name: string;
  /** Depths are relative, starting at 0 for the template's own top-level
   *  block — the caller rebases them onto wherever it's inserting (see
   *  ops.pasteBlocks, which treats entries[0]'s depth as "whatever the
   *  target block's depth already is" and every other entry's depth as
   *  absolute). */
  entries: PasteEntry[];
}

// A template is any block whose own first line is "#template <Name>" — this
// block itself is just a label and is never inserted; everything nested one
// level deeper than it is the template's actual content. Kept as a plain tag
// convention (not a Logseq page-property) so authoring a template is just
// normal block editing on the Templates page, no special syntax to learn.
const TEMPLATE_MARKER_RE = /^#template\s+(\S+)\s*$/;

export function parseTemplates(doc: ApiDoc): Template[] {
  const blocks = doc.blocks.map(apiBlockToEditorBlock);
  const templates: Template[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const firstLine = blocks[i].source.split("\n", 1)[0];
    const m = TEMPLATE_MARKER_RE.exec(firstLine);
    if (!m) continue;
    const baseDepth = blocks[i].depth;
    const entries: PasteEntry[] = [];
    let j = i + 1;
    while (j < blocks.length && blocks[j].depth > baseDepth) {
      entries.push({ depth: blocks[j].depth - baseDepth - 1, content: blocks[j].source });
      j++;
    }
    if (entries.length > 0) templates.push({ name: m[1], entries });
  }
  return templates;
}

/** Case-insensitive prefix match, shortest-name-first — same ranking as
 *  filterTags, for the same reason (an exact-ish match should outrank a
 *  longer name that merely starts with the same text). */
export function filterTemplates(templates: Template[], query: string): Template[] {
  const lower = query.toLowerCase();
  return templates
    .filter((t) => t.name.toLowerCase().startsWith(lower))
    .sort((a, b) => a.name.length - b.name.length || a.name.localeCompare(b.name))
    .slice(0, 8);
}
