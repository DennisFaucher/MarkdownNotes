import { create } from "zustand";
import type { SpellMatch } from "../sync/api";

interface SpellState {
  // Keyed by block id. `checked` records the exact source text each block's
  // matches were computed from, so a block only gets re-sent to LanguageTool
  // when its content actually changed — not on every render, and not again
  // just because it switched between static and edit-mode rendering.
  matches: Record<string, SpellMatch[]>;
  checked: Record<string, string>;
  setMatches: (blockId: string, source: string, matches: SpellMatch[]) => void;
  /** Clears one word's underline from every block immediately after "Add to
   *  Dictionary" — without this, blocks other than the one clicked would keep
   *  showing the stale underline until their own content next changes and
   *  re-triggers a check. `checked` doubles as each block's last-known text,
   *  which is how the actual matched substring gets recovered here. */
  removeWordEverywhere: (word: string) => void;
}

export const useSpellStore = create<SpellState>((set) => ({
  matches: {},
  checked: {},
  setMatches: (blockId, source, matches) =>
    set((s) => ({
      matches: { ...s.matches, [blockId]: matches },
      checked: { ...s.checked, [blockId]: source },
    })),
  removeWordEverywhere: (word) =>
    set((s) => {
      const lower = word.toLowerCase();
      const next: Record<string, SpellMatch[]> = {};
      for (const [blockId, ms] of Object.entries(s.matches)) {
        const source = s.checked[blockId] ?? "";
        next[blockId] = ms.filter((m) => source.slice(m.offset, m.offset + m.length).toLowerCase() !== lower);
      }
      return { matches: next };
    }),
}));
