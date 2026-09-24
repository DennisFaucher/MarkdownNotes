import { useRef, type MouseEvent } from "react";
import { getDisplayLines, groupDisplayLines } from "./derive";
import { renderInline, resolveClickOffset } from "../render/renderInline";
import { ResizableImage } from "../render/ResizableImage";
import { useTabsStore } from "../state/useTabsStore";
import { useUiStore } from "../state/useUiStore";
import { useBlockSpellCheck } from "./useBlockSpellCheck";

interface Props {
  blockId: string;
  source: string;
  marker?: string;
  // `spellMatchOffset`, when present, is the clicked word's SpellMatch.offset
  // — lets the caller (BlockRow) also ask the freshly-mounted editor to open
  // the suggestions popover immediately, instead of requiring a second click.
  onEnterEdit: (pos: number, spellMatchOffset?: number) => void;
  // Splices [start, end) of the raw source with `replacement` directly,
  // without entering edit mode — used by image resize, which persists
  // {:height H, :width W} while staying in the static view.
  onResizeImage: (start: number, end: number, replacement: string) => void;
  // Flips this block's own marker (TODO/DOING/... <-> DONE) in place, same
  // as clicking a badge in the To Dos dashboard — but from wherever the
  // block is normally visible, matching Logseq's own click-to-check-off.
  onToggleMarker: () => void;
}

// Uploaded images are referenced as "../assets/<file>" (one level up from
// journals/ or pages/, per the vault's on-disk layout — see server/src/api/
// assets.ts), which resolves to "/assets/<file>" at the HTTP root. An
// absolute URL (an externally-hosted image someone pasted a markdown link
// to) or an already-rooted path is left untouched.
function resolveImageSrc(src: string): string {
  if (/^(https?:)?\/\//.test(src) || src.startsWith("/")) return src;
  return `/${src.replace(/^(\.\.?\/)+/, "")}`;
}

const HEADING_RE = /^(#{1,6})\s+(.*)$/;

export function BlockStatic({ blockId, source, marker, onEnterEdit, onResizeImage, onToggleMarker }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
  const openTab = useTabsStore((s) => s.openTab);
  const spellcheckEnabled = useUiStore((s) => s.spellcheckEnabled);
  const spellMatches = useBlockSpellCheck(blockId, source, spellcheckEnabled);
  const segments = groupDisplayLines(getDisplayLines(source));

  // Entering edit mode used to preventDefault on mousedown, which also blocked
  // the browser's native click-and-drag text selection — so copy never worked
  // on a static (unfocused) block. Now mousedown just records where the drag
  // started, letting native selection happen; mouseup only enters edit mode if
  // nothing got selected, so a plain click still edits but a drag lets you copy.
  //
  // A leftover selection from a *previous* drag can still report non-collapsed
  // at the moment mouseup fires for a later plain click — the browser's own
  // "click collapses the old selection" isn't guaranteed to have run yet by
  // then. Clearing it ourselves on mousedown means whatever the mouseup check
  // sees can only be selection made during *this* interaction.
  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    mouseDownPos.current = { x: e.clientX, y: e.clientY };
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) selection.removeAllRanges();
  };

  const handleMouseUp = (e: MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const container = ref.current;
    const down = mouseDownPos.current;
    mouseDownPos.current = null;
    // No matching mousedown was recorded here — e.g. it started on an
    // interactive child (the image resize handle) that called
    // stopPropagation on it. That handler tracks its own drag via a
    // document-level listener, so this mouseup is just that gesture's tail
    // end bubbling through; without this check it would be misread as "no
    // drag, no selection" and wrongly enter edit mode right as a resize ends.
    if (!container || !down) return;

    const selection = window.getSelection();
    const hasSelection = !!selection && !selection.isCollapsed && selection.toString().length > 0;
    const dragged = !!down && (Math.abs(e.clientX - down.x) > 4 || Math.abs(e.clientY - down.y) > 4);
    if (hasSelection || dragged) return;

    const offset = resolveClickOffset(e.clientX, e.clientY, container);
    const markEl = (e.target as HTMLElement).closest<HTMLElement>(".mn-spell-mark");
    const spellMatchOffset = markEl?.dataset.spellOffset !== undefined ? Number(markEl.dataset.spellOffset) : undefined;
    onEnterEdit(offset ?? source.length, spellMatchOffset);
  };

  const handlers = {
    onNavigatePage: (title: string) => openTab({ kind: "page", id: title, title }),
    onNavigateTag: (tag: string) => openTab({ kind: "tag", id: tag, title: `#${tag}` }),
  };

  return (
    <div
      ref={ref}
      className="mn-block-static"
      data-block-id={blockId}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {marker && (
        <button
          className={`mn-marker mn-marker-${marker.toLowerCase()} mn-todo-checkbox`}
          title="Toggle done"
          // Both mousedown and mouseup stop propagation — the block's own
          // click-to-edit runs on mouseup (see handleMouseUp), so without
          // this a click here would toggle the marker and then also enter
          // edit mode, same pattern as Chip.tsx's tag/page chips.
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleMarker();
          }}
          onMouseUp={(e) => e.stopPropagation()}
        >
          {marker}
        </button>
      )}
      {segments.map((seg, i) => {
        if (seg.kind === "code") {
          return (
            <pre key={i} className="mn-code-block">
              <code>
                {seg.lines.map((l, j) => (
                  <span key={j} data-s={l.sourceOffset} data-e={l.sourceOffset + l.text.length}>
                    {l.text}
                    {j < seg.lines.length - 1 ? "\n" : ""}
                  </span>
                ))}
              </code>
            </pre>
          );
        }
        if (seg.kind === "table") {
          return (
            <table key={i} className="mn-table">
              <thead>
                <tr>
                  {seg.header.map((c, ci) => (
                    <th key={ci} style={{ textAlign: seg.align[ci] }}>
                      {renderInline(c.text, handlers, c.sourceOffset, spellMatches)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {seg.rows.map((row, ri) => (
                  <tr key={ri}>
                    {row.map((c, ci) => (
                      <td key={ci} style={{ textAlign: seg.align[ci] }}>
                        {renderInline(c.text, handlers, c.sourceOffset, spellMatches)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        if (seg.kind === "image") {
          const { alt, src, width, height, sourceStart, sourceEnd } = seg.image;
          return (
            <ResizableImage
              key={i}
              src={resolveImageSrc(src)}
              alt={alt}
              width={width}
              height={height}
              onResize={(w, h) => onResizeImage(sourceStart, sourceEnd, `![${alt}](${src}){:height ${h}, :width ${w}}`)}
            />
          );
        }
        const line = seg.line;
        const hm = HEADING_RE.exec(line.text);
        if (hm) {
          const level = hm[1].length;
          const headingText = hm[2];
          const prefixLen = line.text.length - headingText.length;
          const Heading = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
          return (
            <Heading key={i} className={`mn-heading mn-h${level}`}>
              {renderInline(headingText, handlers, line.sourceOffset + prefixLen, spellMatches)}
            </Heading>
          );
        }
        return (
          <div key={i} className="mn-block-line">
            {renderInline(line.text, handlers, line.sourceOffset, spellMatches)}
          </div>
        );
      })}
    </div>
  );
}
