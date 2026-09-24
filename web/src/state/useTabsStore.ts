import { create } from "zustand";

export type TabTarget =
  | { kind: "journals" }
  | { kind: "all-pages" }
  | { kind: "todos" }
  | { kind: "page"; id: string; title: string }
  | { kind: "tag"; id: string; title: string }
  | { kind: "journal-day"; id: string; title: string };

export interface Tab {
  key: string;
  target: TabTarget;
}

export interface RecentEntry {
  id: string;
  title: string;
  at: number;
}

interface TabsState {
  tabs: Tab[];
  activeKey: string;
  favorites: { id: string; title: string }[];
  recents: RecentEntry[];

  openTab: (target: TabTarget) => void;
  closeTab: (key: string) => void;
  setActive: (key: string) => void;
  toggleFavorite: (id: string, title: string) => void;
  isFavorite: (id: string) => boolean;
  pushRecent: (id: string, title: string) => void;
}

function targetKey(t: TabTarget): string {
  if (t.kind === "journals") return "journals";
  if (t.kind === "all-pages") return "all-pages";
  if (t.kind === "todos") return "todos";
  return `${t.kind}:${t.id}`;
}

const JOURNALS_TAB: Tab = { key: "journals", target: { kind: "journals" } };
const KNOWN_KINDS = new Set(["journals", "all-pages", "todos", "page", "tag", "journal-day"]);

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private-browsing localStorage can throw; state just won't persist */
  }
}

/** Loose validation against corrupted/outdated localStorage content — a
 *  malformed entry here shouldn't crash the app on startup, just get skipped. */
function isValidTab(t: unknown): t is Tab {
  if (typeof t !== "object" || t === null) return false;
  const tab = t as Record<string, unknown>;
  const target = tab.target as Record<string, unknown> | undefined;
  return typeof tab.key === "string" && !!target && typeof target.kind === "string" && KNOWN_KINDS.has(target.kind);
}

function loadTabsState(): { tabs: Tab[]; activeKey: string } {
  const stored = loadJson<{ tabs: unknown; activeKey: unknown } | null>("mn-tabs-state", null);
  const restoredTabs = Array.isArray(stored?.tabs) ? stored.tabs.filter(isValidTab) : [];
  const tabs = restoredTabs.some((t) => t.key === "journals") ? restoredTabs : [JOURNALS_TAB, ...restoredTabs];
  const activeKey = typeof stored?.activeKey === "string" && tabs.some((t) => t.key === stored.activeKey) ? stored.activeKey : "journals";
  return { tabs, activeKey };
}

function persistTabsState(tabs: Tab[], activeKey: string) {
  saveJson("mn-tabs-state", { tabs, activeKey });
}

const initialTabsState = loadTabsState();

export const useTabsStore = create<TabsState>((set, get) => ({
  tabs: initialTabsState.tabs,
  activeKey: initialTabsState.activeKey,
  favorites: loadJson("mn-favorites", []),
  recents: loadJson("mn-recents", []),

  openTab: (target) => {
    const key = targetKey(target);
    set((state) => {
      const exists = state.tabs.some((t) => t.key === key);
      const tabs = exists ? state.tabs : [...state.tabs, { key, target }];
      persistTabsState(tabs, key);
      return { tabs, activeKey: key };
    });
    if (target.kind === "page") get().pushRecent(target.id, target.title);
  },

  closeTab: (key) =>
    set((state) => {
      if (key === "journals") return {}; // Journals tab is permanent, like Logseq's
      const idx = state.tabs.findIndex((t) => t.key === key);
      if (idx === -1) return {};
      const tabs = state.tabs.filter((t) => t.key !== key);
      let activeKey = state.activeKey;
      if (activeKey === key) {
        const fallback = tabs[idx - 1] ?? tabs[0] ?? JOURNALS_TAB;
        activeKey = fallback.key;
      }
      persistTabsState(tabs, activeKey);
      return { tabs, activeKey };
    }),

  setActive: (key) =>
    set((state) => {
      persistTabsState(state.tabs, key);
      return { activeKey: key };
    }),

  toggleFavorite: (id, title) =>
    set((state) => {
      const exists = state.favorites.some((f) => f.id === id);
      const favorites = exists ? state.favorites.filter((f) => f.id !== id) : [...state.favorites, { id, title }];
      saveJson("mn-favorites", favorites);
      return { favorites };
    }),

  isFavorite: (id) => get().favorites.some((f) => f.id === id),

  pushRecent: (id, title) =>
    set((state) => {
      const filtered = state.recents.filter((r) => r.id !== id);
      const recents = [{ id, title, at: Date.now() }, ...filtered].slice(0, 20);
      saveJson("mn-recents", recents);
      return { recents };
    }),
}));
