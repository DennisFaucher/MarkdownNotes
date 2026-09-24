import { create } from "zustand";

export interface FocusRequest {
  docId: string;
  blockId: string;
  pos: number | "end";
}

interface UiState {
  focusedBlock: { docId: string; blockId: string } | null;
  pendingFocus: FocusRequest | null;
  theme: "light" | "dark";
  requestFocus: (req: FocusRequest) => void;
  clearPendingFocus: () => void;
  setFocusedBlock: (docId: string, blockId: string) => void;
  /** No-ops if focus already moved to a different block (e.g. Enter/Tab already
   *  requested focus elsewhere before this block's blur handler ran). */
  clearFocusedBlockIfSelf: (docId: string, blockId: string) => void;
  toggleTheme: () => void;
  searchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  toggleSearch: () => void;
  /** Whether the server has a LANGUAGETOOL_URL configured — set once at
   *  startup (see App.tsx). Spellcheck UI stays fully inert until this is true. */
  spellcheckEnabled: boolean;
  setSpellcheckEnabled: (enabled: boolean) => void;
  /** One-shot request: clicking a misspelled word in a static (unfocused)
   *  block enters edit mode (see requestFocus) *and* asks the freshly-mounted
   *  editor's SpellcheckOverlay to immediately open the suggestions popover
   *  for that match, instead of requiring a second click once edit mode is
   *  already active. */
  pendingSpellOpen: { docId: string; blockId: string; offset: number } | null;
  requestSpellOpen: (req: { docId: string; blockId: string; offset: number }) => void;
  clearPendingSpellOpen: () => void;
  /** Sidebar-as-drawer state for narrow viewports — see the mobile media
   *  query in app.css, which overrides this to "always visible" above the
   *  breakpoint regardless of this flag. */
  sidebarOpen: boolean;
  openSidebar: () => void;
  closeSidebar: () => void;
  toggleSidebar: () => void;
}

const storedTheme = (typeof localStorage !== "undefined" && (localStorage.getItem("mn-theme") as "light" | "dark")) || "light";

export const useUiStore = create<UiState>((set) => ({
  focusedBlock: null,
  pendingFocus: null,
  theme: storedTheme,
  requestFocus: (req) => set({ pendingFocus: req, focusedBlock: { docId: req.docId, blockId: req.blockId } }),
  clearPendingFocus: () => set({ pendingFocus: null }),
  setFocusedBlock: (docId, blockId) => set({ focusedBlock: { docId, blockId } }),
  clearFocusedBlockIfSelf: (docId, blockId) =>
    set((state) =>
      state.focusedBlock?.docId === docId && state.focusedBlock.blockId === blockId
        ? { focusedBlock: null }
        : {},
    ),
  toggleTheme: () =>
    set((state) => {
      const next = state.theme === "light" ? "dark" : "light";
      try {
        localStorage.setItem("mn-theme", next);
      } catch {
        /* private-browsing localStorage can throw; theme just won't persist */
      }
      return { theme: next };
    }),
  searchOpen: false,
  openSearch: () => set({ searchOpen: true }),
  closeSearch: () => set({ searchOpen: false }),
  toggleSearch: () => set((state) => ({ searchOpen: !state.searchOpen })),
  spellcheckEnabled: false,
  setSpellcheckEnabled: (enabled) => set({ spellcheckEnabled: enabled }),
  pendingSpellOpen: null,
  requestSpellOpen: (req) => set({ pendingSpellOpen: req }),
  clearPendingSpellOpen: () => set({ pendingSpellOpen: null }),
  sidebarOpen: false,
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));
