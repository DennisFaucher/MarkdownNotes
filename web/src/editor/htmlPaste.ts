/**
 * Converts a clipboard `text/html` payload to markdown, so that pasting from a
 * web page keeps its link targets.
 *
 * Why this exists: a browser puts two flavours on the clipboard when you copy
 * a link. `text/html` carries `<a href="https://…">Label</a>`, and `text/plain`
 * carries only `Label` — the URL is not recoverable from the plain-text side at
 * all. Reading only `text/plain` therefore silently drops every pasted URL,
 * which is why a page's link list arrives as a bare list of titles. Other
 * consumers of the same clipboard (Teams, Word) read the HTML, which is why
 * they get working links.
 *
 * Deliberately conservative, because the sibling `text/plain` path is
 * well-tested and must not be disturbed: `markdownFromHtmlIfLinked` returns
 * null unless the HTML genuinely contains a usable link, so a markdown-source
 * paste (Copilot, an editor, this app's own copy) still takes the existing
 * plain-text route byte-for-byte. Only the lossy case is diverted here.
 *
 * Word/Outlook/Docs are the reason this isn't a regex: they express bold and
 * italic as presentational tags carrying an explicit "off" declaration
 * (`<b style="font-weight:normal">`), and wrap everything in nested tables and
 * spans. Styling is ignored entirely, and a counter-declaration is honoured so
 * a Word paste doesn't come out with spurious emphasis.
 */

const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "HEAD", "META", "LINK", "TITLE", "TEMPLATE", "OBJECT", "EMBED"]);

const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DETAILS", "DIALOG", "DIV", "DL", "DT",
  "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3", "H4", "H5", "H6",
  "HEADER", "HGROUP", "HR", "LI", "MAIN", "NAV", "OL", "P", "PRE", "SECTION",
  "TABLE", "TBODY", "TD", "TFOOT", "TH", "THEAD", "TR", "UL",
]);

const HEADING_RE = /^H([1-6])$/;
const INDENT = "  ";

/**
 * Returns markdown for the HTML only when doing so recovers information the
 * plain-text flavour would have thrown away — i.e. it contains a link we can
 * safely keep. Returns null when there is nothing to gain, so the caller keeps
 * its existing plain-text behaviour.
 */
export function markdownFromHtmlIfLinked(html: string): string | null {
  if (!html) return null;
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(html, "text/html");
  } catch {
    return null;
  }
  if (!hasUsableLink(doc.body)) return null;
  const md = blocksToMarkdown(doc.body, 0);
  return md.trim() ? md : null;
}

function hasUsableLink(root: Element): boolean {
  for (const a of Array.from(root.querySelectorAll("a"))) {
    if (safeHref(a.getAttribute("href"))) return true;
  }
  return false;
}

/** Drops schemes that would execute or smuggle content, and normalises the rest. */
function safeHref(raw: string | null): string | null {
  if (!raw) return null;
  const href = raw.trim();
  if (!href) return null;
  // Relative ("/x", "#y", "page.html") and absolute-path targets are fine.
  if (!/^[a-z][a-z0-9+.-]*:/i.test(href)) return href;
  if (/^(https?|mailto):/i.test(href)) return href;
  return null;
}

function isBlock(node: Node): boolean {
  return node.nodeType === 1 && BLOCK_TAGS.has((node as Element).tagName);
}

function childElements(node: Node): Element[] {
  return Array.from(node.childNodes).filter((c): c is Element => c.nodeType === 1);
}

/** Word marks an explicitly-emphasised-off run as `<b style="font-weight:normal">`. */
function styleTurnsOff(el: Element, property: RegExp): boolean {
  const style = el.getAttribute("style");
  return !!style && property.test(style.replace(/\s+/g, ""));
}

function inlineToMarkdown(node: Node): string {
  if (node.nodeType === 3) return (node.nodeValue ?? "").replace(/\s+/g, " ");
  if (node.nodeType !== 1) return "";
  const el = node as Element;
  const tag = el.tagName;
  if (SKIP_TAGS.has(tag)) return "";

  if (tag === "BR") return "\n";
  if (tag === "IMG") return imageToMarkdown(el);
  if (tag === "A") return linkToMarkdown(el);

  const inner = Array.from(el.childNodes).map(inlineToMarkdown).join("");

  switch (tag) {
    case "STRONG":
    case "B":
      return !inner.trim() || styleTurnsOff(el, /font-weight\s*:\s*normal/i) ? inner : `**${inner.trim()}**`;
    case "EM":
    case "I":
      return !inner.trim() || styleTurnsOff(el, /font-style\s*:\s*normal/i) ? inner : `*${inner.trim()}*`;
    case "DEL":
    case "S":
    case "STRIKE":
      return !inner.trim() || styleTurnsOff(el, /text-decoration[^;]*none/i) ? inner : `~~${inner.trim()}~~`;
    case "CODE":
    case "KBD":
    case "SAMP":
    case "TT":
      return !inner.trim() || inner.includes("\n") ? inner : `\`${inner.replace(/`/g, "\\`")}\``;
    case "U":
      // Underline has no markdown spelling; keep the words, drop the decoration.
      return inner;
    default:
      return inner;
  }
}

function imageToMarkdown(el: Element): string {
  const src = safeHref(el.getAttribute("src"));
  if (!src) return "";
  const alt = (el.getAttribute("alt") ?? "").replace(/\s+/g, " ").trim().replace(/[[\]]/g, "");
  return `![${alt}](${src})`;
}

