import { describe, expect, it } from "vitest";
import { indentBlock, indentRange, outdentBlock } from "../../web/src/editor/ops.js";
import type { EditorBlock } from "../../web/src/types/block.js";

/**
 * These are *editor* ops (web/), but the server workspace holds the only test
 * runner in the repo. `ops.ts` and its two imports are dependency-free
 * (type-only aside), so it imports cleanly here — no DOM, no React. See the
 * indentBlock comment for the rule these assert.
 */
function blk(depth: number, text: string): EditorBlock {
  return {
    id: `id-${depth}-${text}`,
    depth,
    source: text,
    originalContLines: [],
    originalBulletEmpty: false,
    dirty: false,
    collapsed: false,
    tags: [],
    refs: [],
  };
}

const depths = (blocks: EditorBlock[]) => blocks.map((b) => b.depth);

describe("indentBlock", () => {
  it("indents when the block above is a sibling at the same depth", () => {
    const blocks = [blk(0, "A"), blk(1, "B"), blk(1, "C")];
    expect(depths(indentBlock(blocks, 2)!)).toEqual([0, 1, 2]);
  });

  it("indents when the block above is DEEPER, making this a sibling of it", () => {
    // The real case from 2026_09_28.md: a pasted/hand-edited document left a
    // depth-2 block under a depth-2 parent while the line above had gone to
    // depth 3. `prev.depth !== b.depth` refused this and froze the region.
    const blocks = [blk(2, "**Broadcom**"), blk(3, "9/23 Rita Sent this Agenda"), blk(2, "Introductions & Goals"), blk(3, "Establish the business")];
    expect(depths(indentBlock(blocks, 2)!)).toEqual([2, 3, 3, 3]);
  });

  it("leaves descendants alone so they stay nested under the block", () => {
    const blocks = [blk(2, "Parent"), blk(3, "above"), blk(2, "Target"), blk(3, "child1"), blk(4, "grandchild")];
    expect(depths(indentBlock(blocks, 2)!)).toEqual([2, 3, 3, 3, 4]);
  });

  it("refuses when the block above is shallower — that would be unparentable", () => {
    // Already nested one level under "A"; indenting again would put it at depth
    // 3 with only a depth-1 line above it.
    const blocks = [blk(1, "A"), blk(2, "B")];
    expect(indentBlock(blocks, 1)).toBeNull();
  });

  it("allows the ordinary sibling case that a shallower-predecessor check must not break", () => {
    const blocks = [blk(1, "A"), blk(2, "B"), blk(2, "C")];
    expect(depths(indentBlock(blocks, 2)!)).toEqual([1, 2, 3]);
  });

  it("refuses for the first block, which has nothing above it", () => {
    expect(indentBlock([blk(0, "only")], 0)).toBeNull();
  });

  it("marks the block dirty so it is persisted", () => {
    const blocks = [blk(2, "Parent"), blk(3, "above"), blk(2, "Target")];
    expect(indentBlock(blocks, 2)![2].dirty).toBe(true);
    expect(blocks[2].dirty).toBe(false);
  });
});

describe("indentRange", () => {
  it("applies the same rule: a deeper predecessor is fine", () => {
    const blocks = [blk(2, "Parent"), blk(3, "above"), blk(2, "B"), blk(2, "C")];
    expect(depths(indentRange(blocks, 2, 3)!)).toEqual([2, 3, 3, 3]);
  });

  it("refuses when the first block of the range has a shallower predecessor", () => {
    const blocks = [blk(1, "A"), blk(2, "B"), blk(2, "C")];
    expect(indentRange(blocks, 1, 2)).toBeNull();
  });

  it("allows a range whose first block sits under a deeper predecessor", () => {
    const blocks = [blk(2, "Parent"), blk(3, "above"), blk(2, "B"), blk(2, "C")];
    expect(depths(indentRange(blocks, 2, 3)!)).toEqual([2, 3, 3, 3]);
  });
});

describe("outdentBlock", () => {
  it("only refuses at depth 0 — it has no shallower sibling requirement", () => {
    const blocks = [blk(0, "A"), blk(3, "deep")];
    expect(depths(outdentBlock(blocks, 1)!)).toEqual([0, 2]);
    expect(outdentBlock(blocks, 0)).toBeNull();
  });
});
