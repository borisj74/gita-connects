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

// Answers "what happens when I connect two verses?" in the reader's terms.
const CONNECTION_FACTS = [
  'A line joins the two verses, labelled with the type you picked. One-way types, like Sequential or Goal, carry an arrow toward the verse they lead to.',
  'Click the label to read the connection\'s note and strength, or to remove it.',
  'Select a verse to spotlight what it links to: its connected verses stay lit, and its lines come alive.',
  'Link types in the toolbar counts connections by type and lets you hide any type.',
  `Your connections save with the canvas as you go, and ${mod}Z undoes one. They are yours: the app's own scholarly connections stay as they are.`,
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
          <p className="sc-footer-lead">
            <strong>Connect two verses:</strong> drag from the dot under one card onto another card,
            then pick how they relate.
          </p>
          <h3 className="sc-heading sc-footer-heading">What a connection does</h3>
          <ul className="sc-facts">
            {CONNECTION_FACTS.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
