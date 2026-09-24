import { useEffect } from "react";
import { useDocStore } from "../state/useDocStore";
import { useTabsStore } from "../state/useTabsStore";
import { fetchPage } from "../sync/api";
import { BlockTree } from "../editor/BlockTree";

export function PageView({ id, title }: { id: string; title: string }) {
  const doc = useDocStore((s) => s.docs[id]);
  const setDoc = useDocStore((s) => s.setDoc);
  const isFavorite = useTabsStore((s) => s.isFavorite(id));
  const toggleFavorite = useTabsStore((s) => s.toggleFavorite);

  useEffect(() => {
    if (!doc) {
      fetchPage(id).then(setDoc).catch(console.error);
    }
  }, [id, doc, setDoc]);

  if (!doc) return <div className="mn-page-view mn-loading">Loading…</div>;

  return (
    <div className="mn-page-view">
      <div className="mn-page-header">
        <h1 className="mn-page-title">{doc.title}</h1>
        <button
          className={`mn-favorite-toggle${isFavorite ? " active" : ""}`}
          onClick={() => toggleFavorite(id, title)}
          title={isFavorite ? "Remove from favorites" : "Add to favorites"}
        >
          {isFavorite ? "★" : "☆"}
        </button>
      </div>
      <BlockTree docId={id} />
    </div>
  );
}
