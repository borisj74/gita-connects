import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from 'reactflow';
import { Trash2 } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import './ConnectionEdge.css';

const PARALLEL_OFFSET_PX = 56;
// How long a new connection takes to draw from source to target.
const DRAW_MS = 450;

export default function ConnectionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
  data,
}: EdgeProps) {
  const parallelIndex = (data?.parallelIndex as number | undefined) ?? 0;
  const parallelTotal = (data?.parallelTotal as number | undefined) ?? 1;
  const offsetStep = parallelIndex - (parallelTotal - 1) / 2;
  const pathOffset = offsetStep * 14;
  const labelOffset = offsetStep * PARALLEL_OFFSET_PX;

  // Middle ground between hard right angles and full bezier curves:
  // stepped routing with generously rounded corners.
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 28,
    offset: 25 + Math.abs(pathOffset),
    centerX: (sourceX + targetX) / 2 + pathOffset,
  });

  const borderColor = (data?.color as string | undefined) ?? 'rgb(177, 93, 67)';
  const dimmed = Boolean(data?.dimmed);
  const description = (data?.description as string | undefined) ?? '';
  const strength = (data?.strength as number | undefined) ?? null;
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  // Set while this line should draw itself in: a connection just made, or
  // one of a verse's scholarly links fanning out (each a little later).
  const drawDelay = data?.drawDelay as number | undefined;
  const drawingIn = drawDelay !== undefined && !reduceMotion;
  const delay = drawDelay ?? 0;
  const strokeWidth = Number(style?.strokeWidth ?? 2);

  // The trace and the spark at its head share one clock, so the dot always
  // rides the tip of the line. Runs before paint so nothing flashes at the
  // canvas origin; the fades that follow are plain CSS, offset by the same
  // delay through --draw-delay.
  const traceRef = useRef<SVGPathElement>(null);
  const haloRef = useRef<SVGPathElement>(null);
  const sparkRef = useRef<SVGCircleElement>(null);
  useLayoutEffect(() => {
    if (!drawingIn) return;
    const start = performance.now() + delay;
    let raf = 0;
    const step = (now: number) => {
      const trace = traceRef.current;
      if (!trace) return;
      if (now < start) {
        raf = requestAnimationFrame(step);
        return;
      }
      sparkRef.current?.setAttribute('visibility', 'visible');
      const t = Math.min(1, (now - start) / DRAW_MS);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const offset = String(1 - eased);
      trace.style.strokeDashoffset = offset;
      if (haloRef.current) haloRef.current.style.strokeDashoffset = offset;
      const point = trace.getPointAtLength(trace.getTotalLength() * eased);
      sparkRef.current?.setAttribute('cx', String(point.x));
      sparkRef.current?.setAttribute('cy', String(point.y));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    step(performance.now());
    return () => cancelAnimationFrame(raf);
    // The delay is fixed for the life of one draw-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingIn]);

  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as globalThis.Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // Capture phase: the React Flow pane stops propagation of mousedown
    // (pan/drag handling), so a bubble-phase document listener never fires
    // for canvas clicks.
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        // While the new line draws in, the real edge (and its arrowhead)
        // waits, then fades in under the trace as it lands.
        style={drawingIn ? { ...style, animation: `edgeSettleIn 200ms ease-out ${380 + delay}ms backwards` } : style}
        markerEnd={markerEnd}
      />
      {drawingIn && (
        <g
          className="edge-draw"
          style={{ color: borderColor, '--draw-delay': `${delay}ms` } as React.CSSProperties}
          aria-hidden="true"
        >
          <path ref={haloRef} className="edge-draw-halo" d={edgePath} pathLength={1} strokeWidth={strokeWidth + 8} />
          <path ref={traceRef} className="edge-draw-trace" d={edgePath} pathLength={1} strokeWidth={strokeWidth + 0.5} />
          <circle ref={sparkRef} className="edge-draw-spark" r={4.5} cx={sourceX} cy={sourceY} visibility="hidden" />
        </g>
      )}
      <EdgeLabelRenderer>
        <div
          ref={wrapperRef}
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            pointerEvents: dimmed ? 'none' : 'all',
            opacity: dimmed ? 0.15 : 1,
            transition: 'opacity 0.2s ease',
          }}
          className={`edge-label-wrapper ${open ? 'open' : ''} ${drawingIn ? 'just-connected' : ''}`}
        >
          <button
            className="edge-label"
            style={{
              borderColor,
              color: borderColor,
              transform: `translateY(${labelOffset}px)`,
              animationDelay: drawingIn ? `${380 + delay}ms` : undefined,
            }}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            aria-expanded={open}
            aria-label={`Connection details: ${label}`}
          >
            <span
              className="edge-label-dot"
              style={{ background: borderColor }}
            />
            {label}
          </button>

          {open && (
            <div className="edge-popover" style={{ borderColor }}>
              <div className="edge-popover-header">
                <span className="edge-popover-dot" style={{ background: borderColor }} />
                <span className="edge-popover-type" style={{ color: borderColor }}>{label}</span>
                {strength != null && (
                  <span className="edge-popover-strength">Strength {strength}/10</span>
                )}
              </div>
              {description && (
                <p className="edge-popover-description">{description}</p>
              )}
              {typeof data?.onDelete === 'function' && (
                <button
                  className="edge-popover-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    (data.onDelete as (id: string) => void)(id);
                  }}
                >
                  <Trash2 size={14} />
                  Remove connection
                </button>
              )}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
