export interface ApiContLine {
  raw: boolean;
  text: string;
}

export interface ApiBlockDerived {
  marker?: string;
  text: string;
  collapsed: boolean;
  tags: string[];
  refs: string[];
}

export interface ApiBlock {
  id: string;
  depth: number;
  bulletEmpty: boolean;
  firstLine: string;
  contLines: ApiContLine[];
  derived: ApiBlockDerived;
}

export interface ApiDoc {
  id: string;
  title: string;
  kind: "journal" | "page";
  preLines: string[];
  blocks: ApiBlock[];
  hadTrailingNewline: boolean;
  version: string;
}

/** A block as held in client editor state: a single editable text buffer per block. */
export interface EditorBlock {
  id: string;
  depth: number;
  /** firstLine + "\n" + continuation-line text, joined; the textarea's value */
  source: string;
  /** original continuation lines (with raw flags) from load — sent back untouched unless dirty */
  originalContLines: ApiContLine[];
  originalBulletEmpty: boolean;
  dirty: boolean;
  collapsed: boolean;
  marker?: string;
  tags: string[];
  refs: string[];
}

export interface EditorDoc {
  id: string;
  title: string;
  kind: "journal" | "page";
  preLines: string[];
  hadTrailingNewline: boolean;
  version: string;
  blocks: EditorBlock[];
  dirty: boolean;
  saving: boolean;
  loadedAt: number;
  /** File changed on disk while this doc had unsaved edits — see useLiveSync. */
  conflict: boolean;
}
