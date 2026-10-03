import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { X, Plus, AlignLeft, FilePlus2, Check } from 'lucide-react';
import type { Verse } from '../types.js';
import { vedabaseUrl } from '../data/index.js';
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
    /** Personal note (App 29): badge when present, add button otherwise. */
    hasNote?: boolean;
    onOpenNote?: () => void;
    /** A connection was just made: the line leaves the source, lands on the target. */
    connectPulse?: 'source' | 'target' | null;
    /** Color of the new connection's type, used by the pulse ring. */
    pulseColor?: string;
    /** A connection is being dragged over this card. */
    connectHover?: 'valid' | 'invalid' | null;
    /** A connection was just dropped back on its own card. */
    connectReject?: boolean;
  };
}

function VerseNode({ data }: VerseNodeProps) {
  const {
    verse, onSelect, onRemove, onExpand, isSelected, connectedCount = 0,
    conceptFilter = null, onConceptSelect, hasNote = false, onOpenNote,
    connectPulse = null, pulseColor, connectHover = null, connectReject = false,
  } = data;

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
      className={[
        'verse-node',
        isSelected && 'selected',
        connectPulse && `connect-pulse-${connectPulse}`,
        connectHover && `connect-target-${connectHover}`,
        connectReject && 'connect-reject',
      ].filter(Boolean).join(' ')}
      style={pulseColor ? ({ '--pulse-color': pulseColor } as React.CSSProperties) : undefined}
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
        {onOpenNote && (
          <button
            type="button"
            className={`node-note nodrag ${hasNote ? 'has-note' : ''}`}
            data-tip={hasNote ? 'Read your note' : 'Add a note'}
            aria-label={hasNote ? `Read your note on ${verse.id}` : `Add a note to ${verse.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onOpenNote();
            }}
          >
            {hasNote ? <AlignLeft size={15} strokeWidth={2.2} /> : <FilePlus2 size={15} strokeWidth={2.2} />}
          </button>
        )}
      </div>

      {/* Fetched translations keep a fixed four-line slot from the first
          frame, so the card does not grow (and jump) when the text lands. */}
      {body ? (
        <div className={`node-translation ${verse.summary ? '' : 'is-fetched'}`}>{body}</div>
      ) : text.status === 'loading' || text.status === 'idle' ? (
        <div className="node-translation node-translation-skeleton" aria-busy="true">
          <span className="node-visually-hidden">Loading translation…</span>
          <span className="node-skeleton-line" aria-hidden="true" />
          <span className="node-skeleton-line" aria-hidden="true" />
          <span className="node-skeleton-line" aria-hidden="true" />
          <span className="node-skeleton-line" aria-hidden="true" />
        </div>
      ) : (
        <div className="node-translation node-translation-fallback">
          {verse.transliteration}
        </div>
      )}

      {/* Standing in the transliteration without saying so reads as though it
          were the translation. Name what is missing, and hand over a way to
          read it anyway. */}
      {text.status === 'unavailable' && (
        <p className="node-translation-missing">
          Translation unavailable.{' '}
          <a
            className="nodrag"
            href={vedabaseUrl(verse)}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
          >
            Read {verse.id} on Vedabase
          </a>
        </p>
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

      {connectedCount > 0 ? (
        <button className="node-expand" onClick={handleExpand} aria-label="Expand network">
          <Plus size={16} className="expand-icon" />
          <span className="expand-text">Show {connectedCount} connected verse{connectedCount !== 1 ? 's' : ''}</span>
        </button>
      ) : (
        // Every linked verse is already on the canvas. Say so in the button's
        // place, so the card does not look like it lost a feature.
        <p className="node-expand-done">
          <Check size={14} strokeWidth={2.4} aria-hidden="true" />
          All linked verses shown
        </p>
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
