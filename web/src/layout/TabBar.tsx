import { useTabsStore, type Tab } from "../state/useTabsStore";

function tabLabel(tab: Tab): string {
  if (tab.target.kind === "journals") return "Journals";
  if (tab.target.kind === "all-pages") return "All pages";
  if (tab.target.kind === "todos") return "To Dos";
  return tab.target.title;
}

export function TabBar() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeKey = useTabsStore((s) => s.activeKey);
  const setActive = useTabsStore((s) => s.setActive);
  const closeTab = useTabsStore((s) => s.closeTab);

  return (
    <div className="mn-tab-bar">
      {tabs.map((tab) => (
        <div key={tab.key} className={`mn-tab${tab.key === activeKey ? " active" : ""}`} onClick={() => setActive(tab.key)}>
          <span className="mn-tab-label">{tabLabel(tab)}</span>
          {tab.key !== "journals" && (
            <button
              className="mn-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.key);
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
