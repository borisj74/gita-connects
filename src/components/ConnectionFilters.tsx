import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Trash2, Check, Plus, ArrowRight } from 'lucide-react';
import type { Edge } from 'reactflow';
import {
  CUSTOM_TYPE_COLORS,
  makeCustomTypeId,
  type ConnectionTypeDef,
} from '../connectionTypes.js';
import { connections } from '../data/index.js';
import './Toolbar.css';
import './ConnectionFilters.css';

interface ConnectionFiltersProps {
  connectionTypes: ConnectionTypeDef[];
  activeFilters: Set<string>;
  onToggleFilter: (type: string) => void;
  /** Show (true) or hide (false) every type at once. */
  onSetAllFilters?: (active: boolean) => void;
  onRemoveCustomType?: (typeId: string) => void;
  onAddCustomType?: (type: ConnectionTypeDef) => void;
  /** Edges currently on the canvas, so counts reflect what is drawn. */
  networkEdges?: Edge[];
}

export default function ConnectionFilters({
  connectionTypes,
  activeFilters,
  onToggleFilter,
  onSetAllFilters,
  onRemoveCustomType,
  onAddCustomType,
  networkEdges = [],
}: ConnectionFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(CUSTOM_TYPE_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isOpen]);

  const close = () => {
    setIsOpen(false);
    setCreating(false);
    setNewLabel('');
    setError(null);
  };

  const activeCount = connectionTypes.filter((t) => activeFilters.has(t.id)).length;
  const totalCount = connectionTypes.length;
  const allOn = activeCount === totalCount;
  const noneOn = activeCount === 0;

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

  const countLabel = (id: string, isCustom?: boolean) => {
    const onCanvas = canvasByType.get(id) ?? 0;
    if (isCustom) return `${onCanvas} on canvas`;
    return `${onCanvas} of ${totalByType.get(id) ?? 0} on canvas`;
  };

  const submitNewType = () => {
    const trimmed = newLabel.trim();
    if (!trimmed) {
      setError('Give the link type a name');
      return;
    }
    if (connectionTypes.some((t) => t.label.toLowerCase() === trimmed.toLowerCase())) {
      setError('A link type with this name already exists');
      return;
    }
    onAddCustomType?.({
      id: makeCustomTypeId(trimmed),
      label: trimmed,
      color: newColor,
      isCustom: true,
    });
    setCreating(false);
    setNewLabel('');
    setError(null);
  };

  return (
    <div className="connection-filters" ref={dropdownRef}>
      <button
        type="button"
        className="tb-button filters-button"
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`Link types, ${activeCount} of ${totalCount} shown`}
      >
        <span className="filters-label">Link types</span>
        <span className="tb-button-muted">{activeCount} of {totalCount}</span>
        <ChevronDown size={16} className="tb-chevron" />
      </button>

      {isOpen && (
        <div className="filters-dropdown" role="group" aria-label="Show link types">
          <div className="filters-header">
            <span className="filters-heading">Show link types</span>
            {onSetAllFilters && (
              <span className="filters-bulk">
                <button
                  type="button"
                  className={`filters-bulk-btn ${allOn ? 'is-current' : ''}`}
                  onClick={() => onSetAllFilters(true)}
                  disabled={allOn}
                >
                  All
                </button>
                <span className="filters-bulk-sep" aria-hidden="true" />
                <button
                  type="button"
                  className={`filters-bulk-btn ${noneOn ? 'is-current' : ''}`}
                  onClick={() => onSetAllFilters(false)}
                  disabled={noneOn}
                >
                  None
                </button>
              </span>
            )}
          </div>

          <div className="filters-list">
            {connectionTypes.map(({ id, color, label, isCustom, directional }) => {
              const checked = activeFilters.has(id);
              const onCanvas = canvasByType.get(id) ?? 0;
              return (
                <label key={id} className="filter-item">
                  <input
                    type="checkbox"
                    className="filter-checkbox-input"
                    checked={checked}
                    onChange={() => onToggleFilter(id)}
                  />
                  <span className={`filter-checkbox ${checked ? 'is-checked' : ''}`} aria-hidden="true">
                    {checked && <Check size={11} strokeWidth={3} />}
                  </span>
                  <span className="filter-color" style={{ background: color }} aria-hidden="true" />
                  <span className="filter-text">
                    {label}
                    {directional && (
                      <ArrowRight size={13} className="filter-arrow" aria-label="directional" />
                    )}
                  </span>
                  <span className={`filter-count ${onCanvas === 0 ? 'is-empty' : ''}`}>
                    {countLabel(id, isCustom)}
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
                      <Trash2 size={13} />
                    </button>
                  )}
                </label>
              );
            })}
          </div>

          <div className="filters-footer">
            {onAddCustomType && !creating && (
              <button type="button" className="filters-new-type" onClick={() => setCreating(true)}>
                <Plus size={15} />
                New link type…
              </button>
            )}
            {onAddCustomType && creating && (
              <form
                className="filters-new-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitNewType();
                }}
              >
                <input
                  type="text"
                  className={`filters-new-input ${error ? 'has-error' : ''}`}
                  placeholder="Name, e.g. Symbolic"
                  value={newLabel}
                  maxLength={32}
                  autoFocus
                  onChange={(e) => {
                    setNewLabel(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      e.stopPropagation();
                      setCreating(false);
                    }
                  }}
                  aria-label="New link type name"
                />
                <div className="filters-new-colors" role="radiogroup" aria-label="Colour">
                  {CUSTOM_TYPE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={newColor === c}
                      className={`filters-new-swatch ${newColor === c ? 'is-selected' : ''}`}
                      style={{ background: c }}
                      onClick={() => setNewColor(c)}
                      aria-label={`Colour ${c}`}
                    />
                  ))}
                </div>
                {error && <div className="filters-new-error">{error}</div>}
                <div className="filters-new-actions">
                  <button type="button" className="filters-new-cancel" onClick={() => setCreating(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="filters-new-submit" disabled={!newLabel.trim()}>
                    Add type
                  </button>
                </div>
              </form>
            )}
            <div className="filters-hint">
              Drag from one verse's dot to another to create a link.
            </div>
            <div className="filters-hint filters-legend">
              <ArrowRight size={12} aria-hidden="true" />
              Arrow marks types where order matters: the link runs from the earlier or more basic verse.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
