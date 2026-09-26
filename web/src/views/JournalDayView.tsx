import { useEffect } from "react";
import { useDocStore } from "../state/useDocStore";
import { fetchJournalDay } from "../sync/api";
import { BlockTree } from "../editor/BlockTree";
import { PreLines } from "../editor/PreLines";

/** A single journal day, addressable outside the main Journals feed's rolling
 *  pagination window — used when search or a tag link points at a specific day. */
export function JournalDayView({ id }: { id: string }) {
  const doc = useDocStore((s) => s.docs[id]);
  const setDoc = useDocStore((s) => s.setDoc);

  useEffect(() => {
    if (!doc) {
      fetchJournalDay(id.replace(/_/g, "-")).then(setDoc).catch(console.error);
    }
  }, [id, doc, setDoc]);

  if (!doc) return <div className="mn-page-view mn-loading">Loading…</div>;

  return (
    <div className="mn-page-view">
      <h1 className="mn-day-title">{doc.title}</h1>
      <PreLines preLines={doc.preLines} />
      <BlockTree docId={id} />
    </div>
  );
}
