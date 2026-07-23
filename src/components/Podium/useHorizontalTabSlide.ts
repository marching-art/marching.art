import { useEffect, useRef } from 'react';

/**
 * Keep the selected pill in a horizontally-scrolling tab strip visible by
 * centering it in its scroll container. Used by the Podium day/week selectors so
 * the highlighted current day/week is on-screen on mobile instead of scrolled
 * off to the right (the strip stays in chronological order — we slide it, we
 * don't reverse it).
 *
 * Attach `containerRef` to the scrollable strip and `selectedRef` to the active
 * button; pass a `dep` that changes when the selection (or the data) changes so
 * the strip re-centers. Only `scrollLeft` is touched, so the page never jumps
 * vertically.
 */
export function useHorizontalTabSlide(dep: unknown) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const btn = selectedRef.current;
    if (!container || !btn) return;
    const target = btn.offsetLeft - container.clientWidth / 2 + btn.clientWidth / 2;
    container.scrollLeft = Math.max(0, target);
  }, [dep]);

  return { containerRef, selectedRef };
}
