import { describe, expect, it } from "vitest";
import { deriveBlock } from "../src/markdown/derive.js";

function block(firstLine: string, contLines: string[] = []) {
  return { firstLine, contLines: contLines.map((text) => ({ raw: false, text })) };
}

describe("deriveBlock", () => {
  it("strips a TODO/DONE marker from the first line", () => {
    const d = deriveBlock(block("TODO Buy milk"));
    expect(d.marker).toBe("TODO");
    expect(d.text).toBe("Buy milk");
  });

  it("extracts tags and page refs from the block's full content", () => {
    const d = deriveBlock(block("Discuss #ProjectAlpha with [[Jane Doe]]"));
    expect(d.tags).toEqual(["ProjectAlpha"]);
    expect(d.refs).toEqual(["Jane Doe"]);
  });

  it("does not treat a #tag or [[ref]] inside a fenced code block as real", () => {
    const d = deriveBlock(
      block("```js", ["function f() {", "  return '#nothashtag [[NotAPage]]';", "}", "```"]),
    );
    expect(d.tags).toEqual([]);
    expect(d.refs).toEqual([]);
    // full-text search should still see the code's actual content
    expect(d.content).toContain("#nothashtag");
  });

  it("still finds a real tag outside the fence in a block that also contains code", () => {
    const d = deriveBlock(block("Notes #real", ["```", "#fake", "```"]));
    expect(d.tags).toEqual(["real"]);
  });

  it("reads the collapsed:: true property and excludes it from content", () => {
    const d = deriveBlock(block("Parent", ["collapsed:: true"]));
    expect(d.collapsed).toBe(true);
    expect(d.content).toBe("Parent");
  });

  it("skips LOGBOOK/CLOCK drawer lines when building content", () => {
    const d = deriveBlock(block("DONE Task", [":LOGBOOK:", "CLOCK: [2025-10-21]", ":END:", "extra note"]));
    expect(d.content).toBe("Task\nextra note");
  });
});
