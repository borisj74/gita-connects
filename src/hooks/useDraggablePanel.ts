import { useCallback, useEffect, useRef, useState } from 'react';

type Pos = { x: number; y: number };

// Stay this far inside the canvas edges.
const EDGE = 8;
// Keep at least the header on screen when the panel is dragged low.
const HEADER_KEEP = 48;
// Pointer travel before a press on the header counts as a drag, not a click.
const DRAG_THRESHOLD = 4;
const KEY_STEP = 16;
const KEY_STEP_BIG = 64;

function load(key: string): Pos | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<Pos>;
    return typeof p.x === 'number' && typeof p.y === 'number' ? { x: p.x, y: p.y } : null;
  } catch {
    return null;
  }
}

function save(key: string, pos: Pos | null) {
  try {
    if (pos) localStorage.setItem(key, JSON.stringify(pos));
    else localStorage.removeItem(key);
  } catch {
    // Position just doesn't stick — not worth surfacing.
  }
}

/**
 * A floating panel the reader can drag by its header (or move with the arrow
 * keys) anywhere inside its positioned parent. The spot is remembered, and it
 * is pulled back inside when the parent or the panel changes size. Until
 * moved, the panel keeps its stylesheet position.
 */
export function useDraggablePanel<T extends HTMLElement>(storageKey: string) {
  const panelRef = useRef<T>(null);
  const [pos, setPos] = useState<Pos | null>(() => load(storageKey));
  const posRef = useRef(pos);
  useEffect(() => {
    posRef.current = pos;
  }, [pos]);
  const drag = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const clamp = useCallback((p: Pos): Pos => {
    const el = panelRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return p;
    const maxX = Math.max(EDGE, parent.clientWidth - el.offsetWidth - EDGE);
    const maxY = Math.max(EDGE, parent.clientHeight - HEADER_KEEP - EDGE);
    return {
      x: Math.round(Math.min(Math.max(p.x, EDGE), maxX)),
      y: Math.round(Math.min(Math.max(p.y, EDGE), maxY)),
    };
  }, []);

  // Pull the panel back inside when the canvas or the panel resizes
  // (window resize, side panels opening, the panel expanding).
  useEffect(() => {
    const el = panelRef.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const refit = () =>
      setPos((p) => {
        if (!p) return p;
        const c = clamp(p);
        return c.x === p.x && c.y === p.y ? p : c;
      });
    refit();
    const ro = new ResizeObserver(refit);
    ro.observe(el);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [clamp]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const el = panelRef.current;
    if (!el || e.button !== 0) return;
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: el.offsetLeft,
      originY: el.offsetTop,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setPos(clamp({ x: d.originX + dx, y: d.originY + dy }));
  }, [clamp]);

  const onPointerUp = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (d?.moved) {
      suppressClick.current = true;
      save(storageKey, posRef.current);
    }
  }, [storageKey]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const step = e.shiftKey ? KEY_STEP_BIG : KEY_STEP;
    const delta: Record<string, Pos> = {
      ArrowLeft: { x: -step, y: 0 },
      ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step },
      ArrowDown: { x: 0, y: step },
    };
    const d = delta[e.key];
    const el = panelRef.current;
    if (!d || !el) return;
    e.preventDefault();
    const from = posRef.current ?? { x: el.offsetLeft, y: el.offsetTop };
    const next = clamp({ x: from.x + d.x, y: from.y + d.y });
    setPos(next);
    save(storageKey, next);
  }, [clamp, storageKey]);

  /** True once, right after a drag ended, so the header's click can be ignored. */
  const consumeDragClick = useCallback(() => {
    const was = suppressClick.current;
    suppressClick.current = false;
    return was;
  }, []);

  const style: React.CSSProperties | undefined = pos
    ? {
        left: pos.x,
        top: pos.y,
        right: 'auto',
        bottom: 'auto',
        maxHeight: `calc(100% - ${pos.y + 16}px)`,
      }
    : undefined;

  return {
    panelRef,
    style,
    moved: pos !== null,
    handleProps: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown },
    consumeDragClick,
  };
}
