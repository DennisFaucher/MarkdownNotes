const FTS_OPERATORS = /^(?:AND|OR|NOT|NEAR)$/i;

/** Turns what the user typed into an FTS5 MATCH expression.
 *
 *  Each bare term is quoted on its own, so punctuation that is ordinary in this
 *  vault — the leading `#` of a tag, a `-` inside a marker — is matched as text
 *  instead of being read as (or throwing on) FTS5 query syntax.
 *
 *  FTS5 reads whitespace between terms as AND, which is the behaviour a search
 *  box should have: `#mcpnotes #claudenotes` finds blocks carrying both tags, in
 *  any order and at any distance. Quoting the *whole* input as one phrase (the
 *  previous approach) instead required the terms to be adjacent and in exactly
 *  the order typed, so the same query returned 0 or 4 depending purely on which
 *  order the two tags happened to be written in the note — and a third word
 *  broke it again. An explicitly quoted run still means a phrase, and bare
 *  AND/OR/NOT/NEAR and parentheses still pass through for real FTS5 queries.
 *
 *  Dependency-free (no db import) so it can be unit-tested on its own.
 */
export function toFtsQuery(q: string): string {
  type Item = { kind: "term" | "op"; text: string };
  const items: Item[] = [];
  for (const token of q.match(/"[^"]*"|\S+/g) ?? []) {
    if (FTS_OPERATORS.test(token)) {
      items.push({ kind: "op", text: token.toUpperCase() });
      continue;
    }
    const quoted = token.length > 1 && token.startsWith('"') && token.endsWith('"');
    const inner = quoted ? token.slice(1, -1) : token;
    if (inner.length === 0) continue;
    items.push({ kind: "term", text: `"${inner.replace(/"/g, '""')}"` });
  }

  // FTS5 treats a leading, trailing or doubled operator as a syntax error, and a
  // search box shouldn't 500 on a stray character — so keep an operator only
  // when a term exists on both sides of it, then collapse any run that leaves.
  // Parentheses are deliberately NOT treated as syntax: a note-taking search box
  // is better off matching "(as planned)" literally than rejecting the query.
  const hasTermBefore = (i: number) => items.slice(0, i).some((p) => p.kind === "term");
  const hasTermAfter = (i: number) => items.slice(i + 1).some((p) => p.kind === "term");
  const out: string[] = [];
  for (const [i, item] of items.entries()) {
    if (item.kind === "term") {
      out.push(item.text);
      continue;
    }
    if (!hasTermBefore(i) || !hasTermAfter(i)) continue;
    if (out.length === 0 || FTS_OPERATORS.test(out[out.length - 1])) continue;
    out.push(item.text);
  }
  return out.join(" ");
}
