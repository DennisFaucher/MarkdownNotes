import type { BlockInput, ParsedDoc } from "./types.js";

export function serializeDoc(doc: {
  preLines: string[];
  blocks: BlockInput[];
  hadTrailingNewline: boolean;
}): string {
  const lines: string[] = [...doc.preLines];
  for (const b of doc.blocks) {
    const t = "\t".repeat(b.depth);
    lines.push(b.bulletEmpty ? t + "-" : t + "- " + b.firstLine);
    for (const c of b.contLines) {
      lines.push(c.raw ? c.text : t + "  " + c.text);
    }
  }
  return lines.join("\n") + (doc.hadTrailingNewline ? "\n" : "");
}

export function serializeParsedDoc(doc: ParsedDoc): string {
  return serializeDoc(doc);
}
