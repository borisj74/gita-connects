import { useContext } from 'react';
import {
  getSmoothStepPath,
  Position,
  useStore,
  type ConnectionLineComponentProps,
} from 'reactflow';
import { ConnectTargetContext } from './connectTarget.js';
import './ConnectionLine.css';

// The line drawn while dragging from a verse's bottom dot. Over another card
// it snaps to that card's top dot, so the whole card is the drop target;
// over its own card it greys out and goes dashed.
export default function ConnectionLine({
  fromX,
  fromY,
  toX,
  toY,
  fromPosition,
  toPosition,
}: ConnectionLineComponentProps) {
  const target = useContext(ConnectTargetContext);
  const targetNode = useStore((s) =>
    target?.valid ? s.nodeInternals.get(target.id) : undefined,
  );

  let endX = toX;
  let endY = toY;
  let endPosition = toPosition;
  const snapped = Boolean(targetNode?.positionAbsolute && targetNode.width);
  if (snapped && targetNode?.positionAbsolute) {
    endX = targetNode.positionAbsolute.x + (targetNode.width ?? 0) / 2;
    endY = targetNode.positionAbsolute.y;
    endPosition = Position.Top;
  }

  const [path] = getSmoothStepPath({
    sourceX: fromX,
    sourceY: fromY,
    sourcePosition: fromPosition,
    targetX: endX,
    targetY: endY,
    targetPosition: endPosition,
    borderRadius: 28,
    offset: 25,
  });

  const state = snapped ? 'is-snapped' : target && !target.valid ? 'is-invalid' : '';

  return (
    <g className={`drag-line ${state}`}>
      <path className="drag-line-path" d={path} fill="none" />
      <circle className="drag-line-end" cx={endX} cy={endY} r={snapped ? 7 : 4} />
    </g>
  );
}
