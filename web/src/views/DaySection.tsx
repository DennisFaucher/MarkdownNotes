import { useDocStore } from "../state/useDocStore";
import { useTabsStore } from "../state/useTabsStore";
import { BlockTree } from "../editor/BlockTree";
import { PreLines } from "../editor/PreLines";

export function DaySection({ dayId }: { dayId: string }) {
  const doc = useDocStore((s) => s.docs[dayId]);
  const openTab = useTabsStore((s) => s.openTab);
  if (!doc) return null;

  return (
    <section className="mn-day-section">
      <h2
        className="mn-day-title mn-day-title-link"
        onClick={() => openTab({ kind: "journal-day", id: dayId, title: doc.title })}
        title="Open this day in its own tab"
      >
        {doc.title}
      </h2>
      <PreLines preLines={doc.preLines} />
      <BlockTree docId={dayId} />
    </section>
  );
}
