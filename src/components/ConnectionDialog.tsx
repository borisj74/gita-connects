import { useState } from 'react';
import { X, Plus } from 'lucide-react';
import type { ConnectionTypeDef } from '../connectionTypes.js';
import { makeCustomTypeId } from '../connectionTypes.js';
import './ConnectionDialog.css';

interface ConnectionDialogProps {
  sourceVerseId: string;
  targetVerseId: string;
  connectionTypes: ConnectionTypeDef[];
  onCancel: () => void;
  onConfirm: (params: {
    typeId: string;
    description: string;
    strength: number;
    newType?: ConnectionTypeDef;
  }) => void;
}

const DEFAULT_COLOR_PALETTE = [
  '#ca7558', '#7d8a6e', '#8d7a66', '#c8a04a',
  '#5a7a96', '#9b6a8b', '#5e9b8e', '#b85c5c',
  '#6b8e23', '#4a6fa5', '#d49a6a', '#7a5c8a',
];

export default function ConnectionDialog({
  sourceVerseId,
  targetVerseId,
  connectionTypes,
  onCancel,
  onConfirm,
}: ConnectionDialogProps) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>(
    connectionTypes[0]?.id ?? 'thematic',
  );
  const [description, setDescription] = useState('');
  const [strength, setStrength] = useState(5);
  const [showCustomForm, setShowCustomForm] = useState(false);
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
          <p className="modal-description">
            Linking <strong>{sourceVerseId}</strong> &rarr;{' '}
            <strong>{targetVerseId}</strong>
          </p>

          {!showCustomForm ? (
            <>
              <label className="dialog-label">Connection type</label>
              <div className="type-grid">
                {connectionTypes.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`type-chip ${selectedTypeId === t.id ? 'selected' : ''}`}
                    onClick={() => setSelectedTypeId(t.id)}
                  >
                    <span
                      className="type-chip-color"
                      style={{ background: t.color }}
                    />
                    <span className="type-chip-label">{t.label}</span>
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

          <label className="dialog-label">Description (optional)</label>
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
