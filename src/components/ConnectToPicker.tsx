import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Check } from 'lucide-react';
import { verses, getVerse } from '../data/index.js';
import './ConnectToPicker.css';

interface ConnectToPickerProps {
  /** The verse the link starts from. */
  fromId: string;
  networkVerses: Set<string>;
  onPick: (toId: string) => void;
  onCancel: () => void;
}

const LIMIT = 30;

/** Same matching as the toolbar search: number, chapter, theme, concept or transliteration. */
function matches(q: string, v: (typeof verses)[number]): boolean {
  return (
    v.id.includes(q)
    || `chapter ${v.chapter}`.includes(q)
    || !!v.theme?.toLowerCase().includes(q)
    || v.concepts.some((c) => c.toLowerCase().includes(q))
    || v.transliteration.toLowerCase().includes(q)
  );
}

/**
 * "Connect to…" from the verse panel: pick the other verse from a list
 * instead of dragging between cards. Verses already on the canvas come
 * first; searching reaches all 701.
 */
export default function ConnectToPicker({ fromId, networkVerses, onPick, onCancel }: ConnectToPickerProps) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const onCanvas = (id: string) => networkVerses.has(id);
    const pool = q ? verses.filter((v) => matches(q, v)) : verses.filter((v) => onCanvas(v.id));
    return pool
      .filter((v) => v.id !== fromId)
      .sort((a, b) => Number(onCanvas(b.id)) - Number(onCanvas(a.id)))
      .slice(0, LIMIT);
  }, [query, networkVerses, fromId]);

  const from = getVerse(fromId);

  const onKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      onCancel();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      e.preventDefault();
      onPick(results[active].id);
    }
  };

  // Portalled: the mobile panel is a moved (transformed) sheet, which would
  // otherwise trap this fixed overlay inside it.
  return createPortal(
    <div className="ctp-overlay" onClick={onCancel} onKeyDown={onKeyDown}>
      <div
        className="ctp-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ctp-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ctp-header">
          <h3 id="ctp-title" className="ctp-title">
            Connect <strong>{fromId}</strong>{from?.theme ? ` ${from.theme}` : ''} to…
          </h3>
          <button type="button" className="ctp-close" onClick={onCancel} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="ctp-field">
          <Search size={16} className="ctp-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            className="ctp-input"
            type="text"
            value={query}
            placeholder="Verse number, concept or theme"
            aria-label="Find the verse to connect to"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="ctp-results"
            aria-activedescendant={results[active] ? `ctp-opt-${results[active].id}` : undefined}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
          />
        </div>
        <p className="ctp-sublabel">
          {query.trim() ? 'Matching verses' : networkVerses.size > 1 ? 'On your canvas' : 'Search for a verse to connect to'}
        </p>
        <ul id="ctp-results" className="ctp-list" role="listbox" aria-label="Verses">
          {results.map((v, i) => (
            <li key={v.id} id={`ctp-opt-${v.id}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`ctp-item ${i === active ? 'is-active' : ''}`}
                onClick={() => onPick(v.id)}
                onMouseEnter={() => setActive(i)}
                tabIndex={-1}
              >
                <span className="ctp-id">{v.id}</span>
                <span className="ctp-theme">{v.theme ?? v.transliteration}</span>
                {networkVerses.has(v.id) && (
                  <span className="ctp-on-canvas">
                    <Check size={12} strokeWidth={2.6} aria-hidden="true" /> On canvas
                  </span>
                )}
              </button>
            </li>
          ))}
          {query.trim() && results.length === 0 && <li className="ctp-empty">No verses match “{query.trim()}”.</li>}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
