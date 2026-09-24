import { useTabsStore } from "../state/useTabsStore";
import { JournalsFeed } from "../views/JournalsFeed";
import { AllPages } from "../views/AllPages";
import { PageView } from "../views/PageView";
import { TagView } from "../views/TagView";
import { JournalDayView } from "../views/JournalDayView";
import { TodosView } from "../views/TodosView";

export function MainPane() {
  const tabs = useTabsStore((s) => s.tabs);
  const activeKey = useTabsStore((s) => s.activeKey);
  const active = tabs.find((t) => t.key === activeKey);

  return (
    <main className="mn-main-pane">
      <div className="mn-page-card">
        {active?.target.kind === "journals" && <JournalsFeed />}
        {active?.target.kind === "all-pages" && <AllPages />}
        {active?.target.kind === "todos" && <TodosView />}
        {active?.target.kind === "page" && <PageView id={active.target.id} title={active.target.title} />}
        {active?.target.kind === "tag" && <TagView tag={active.target.id} />}
        {active?.target.kind === "journal-day" && <JournalDayView id={active.target.id} />}
      </div>
    </main>
  );
}
