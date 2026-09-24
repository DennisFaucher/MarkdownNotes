import { randomUUID } from "node:crypto";
import type { Block, ContLine, ParsedDoc } from "./types.js";

// A bullet line is <tabs> then either "- <content>" or exactly "-" (an empty block).
// Deliberately does not try to track fenced code blocks: two files in the real vault
// close a fence with a typo ("```gj"), which desyncs any fence-aware tokenizer and
// mis-parses everything after it. Requiring "- " immediately after the tabs means a
// continuation line (which always has two extra spaces before any "-") can never be
// mistaken for a bullet, so fence tracking is unnecessary.
const BULLET_RE = /^(\t*)(?:- (.*)|-())$/;

export function parseDoc(src: string): ParsedDoc {
  const hadTrailingNewline = src.length > 0 && src.endsWith("\n");
  const lines = src.split("\n");
  if (hadTrailingNewline) lines.pop();

  const preLines: string[] = [];
  let i = 0;
  while (i < lines.length && !BULLET_RE.test(lines[i])) {
    preLines.push(lines[i]);
    i++;
  }

  const blocks: Block[] = [];
  while (i < lines.length) {
    const m = BULLET_RE.exec(lines[i])!;
    const depth = m[1].length;
    const bulletEmpty = m[2] === undefined;
    const firstLine = bulletEmpty ? "" : m[2];
    const srcStart = i;
    i++;

    const prefix = "\t".repeat(depth) + "  ";
    const contLines: ContLine[] = [];
    while (i < lines.length && !BULLET_RE.test(lines[i])) {
      const line = lines[i];
      if (line.startsWith(prefix)) {
        contLines.push({ raw: false, text: line.slice(prefix.length) });
      } else {
        contLines.push({ raw: true, text: line });
      }
      i++;
    }

    blocks.push({
      id: randomUUID(),
      depth,
      bulletEmpty,
      firstLine,
      contLines,
      srcStart,
      srcEnd: i - 1,
    });
  }

  return { preLines, blocks, hadTrailingNewline };
}
