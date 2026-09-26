import { describe, expect, it } from "vitest";
import { isIndexableFile } from "../src/index/fileFilter.js";

/**
 * Guards the disagreement between the two places that decide what gets indexed:
 *
 *   - vault/watcher.ts `ignored`   skips `*.conflict-*` while running
 *   - index/build.ts listMarkdownFiles  must skip them too, or the startup
 *     rebuild indexes them and nothing can ever un-index them
 *
 * The failure mode is silent and sticky: phantom duplicate To Dos / search
 * entries that survive until a container restart. This asserts the predicate
 * directly, with no filesystem or database access, so it stays a pure unit test.
 */
describe("isIndexableFile", () => {
  it("keeps ordinary markdown", () => {
    expect(isIndexableFile("2026_04_02.md")).toBe(true);
    expect(isIndexableFile("ADP.md")).toBe(true);
    expect(isIndexableFile("WWT SMEs.md")).toBe(true);
  });

  it("excludes sync-tool conflict copies", () => {
    expect(isIndexableFile("2026_04_02.conflict-2026-09-25T13-02-10-161Z.md")).toBe(false);
    expect(isIndexableFile("2026_01_01.conflict-2026-01-02T03-04-05-006Z.md")).toBe(false);
  });

  it("still excludes non-markdown files", () => {
    expect(isIndexableFile("image_1779469503860_0.png")).toBe(false);
    expect(isIndexableFile("IMGP8261_1776624851353_0.JPG")).toBe(false);
    expect(isIndexableFile("notes.txt")).toBe(false);
  });

  it("does not over-exclude a legitimate page whose name merely mentions conflict", () => {
    // Only the sync-tool's own naming pattern is filtered — a real note
    // called e.g. "Server conflict resolution.md" must still be indexed.
    expect(isIndexableFile("Server conflict resolution.md")).toBe(true);
    expect(isIndexableFile("conflicts.md")).toBe(true);
  });
});
