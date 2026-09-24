import { useEffect, useState } from "react";
import { fetchAllPages } from "../sync/api";
import { useTabsStore } from "../state/useTabsStore";

export function AllPages() {
  const [pages, setPages] = useState<{ id: string; title: string }[] | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const openTab = useTabsStore((s) => s.openTab);

  useEffect(() => {
    fetchAllPages().then((r) => setPages(r.pages)).catch(console.error);
  }, []);

  const createPage = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    // No separate "create" step — a page only becomes a real file once you save
    // content into it, same as typing [[a new page name]] and clicking it.
    openTab({ kind: "page", id: trimmed, title: trimmed });
    setNewTitle("");
  };

  return (
    <div className="mn-all-pages">
      <h1 className="mn-page-title">All pages</h1>
      <form
        className="mn-new-page-form"
        onSubmit={(e) => {
          e.preventDefault();
          createPage(newTitle);
        }}
      >
        <input
          className="mn-new-page-input"
          placeholder="New page title…"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
        />
        <button type="submit" className="mn-new-page-button" disabled={!newTitle.trim()}>
          + New Page
        </button>
      </form>
      {pages === null && <p>Loading…</p>}
      {pages?.length === 0 && <p>No pages yet.</p>}
      <ul className="mn-all-pages-list">
        {pages?.map((p) => (
          <li key={p.id}>
            <button className="mn-page-link" onClick={() => openTab({ kind: "page", id: p.id, title: p.title })}>
              {p.title}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
