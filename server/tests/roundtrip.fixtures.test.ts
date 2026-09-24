import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseDoc } from "../src/markdown/tokenize.js";
import { serializeParsedDoc } from "../src/markdown/serialize.js";

const fixturesDir = join(fileURLToPath(new URL(".", import.meta.url)), "fixtures/vault");

describe("round-trip against synthetic fixtures (checked in, no VAULT_PATH needed)", () => {
  const files = readdirSync(fixturesDir).filter((f) => f.endsWith(".md"));

  it("found the expected fixture files", () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  for (const file of files) {
    it(`round-trips ${file}`, () => {
      const src = readFileSync(join(fixturesDir, file));
      const text = src.toString("utf8");
      const out = serializeParsedDoc(parseDoc(text));
      expect(Buffer.from(out, "utf8").equals(src)).toBe(true);
    });
  }
});
