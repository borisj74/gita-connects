import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { ConnectionTypeDef } from '../connectionTypes.js';
import { connections } from '../data.js';
import './ConnectionFilters.css';

interface ConnectionFiltersProps {
  connectionTypes: ConnectionTypeDef[];
  activeFilters: Set<string>;
  onToggleFilter: (type: string) => void;
  onRemoveCustomType?: (typeId: string) => void;
}

export default function ConnectionFilters({
  connectionTypes,
  activeFilters,
  onToggleFilter,
  onRemoveCustomType,
}: ConnectionFiltersProps) {
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

  // Count connections per type from the base dataset.
  const countsByType = useMemo(() => {
    const m = new Map<string, number>();
    connections.forEach((c) => m.set(c.type, (m.get(c.type) ?? 0) + 1));
    return m;
  }, []);

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
          {connectionTypes.map(({ id, color, label, isCustom }) => (
            <label key={id} className="filter-item">
              <input
                type="checkbox"
                className="filter-checkbox"
                checked={activeFilters.has(id)}
                onChange={() => onToggleFilter(id)}
              />
              <span className="filter-color" style={{ background: color }} />
              <span className="filter-text">{label}</span>
              <span className="filter-count">{countsByType.get(id) ?? 0}</span>
              {isCustom && onRemoveCustomType && (
                <button
                  type="button"
                  className="filter-remove"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onRemoveCustomType(id);
                  }}
                  aria-label={`Remove ${label} type`}
                  title="Remove custom type"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </label>
          ))}
          <div className="filters-hint">
            Drag between two verses to create a new connection.
          </div>
        </div>
      )}
    </div>
  );
}
