import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TOUR_STEPS, type TourContext } from '../tour/steps.js';
import type { TourStatus } from '../tour/tourStore.js';
import './GuidedTour.css';

interface GuidedTourProps {
  /** Open on the welcome card, or go straight into the tour (a replay). */
  startAt: 'welcome' | 'tour';
  isMobile: boolean;
  /** The tour is starting: make sure there is something to point at; returns the verse to talk about. */
  onBegin: () => string | null;
  /** A stop is about to show (e.g. open the chapters list or the verse for it). */
  onStepEnter?: (stepId: string, focusId: string | null) => void;
  onClose: (status: TourStatus) => void;
}

interface Rect { top: number; left: number; width: number; height: number }

const PAD = 8;
const GAP = 16;
const EDGE = 12;
const TIP_W = 340;

/** Union of every visible element the selectors match, padded; null when none is on screen. */
function measure(selectors: string[]): Rect | null {
  let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
  for (const sel of selectors) {
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom < 0 || r.right < 0 || r.top > window.innerHeight || r.left > window.innerWidth) continue;
      top = Math.min(top, r.top);
      left = Math.min(left, r.left);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
      break; // first visible match per selector
    }
  }
  if (top === Infinity) return null;
  const t = Math.max(top - PAD, 4);
  const l = Math.max(left - PAD, 4);
  return {
    top: t,
    left: l,
    width: Math.min(right + PAD, window.innerWidth - 4) - l,
    height: Math.min(bottom + PAD, window.innerHeight - 4) - t,
  };
}

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b || (!!a && !!b && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

type Side = 'right' | 'left' | 'bottom' | 'top';

/** Where the card goes beside the spotlight, and where its arrow points. */
function place(r: Rect, w: number, h: number): { top: number; left: number; side: Side; arrow: number } {
  const vw = window.innerWidth, vh = window.innerHeight;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
  const cy = r.top + r.height / 2, cx = r.left + r.width / 2;
  let side: Side;
  if (r.left + r.width + GAP + w <= vw - EDGE) side = 'right';
  else if (r.left - GAP - w >= EDGE) side = 'left';
  else if (r.top + r.height + GAP + h <= vh - EDGE) side = 'bottom';
  else side = 'top';
  if (side === 'right' || side === 'left') {
    const top = clamp(cy - 48, EDGE, vh - h - EDGE);
    const left = side === 'right' ? r.left + r.width + GAP : r.left - GAP - w;
    return { top, left, side, arrow: clamp(cy - top - 7, 18, h - 32) };
  }
  const left = clamp(cx - w / 2, EDGE, vw - w - EDGE);
  const top = side === 'bottom' ? r.top + r.height + GAP : Math.max(EDGE, r.top - GAP - h);
  return { top, left, side, arrow: clamp(cx - left - 7, 18, w - 32) };
}

/**
 * The first-visit welcome and guided tour: the screen dims, one part of the
 * app at a time is spotlit, and a card beside it explains it, with Back,
 * Next and Skip.
 */
export default function GuidedTour({ startAt, isMobile, onBegin, onStepEnter, onClose }: GuidedTourProps) {
  const [phase, setPhase] = useState<'welcome' | 'step' | 'finish'>(startAt === 'welcome' ? 'welcome' : 'step');
  const [index, setIndex] = useState(0);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const [tipSize, setTipSize] = useState({ w: TIP_W, h: 220 });
  const cardRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const began = useRef(false);

  const step = phase === 'step' ? TOUR_STEPS[index] : null;
  const ctx: TourContext = { focusId, isMobile };

  const begin = useCallback(() => {
    if (!began.current) {
      began.current = true;
      setFocusId(onBegin());
    }
    setIndex(0);
    setPhase('step');
  }, [onBegin]);

  // A replay goes straight to the first stop.
  useEffect(() => {
    if (startAt === 'tour' && !began.current) {
      began.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- adopting what onBegin put on the canvas
      setFocusId(onBegin());
    }
  }, [startAt, onBegin]);

  const stepId = step?.id;
  useEffect(() => {
    if (stepId) onStepEnter?.(stepId, focusId);
  }, [stepId, focusId, onStepEnter]);

  // Follow the target every frame: cards fan in, panels slide, the window resizes.
  const selectors = step ? step.targets(ctx).join('|') : '';
  useEffect(() => {
    if (!selectors) return;
    let frame = 0;
    let last: Rect | null = null;
    const tick = () => {
      const next = measure(selectors.split('|'));
      if (!sameRect(next, last)) {
        last = next;
        setRect(next);
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [selectors]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const { offsetWidth: w, offsetHeight: h } = el;
    setTipSize((s) => (s.w === w && s.h === h ? s : { w, h }));
  }, [phase, index, isMobile]);

  // Each new card takes the focus, so the keyboard and screen readers follow along.
  useEffect(() => {
    primaryRef.current?.focus();
  }, [phase, index]);

  const skip = useCallback(() => onClose(phase === 'finish' ? 'done' : 'skipped'), [onClose, phase]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      skip();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = cardRef.current?.querySelectorAll<HTMLElement>('button');
    if (!items || items.length === 0) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const next = () => {
    if (index < TOUR_STEPS.length - 1) setIndex(index + 1);
    else setPhase('finish');
  };
  const back = () => setIndex(Math.max(0, index - 1));

  if (phase !== 'step') {
    const welcome = phase === 'welcome';
    return (
      <div className="tour-layer" onKeyDown={onKeyDown}>
        <div className="tour-scrim" />
        <div
          ref={cardRef}
          className="tour-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tour-modal-title"
        >
          <p className="tour-kicker">{welcome ? 'Welcome' : 'You are ready'}</p>
          <h2 id="tour-modal-title" className="tour-modal-title">
            {welcome ? 'Welcome to Gita Connects' : 'Now it’s your turn'}
          </h2>
          <p className="tour-modal-body">
            {welcome
              ? 'The Gita is not 700 separate verses. It is a web of ideas that echo across chapters. Take a one-minute tour to see how to explore it and build your own.'
              : `Open a verse, follow its links, and draw the connections you see. You can take this tour again any time from ${isMobile ? 'the menu' : '⋯'} → Take the tour.`}
          </p>
          <div className="tour-modal-actions">
            <button
              ref={primaryRef}
              type="button"
              className="tour-btn tour-btn-primary tour-btn-wide"
              onClick={welcome ? begin : () => onClose('done')}
            >
              {welcome ? 'Take the tour' : 'Start exploring'}
            </button>
            <button
              type="button"
              className="tour-btn tour-btn-wide"
              onClick={welcome ? () => onClose('skipped') : () => { setIndex(0); setPhase('step'); }}
            >
              {welcome ? 'Skip, I’ll explore on my own' : 'Replay the tour'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const spot = selectors ? rect : null;
  const pos = !isMobile && spot ? place(spot, tipSize.w, tipSize.h) : null;
  const sheetAtTop = isMobile && !!spot && spot.top + spot.height / 2 > window.innerHeight / 2;
  const cardClass = [
    'tour-card',
    isMobile ? 'is-sheet' : '',
    sheetAtTop ? 'at-top' : '',
    !isMobile && !spot ? 'is-centered' : '',
  ].join(' ');
  const cardStyle = pos ? { top: pos.top, left: pos.left } : undefined;
  const total = TOUR_STEPS.length;

  return (
    <div className="tour-layer" onKeyDown={onKeyDown}>
      {spot ? (
        <div className="tour-spot" style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }} />
      ) : (
        <div className="tour-scrim" />
      )}
      <div
        ref={cardRef}
        className={cardClass}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-card-title"
        aria-describedby="tour-card-body"
      >
        {pos && (
          <span
            className={`tour-arrow on-${pos.side}`}
            style={pos.side === 'left' || pos.side === 'right' ? { top: pos.arrow } : { left: pos.arrow }}
            aria-hidden="true"
          />
        )}
        <div className="tour-progress">
          <span className="tour-pips" aria-hidden="true">
            {TOUR_STEPS.map((s, i) => (
              <span key={s.id} className={`tour-pip ${i === index ? 'is-on' : ''}`} />
            ))}
          </span>
          <span className="tour-count" aria-live="polite">{index + 1} of {total}</span>
        </div>
        <h2 id="tour-card-title" className="tour-card-title">{step!.title}</h2>
        <p id="tour-card-body" className="tour-card-body">{step!.body(ctx)}</p>
        <div className="tour-card-actions">
          <button type="button" className="tour-skip" onClick={skip}>Skip tour</button>
          <span className="tour-grow" />
          {index > 0 && (
            <button type="button" className="tour-btn" onClick={back}>Back</button>
          )}
          <button ref={primaryRef} type="button" className="tour-btn tour-btn-primary" onClick={next}>
            {index === total - 1 ? 'Finish' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
