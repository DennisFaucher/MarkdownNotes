import type { ReactNode } from "react";
import { Chip, ExternalLinkSpan } from "./Chip";
import type { SpellMatch } from "../sync/api";

// `inline code` | **bold** | *italic* | [[page ref]] | #tag | bare URL. Images
// are still deferred. Alternation order matters: code is tried first so a
// backtick span's contents are never re-tokenized, and bold (**) is tried
// before italic (*) so "**x**" isn't parsed as italic around a stray "*x*".
// Bold/italic require a non-whitespace character on each inner edge (CommonMark's
// flanking rule, simplified) so "3 * 4 * 5" isn't misread as italic.
const TOKEN_RE =
  /(`([^`]+)`)|(\*\*(\S(?:[^*]*\S)?)\*\*)|(\*(\S(?:[^*]*\S)?)\*)|(\[\[([^\]]+)\]\])|(#([A-Za-z][A-Za-z0-9_\-/]*))|(https?:\/\/[^\s)]+)/g;

export interface InlineHandlers {
  onNavigatePage: (title: string) => void;
  onNavigateTag: (tag: string) => void;
}

/** Splits one plain-text run into data-s/data-e spans, further slicing out any
 *  spellcheck match ranges that fall inside it into <mark> elements carrying
 *  the same data-s/data-e — so a static (unfocused) block shows the same
 *  wavy underlines as the live editor, and clicking one still resolves to the
 *  right caret offset via the normal [data-s] lookup. */
function renderTextRun(text: string, absOffset: number, spellMatches: SpellMatch[], keyPrefix: string): ReactNode[] {
  const absEnd = absOffset + text.length;
  const relevant = spellMatches
    .filter((m) => m.offset < absEnd && m.offset + m.length > absOffset)
    .sort((a, b) => a.offset - b.offset);
  if (relevant.length === 0) {
    return [
      <span key={keyPrefix} data-s={absOffset} data-e={absEnd}>
        {text}
      </span>,
    ];
  }
  const out: ReactNode[] = [];
  let cursor = absOffset;
  relevant.forEach((m, i) => {
    const mStart = Math.max(m.offset, absOffset);
    const mEnd = Math.min(m.offset + m.length, absEnd);
    if (mStart > cursor) {
      out.push(
        <span key={`${keyPrefix}-t${i}`} data-s={cursor} data-e={mStart}>
          {text.slice(cursor - absOffset, mStart - absOffset)}
        </span>,
      );
    }
    const cls = m.issueType === "misspelling" ? "mn-spell-misspelling" : "mn-spell-other";
    out.push(
      <mark
        key={`${keyPrefix}-m${i}`}
        className={`mn-spell-mark ${cls}`}
        data-s={mStart}
        data-e={mEnd}
        data-spell-offset={m.offset}
      >
        {text.slice(mStart - absOffset, mEnd - absOffset)}
      </mark>,
    );
    cursor = mEnd;
  });
  if (cursor < absEnd) {
    out.push(
      <span key={`${keyPrefix}-tail`} data-s={cursor} data-e={absEnd}>
        {text.slice(cursor - absOffset)}
      </span>,
    );
  }
  return out;
}

/** Renders text as chips/links, each stamped with data-s/data-e source offsets so
 * a click on plain text can resolve back to an exact caret position in the raw
 * markdown (see BlockStatic's click handler).
 *
 * Uses matchAll rather than a manual TOKEN_RE.exec loop: bold/italic recurse into
 * this function for their inner content, and exec's shared, mutable `lastIndex`
 * on the single module-level TOKEN_RE would get clobbered by the recursive call,
 * corrupting the outer loop's position and spinning it into an infinite loop.
 * matchAll iterates its own internal copy, so recursion is safe. */
export function renderInline(
  text: string,
  handlers: InlineHandlers,
  baseOffset = 0,
  spellMatches: SpellMatch[] = [],
): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    if (m.index > lastIndex) {
      nodes.push(...renderTextRun(text.slice(lastIndex, m.index), baseOffset + lastIndex, spellMatches, `r${key++}`));
    }
    const start = m.index;
    const end = start + m[0].length;
    if (m[1]) {
      // Inline code isn't a chip — it stays a plain editable span, just styled,
      // so data-s/data-e cover the content only (backticks excluded) and a click
      // inside it resolves to an exact offset the same way plain text does.
      const content = m[2];
      nodes.push(
        <code key={key++} className="mn-inline-code" data-s={baseOffset + start + 1} data-e={baseOffset + end - 1}>
          {content}
        </code>,
      );
    } else if (m[3]) {
      // Recursing lets a tag/link/code span still work inside bold or italic text.
      // The inner spans carry their own data-s/data-e, so the wrapper needs none.
      const content = m[4];
      nodes.push(
        <strong key={key++}>{renderInline(content, handlers, baseOffset + start + 2, spellMatches)}</strong>,
      );
    } else if (m[5]) {
      const content = m[6];
      nodes.push(<em key={key++}>{renderInline(content, handlers, baseOffset + start + 1, spellMatches)}</em>);
    } else if (m[7]) {
      const title = m[8];
      nodes.push(
        <Chip key={key++} kind="page" label={title} dataS={baseOffset + start} dataE={baseOffset + end} onActivate={() => handlers.onNavigatePage(title)} />,
      );
    } else if (m[9]) {
      const tag = m[10];
      nodes.push(
        <Chip key={key++} kind="tag" label={`#${tag}`} dataS={baseOffset + start} dataE={baseOffset + end} onActivate={() => handlers.onNavigateTag(tag)} />,
      );
    } else if (m[11]) {
      nodes.push(<ExternalLinkSpan key={key++} href={m[11]} dataS={baseOffset + start} dataE={baseOffset + end} />);
    }
    lastIndex = end;
  }
  if (lastIndex < text.length) {
    nodes.push(...renderTextRun(text.slice(lastIndex), baseOffset + lastIndex, spellMatches, `r${key++}`));
  }
  if (nodes.length === 0) {
    nodes.push(
      <span key={0} data-s={baseOffset} data-e={baseOffset}>
        {" "}
      </span>,
    );
  }
  return nodes;
}

/** Resolves a DOM (node, offset) pair — from a click point or a Selection/Range
 * boundary — to a source character offset, via the nearest ancestor's data-s. */
export function resolveNodeOffset(node: Node, offsetInNode: number, container?: HTMLElement): number | null {
  const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
  const spanEl = el?.closest<HTMLElement>("[data-s]");
  if (!spanEl) return null;
  if (container && !container.contains(spanEl)) return null;
  const dataS = Number(spanEl.dataset.s);
  if (spanEl.dataset.chip === "true") return dataS;
  return dataS + offsetInNode;
}

/** Maps a mouse click on rendered inline content back to a source character offset. */
export function resolveClickOffset(clientX: number, clientY: number, container: HTMLElement): number | null {
  const anyDoc = document as unknown as {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
  };
  let node: Node | null = null;
  let offsetInNode = 0;
  if (anyDoc.caretRangeFromPoint) {
    const range = anyDoc.caretRangeFromPoint(clientX, clientY);
    if (!range) return null;
    node = range.startContainer;
    offsetInNode = range.startOffset;
  } else if (anyDoc.caretPositionFromPoint) {
    const pos = anyDoc.caretPositionFromPoint(clientX, clientY);
    if (!pos) return null;
    node = pos.offsetNode;
    offsetInNode = pos.offset;
  } else {
    return null;
  }
  return resolveNodeOffset(node, offsetInNode, container);
}
