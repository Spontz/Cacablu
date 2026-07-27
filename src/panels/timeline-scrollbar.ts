export interface TimelineViewportScrollbarMetrics {
  clientWidth: number;
  clientHeight: number;
  offsetWidth: number;
  offsetHeight: number;
  scrollWidth: number;
  scrollHeight: number;
}

export function isTimelineViewportScrollbarPoint(
  localX: number,
  localY: number,
  metrics: TimelineViewportScrollbarMetrics,
): boolean {
  const hasHorizontalScrollbar = metrics.scrollWidth > metrics.clientWidth
    && metrics.offsetHeight > metrics.clientHeight;
  const hasVerticalScrollbar = metrics.scrollHeight > metrics.clientHeight
    && metrics.offsetWidth > metrics.clientWidth;

  return (hasHorizontalScrollbar && localY >= metrics.clientHeight && localY <= metrics.offsetHeight)
    || (hasVerticalScrollbar && localX >= metrics.clientWidth && localX <= metrics.offsetWidth);
}

export function isTimelineViewportScrollbarInteraction(
  viewport: HTMLElement,
  clientX: number,
  clientY: number,
): boolean {
  const bounds = viewport.getBoundingClientRect();
  return isTimelineViewportScrollbarPoint(
    clientX - bounds.left,
    clientY - bounds.top,
    viewport,
  );
}
