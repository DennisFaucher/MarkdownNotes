import { create } from "zustand";
import { fetchJournals } from "../sync/api";
import { useDocStore } from "./useDocStore";

const PAGE_SIZE = 7;

interface JournalState {
  dayIds: string[];
  /** exclusive upper bound for the next page; undefined means "no bound yet" —
   *  the server then defaults to tomorrow, which correctly includes today. */
  cursor: string | undefined;
  hasMore: boolean;
  loading: boolean;
  loadMore: () => Promise<void>;
  reset: () => void;
}

export const useJournalStore = create<JournalState>((set, get) => ({
  dayIds: [],
  cursor: undefined,
  hasMore: true,
  loading: false,

  loadMore: async () => {
    if (get().loading || !get().hasMore) return;
    set({ loading: true });
    const { cursor } = get();
    const { days } = await fetchJournals(cursor, PAGE_SIZE);
    const setDoc = useDocStore.getState().setDoc;
    for (const day of days) setDoc(day);
    const lastDay = days[days.length - 1];
    const nextCursor = lastDay ? lastDay.id.replace(/_/g, "-") : cursor;
    set((state) => ({
      dayIds: [...state.dayIds, ...days.map((d) => d.id)],
      cursor: nextCursor,
      loading: false,
      hasMore: days.length === PAGE_SIZE,
    }));
  },

  reset: () => set({ dayIds: [], cursor: undefined, hasMore: true, loading: false }),
}));
