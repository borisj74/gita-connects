import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { X, Plus } from 'lucide-react';
import type { Verse } from '../types.js';
import { useVerseText } from '../hooks/useVerseText.js';
import './VerseNode.css';

interface VerseNodeProps {
  data: {
    verse: Verse;
    onSelect: () => void;
    onRemove: () => void;
    onExpand?: () => void;
    isSelected: boolean;
    connectedCount?: number;
    /** Concept chip acting as a filter (App 23), if any. */
    conceptFilter?: string | null;
    onConceptSelect?: (concept: string) => void;
  };
}

function VerseNode({ data }: VerseNodeProps) {
  const { verse, onSelect, onRemove, onExpand, isSelected, connectedCount = 0, conceptFilter = null, onConceptSelect } = data;

  // Cards always lead with English. Curated verses carry a summary; the rest
  // show the first line of the translation, fetched on demand and cached for
  // the session (see useVerseText for why it is never bundled).
  const text = useVerseText(verse.summary ? null : verse.id);
  // Summaries use *asterisks* for Sanskrit terms; cards render plain text.
  const body = (
    verse.summary ??
    (text.status === 'ready' ? text.text.translation : null)
  )?.replace(/\*/g, '');

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

      <button className="node-remove" onClick={handleRemove} aria-label="Remove verse">
        <X size={16} strokeWidth={2.5} />
      </button>

      <div className="node-header">
        <div className="node-verse-id">{verse.id}</div>
        <div className={`node-theme ${verse.curated && !verse.reviewed ? 'unreviewed' : ''}`}>
          {verse.theme ?? 'Uncurated'}
        </div>
      </div>

      {body ? (
        <div className="node-translation">{body}</div>
      ) : (
        <div
          className={`node-translation node-translation-fallback ${text.status === 'loading' ? 'is-loading' : ''}`}
          aria-busy={text.status === 'loading'}
        >
          {text.status === 'loading' ? 'Loading translation…' : verse.transliteration}
        </div>
      )}

      <div className="node-concepts">
        {verse.concepts.map(concept => {
          const active = conceptFilter === concept;
          return (
            <button
              key={concept}
              type="button"
              className={`node-concept nodrag ${active ? 'is-active' : conceptFilter ? 'is-muted' : ''}`}
              data-tip={active ? 'Clear filter' : `Show all verses on ${concept}`}
              aria-pressed={active}
              onClick={(e) => {
                e.stopPropagation();
                onConceptSelect?.(concept);
              }}
            >
              {concept}
            </button>
          );
        })}
      </div>

      {connectedCount > 0 && (
        <button className="node-expand" onClick={handleExpand} aria-label="Expand network">
          <Plus size={16} className="expand-icon" />
          <span className="expand-text">Show {connectedCount} connected verse{connectedCount !== 1 ? 's' : ''}</span>
        </button>
      )}

      <Handle type="source" position={Position.Bottom} className="node-handle" />

      {/* Shown only while the card itself has keyboard focus (App 24) */}
      <div className="node-key-hints" aria-hidden="true">
        <span><kbd>⏎</kbd>Open verse</span>
        <span><kbd>← →</kbd>Move along links</span>
        <span><kbd>Del</kbd>Remove</span>
      </div>
    </div>
  );
}

export default memo(VerseNode);
