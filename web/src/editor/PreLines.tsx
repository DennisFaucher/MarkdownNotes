import { useTabsStore } from "../state/useTabsStore";
import { renderInline } from "../render/renderInline";

/** `### Heading` -> level + text; the trailing-space form also allows an
 *  empty heading (`###`), which the real vault contains. */
const HEADING_RE = /^(#{1,6})\s*(.*)$/;

/** A Logseq block property, e.g. `collapsed:: true`. Carries real meaning to
 *  Logseq, so it is shown rather than hidden — but not as body text. */
const PROPERTY_RE = /^([A-Za-z][A-Za-z0-9_-]*)::\s*(.*)$/;

/** Renders a document's `preLines` — the run of non-bullet lines that precede
 *  the first block in a markdown file.
 *
 *  The parser deliberately keeps these separate from blocks (see
 *  server/src/markdown/tokenize.ts): the block editor's whole addressing model
 *  is `(file path, block_index)` over bullet lines, and these lines are not
 *  bullets. They survive untouched — `serializeDoc` re-emits them verbatim and
 *  every write carries them over from disk — but until now no view rendered
 *  them, so a journal whose first line is a `### heading` (148 files in the
 *  real vault, all imported from Logseq) silently showed that heading nowhere
 *  even though it was present in the file.
 *
 *  Display-only by design: clicking does not enter edit mode, because there is
 *  no block to attach an editor to. Editing a heading means editing the file.
 */
export function PreLines({ preLines }: { preLines: string[] }) {
  const openTab = useTabsStore((s) => s.openTab);
  if (preLines.length === 0) return null;

  const handlers = {
    onNavigatePage: (title: string) => openTab({ kind: "page", id: title, title }),
    onNavigateTag: (tag: string) => openTab({ kind: "tag", id: tag, title: `#${tag}` }),
  };

  return (
    <div className="mn-prelines">
      {preLines.map((line, i) => {
        const hm = HEADING_RE.exec(line);
        if (hm) {
          const level = hm[1].length;
          const text = hm[2];
          const Heading = `h${Math.min(level, 6)}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
          return (
            <Heading key={i} className={`mn-heading mn-h${level}`}>
              {renderInline(text, handlers, 0)}
            </Heading>
          );
        }
        const pm = PROPERTY_RE.exec(line);
        if (pm) {
          return (
            <div key={i} className="mn-preline-property">
              <span className="mn-preline-property-key">{pm[1]}</span>
              <span className="mn-preline-property-value">{renderInline(pm[2], handlers, 0)}</span>
            </div>
          );
        }
        return (
          <div key={i} className="mn-preline-line">
            {renderInline(line, handlers, 0)}
          </div>
        );
      })}
    </div>
  );
}
