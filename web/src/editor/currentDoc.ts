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

/**
 * Reactive version of `getCurrentDocId`, for components that *render* the answer
 * rather than acting on it at click time — e.g. the print button's `disabled`
 * state. The plain function reads `getState()`, which is a snapshot: calling it
 * during render leaves the value frozen at whatever the store held on the last
 * render that happened to run, so a button gated on it stays disabled after the
 * user opens a document. Both stores are subscribed, so switching tabs (or
 * moving the caret within the Journals feed) re-derives it.
 */
export function useCurrentDocId(): string | null {
  const tabs = useTabsStore((s) => s.tabs);
  const activeKey = useTabsStore((s) => s.activeKey);
  const focusedDocId = useUiStore((s) => s.focusedBlock?.docId ?? null);
  const active = tabs.find((t) => t.key === activeKey);
  if (!active) return null;
  if (active.target.kind === "page" || active.target.kind === "journal-day") return active.target.id;
  if (active.target.kind === "journals") return focusedDocId;
  return null;
}
