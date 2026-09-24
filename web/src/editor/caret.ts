export function isCaretOnFirstLine(value: string, pos: number): boolean {
  return !value.slice(0, pos).includes("\n");
}

export function isCaretOnLastLine(value: string, pos: number): boolean {
  return !value.slice(pos).includes("\n");
}

export function caretColumn(value: string, pos: number): number {
  const lastNewline = value.lastIndexOf("\n", pos - 1);
  return pos - (lastNewline + 1);
}

/** Position of `column` on the last line of `value`, clamped to that line's length. */
export function posAtColumnOnLastLine(value: string, column: number): number {
  const lastNewline = value.lastIndexOf("\n");
  const lineStart = lastNewline + 1;
  const lineLength = value.length - lineStart;
  return lineStart + Math.min(column, lineLength);
}

/** Position of `column` on the first line of `value`, clamped to that line's length. */
export function posAtColumnOnFirstLine(value: string, column: number): number {
  const firstNewline = value.indexOf("\n");
  const lineLength = firstNewline === -1 ? value.length : firstNewline;
  return Math.min(column, lineLength);
}
