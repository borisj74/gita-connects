import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import './ConnectionFilters.css';

interface ConnectionFiltersProps {
  activeFilters: Set<string>;
  onToggleFilter: (type: string) => void;
}

const connectionTypes = [
  { type: 'thematic', color: '#ca7558', label: 'Thematic' },
  { type: 'conceptual', color: '#7d8a6e', label: 'Conceptual' },
  { type: 'practical', color: '#8d7a66', label: 'Practical' },
];

export default function ConnectionFilters({ activeFilters, onToggleFilter }: ConnectionFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeCount = activeFilters.size;

  return (
    <div className="connection-filters" ref={dropdownRef}>
      <button
        className="filters-button"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className="filters-label">Connections ({activeCount})</span>
        <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
      </button>

      {isOpen && (
        <div className="filters-dropdown">
          {connectionTypes.map(({ type, color, label }) => (
            <label key={type} className="filter-item">
              <input
                type="checkbox"
                className="filter-checkbox"
                checked={activeFilters.has(type)}
                onChange={() => onToggleFilter(type)}
              />
              <span className="filter-color" style={{ background: color }} />
              <span className="filter-text">{label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
