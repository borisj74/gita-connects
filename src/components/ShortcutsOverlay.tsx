import { useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import ScrimHint from './ScrimHint.js';
import { PREDEFINED_CONNECTION_TYPES } from '../connectionTypes.js';
import { CONNECTION_GUIDE, TELLING_APART } from '../connectionGuide.js';
import { connections, getVerse } from '../data/index.js';
import './ShortcutsOverlay.css';

export type HelpTab = 'shortcuts' | 'kinds';

interface ShortcutsOverlayProps {
  onClose: () => void;
  /** Which tab opens first; the "What do these mean?" links open on kinds. */
  initialTab?: HelpTab;
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
  { label: 'Show or hide network insights', keys: [['I']] },
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

/** One verse in a guide example: its number and, when it has one, its theme. */
function VerseRef({ id }: { id: string }) {
  const theme = getVerse(id)?.theme;
  return (
    <span className="kg-verse">
      <span className="kg-verse-id">{id}</span>
      {theme && <span className="kg-verse-theme">{theme}</span>}
    </span>
  );
}

/** "Kinds of connection": what each of the ten kinds means, with a real example. */
function KindsGuide() {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of connections) m.set(c.type, (m.get(c.type) ?? 0) + 1);
    return m;
  }, []);
  return (
    <div className="kg">
      <p className="kg-lead">
        Every connection says <em>how</em> two verses relate. One-way kinds carry an arrow toward the verse
        they lead to; two-way kinds have none. Strength, from 1 to 10, says how close the link is.
      </p>
      <ul className="kg-list">
        {PREDEFINED_CONNECTION_TYPES.map((t) => {
          const g = CONNECTION_GUIDE[t.id];
          if (!g) return null;
          return (
            <li key={t.id} className="kg-item" style={{ '--kind': t.color } as React.CSSProperties}>
              <div className="kg-head">
                <span className="kg-swatch" aria-hidden="true" />
                <h4 className="kg-name">{t.label}</h4>
                <span className="kg-dir">{t.directional ? 'one-way →' : 'two-way ↔'}</span>
                <span className="kg-count">{counts.get(t.id) ?? 0} in the app</span>
              </div>
              <p className="kg-meaning">{g.meaning}</p>
              <p className="kg-ask">Ask yourself: {g.ask}</p>
              <p className="kg-example">
                <span className="kg-example-pair">
                  <VerseRef id={g.example.from} />
                  <span className="kg-arrow" aria-label={t.directional ? 'leads to' : 'and'}>
                    {t.directional ? '→' : '↔'}
                  </span>
                  <VerseRef id={g.example.to} />
                </span>
                <span className="kg-why">{g.example.why}</span>
              </p>
            </li>
          );
        })}
      </ul>
      <h3 className="sc-heading">Telling them apart</h3>
      <dl className="kg-apart">
        {TELLING_APART.map(({ pair, answer }) => (
          <div key={pair}>
            <dt>{pair}</dt>
            <dd>{answer}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * The help panel, opened from `?`, the ⋯ menu, or a "What do these mean?"
 * link: keyboard shortcuts, and a guide to the kinds of connection.
 */
export default function ShortcutsOverlay({ onClose, initialTab = 'shortcuts' }: ShortcutsOverlayProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<HelpTab>(initialTab);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === '?') {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      } else if (e.key === 'Tab' && dialogRef.current) {
        // Keep focus inside the panel.
        const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button, [tabindex="0"]')];
        if (focusable.length === 0) return;
        const i = focusable.indexOf(document.activeElement as HTMLElement);
        const next = e.shiftKey ? (i <= 0 ? focusable.length - 1 : i - 1) : (i + 1) % focusable.length;
        e.preventDefault();
        focusable[next].focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      opener?.focus?.();
    };
  }, [onClose]);

  const title = tab === 'kinds' ? 'Kinds of connection' : 'Keyboard shortcuts';

  return (
    <div className="modal-overlay sc-overlay" onClick={onClose}>
      <ScrimHint label="Click anywhere to close" />
      <div
        ref={dialogRef}
        className="sc-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sc-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sc-header">
          <h2 id="sc-title" className="sc-title">{title}</h2>
          <button ref={closeRef} type="button" className="sc-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <div className="sc-tabs" role="tablist" aria-label="Help">
          <button
            type="button"
            role="tab"
            id="sc-tab-shortcuts"
            aria-selected={tab === 'shortcuts'}
            aria-controls="sc-panel"
            className="sc-tab"
            onClick={() => setTab('shortcuts')}
          >
            Keyboard shortcuts
          </button>
          <button
            type="button"
            role="tab"
            id="sc-tab-kinds"
            aria-selected={tab === 'kinds'}
            aria-controls="sc-panel"
            className="sc-tab"
            onClick={() => setTab('kinds')}
          >
            Kinds of connection
          </button>
        </div>
        <div
          id="sc-panel"
          className="sc-scroll"
          role="tabpanel"
          aria-labelledby={tab === 'kinds' ? 'sc-tab-kinds' : 'sc-tab-shortcuts'}
          tabIndex={0}
        >
          {tab === 'kinds' ? (
            <KindsGuide />
          ) : (
            <>
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
                <button type="button" className="sc-link" onClick={() => setTab('kinds')}>
                  What each kind of connection means →
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
