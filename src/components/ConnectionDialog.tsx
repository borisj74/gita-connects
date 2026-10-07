import { useState } from 'react';
import { X, Plus, ChevronDown, CircleHelp, ArrowLeftRight } from 'lucide-react';
import type { ConnectionTypeDef } from '../connectionTypes.js';
import { makeCustomTypeId, CUSTOM_TYPE_COLORS } from '../connectionTypes.js';
import { CONNECTION_GUIDE } from '../connectionGuide.js';
import './ConnectionDialog.css';

interface ConnectionDialogProps {
  sourceVerseId: string;
  targetVerseId: string;
  connectionTypes: ConnectionTypeDef[];
  /** Types that already link these two verses; offered but not pickable. */
  linkedTypeIds?: string[];
  onCancel: () => void;
  /** Reverse the link, so it runs from the second verse to the first. */
  onSwap?: () => void;
  onConfirm: (params: {
    typeId: string;
    description: string;
    strength: number;
    newType?: ConnectionTypeDef;
  }) => void;
  /** Open the guide to all the kinds of connection. */
  onShowGuide?: () => void;
}

const DEFAULT_COLOR_PALETTE = CUSTOM_TYPE_COLORS;

export default function ConnectionDialog({
  sourceVerseId,
  targetVerseId,
  connectionTypes,
  linkedTypeIds = [],
  onCancel,
  onSwap,
  onConfirm,
  onShowGuide,
}: ConnectionDialogProps) {
  const isLinked = (id: string) => linkedTypeIds.includes(id);
  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    () => connectionTypes.find((t) => !isLinked(t.id))?.id ?? '',
  );
  const [description, setDescription] = useState('');
  const [strength, setStrength] = useState(5);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customColor, setCustomColor] = useState(DEFAULT_COLOR_PALETTE[0]);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    setError(null);

    if (showCustomForm) {
      const trimmed = customLabel.trim();
      if (!trimmed) {
        setError('Please enter a name for the new connection type');
        return;
      }
      if (
        connectionTypes.some(
          (t) => t.label.toLowerCase() === trimmed.toLowerCase(),
        )
      ) {
        setError('A connection type with this name already exists');
        return;
      }
      const newType: ConnectionTypeDef = {
        id: makeCustomTypeId(trimmed),
        label: trimmed,
        color: customColor,
        isCustom: true,
      };
      onConfirm({
        typeId: newType.id,
        description: description.trim() || `${newType.label} connection`,
        strength,
        newType,
      });
      return;
    }

    if (!selectedTypeId || isLinked(selectedTypeId)) {
      setError('These verses are already linked by every type. Add a custom type instead.');
      return;
    }
    onConfirm({
      typeId: selectedTypeId,
      description: description.trim() || 'User-created connection',
      strength,
    });
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className="modal-content connection-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>New Connection</h3>
          <button className="modal-close" onClick={onCancel} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <p className="modal-description cd-direction">
            <span>
              Linking <strong>{sourceVerseId}</strong> &rarr;{' '}
              <strong>{targetVerseId}</strong>
            </span>
            {onSwap && (
              <button
                type="button"
                className="cd-swap"
                onClick={onSwap}
                title="Swap direction"
                aria-label={`Swap direction: link ${targetVerseId} to ${sourceVerseId} instead`}
              >
                <ArrowLeftRight size={14} />
                Swap
              </button>
            )}
          </p>

          {!showCustomForm ? (
            <>
              <label className="dialog-label">Connection type</label>
              <div className="type-grid">
                {connectionTypes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`type-chip ${selectedTypeId === t.id ? 'selected' : ''} ${isLinked(t.id) ? 'is-linked' : ''}`}
                    onClick={() => setSelectedTypeId(t.id)}
                    disabled={isLinked(t.id)}
                    title={isLinked(t.id) ? `Already linked as ${t.label}` : undefined}
                  >
                    <span
                      className="type-chip-color"
                      style={{ background: t.color }}
                    />
                    <span className="type-chip-label">{t.label}</span>
                    {isLinked(t.id) && <span className="type-chip-linked">linked</span>}
                  </button>
                ))}
                <button
                  type="button"
                  className="type-chip type-chip-add"
                  onClick={() => setShowCustomForm(true)}
                >
                  <Plus size={14} />
                  <span className="type-chip-label">Custom</span>
                </button>
              </div>
              <TypeMeaning
                type={connectionTypes.find((t) => t.id === selectedTypeId)}
                onShowGuide={onShowGuide}
              />
            </>
          ) : (
            <>
              <label className="dialog-label">New type name</label>
              <input
                type="text"
                className="dialog-input"
                placeholder="e.g., Symbolic, Historical"
                value={customLabel}
                onChange={(e) => {
                  setCustomLabel(e.target.value);
                  setError(null);
                }}
                maxLength={32}
                autoFocus
              />
              <label className="dialog-label">Color</label>
              <div className="color-palette">
                {DEFAULT_COLOR_PALETTE.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`color-swatch ${customColor === c ? 'selected' : ''}`}
                    style={{ background: c }}
                    onClick={() => setCustomColor(c)}
                    aria-label={`Choose color ${c}`}
                  />
                ))}
              </div>
              <button
                type="button"
                className="dialog-link-button"
                onClick={() => setShowCustomForm(false)}
              >
                &larr; Use an existing type
              </button>
            </>
          )}

          <button
            type="button"
            className="dialog-details-toggle"
            onClick={() => setShowDetails((v) => !v)}
          >
            <ChevronDown size={14} className={`chevron ${showDetails ? 'open' : ''}`} />
            {showDetails ? 'Hide details' : 'Add details (optional)'}
          </button>

          {showDetails && (
            <>
              <label className="dialog-label">Description</label>
              <input
                type="text"
                className="dialog-input"
                placeholder="What does this connection represent?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={140}
              />

              <label className="dialog-label">
                Strength: <strong>{strength}</strong>/10
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={strength}
                onChange={(e) => setStrength(Number(e.target.value))}
                className="dialog-range"
              />
            </>
          )}

          {error && <div className="dialog-error">{error}</div>}
        </div>

        <div className="modal-footer">
          <button className="modal-button cancel-button" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="modal-button save-modal-button"
            onClick={handleConfirm}
          >
            Create Connection
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * What the chosen kind means, right where the reader picks it, so the choice
 * is an informed one. Custom kinds show the reader's own description.
 */
function TypeMeaning({ type, onShowGuide }: { type?: ConnectionTypeDef; onShowGuide?: () => void }) {
  if (!type) return null;
  const guide = CONNECTION_GUIDE[type.id];
  const meaning = guide?.meaning ?? type.description;
  return (
    <div className="type-meaning" aria-live="polite" style={{ '--kind': type.color } as React.CSSProperties}>
      <p className="type-meaning-head">
        <strong>{type.label}</strong>
        <span>{type.directional ? 'one-way →' : 'two-way ↔'}</span>
      </p>
      {meaning && <p className="type-meaning-text">{meaning}</p>}
      {guide && <p className="type-meaning-ask">Ask yourself: {guide.ask}</p>}
      {onShowGuide && (
        <button type="button" className="type-meaning-link" onClick={onShowGuide}>
          <CircleHelp size={13} aria-hidden="true" />
          See all the kinds of connection
        </button>
      )}
    </div>
  );
}
