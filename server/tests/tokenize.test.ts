import { describe, expect, it } from "vitest";
import { parseDoc } from "../src/markdown/tokenize.js";
import { serializeDoc } from "../src/markdown/serialize.js";

describe("parseDoc structure", () => {
  it("builds one block per bullet with correct depth", () => {
    const doc = parseDoc("- top\n\t- child\n\t\t- grandchild");
    expect(doc.blocks.map((b) => [b.depth, b.firstLine])).toEqual([
      [0, "top"],
      [1, "child"],
      [2, "grandchild"],
    ]);
  });

  it("does not split on a literal bullet-like line inside a fenced continuation", () => {
    const doc = parseDoc("- Notes\n\t- ```\n\t  - fake bullet inside fence\n\t  ```\n- After");
    expect(doc.blocks).toHaveLength(3);
    expect(doc.blocks[1].contLines.map((c) => c.text)).toEqual(["- fake bullet inside fence", "```"]);
  });

  it("treats a lone dash as an empty block, never '- '", () => {
    const doc = parseDoc("-\n\t-");
    expect(doc.blocks[0].bulletEmpty).toBe(true);
    expect(doc.blocks[0].firstLine).toBe("");
    expect(serializeDoc({ ...doc })).not.toContain("- \n");
  });

  it("treats text before the first bullet as preLines, verbatim", () => {
    const doc = parseDoc("### Heading\ncollapsed:: true\n- First block");
    expect(doc.preLines).toEqual(["### Heading", "collapsed:: true"]);
    expect(doc.blocks).toHaveLength(1);
  });

  it("handles a file with no bullets at all", () => {
    const doc = parseDoc("###");
    expect(doc.preLines).toEqual(["###"]);
    expect(doc.blocks).toHaveLength(0);
  });

  it("preserves whitespace-only continuation lines exactly", () => {
    const src = "- a\n  \n\t- b\n\t  ";
    const doc = parseDoc(src);
    expect(doc.blocks[0].contLines[0].text).toBe("");
    expect(doc.blocks[1].contLines[0].text).toBe("");
    expect(serializeDoc(doc)).toBe(src);
  });

  it("round-trips presence or absence of a trailing newline", () => {
    expect(parseDoc("- a").hadTrailingNewline).toBe(false);
    expect(parseDoc("- a\n").hadTrailingNewline).toBe(true);
    expect(serializeDoc(parseDoc("- a"))).toBe("- a");
    expect(serializeDoc(parseDoc("- a\n"))).toBe("- a\n");
  });

  it("round-trips a fully empty file and a single blank line", () => {
    expect(serializeDoc(parseDoc(""))).toBe("");
    expect(serializeDoc(parseDoc("\n"))).toBe("\n");
  });
});
