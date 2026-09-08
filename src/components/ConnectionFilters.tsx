import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import type { Edge } from 'reactflow';
import type { ConnectionTypeDef } from '../connectionTypes.js';
import { connections } from '../data/index.js';
import './Toolbar.css';
import './ConnectionFilters.css';

interface ConnectionFiltersProps {
  connectionTypes: ConnectionTypeDef[];
  activeFilters: Set<string>;
  onToggleFilter: (type: string) => void;
  onRemoveCustomType?: (typeId: string) => void;
  /** Edges currently on the canvas, so counts reflect what is drawn. */
  networkEdges?: Edge[];
}

export default function ConnectionFilters({
  connectionTypes,
  activeFilters,
  onToggleFilter,
  onRemoveCustomType,
  networkEdges = [],
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

  const activeCount = connectionTypes.filter((t) => activeFilters.has(t.id)).length;
  const totalCount = connectionTypes.length;

  // Dataset total per type. Custom types have no dataset entries, so their
  // total is whatever is drawn.
  const totalByType = useMemo(() => {
    const m = new Map<string, number>();
    connections.forEach((c) => m.set(c.type, (m.get(c.type) ?? 0) + 1));
    return m;
  }, []);

  // What is actually on the canvas right now.
  const canvasByType = useMemo(() => {
    const m = new Map<string, number>();
    networkEdges.forEach((e) => {
      const type = (e.data as { typeId?: string } | undefined)?.typeId;
      if (type) m.set(type, (m.get(type) ?? 0) + 1);
    });
    return m;
  }, [networkEdges]);

  return (
    <div className="connection-filters" ref={dropdownRef}>
      <button
        type="button"
        className="tb-button filters-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Link types, ${activeCount} of ${totalCount} shown`}
      >
        <span className="filters-label">Link types</span>
        <span className="tb-button-muted">{activeCount} of {totalCount}</span>
        <ChevronDown size={16} className="tb-chevron" />
      </button>

      {isOpen && (
        <div className="filters-dropdown">
          {connectionTypes.map(({ id, color, label, isCustom, directional }) => (
            <label key={id} className="filter-item">
              <input
                type="checkbox"
                className="filter-checkbox"
                checked={activeFilters.has(id)}
                onChange={() => onToggleFilter(id)}
              />
              <span
                className={`filter-color ${directional ? 'directional' : ''}`}
                style={{ background: color, color }}
                aria-hidden="true"
              />
              <span className="filter-text">{label}</span>
              <span
                className={`filter-count ${(canvasByType.get(id) ?? 0) === 0 ? 'is-empty' : ''}`}
                title={
                  isCustom
                    ? `${canvasByType.get(id) ?? 0} on canvas`
                    : `${canvasByType.get(id) ?? 0} on canvas · ${totalByType.get(id) ?? 0} in the Gita`
                }
              >
                {isCustom
                  ? canvasByType.get(id) ?? 0
                  : `${canvasByType.get(id) ?? 0} of ${totalByType.get(id) ?? 0}`}
              </span>
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
            <div className="filters-legend">
              <span className="filter-color directional filters-legend-swatch" aria-hidden="true" />
              Arrow points from the earlier or more basic verse to the one that follows from it.
            </div>
            Drag between two verses to create a new connection.
          </div>
        </div>
      )}
    </div>
  );
}
