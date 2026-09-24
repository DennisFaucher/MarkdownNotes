import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseDoc } from "../src/markdown/tokenize.js";
import { serializeDoc } from "../src/markdown/serialize.js";

// The line-based decomposition (preLines + firstLine/contLines, prefix stripped
// deterministically from depth) should round-trip ANY input, not just realistic
// vault content — every byte lands in exactly one bucket and prefixes are
// re-derived from depth rather than re-tokenized on the way back out. This
// property test hunts for tokenizer bugs (off-by-one prefix stripping, trailing
// newline handling) across shapes the real vault doesn't happen to contain.
const lineChars = "abcAB01-#[]{}():.,_/\\* \t";
const line = fc.stringOf(fc.constantFrom(...lineChars.split("")), { maxLength: 24 });

describe("round-trip property: holds for arbitrary line content", () => {
  it("serialize(parse(s)) === s for any generated file", () => {
    fc.assert(
      fc.property(fc.array(line, { maxLength: 30 }), fc.boolean(), (lines, trailingNewline) => {
        const src = lines.join("\n") + (trailingNewline ? "\n" : "");
        const doc = parseDoc(src);
        expect(serializeDoc(doc)).toBe(src);
      }),
      { numRuns: 500 },
    );
  });

  it("is idempotent under re-parsing", () => {
    fc.assert(
      fc.property(fc.array(line, { maxLength: 30 }), fc.boolean(), (lines, trailingNewline) => {
        const src = lines.join("\n") + (trailingNewline ? "\n" : "");
        const once = serializeDoc(parseDoc(src));
        const twice = serializeDoc(parseDoc(once));
        expect(twice).toBe(once);
      }),
      { numRuns: 500 },
    );
  });
});
