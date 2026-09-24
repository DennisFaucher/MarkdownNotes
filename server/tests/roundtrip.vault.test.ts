import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { parseDoc } from "../src/markdown/tokenize.js";
import { serializeParsedDoc } from "../src/markdown/serialize.js";

/**
 * Runs the parser against real note files, read-only, and asserts byte-identical
 * round-tripping. This is the guard against silently corrupting the user's vault.
 * Set VAULT_PATH to point at a real Logseq vault; otherwise this suite is skipped
 * and the synthetic-fixture suite (roundtrip.fixtures.test.ts) still runs.
 */
const vaultPath = process.env.VAULT_PATH;

function listMarkdownFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...listMarkdownFiles(full));
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

function assertRoundTrip(path: string, src: Buffer) {
  const text = src.toString("utf8");
  const doc = parseDoc(text);
  const out = serializeParsedDoc(doc);
  const outBuf = Buffer.from(out, "utf8");
  if (!outBuf.equals(src)) {
    const origLines = text.split("\n");
    const outLines = out.split("\n");
    let firstDiff = -1;
    for (let i = 0; i < Math.max(origLines.length, outLines.length); i++) {
      if (origLines[i] !== outLines[i]) {
        firstDiff = i;
        break;
      }
    }
    throw new Error(
      `Round-trip mismatch in ${path} at line ${firstDiff}\n` +
        `  original: ${JSON.stringify(origLines[firstDiff])}\n` +
        `  produced: ${JSON.stringify(outLines[firstDiff])}`,
    );
  }
  // idempotence: re-parsing the serialized output must reproduce the same tree shape
  const doc2 = parseDoc(out);
  expect(serializeParsedDoc(doc2)).toBe(out);
}

describe.skipIf(!vaultPath)("round-trip against real vault", () => {
  const files = vaultPath
    ? [...listMarkdownFiles(join(vaultPath, "journals")), ...listMarkdownFiles(join(vaultPath, "pages"))]
    : [];

  it("found the expected files", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  // Allow-list of files known to fail round-tripping. Must stay empty — a file
  // landing here is a data-loss bug, not something to relax the test for.
  const allowList = new Set<string>([]);

  for (const file of files) {
    const rel = relative(vaultPath ?? "", file);
    const testFn = allowList.has(rel) ? it.skip : it;
    testFn(`round-trips ${rel}`, () => {
      const src = readFileSync(file);
      assertRoundTrip(rel, src);
    });
  }
});
