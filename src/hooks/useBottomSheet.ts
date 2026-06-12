import { useCallback, useRef, useState, type CSSProperties } from 'react';

export type BottomSheetSnap = 'peek' | 'expanded';

interface UseBottomSheetOptions {
  enabled: boolean;
  onClose: () => void;
  peekVh?: number;
  expandedVh?: number;
}

const CLOSE_DRAG_PX = 72;
const EXPAND_DRAG_PX = 48;
/** Minimum canvas strip kept visible above the sheet when fully expanded */
const TOP_GAP_PX = 76;

function maxSheetHeightVh(expandedVh: number): number {
  if (typeof window === 'undefined') return expandedVh;
  const topGapVh = (TOP_GAP_PX / window.innerHeight) * 100;
  return Math.min(expandedVh, 100 - topGapVh);
}

export function useBottomSheet({
  enabled,
  onClose,
  peekVh = 42,
  expandedVh = 100,
}: UseBottomSheetOptions) {
  const [snap, setSnap] = useState<BottomSheetSnap>('peek');
  const [dragOffsetPx, setDragOffsetPx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startYRef = useRef(0);
  const startSnapRef = useRef<BottomSheetSnap>('peek');

  const maxVh = maxSheetHeightVh(expandedVh);
  const snapHeightVh = snap === 'expanded' ? maxVh : peekVh;

  const clampHeight = (vh: number) => Math.min(maxVh, Math.max(0, vh));

  const currentHeightVh = dragging
    ? clampHeight(snapHeightVh - (dragOffsetPx / window.innerHeight) * 100)
    : snapHeightVh;

  const onGrabberPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!enabled) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      startYRef.current = e.clientY;
      startSnapRef.current = snap;
      setDragging(true);
      setDragOffsetPx(0);
    },
    [enabled, snap],
  );

  const onGrabberPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!dragging) return;
      setDragOffsetPx(e.clientY - startYRef.current);
    },
    [dragging],
  );

  const finishDrag = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      if (!dragging) return;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer may already be released.
      }
      setDragging(false);

      const delta = e.clientY - startYRef.current;
      setDragOffsetPx(0);

      if (delta < -EXPAND_DRAG_PX) {
        setSnap('expanded');
        return;
      }

      if (delta > CLOSE_DRAG_PX) {
        if (startSnapRef.current === 'expanded') {
          setSnap('peek');
        } else {
          onClose();
        }
        return;
      }

      // Small movement: toggle on tap-like gesture
      if (Math.abs(delta) < 8) {
        setSnap((s) => (s === 'peek' ? 'expanded' : 'peek'));
      }
    },
    [dragging, onClose],
  );

  const sheetClassName = [
    snap === 'expanded' ? 'is-expanded' : 'is-peek',
    dragging ? 'is-dragging' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    snap,
    sheetClassName,
    sheetStyle: { height: `${currentHeightVh}dvh` } as CSSProperties,
    grabberProps: {
      onPointerDown: onGrabberPointerDown,
      onPointerMove: onGrabberPointerMove,
      onPointerUp: finishDrag,
      onPointerCancel: finishDrag,
    },
  };
}
