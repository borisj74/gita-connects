import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import ScrimHint from './ScrimHint.js';
import './ShortcutsOverlay.css';

interface ShortcutsOverlayProps {
  onClose: () => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? '⌘' : 'Ctrl';

interface Row {
  label: string;
  keys: string[][];
}

const FINDING: Row[] = [
  { label: 'Jump to search', keys: [[`${mod}K`], ['/']] },
  { label: 'Browse chapters', keys: [['B']] },
  { label: 'Previous / next verse', keys: [['↑'], ['↓']] },
  { label: 'Add or edit your note', keys: [['N']] },
  { label: 'Close panel or dialog', keys: [['Esc']] },
];

const CANVAS: Row[] = [
  { label: 'Undo', keys: [[`${mod}Z`]] },
  { label: 'Redo', keys: [[`${mod}⇧Z`]] },
  { label: 'Save network', keys: [[`${mod}S`]] },
  { label: 'Fit all verses in view', keys: [[`${mod}0`]] },
  { label: 'Open the focused verse', keys: [['⏎']] },
  { label: 'Move focus along links', keys: [['←'], ['→']] },
  { label: 'Remove focused verse or link', keys: [['Del']] },
  { label: 'Show this list', keys: [['?']] },
];

function Keys({ keys }: { keys: string[][] }) {
  return (
    <span className="sc-keys">
      {keys.map((combo, i) => (
        <kbd key={i} className="sc-key">{combo.join('')}</kbd>
      ))}
    </span>
  );
}

/** Keyboard shortcuts reference (App 20). Opened from `?` or the ⋯ menu. */
export default function ShortcutsOverlay({ onClose }: ShortcutsOverlayProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab') {
        // Only one focusable control; keep focus on it.
        e.preventDefault();
        closeRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="modal-overlay sc-overlay" onClick={onClose}>
      <ScrimHint label="Click anywhere to close" />
      <div
        className="sc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sc-header">
          <h2 id="sc-title" className="sc-title">Keyboard shortcuts</h2>
          <button ref={closeRef} type="button" className="sc-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="sc-columns">
          <section className="sc-column">
            <h3 className="sc-heading">Finding verses</h3>
            {FINDING.map((row) => (
              <div key={row.label} className="sc-row">
                <span className="sc-label">{row.label}</span>
                <Keys keys={row.keys} />
              </div>
            ))}
          </section>
          <section className="sc-column">
            <h3 className="sc-heading">Working on the canvas</h3>
            {CANVAS.map((row) => (
              <div key={row.label} className="sc-row">
                <span className="sc-label">{row.label}</span>
                <Keys keys={row.keys} />
              </div>
            ))}
          </section>
        </div>
        <div className="sc-footer">
          <strong>Connect two verses:</strong> drag from the dot under one card to the dot above another.
        </div>
      </div>
    </div>
  );
}
