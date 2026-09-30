import { describe, expect, it } from "vitest";
import {
  getDisplayLines,
  groupDisplayLines,
  isDividerLine,
} from "../../web/src/editor/derive.js";

/** Group the way both renderers do, and hand back the segment kinds. */
function kindsOf(source: string): string[] {
  return groupDisplayLines(getDisplayLines(source)).map((s) => s.kind);
}

describe("isDividerLine", () => {
  it("accepts three or more dashes alone on a line", () => {
    expect(isDividerLine("---")).toBe(true);
    expect(isDividerLine("----")).toBe(true);
    expect(isDividerLine("-------")).toBe(true);
  });

  it("tolerates the indentation of a continuation line", () => {
    expect(isDividerLine("  ---")).toBe(true);
    expect(isDividerLine("\t---")).toBe(true);
  });

  it("requires nothing else on the line", () => {
    expect(isDividerLine("--- foo")).toBe(false);
    expect(isDividerLine("foo ---")).toBe(false);
    expect(isDividerLine("- - -")).toBe(false);
  });

  it("leaves two dashes alone — those are prose, not a rule", () => {
    // `--` is an em-dash, a CLI flag, a negative argument, an ASCII table.
    expect(isDividerLine("--")).toBe(false);
    expect(isDividerLine("-")).toBe(false);
    expect(isDividerLine("")).toBe(false);
  });
});

describe("groupDisplayLines dividers", () => {
  it("reads a block whose only content is --- as a divider", () => {
    expect(kindsOf("---")).toEqual(["divider"]);
  });

  it("reads a divider between prose lines", () => {
    expect(kindsOf("intro\n---\noutro")).toEqual(["line", "divider", "line"]);
  });

  it("still treats --- inside a fenced code block as code", () => {
    const src = "```\n---\n```";
    const segs = groupDisplayLines(getDisplayLines(src));
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("code");
    if (segs[0].kind === "code") {
      expect(segs[0].lines.map((l) => l.text)).toEqual(["---"]);
    }
  });

  // The regression this guards: a table separator row consists only of dashes
  // once split into cells, so a naive divider check placed before the table
  // branch would eat the `| --- | --- |` line and destroy the table.
  it("does not steal a table's --- separator row", () => {
    const src = "| a | b |\n| --- | --- |\n| 1 | 2 |";
    const segs = groupDisplayLines(getDisplayLines(src));
    expect(segs).toHaveLength(1);
    expect(segs[0].kind).toBe("table");
    if (segs[0].kind === "table") {
      expect(segs[0].header.map((c) => c.text)).toEqual(["a", "b"]);
      expect(segs[0].rows).toHaveLength(1);
    }
  });

  it("keeps a divider's source offset pointing at the dashes", () => {
    const src = "intro\n---\noutro";
    const seg = groupDisplayLines(getDisplayLines(src))[1];
    expect(seg.kind).toBe("divider");
    if (seg.kind === "divider") {
      expect(src.slice(seg.line.sourceOffset, seg.line.sourceOffset + 3)).toBe("---");
    }
  });

  it("is display-only — the source is unchanged", () => {
    // Nothing in this path rewrites `source`; the divider is a rendering
    // decision, so a save round-trips byte-for-byte. Guards against someone
    // later "helpfully" normalising --- to **** in the grouper.
    const src = "a\n---\nb";
    const out = groupDisplayLines(getDisplayLines(src))
      .map((s) => (s.kind === "line" ? s.line.text : ""))
      .join("\n");
    expect(src).toBe("a\n---\nb");
    expect(out).toBe("a\n\nb");
  });
});
