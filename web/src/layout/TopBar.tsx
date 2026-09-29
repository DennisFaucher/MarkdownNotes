import { useUiStore } from "../state/useUiStore";
import { useCurrentDocId } from "../editor/currentDoc";
import { useDocStore } from "../state/useDocStore";
import { IndentButtons } from "./IndentButtons";

export function TopBar() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const openSearch = useUiStore((s) => s.openSearch);
  const openCalendar = useUiStore((s) => s.openCalendar);
  const openPrint = useUiStore((s) => s.openPrint);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  // Which document the print button would capture. Deliberately the same
  // "prefer an explicit tab" resolution find & replace uses, rather than
  // focusedBlock — which is null by the time a toolbar click runs, and always
  // null on touch. Must be the *reactive* hook, not getCurrentDocId(): the
  // plain function is a getState() snapshot and would leave this stuck on
  // whatever was true at the last render, i.e. permanently disabled.
  const docId = useCurrentDocId();
  // The doc must actually be loaded, not merely targeted. Both PageView and
  // JournalDayView render `.mn-page-view` while still fetching (it doubles as
  // the "Loading…" state), so a click in that window would otherwise reach
  // PrintDocument, find no doc to render, and silently do nothing.
  //
  // The selector hook is called unconditionally and the null check is applied
  // to its RESULT. Short-circuiting the call itself (`docId !== null &&
  // useDocStore(...)`) is a conditional hook — the hook count changes when the
  // active tab has no doc, which React throws on (minified error #310) and
  // which blanks the whole app.
  const docLoaded = useDocStore((s) => (docId === null ? true : s.docs[docId] !== undefined));
  const printable = docId !== null && docLoaded;

  return (
    <div className="mn-top-bar">
      <button className="mn-hamburger" onClick={toggleSidebar} title="Menu" aria-label="Toggle sidebar">
        ☰
      </button>
      <button className="mn-search-trigger" onClick={openSearch} title="Search (Cmd+K)">
        🔍
      </button>
      <button className="mn-calendar-trigger" onClick={openCalendar} title="Jump to date">
        📅
      </button>
      <button
        className="mn-print-trigger"
        onClick={openPrint}
        disabled={!printable}
        title={
          printable
            ? "Print / Save as PDF"
            : "Open a page, journal day, or tag to print it"
        }
        aria-label="Print or save as PDF"
      >
        🖨
      </button>
      <IndentButtons />
      <div className="mn-top-bar-spacer" />
      <button className="mn-theme-toggle" onClick={toggleTheme} title="Toggle theme">
        {theme === "light" ? "🌙" : "☀️"}
      </button>
    </div>
  );
}
