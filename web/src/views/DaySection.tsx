import { useDocStore } from "../state/useDocStore";
import { BlockTree } from "../editor/BlockTree";

export function DaySection({ dayId }: { dayId: string }) {
  const doc = useDocStore((s) => s.docs[dayId]);
  if (!doc) return null;

  return (
    <section className="mn-day-section">
      <h2 className="mn-day-title">{doc.title}</h2>
      <BlockTree docId={dayId} />
    </section>
  );
}
