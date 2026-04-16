import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import type { Verse } from '../types.js';
import './VerseNode.css';

interface VerseNodeProps {
  data: {
    verse: Verse;
    onSelect: () => void;
    onRemove: () => void;
    onExpand?: () => void;
    isSelected: boolean;
    connectedCount?: number;
  };
}

function VerseNode({ data }: VerseNodeProps) {
  const { verse, onSelect, onRemove, onExpand, isSelected, connectedCount = 0 } = data;

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  };

  const handleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onExpand) onExpand();
  };

  return (
    <div
      className={`verse-node ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <Handle type="target" position={Position.Top} className="node-handle" />

      <div className="node-drag-handle" title="Drag to move">
        <span className="node-drag-dots">⠿</span>
      </div>

      <button className="node-remove" onClick={handleRemove} aria-label="Remove verse">
        ×
      </button>

      <div className="node-header">
        <div className="node-verse-id">{verse.id}</div>
        <div className="node-theme">{verse.theme}</div>
      </div>

      <div className="node-sanskrit">{verse.sanskrit}</div>
      <div className="node-transliteration">{verse.transliteration}</div>
      <div className="node-translation">{verse.translation}</div>

      <div className="node-concepts">
        {verse.concepts.map((concept) => (
          <span key={concept} className="node-concept">{concept}</span>
        ))}
      </div>

      {connectedCount > 0 && (
        <button className="node-expand" onClick={handleExpand} aria-label="Expand network">
          <span className="expand-icon">+</span>
          <span className="expand-text">
            Show {connectedCount} connected verse{connectedCount !== 1 ? 's' : ''}
          </span>
        </button>
      )}

      <Handle type="source" position={Position.Bottom} className="node-handle" />
    </div>
  );
}

export default memo(VerseNode);
