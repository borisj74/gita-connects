import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, SearchX } from 'lucide-react';
import { verses } from '../data.js';
import './SearchPalette.css';

interface SearchPaletteProps {
  onVerseSelect: (verseId: string) => void;
  onClose: () => void;
}

// Bold the matched substring within a result string.
function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="palette-highlight">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function SearchPalette({ onVerseSelect, onClose }: SearchPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return verses
      .filter((verse) => {
        if (verse.id.includes(q)) return true;
        if (`chapter ${verse.chapter}`.includes(q)) return true;
        if (verse.theme.toLowerCase().includes(q)) return true;
        if (verse.concepts.some((c) => c.toLowerCase().includes(q))) return true;
        if (verse.translation.toLowerCase().includes(q)) return true;
        if (verse.transliteration.toLowerCase().includes(q)) return true;
        return false;
      })
      .slice(0, 8);
  }, [query]);

  const select = (verseId: string) => {
    onVerseSelect(verseId);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && results[activeIndex]) {
      select(results[activeIndex].id);
    }
  };

  return (
    <div className="palette-overlay" onMouseDown={onClose}>
      <div
        className="palette"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Search verses"
      >
        <div className="palette-input-row">
          <Search size={18} className="palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="palette-input"
            placeholder="Search verses by number, concept, or theme..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setActiveIndex(0); }}
          />
          <kbd className="palette-kbd">Esc</kbd>
        </div>

        {query && results.length > 0 && (
          <div className="palette-results">
            {results.map((verse, index) => (
              <button
                key={verse.id}
                className={`palette-result ${index === activeIndex ? 'active' : ''}`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => select(verse.id)}
              >
                <div className="palette-result-header">
                  <span className="palette-result-id">{highlight(verse.id, query)}</span>
                  <span className="palette-result-chapter">Ch. {verse.chapter}</span>
                </div>
                <div className="palette-result-theme">{highlight(verse.theme, query)}</div>
                <div className="palette-result-concepts">
                  {verse.concepts.slice(0, 3).map((c) => (
                    <span key={c} className="palette-result-concept">{highlight(c, query)}</span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}

        {query && results.length === 0 && (
          <div className="palette-empty">
            <SearchX size={28} />
            <div className="palette-empty-text">No verses found</div>
            <div className="palette-empty-hint">
              Try a verse number (e.g. "2.47"), concept (e.g. "karma"), or theme
            </div>
          </div>
        )}

        {!query && (
          <div className="palette-hint">
            Type to search across {verses.length} verses — by number, concept, theme, or translation
          </div>
        )}
      </div>
    </div>
  );
}
