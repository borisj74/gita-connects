import { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from 'reactflow';
import './ConnectionEdge.css';

const PARALLEL_OFFSET_PX = 36;

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
  const [showTooltip, setShowTooltip] = useState(false);

  const parallelIndex = (data?.parallelIndex as number | undefined) ?? 0;
  const parallelTotal = (data?.parallelTotal as number | undefined) ?? 1;
  const offsetStep = parallelIndex - (parallelTotal - 1) / 2;
  const pathOffset = offsetStep * 14;
  const labelOffset = offsetStep * PARALLEL_OFFSET_PX;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    offset: 25 + Math.abs(pathOffset),
    centerX: (sourceX + targetX) / 2 + pathOffset,
  });

  const borderColor = (data?.color as string | undefined) ?? 'rgb(177, 93, 67)';

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
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY + labelOffset}px)`,
            pointerEvents: 'all',
          }}
          className="edge-label-wrapper"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <div
            className="edge-label"
            style={{ borderColor, color: borderColor }}
          >
            <span
              className="edge-label-dot"
              style={{ background: borderColor }}
            />
            {label}
          </div>

          {showTooltip && data?.description && (
            <div className="edge-tooltip" style={{ borderColor }}>
              <div className="tooltip-type" style={{ color: borderColor }}>
                {label}
              </div>
              <div className="tooltip-description">{data.description}</div>
              {data?.strength && (
                <div className="tooltip-strength">
                  Strength: {data.strength}/10
                </div>
              )}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
