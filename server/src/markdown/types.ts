export interface ContLine {
  /** true when the line didn't match the expected "<tabs><two spaces>" prefix and is stored verbatim */
  raw: boolean;
  text: string;
}

export interface Block {
  id: string;
  depth: number;
  bulletEmpty: boolean;
  firstLine: string;
  contLines: ContLine[];
  srcStart: number;
  srcEnd: number;
}

export interface ParsedDoc {
  preLines: string[];
  blocks: Block[];
  hadTrailingNewline: boolean;
}

export interface BlockInput {
  id?: string;
  depth: number;
  bulletEmpty: boolean;
  firstLine: string;
  contLines: ContLine[];
}
