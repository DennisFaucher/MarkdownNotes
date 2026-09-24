import { useTabsStore } from "../state/useTabsStore";
import { useUiStore } from "../state/useUiStore";

export function Sidebar() {
  const openTab = useTabsStore((s) => s.openTab);
  const activeKey = useTabsStore((s) => s.activeKey);
  const favorites = useTabsStore((s) => s.favorites);
  const recents = useTabsStore((s) => s.recents);
  const toggleFavorite = useTabsStore((s) => s.toggleFavorite);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const closeSidebar = useUiStore((s) => s.closeSidebar);

  // On a narrow viewport the sidebar is an off-canvas drawer (see the mobile
  // media query in app.css) — navigating should close it the same way a
  // native app's drawer does, rather than leaving it open over the content
  // you just chose to view. Above the breakpoint this is a no-op visually,
  // since CSS forces the sidebar visible regardless of sidebarOpen there.
  const go = (fn: () => void) => () => {
    fn();
    closeSidebar();
  };

  return (
    <>
      {sidebarOpen && <div className="mn-sidebar-backdrop" onClick={closeSidebar} />}
      <aside className={`mn-sidebar${sidebarOpen ? " mn-sidebar-open" : ""}`}>
        <div className="mn-workspace-name">MarkdownNotes</div>

        <nav className="mn-nav">
          <button className={`mn-nav-item${activeKey === "journals" ? " active" : ""}`} onClick={go(() => openTab({ kind: "journals" }))}>
            Journals
          </button>
          <button className={`mn-nav-item${activeKey === "all-pages" ? " active" : ""}`} onClick={go(() => openTab({ kind: "all-pages" }))}>
            All pages
          </button>
          <button className={`mn-nav-item${activeKey === "todos" ? " active" : ""}`} onClick={go(() => openTab({ kind: "todos" }))}>
            To Dos
          </button>
        </nav>

        <div className="mn-sidebar-section">
          <div className="mn-sidebar-heading">Favorites</div>
          {favorites.length === 0 && <div className="mn-sidebar-empty">No favorites yet</div>}
          {favorites.map((f) => (
            <div key={f.id} className="mn-sidebar-row">
              <button
                className={`mn-nav-item${activeKey === `page:${f.id}` ? " active" : ""}`}
                onClick={go(() => openTab({ kind: "page", id: f.id, title: f.title }))}
              >
                {f.title}
              </button>
              <button className="mn-unfavorite" title="Remove from favorites" onClick={() => toggleFavorite(f.id, f.title)}>
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="mn-sidebar-section">
          <div className="mn-sidebar-heading">Recent</div>
          {recents.length === 0 && <div className="mn-sidebar-empty">Nothing recent</div>}
          {recents.map((r) => (
            <button
              key={r.id}
              className={`mn-nav-item${activeKey === `page:${r.id}` ? " active" : ""}`}
              onClick={go(() => openTab({ kind: "page", id: r.id, title: r.title }))}
            >
              {r.title}
            </button>
          ))}
        </div>
      </aside>
    </>
  );
}