function linkToMarkdown(el: Element): string {
  const href = safeHref(el.getAttribute("href"));
  const inner = anchorInner(el).trim();
  if (!inner) return "";
  if (!href) return inner;
  // An anchor wrapping block content (a "card" link: title + excerpt + date)
  // would produce a link spanning newlines, which markdown can't express. Link
  // the first line and keep the remainder as its own line rather than dropping
  // it — a space-joined line would also merge the excerpt into the link text.
  const newline = inner.indexOf("\n");
  if (newline === -1) {
    return /^\[.*\]\(.*\)$/.test(inner) ? inner : `[${inner}](${href})`;
  }
  // A card's title is usually an <h1>–<h3> inside the anchor. Heading level is
  // presentation for a link, and `parsePastedMarkdown` would read a leading "#"
  // inside the link text as a heading and nest the excerpt under it, so drop it.
  const first = inner.slice(0, newline).trim().replace(/^#{1,6}\s*/, "");
  const rest = inner.slice(newline).trim();
  return [first ? `[${first}](${href})` : "", rest].filter(Boolean).join("\n");
}

/**
 * An anchor's own content, with its block-level children rendered as markdown
 * and separated by newlines. The plain inline walk can't do this: it would
 * concatenate `<h3>` and `<p>` into one run of text and lose the boundary that
 * tells a card's title apart from its excerpt.
 */
function anchorInner(el: Element): string {
  const parts: string[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (isBlock(child)) {
      const lines = blockLines(child as Element, 0).join("\n");
      if (lines.trim()) parts.push(lines);
    } else {
      parts.push(inlineToMarkdown(child));
    }
  }
  return normalize(parts.join("\n"));
}

/** Markdown for one block element, as lines (a nested list is several lines). */
function blockLines(el: Element, depth: number): string[] {
  const tag = el.tagName;
  if (SKIP_TAGS.has(tag)) return [];

  if (tag === "UL" || tag === "OL") return listLines(el, depth);
  if (tag === "HR") return ["---"];
  if (tag === "PRE") return preLines(el);
  if (tag === "TABLE") return tableLines(el);
  // An anchor wrapping block children isn't in BLOCK_TAGS, so it reaches here
  // as a block; it still has to go through the link path or its href is lost.
  if (tag === "A") {
    const md = linkToMarkdown(el);
    return md ? md.split("\n") : [];
  }

  const heading = HEADING_RE.exec(tag);
  const inline: string[] = [];
  const nested: string[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (isBlock(child)) nested.push(...blockLines(child as Element, depth));
    else inline.push(inlineToMarkdown(child));
  }

  const body = normalize(inline.join("")).trim();
  if (heading) return body ? [`${"#".repeat(Number(heading[1]))} ${body}`] : [];

  const lines = body ? body.split("\n") : [];
  if (tag === "BLOCKQUOTE") {
    const quoted = lines.map((l) => `> ${l}`.trimEnd());
    return quoted.length ? [...quoted, ...nested] : nested;
  }
  return lines.length || nested.length ? [...lines, ...nested] : [];
}

function listLines(list: Element, depth: number): string[] {
  const ordered = list.tagName === "OL";
  const start = Number(list.getAttribute("start")) || 1;
  const pad = INDENT.repeat(depth);
  const out: string[] = [];
  let n = start;
  for (const li of childElements(list)) {
    if (li.tagName !== "LI") continue;
    const marker = ordered ? `${n}. ` : "- ";
    n++;
    const inline: string[] = [];
    const nested: string[] = [];
    for (const child of Array.from(li.childNodes)) {
      if (isBlock(child)) nested.push(...blockLines(child as Element, depth + 1));
      else inline.push(inlineToMarkdown(child));
    }
    const body = normalize(inline.join("")).trim();
    out.push(body ? `${pad}${marker}${body}` : `${pad}${marker}`);
    out.push(...nested);
  }
  return out;
}

function preLines(pre: Element): string[] {
  const code = pre.querySelector("code");
  const text = (code?.textContent ?? pre.textContent ?? "").replace(/\n$/, "");
  if (!text.trim()) return [];
  const fence = text.includes("```") ? "~~~" : "```";
  return [`${fence}`, ...text.split("\n"), fence];
}

function tableLines(table: Element): string[] {
  const rows: string[][] = [];
  for (const tr of Array.from(table.querySelectorAll("tr"))) {
    const cells = childElements(tr).filter((c) => c.tagName === "TD" || c.tagName === "TH");
    if (!cells.length) continue;
    rows.push(cells.map((c) => cellToMarkdown(c)));
  }
  if (!rows.length) return [];

  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array<string>(width - r.length).fill("")];
  const out: string[] = [pad(rows[0]).join(" | ").trim(), `|${" --- |".repeat(width)}`];
  for (const row of rows.slice(1)) out.push(pad(row).join(" | ").trim());
  return out;
}

function cellToMarkdown(cell: Element): string {
  const lines: string[] = [];
  const nested: string[] = [];
  for (const child of Array.from(cell.childNodes)) {
    if (isBlock(child)) nested.push(...blockLines(child as Element, 0));
    else lines.push(inlineToMarkdown(child));
  }
  const body = normalize(lines.join("")).trim();
  return [body, ...nested].filter(Boolean).join(" ").replace(/\|/g, "\\|");
}

function blocksToMarkdown(root: Element, depth: number): string {
  const out: string[] = [];
  for (const child of childElements(root)) {
    out.push(blockLines(child, depth).join("\n"));
  }
  return out.filter((p) => p.trim()).join("\n\n");
}

/** Collapses the runs of spaces that HTML source formatting leaves behind. */
function normalize(text: string): string {
  return text
    .split("\n")
    .map((l) => l.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/ *\n */g, "\n")
    .trim();
}
