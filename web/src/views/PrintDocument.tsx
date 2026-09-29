import { useEffect, useRef } from "react";
import { useCurrentDocId } from "../editor/currentDoc";
import { getDisplayLines, groupDisplayLines } from "../editor/derive";
import { resolveImageSrc } from "../editor/imageSrc";
import { renderInline } from "../render/renderInline";
import { useDocStore } from "../state/useDocStore";
import { useUiStore } from "../state/useUiStore";
import type { EditorBlock } from "../types/block";

/**
 * Builds a throwaway, print-only rendering of the open document and hands it to
 * the browser's print dialog ("Save as PDF" in every modern browser).
 *
 * Why this is a separate document rather than just printing the live view:
 *
 *  - `.mn-day-section` sets `content-visibility: auto`, so a print of the live
 *    view *skips off-screen sections* — the PDF would silently lose most of a
 *    long journal. (This is the same property that already makes it a
 *    containing block for the code copy button; see app.css.)
 *  - `BlockTree` renders only `getVisibleIndices(doc.blocks)`, so anything under
 *    a `collapsed:: true` block is not in the DOM at all and no print stylesheet
 *    can recover it. A PDF that quietly omitted collapsed sections would look
 *    like data loss, so every block is rendered here, expanded.
 *
 * Rendering reuses the app's own `getDisplayLines`/`groupDisplayLines` parsing
 * and `renderInline` chip renderer, so what prints matches what is on screen.
 * What is deliberately *not* reused is `BlockStatic`: it is built around editing
 * (spellcheck marks, click-to-edit, resize handles, tag chips that navigate), all
 * of which are meaningless or actively wrong on paper. The presentation of the
 * four segment kinds is therefore restated here rather than shared.
 */
export function PrintDocument() {
  const printOpen = useUiStore((s) => s.printOpen);
  const closePrint = useUiStore((s) => s.closePrint);
  const registerPrintDone = useUiStore((s) => s.registerPrintDone);
  const docId = useCurrentDocId();
  const doc = useDocStore((s) => (docId ? s.docs[docId] : undefined));
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!printOpen) return;
    const root = rootRef.current;
    if (!root) {
      closePrint();
      return;
    }
    // Images must be decoded before print() or the PDF gets empty boxes. Each
    // img settles via its own load/error, so we never wait forever on a
    // broken external URL — and a failure still prints, just without that image.
    const imgs = Array.from(root.querySelectorAll("img"));
    const done = Promise.all(
      imgs.map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.addEventListener("load", () => res(), { once: true });
              img.addEventListener("error", () => res(), { once: true });
            }),
      ),
    );
    let cancelled = false;
    // rAF so the print-only DOM is laid out (and the images have started
    // loading) before the dialog steals the main thread.
    const raf = requestAnimationFrame(() => {
      done.then(() => {
        if (cancelled) return;
        window.print();
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [printOpen, docId, closePrint]);

  // Close once the dialog is dismissed, so the hidden document doesn't linger in
  // the DOM (and isn't left for a stray second Ctrl+P to reuse). `afterprint` is
  // the primary signal; the store's fallback covers engines that omit it.
  useEffect(() => {
    if (!printOpen) return;
    return registerPrintDone(closePrint);
  }, [printOpen, closePrint, registerPrintDone]);

  if (!printOpen || !doc) return null;

  // `doc.title` is already display-ready for both kinds: a page is its name, and
  // a journal day arrives from the server pre-formatted ("Dec 31st, 2099"), the
  // same string the tab bar shows. Do not re-format it here — an earlier
  // version assumed the ISO `2026-09-29` shape and would have silently
  // passed the server's string straight through anyway.
  const title = doc.title;

  return (
    <div className="mn-print-root" ref={rootRef}>
      <h1 className="mn-print-title">{title}</h1>
      <div className="mn-print-body">
        {doc.blocks.map((b, i) => (
          <PrintBlock key={`${i}-${b.id}`} block={b} />
        ))}
      </div>
    </div>
  );
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;

function PrintBlock({ block }: { block: EditorBlock }) {
  const segments = groupDisplayLines(getDisplayLines(block.source));
  // No-op handlers: a printed page can't navigate, and a tag chip that
  // silently does nothing is better than one that throws.
  const handlers = { onNavigatePage: () => {}, onNavigateTag: () => {} };

  return (
    <div className="mn-print-block" style={{ paddingLeft: `${block.depth * 18}px` }}>
      {block.marker && <span className={`mn-print-marker mn-print-marker-${block.marker.toLowerCase()}`}>{markerGlyph(block.marker)}</span>}
      {segments.map((seg, i) => {
        if (seg.kind === "code") {
          return (
            <pre key={i} className="mn-print-code">
              <code>{seg.lines.map((l, j) => `${l.text}${j < seg.lines.length - 1 ? "\n" : ""}`).join("")}</code>
            </pre>
          );
        }
        if (seg.kind === "table") {
          return (
            <table key={i} className="mn-print-table">
              <thead>
                <tr>
                  {seg.header.map((c, ci) => (
                    <th key={ci} style={{ textAlign: seg.align[ci] }}>
                      {renderInline(c.text, handlers, c.sourceOffset, [])}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seg.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((c, ci) => (
                      <td key={ci} style={{ textAlign: seg.align[ci] }}>
                        {renderInline(c.text, handlers, c.sourceOffset, [])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        if (seg.kind === "image") {
          const { alt, src, width, height } = seg.image;
          return <img key={i} className="mn-print-image" src={resolveImageSrc(src)} alt={alt} width={width} height={height} />;
        }
        const line = seg.line;
        const hm = HEADING_RE.exec(line.text);
        if (hm) {
          const level = Math.min(hm[1].length, 6);
          const Heading = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
          return (
            <Heading key={i} className="mn-print-heading">
              {renderInline(hm[2], handlers, line.text.length - hm[2].length, [])}
            </Heading>
          );
        }
        return (
          <div key={i} className="mn-print-line">
            {renderInline(line.text, handlers, line.sourceOffset, [])}
          </div>
        );
      })}
    </div>
  );
}

/** Paper can't show Logseq's text markers, so use the same glyphs the on-screen
 *  checkbox uses rather than printing the literal words. */
function markerGlyph(marker: string): string {
  switch (marker) {
    case "DONE":
    case "CANCELED":
      return "☒";
    case "DOING":
    case "NOW":
      return "◐";
    case "WAITING":
      return "◔";
    case "LATER":
      return "◌";
    default:
      return "☐";
  }
}
