import { useEffect, useRef, useState, type ReactNode } from "react";
import { searchNotes, type SearchResult } from "../sync/api";
import { useTabsStore } from "../state/useTabsStore";
import { useUiStore } from "../state/useUiStore";

const DEBOUNCE_MS = 150;
const HEADING_RE = /^#{1,6}\s+/;

function stripHeadingMarker(text: string): string {
  return text.replace(HEADING_RE, "");
}

// Matches the sentinel control characters the server wraps FTS5 matches in
// (see server/src/index/search.ts) — never render this as raw HTML, since the
// text between them is the user's own note content and isn't escaped by
// SQLite's snippet(). Splitting like this keeps every character passing
// through ordinary JSX text children, which React escapes automatically.
function renderSnippet(snippet: string): ReactNode[] {
  return snippet.split(/[\u0001\u0002]/).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : part));
}

export function SearchModal() {
  const open = useUiStore((s) => s.searchOpen);
  const closeSearch = useUiStore((s) => s.closeSearch);
  const openTab = useTabsStore((s) => s.openTab);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      // let the modal mount before focusing
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(() => {
      searchNotes(query)
        .then((r) => {
          setResults(r.results);
          setActiveIndex(0);
        })
        .catch(console.error);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  if (!open) return null;

  const trimmedQuery = query.trim();
  // Always offered alongside real matches (not just when there are zero) — a
  // content match for "Project Alpha" in a journal entry doesn't mean a
  // dedicated page named that already exists. Opening it is idempotent: if a
  // page with that exact title already exists, this just opens it instead.
  const showCreateOption = trimmedQuery.length > 0;
  const createIndex = results.length;
  const itemCount = results.length + (showCreateOption ? 1 : 0);

  const openResult = (r: SearchResult) => {
    if (r.pageKind === "journal") {
      const id = r.path.split("/").pop()!.replace(/\.md$/, "");
      openTab({ kind: "journal-day", id, title: r.pageTitle });
    } else {
      openTab({ kind: "page", id: r.pageTitle, title: r.pageTitle });
    }
    closeSearch();
  };

  const createPage = () => {
    if (!trimmedQuery) return;
    openTab({ kind: "page", id: trimmedQuery, title: trimmedQuery });
    closeSearch();
  };

  const activate = (index: number) => {
    if (index === createIndex) createPage();
    else if (results[index]) openResult(results[index]);
  };

  return (
    <div className="mn-search-overlay" onMouseDown={closeSearch}>
      <div className="mn-search-box" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="mn-search-input"
          placeholder="Search your notes…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              closeSearch();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setActiveIndex((i) => Math.min(i + 1, itemCount - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActiveIndex((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              activate(activeIndex);
            }
          }}
        />
        <ul className="mn-search-results">
          {results.map((r, i) => (
            <li
              key={r.blockId}
              className={`mn-search-result${i === activeIndex ? " active" : ""}`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                openResult(r);
              }}
            >
              <div className="mn-search-result-title">{r.pageTitle}</div>
              {r.depth > 0 && <div className="mn-search-result-breadcrumb">{stripHeadingMarker(r.topContent)}</div>}
              <div className="mn-search-result-snippet">{renderSnippet(r.snippet)}</div>
            </li>
          ))}
          {query.trim() && results.length === 0 && <li className="mn-search-empty">No matches</li>}
          {showCreateOption && (
            <li
              className={`mn-search-result mn-search-create${createIndex === activeIndex ? " active" : ""}`}
              onMouseEnter={() => setActiveIndex(createIndex)}
              onMouseDown={(e) => {
                e.preventDefault();
                createPage();
              }}
            >
              + Create page: <strong>{trimmedQuery}</strong>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
