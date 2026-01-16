import { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import { verses } from '../data.js';
import './SearchBar.css';

interface SearchBarProps {
  onVerseSelect: (verseId: string) => void;
}

export default function SearchBar({ onVerseSelect }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];

    const lowerQuery = query.toLowerCase();

    return verses.filter(verse => {
      // Search by verse ID (e.g., "2.47")
      if (verse.id.includes(lowerQuery)) return true;

      // Search by chapter (e.g., "chapter 2")
      if (`chapter ${verse.chapter}`.includes(lowerQuery)) return true;

      // Search by theme
      if (verse.theme.toLowerCase().includes(lowerQuery)) return true;

      // Search by concepts
      if (verse.concepts.some(c => c.toLowerCase().includes(lowerQuery))) return true;

      // Search in translation
      if (verse.translation.toLowerCase().includes(lowerQuery)) return true;

      // Search in transliteration
      if (verse.transliteration.toLowerCase().includes(lowerQuery)) return true;

      return false;
    }).slice(0, 8); // Limit to 8 results
  }, [query]);

  const handleSelect = (verseId: string) => {
    onVerseSelect(verseId);
    setQuery('');
    setIsFocused(false);
  };

  const handleClear = () => {
    setQuery('');
  };

  return (
    <div className="search-container">
      <div className={`search-bar ${isFocused ? 'focused' : ''}`}>
        <Search size={20} className="search-icon" />
        <input
          type="text"
          className="search-input"
          placeholder="Search verses by number, concept, or theme..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 200)}
        />
        {query && (
          <button className="clear-button" onClick={handleClear} aria-label="Clear search">
            <X size={18} />
          </button>
        )}
      </div>

      {isFocused && searchResults.length > 0 && (
        <div className="search-results">
          {searchResults.map((verse, index) => (
            <div
              key={verse.id}
              className="search-result-item"
              onClick={() => handleSelect(verse.id)}
              style={{ animationDelay: `${index * 30}ms` }}
            >
              <div className="result-header">
                <span className="result-id">{verse.id}</span>
                <span className="result-chapter">Ch. {verse.chapter}</span>
              </div>
              <div className="result-theme">{verse.theme}</div>
              <div className="result-concepts">
                {verse.concepts.slice(0, 3).map(concept => (
                  <span key={concept} className="result-concept">
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {isFocused && query && searchResults.length === 0 && (
        <div className="search-results">
          <div className="no-results">
            <div className="no-results-icon">🔍</div>
            <div className="no-results-text">No verses found</div>
            <div className="no-results-hint">
              Try searching by verse number (e.g., "2.47"), concept (e.g., "karma"), or theme
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
