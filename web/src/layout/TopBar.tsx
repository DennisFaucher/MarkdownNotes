import { useUiStore } from "../state/useUiStore";
import { IndentButtons } from "./IndentButtons";

export function TopBar() {
  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const openSearch = useUiStore((s) => s.openSearch);
  const openCalendar = useUiStore((s) => s.openCalendar);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

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
      <IndentButtons />
      <div className="mn-top-bar-spacer" />
      <button className="mn-theme-toggle" onClick={toggleTheme} title="Toggle theme">
        {theme === "light" ? "🌙" : "☀️"}
      </button>
    </div>
  );
}
