import { useEffect } from "react";
import { checkSpelling, type SpellMatch } from "../sync/api";
import { useSpellStore } from "../state/useSpellStore";

const DEBOUNCE_MS = 800;
const EMPTY: SpellMatch[] = [];

// Every block on a page schedules a check independently, so opening a long
// journal day would otherwise fire dozens of simultaneous requests at the
// self-hosted LanguageTool server the moment the debounce timers land
// together. Capping in-flight requests smooths that into a steady trickle
// instead — the requests still all happen, just not all at once.
const MAX_CONCURRENT = 4;
let inFlight = 0;
const queue: (() => void)[] = [];

function runQueued(task: () => Promise<void>): void {
  const start = () => {
    inFlight += 1;
    task().finally(() => {
      inFlight -= 1;
      const next = queue.shift();
      if (next) next();
    });
  };
  if (inFlight < MAX_CONCURRENT) start();
  else queue.push(start);
}

/**
 * Debounced spell/grammar check for one block, shared across every block on
 * the page (not just the focused one) via useSpellStore — so switching a
 * block between its static and edit-mode rendering reuses the same cached
 * result instead of re-checking. Matches lag slightly behind the very latest
 * keystrokes in the block actively being typed into (same as any real-world
 * spellchecker) — a stale set stays on screen until the next completed check
 * replaces it, rather than flashing empty on every change.
 */
export function useBlockSpellCheck(blockId: string, source: string, enabled: boolean): SpellMatch[] {
  const matches = useSpellStore((s) => s.matches[blockId]) ?? EMPTY;
  const checked = useSpellStore((s) => s.checked[blockId]);
  const setMatches = useSpellStore((s) => s.setMatches);

  useEffect(() => {
    if (!enabled) return;
    if (!source.trim()) {
      if (checked !== source) setMatches(blockId, source, []);
      return;
    }
    if (checked === source) return; // already checked this exact content

    const timer = setTimeout(() => {
      runQueued(() =>
        checkSpelling(source)
          .then((r) => setMatches(blockId, source, r.matches))
          .catch(() => {
            // best-effort — an unreachable LanguageTool server shouldn't disrupt editing
          }),
      );
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [blockId, source, enabled, checked, setMatches]);

  return matches;
}
