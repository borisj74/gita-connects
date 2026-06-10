import { useEffect, useRef, useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from 'reactflow';
import { Trash2 } from 'lucide-react';
import './ConnectionEdge.css';

const PARALLEL_OFFSET_PX = 56;

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
        style={style}
        markerEnd={markerEnd}
      />
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
          className={`edge-label-wrapper ${open ? 'open' : ''}`}
        >
          <button
            className="edge-label"
            style={{ borderColor, color: borderColor, transform: `translateY(${labelOffset}px)` }}
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
