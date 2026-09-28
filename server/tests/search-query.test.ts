import { describe, expect, it } from "vitest";
import { toFtsQuery } from "../src/index/ftsQuery.js";
import { isBareTagQuery } from "../src/index/tagQuery.js";

/**
 * The search box used to quote the entire query as one FTS5 phrase, so
 * "#a #b" only matched notes where the two tags sat adjacent and in the order
 * typed — the same query returned 0 or 4 results depending purely on how the
 * note happened to be written. Now each term is quoted separately and FTS5's
 * implicit AND applies. These assertions pin the expression shape, which is what
 * actually changed; result counts depend on the vault.
 */
describe("toFtsQuery", () => {
  it("treats space-separated terms as AND, in any order", () => {
    expect(toFtsQuery("#mcpnotes #claudenotes")).toBe('"#mcpnotes" "#claudenotes"');
    expect(toFtsQuery("mcpnotes claudenotes")).toBe('"mcpnotes" "claudenotes"');
  });

  it("keeps a single term working", () => {
    expect(toFtsQuery("mcpnotes")).toBe('"mcpnotes"');
    expect(toFtsQuery("#mcpnotes")).toBe('"#mcpnotes"');
  });

  it("preserves an explicitly quoted phrase", () => {
    expect(toFtsQuery('"ibs sales"')).toBe('"ibs sales"');
    expect(toFtsQuery('"ibs sales" mcpnotes')).toBe('"ibs sales" "mcpnotes"');
  });

  it("passes real FTS5 operators through", () => {
    expect(toFtsQuery("mcpnotes OR claudenotes")).toBe('"mcpnotes" OR "claudenotes"');
    expect(toFtsQuery("mcpnotes NOT graylog")).toBe('"mcpnotes" NOT "graylog"');
    expect(toFtsQuery("mcpnotes AND claudenotes")).toBe('"mcpnotes" AND "claudenotes"');
  });

  it("drops operators that have nothing to attach to, rather than emitting invalid syntax", () => {
    expect(toFtsQuery("AND mcpnotes")).toBe('"mcpnotes"');
    expect(toFtsQuery("mcpnotes AND")).toBe('"mcpnotes"');
    expect(toFtsQuery("mcpnotes AND AND claudenotes")).toBe('"mcpnotes" AND "claudenotes"');
    expect(toFtsQuery("AND")).toBe("");
    expect(toFtsQuery("")).toBe("");
    expect(toFtsQuery("   ")).toBe("");
  });

  it("neutralises punctuation that is ordinary in this vault", () => {
    expect(toFtsQuery("#WWTToDo")).toBe('"#WWTToDo"');
    // A leading NOT excludes from nothing, so it is dropped rather than passed on.
    expect(toFtsQuery("NOT #tag")).toBe('"#tag"');
    expect(toFtsQuery("mcpnotes NOT #tag")).toBe('"mcpnotes" NOT "#tag"');
    // A lone double quote can't open a valid phrase; it must stay inert.
    expect(toFtsQuery('"')).toBe('""""');
    expect(toFtsQuery('say "hi" now')).toBe('"say" "hi" "now"');
    // Parentheses are ordinary characters, not group syntax. The tokenizer
    // strips them anyway, so this degrades to an AND of the words — broader,
    // but never an error.
    expect(toFtsQuery("(as planned)")).toBe('"(as" "planned)"');
  });
});

/**
 * Which queries get date ordering instead of bm25 relevance. A lone `#tag` is
 * the case where relevance actively misleads: every match is a near-identical
 * bare tag, so bm25 ties and SQLite's tie-break is arbitrary — which is why
 * `#RTXNotes` (80 blocks) used to list January first and drop every September
 * entry past the 30-result cap.
 */
describe("isBareTagQuery", () => {
  it("accepts a single tag", () => {
    expect(isBareTagQuery("#RTXNotes")).toBe(true);
    expect(isBareTagQuery("  #mcpnotes  ")).toBe(true);
  });

  it("rejects anything with a second term, so real keyword search keeps relevance", () => {
    expect(isBareTagQuery("#a #b")).toBe(false);
    expect(isBareTagQuery("#RTXNotes migration")).toBe(false);
    expect(isBareTagQuery("migration")).toBe(false);
    expect(isBareTagQuery("#RTXNotes AND foo")).toBe(false);
  });

  it("rejects empty and degenerate input", () => {
    expect(isBareTagQuery("")).toBe(false);
    expect(isBareTagQuery("#")).toBe(false);
    expect(isBareTagQuery("   ")).toBe(false);
  });
});
