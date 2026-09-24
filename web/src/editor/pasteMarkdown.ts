import { isSeparatorRow } from "./derive";

export interface ParsedPasteLine {
  depth: number;
  content: string;
}

const LIST_MARKER_RE = /^([-*+]|\d+[.)])\s+(.*)$/;
const HEADING_RE = /^(#{1,6})\s+/;

/**
 * Turns pasted multi-line markdown into (depth, content) entries — the paste
 * equivalent of what Enter/Tab produce when you type a nested list by hand.
 *
 * Two independent signals decide nesting, and both feed one shared stack:
 *  - Literal leading whitespace, for a nested list ("  - sub-item").
 *  - Heading hierarchy: standard markdown does NOT indent a list under its
 *    heading — "# Heading" and the "- bullet" list below it both sit at
 *    column 0 in the raw text, exactly like the Claude/Logseq meeting-summary
 *    format this was built to handle. Content belongs to the nearest heading
 *    until a heading of equal-or-higher level ends its scope.
 * Headings get a synthetic stack key below any real indent (and ordered by
 * level among themselves) so "indent 0 right after an H1" still reads as
 * "nested one level inside that H1", while a second H1 later correctly pops
 * back out to the top.
 *
 * Also strips list markers (our block IS the bullet, so keeping the source's
 * own "- " would show a duplicate), and re-groups a pasted table's header/
 * separator/body rows into one multi-line block instead of one block per row
 * — matching the shape groupDisplayLines already expects for rendering a table.
 *
 * A fenced code block's content is left untouched (no marker stripping, no
 * depth recompute, no trimming — code indentation is meaningful) so it isn't
 * misread as list or heading structure.
 */
export function parsePastedMarkdown(text: string, baseDepth: number): ParsedPasteLine[] {
  const rawLines = text.split("\n");
  while (rawLines.length > 1 && rawLines[rawLines.length - 1] === "") rawLines.pop();

  const lines: ParsedPasteLine[] = [];
  const stack: { key: number; depth: number }[] = [];
  let inFence = false;
  let fenceDepth = baseDepth;

  for (const raw of rawLines) {
    const trimmed = raw.trim();

    if (inFence) {
      lines.push({ depth: fenceDepth, content: raw });
      if (trimmed.startsWith("```")) inFence = false;
      continue;
    }

    if (trimmed === "") {
      lines.push({ depth: stack.length ? stack[stack.length - 1].depth : baseDepth, content: "" });
      continue;
    }

    const hm = HEADING_RE.exec(trimmed);
    if (hm) {
      const level = hm[1].length;
      const key = -1000 + level; // sorts below any real indent, and by level among headings
      while (stack.length && stack[stack.length - 1].key >= key) stack.pop();
      const depth = stack.length ? stack[stack.length - 1].depth + 1 : baseDepth;
      stack.push({ key, depth });
      lines.push({ depth, content: trimmed }); // keep "#" — BlockStatic's own heading detection needs it
      continue;
    }

    const indent = raw.length - raw.trimStart().length;
    while (stack.length && stack[stack.length - 1].key >= indent) stack.pop();
    const depth = stack.length ? stack[stack.length - 1].depth + 1 : baseDepth;
    stack.push({ key: indent, depth });

    if (trimmed.startsWith("```")) {
      inFence = true;
      fenceDepth = depth;
      lines.push({ depth, content: trimmed });
      continue;
    }

    let content = trimmed;
    const m = LIST_MARKER_RE.exec(content);
    if (m) content = m[2];
    lines.push({ depth, content });
  }

  return groupTables(realignBlankLines(lines));
}

/**
 * A blank line between a heading and its nested content was assigned the
 * heading's own depth (there's nothing else to go on in a single forward
 * pass), making it a sibling of the heading rather than of the content that
 * follows. Since our block tree is purely positional — a block's children are
 * whatever comes after it at greater depth, until something at an equal-or-
 * lesser depth — that shallower blank line ends up structurally "in front of"
 * the deeper content, becoming its parent instead of the heading. Nothing
 * renders it as a heading, so it just looks like an empty bullet that
 * mysteriously grew a collapse arrow. Aligning each blank line's depth to
 * whatever comes after it fixes this: it becomes a sibling of that content,
 * both still properly nested under the heading.
 */
function realignBlankLines(lines: ParsedPasteLine[]): ParsedPasteLine[] {
  const out = [...lines];
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i].content !== "") continue;
    const next = out[i + 1];
    if (next) out[i] = { ...out[i], depth: next.depth };
  }
  return out;
}

function groupTables(lines: ParsedPasteLine[]): ParsedPasteLine[] {
  const out: ParsedPasteLine[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const next = lines[i + 1];
    if (line.content.includes("|") && next && next.depth === line.depth && isSeparatorRow(next.content)) {
      const depth = line.depth;
      const rows = [line.content, next.content];
      let j = i + 2;
      while (j < lines.length && lines[j].depth === depth && lines[j].content.includes("|")) {
        rows.push(lines[j].content);
        j++;
      }
      out.push({ depth, content: rows.join("\n") });
      i = j;
      continue;
    }
    out.push(line);
    i++;
  }
  return out;
}
