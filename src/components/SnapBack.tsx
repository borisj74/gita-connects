import { useLayoutEffect, useRef } from 'react';

const RETRACT_MS = 260;

interface SnapBackProps {
  /** Verse whose bottom dot the line came from. */
  fromId: string;
  /** Where the drag was let go, in client coordinates. */
  x: number;
  y: number;
  /** Dropped on its own card rather than on empty canvas. */
  reject: boolean;
  /** The canvas wrapper this overlay is drawn over. */
  container: HTMLElement | null;
  onDone: () => void;
}

// A drag that did not land on another verse reels back into the dot it left,
// instead of vanishing. Coordinates are screen space, measured once at drop.
export default function SnapBack({ fromId, x, y, reject, container, onDone }: SnapBackProps) {
  const lineRef = useRef<SVGLineElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);

  useLayoutEffect(() => {
    const handle = container?.querySelector(
      `.react-flow__node[data-id="${CSS.escape(fromId)}"] .react-flow__handle-bottom`,
    );
    if (!container || !handle) {
      onDone();
      return;
    }
    const box = container.getBoundingClientRect();
    const h = handle.getBoundingClientRect();
    const hx = h.left + h.width / 2 - box.left;
    const hy = h.top + h.height / 2 - box.top;
    const dx = x - box.left;
    const dy = y - box.top;

    const line = lineRef.current;
    const dot = dotRef.current;
    line?.setAttribute('x1', String(hx));
    line?.setAttribute('y1', String(hy));

    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / RETRACT_MS);
      // Ease in: slow to let go, quick to reel home.
      const k = 1 - t * t * t;
      const ex = String(hx + (dx - hx) * k);
      const ey = String(hy + (dy - hy) * k);
      line?.setAttribute('x2', ex);
      line?.setAttribute('y2', ey);
      dot?.setAttribute('cx', ex);
      dot?.setAttribute('cy', ey);
      if (t < 1) raf = requestAnimationFrame(step);
      else onDone();
    };
    step(start);
    return () => cancelAnimationFrame(raf);
    // One retraction per drop; the parent remounts this for the next one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <svg className={`snap-back ${reject ? 'is-reject' : ''}`} aria-hidden="true">
      <line ref={lineRef} />
      <circle ref={dotRef} r={4} />
    </svg>
  );
}
