import { parseDoc } from "../markdown/tokenize.js";
import { hashContent, readRaw } from "./write.js";
import type { ParsedDoc } from "../markdown/types.js";

export interface LoadedDoc {
  doc: ParsedDoc;
  version: string;
}

export async function loadPage(absPath: string): Promise<LoadedDoc | null> {
  const raw = await readRaw(absPath);
  if (raw === null) return null;
  return { doc: parseDoc(raw), version: hashContent(raw) };
}

/** An empty draft for a page/journal day that has no file on disk yet. */
export function emptyDoc(): LoadedDoc {
  return { doc: { preLines: [], blocks: [], hadTrailingNewline: true }, version: "" };
}
