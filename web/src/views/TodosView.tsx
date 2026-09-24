import { useEffect, useState } from "react";
import { fetchTodos, toggleTodo, type TodoItem } from "../sync/api";
import { useTabsStore } from "../state/useTabsStore";

const HEADING_RE = /^#{1,6}\s+/;

function stripHeadingMarker(text: string): string {
  return text.replace(HEADING_RE, "");
}

const UNCATEGORIZED = "Uncategorized";

function groupByCategory(todos: TodoItem[]): [string, TodoItem[]][] {
  const groups = new Map<string, TodoItem[]>();
  for (const t of todos) {
    const key = t.category ?? UNCATEGORIZED;
    const list = groups.get(key);
    if (list) list.push(t);
    else groups.set(key, [t]);
  }
  return [...groups.entries()].sort(([a], [b]) => {
    if (a === UNCATEGORIZED) return 1;
    if (b === UNCATEGORIZED) return -1;
    return a.localeCompare(b);
  });
}

export function TodosView() {
  const [todos, setTodos] = useState<TodoItem[] | null>(null);
  const openTab = useTabsStore((s) => s.openTab);

  useEffect(() => {
    fetchTodos()
      .then((r) => setTodos(r.todos))
      .catch(console.error);
  }, []);

  const openResult = (t: TodoItem) => {
    if (t.pageKind === "journal") {
      const id = t.path.split("/").pop()!.replace(/\.md$/, "");
      openTab({ kind: "journal-day", id, title: t.pageTitle });
    } else {
      openTab({ kind: "page", id: t.pageTitle, title: t.pageTitle });
    }
  };

  // Optimistic: a checked-off item just drops out of the open list right
  // away rather than waiting on a refetch — it's still sitting in its
  // journal day exactly where it was, just no longer "open" here.
  const checkOff = (t: TodoItem) => {
    setTodos((current) => current?.filter((x) => x !== t) ?? current);
    toggleTodo(t.path, t.blockIndex).catch(() => {
      // best-effort — put it back if the toggle actually failed server-side
      setTodos((current) => (current ? [...current, t] : current));
    });
  };

  const groups = todos ? groupByCategory(todos) : [];

  return (
    <div className="mn-todos-view">
      <h1 className="mn-page-title">To Dos</h1>
      {todos === null && <p>Loading…</p>}
      {todos?.length === 0 && <p>No open to-dos.</p>}
      {groups.map(([category, items]) => (
        <div key={category} className="mn-todo-group">
          <h2 className="mn-todo-group-heading">{category === UNCATEGORIZED ? category : `#${category}`}</h2>
          <ul className="mn-todo-list">
            {items.map((t) => (
              <li key={`${t.path}:${t.blockIndex}`} className="mn-todo-item">
                <button
                  className={`mn-marker mn-marker-${t.marker.toLowerCase()} mn-todo-checkbox`}
                  onClick={() => checkOff(t)}
                  title="Mark done"
                >
                  {t.marker}
                </button>
                <div className="mn-todo-item-body">
                  <div className="mn-todo-item-content">{t.content}</div>
                  <button className="mn-todo-item-source" onClick={() => openResult(t)}>
                    {t.pageTitle}
                    {t.depth > 0 && ` — ${stripHeadingMarker(t.topContent)}`}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
