import { useLayoutEffect, type RefObject } from "react";

/**
 * Clamps a portalled position:fixed popover to the real viewport — flips
 * from opening below the anchor to opening above it when below would
 * overflow the bottom of the screen, and nudges left when it would overflow
 * the right edge. Defaults to opening below on the initial render (via the
 * caller's own inline style), then corrects post-render once the popover's
 * actual size is known — no visible flicker, since this runs in
 * useLayoutEffect, before paint.
 *
 * Must be used on an element rendered through a portal to document.body: an
 * ordinary position:fixed element inside a content-visibility:auto ancestor
 * (used by long journal-day sections for virtualization) gets a new
 * containing block per the CSS spec, silently breaking "fixed relative to
 * the viewport" — it ends up positioned relative to that section's box
 * instead, landing thousands of pixels off-screen on a scrolled page.
 */
export function usePopoverPosition(
  ref: RefObject<HTMLElement>,
  anchor: { x: number; top: number; bottom: number } | null,
  deps: unknown[],
) {
  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const el = ref.current;
    el.style.left = `${anchor.x}px`;
    el.style.top = `${anchor.bottom + 4}px`;
    el.style.bottom = "";
    const overflowBottom = el.getBoundingClientRect().bottom - window.innerHeight;
    if (overflowBottom > 0) {
      el.style.top = "";
      el.style.bottom = `${window.innerHeight - anchor.top + 4}px`;
    }
    const overflowRight = el.getBoundingClientRect().right - window.innerWidth;
    if (overflowRight > 0) {
      el.style.left = `${Math.max(8, anchor.x - overflowRight)}px`;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
