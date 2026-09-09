import {
  forwardRef, useImperativeHandle, useEffect, useMemo, useRef, useState,
} from 'react';
import { Search, SearchX, Plus, Check, X } from 'lucide-react';
import { verses } from '../data/index.js';
import { useMediaQuery, MOBILE_BREAKPOINT } from '../hooks/useMediaQuery.js';
import './SearchField.css';

export interface SearchFieldRef {
  /** Put the cursor in the field, from ⌘K or "/". */
  focus: () => void;
}

interface SearchFieldProps {
  onVerseSelect: (verseId: string) => void;
  onAddVerse: (verseId: string) => void;
  networkVerses: Set<string>;
}

/** Bold the matched run inside a result, so it is obvious why it matched. */
function highlight(text: string, query: string) {
  const q = query.trim();
  if (!q) return text;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="sf-highlight">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/**
 * Search, as a field in the toolbar rather than a modal.
 *
 * It used to be a button that opened a centred overlay, which meant the
 * canvas — the thing you are searching in order to act on — was covered by a
 * scrim the moment you started looking. Here the field stays where it is and
 * only a dropdown appears beneath it, so results and canvas are visible at
 * once and adding a verse never costs a round trip through a dialog.
 *
 * On a phone there is no room for a field that reads as a field: it competes
 * with Chapters and the actions menu and ends up too narrow to type in. So it
 * collapses to an icon there and takes the full width of the toolbar once
 * tapped, which is also where the results panel wants to be.
 */
const SearchField = forwardRef<SearchFieldRef, SearchFieldProps>(
  ({ onVerseSelect, onAddVerse, networkVerses }, ref) => {
    const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(false);
    const [wantsExpanded, setExpanded] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      focus: () => {
        setExpanded(true);
        // The field may only now be rendering, so focus after it exists.
        requestAnimationFrame(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        });
      },
    }));

    // Expanding is only meaningful on mobile, where the field starts as an
    // icon. Deriving it means a widening screen collapses it for free.
    const expanded = isMobile && wantsExpanded;

    useEffect(() => {
      if (!open && !expanded) return;
      const onDown = (e: MouseEvent) => {
        if (rootRef.current && !rootRef.current.contains(e.target as globalThis.Node)) {
          setOpen(false);
          if (!query) setExpanded(false);
        }
      };
      document.addEventListener('mousedown', onDown);
      return () => document.removeEventListener('mousedown', onDown);
    }, [open, expanded, query]);

    const results = useMemo(() => {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      return verses
        .filter((verse) => {
          if (verse.id.includes(q)) return true;
          if (`chapter ${verse.chapter}`.includes(q)) return true;
          if (verse.theme?.toLowerCase().includes(q)) return true;
          if (verse.concepts.some((c) => c.toLowerCase().includes(q))) return true;
          if (verse.wordMeanings.toLowerCase().includes(q)) return true;
          if (verse.transliteration.toLowerCase().includes(q)) return true;
          return false;
        })
        .slice(0, 8);
    }, [query]);

    const select = (verseId: string) => {
      onVerseSelect(verseId);
      setOpen(false);
      setExpanded(false);
      inputRef.current?.blur();
    };

    const clear = () => {
      setQuery('');
      setActiveIndex(0);
      inputRef.current?.focus();
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
      // The canvas listens for these too; while typing here they are ours.
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (query) clear();
        else {
          setExpanded(false);
          inputRef.current?.blur();
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setOpen(true);
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results[activeIndex]) {
        e.preventDefault();
        select(results[activeIndex].id);
      }
    };

    const hasQuery = query.trim().length > 0;
    const showDropdown = open && hasQuery;
    // Focused but empty: say what the field matches on rather than showing a
    // blank panel or nothing at all.
    const showHint = open && !hasQuery;
    const collapsed = isMobile && !expanded;

    if (collapsed) {
      return (
        <div className="sf-root is-collapsed" ref={rootRef}>
          <button
            type="button"
            className="sf-toggle"
            onClick={() => {
              setExpanded(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            aria-label="Search verses"
            aria-expanded={false}
          >
            <Search size={18} />
          </button>
        </div>
      );
    }

    return (
      <div className={`sf-root ${expanded ? 'is-expanded' : ''}`} ref={rootRef}>
        <div className={`sf-field ${showDropdown ? 'is-open' : ''}`}>
          <Search size={16} className="sf-icon" />
          <input
            ref={inputRef}
            type="text"
            className="sf-input"
            placeholder={isMobile ? 'Search verses' : 'Search verses by number, concept, or theme'}
            value={query}
            role="combobox"
            aria-expanded={showDropdown || showHint}
            aria-controls="sf-results"
            aria-activedescendant={showDropdown && results[activeIndex] ? `sf-opt-${results[activeIndex].id}` : undefined}
            aria-autocomplete="list"
            aria-label="Search verses"
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
              setOpen(true);
            }}
            onKeyDown={onKeyDown}
          />
          {query ? (
            <button type="button" className="sf-clear" onClick={clear} aria-label="Clear search">
              <X size={14} />
            </button>
          ) : expanded ? (
            <button
              type="button"
              className="sf-clear"
              onClick={() => setExpanded(false)}
              aria-label="Close search"
            >
              <X size={14} />
            </button>
          ) : (
            <kbd className="sf-kbd">⌘K</kbd>
          )}
        </div>

        {showHint && (
          <div className="sf-dropdown">
            <span className="sf-hint">
              Search all <strong>{verses.length}</strong> verses by number like{' '}
              <strong>2.47</strong>, concept like <strong>karma</strong>, theme, or Sanskrit.
            </span>
          </div>
        )}

        {showDropdown && (
          <div className="sf-dropdown" id="sf-results" role="listbox" aria-label="Search results">
            {results.length > 0 ? (
              results.map((verse, index) => {
                const inNetwork = networkVerses.has(verse.id);
                return (
                  <div
                    key={verse.id}
                    id={`sf-opt-${verse.id}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={`sf-result ${index === activeIndex ? 'is-active' : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <button type="button" className="sf-result-main" onClick={() => select(verse.id)}>
                      <span className="sf-result-head">
                        <span className="sf-result-id">{highlight(verse.id, query)}</span>
                        <span className="sf-result-chapter">Ch. {verse.chapter}</span>
                      </span>
                      <span className="sf-result-theme">
                        {highlight(verse.theme ?? verse.transliteration, query)}
                      </span>
                      <span className="sf-result-concepts">
                        {verse.concepts.slice(0, 3).map((c) => (
                          <span key={c} className="sf-result-concept">{highlight(c, query)}</span>
                        ))}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={`sf-result-add ${inNetwork ? 'is-in-network' : ''}`}
                      onClick={() => { if (!inNetwork) onAddVerse(verse.id); }}
                      disabled={inNetwork}
                      title={inNetwork ? 'Already on the canvas' : 'Add to the canvas'}
                      aria-label={inNetwork ? `${verse.id} is already on the canvas` : `Add ${verse.id} to the canvas`}
                    >
                      {inNetwork ? <Check size={16} /> : <Plus size={16} />}
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="sf-empty">
                <SearchX size={22} />
                <span className="sf-empty-title">No verses found</span>
                <span className="sf-empty-hint">
                  Try a verse number like 2.47, a concept like karma, or a theme
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

SearchField.displayName = 'SearchField';
export default SearchField;
