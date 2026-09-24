import { useTabsStore } from "../state/useTabsStore";
import { useUiStore } from "../state/useUiStore";

/**
 * Which doc "find & replace" (or any other current-document action) should
 * scope to: the open page/journal-day tab, or — when the active tab is the
 * multi-day Journals feed itself — whichever day the caret was last in,
 * since the feed has no single doc of its own. Plain function (not a hook)
 * so it can be called from the App-level keydown handler outside React
 * render; FindReplaceBar re-derives the same thing reactively via its own
 * store selectors instead of calling this.
 */
export function getCurrentDocId(): string | null {
  const { tabs, activeKey } = useTabsStore.getState();
  const active = tabs.find((t) => t.key === activeKey);
  if (!active) return null;
  if (active.target.kind === "page" || active.target.kind === "journal-day") return active.target.id;
  if (active.target.kind === "journals") return useUiStore.getState().focusedBlock?.docId ?? null;
  return null;
}
