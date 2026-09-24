import { useEffect, useState } from "react";
import { fetchTag, type TaggedBlock } from "../sync/api";
import { useTabsStore } from "../state/useTabsStore";

const HEADING_RE = /^#{1,6}\s+/;

function stripHeadingMarker(text: string): string {
  return text.replace(HEADING_RE, "");
}

export function TagView({ tag }: { tag: string }) {
  const [blocks, setBlocks] = useState<TaggedBlock[] | null>(null);
  const openTab = useTabsStore((s) => s.openTab);

  useEffect(() => {
    setBlocks(null);
    fetchTag(tag)
      .then((r) => setBlocks(r.blocks))
      .catch(console.error);
  }, [tag]);

  const openResult = (b: TaggedBlock) => {
    if (b.pageKind === "journal") {
      const id = b.path.split("/").pop()!.replace(/\.md$/, "");
      openTab({ kind: "journal-day", id, title: b.pageTitle });
    } else {
      openTab({ kind: "page", id: b.pageTitle, title: b.pageTitle });
    }
  };

  return (
    <div className="mn-tag-view">
      <h1 className="mn-page-title">#{tag}</h1>
      {blocks === null && <p>Loading…</p>}
      {blocks?.length === 0 && <p>No blocks tagged #{tag} yet.</p>}
      <ul className="mn-tag-results">
        {blocks?.map((b) => (
          <li key={b.blockId} className="mn-tag-result">
            <button className="mn-tag-result-source" onClick={() => openResult(b)}>
              {b.pageTitle}
            </button>
            {b.depth > 0 && <div className="mn-tag-result-breadcrumb">{stripHeadingMarker(b.topContent)}</div>}
            <div className="mn-tag-result-content">{b.content}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
