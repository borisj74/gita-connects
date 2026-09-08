import { useEffect, useRef } from 'react';
import { Waypoints } from 'lucide-react';
import { autosavedAgo, type Autosave } from '../autosave.js';
import './RestoreSessionCard.css';

interface RestoreSessionCardProps {
  autosave: Autosave;
  onRestore: () => void;
  onStartFresh: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Shown in place of the empty state when an autosave is waiting (App 16). */
export default function RestoreSessionCard({ autosave, onRestore, onStartFresh }: RestoreSessionCardProps) {
  const restoreRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    restoreRef.current?.focus();
  }, []);

  const ids = autosave.nodes.map((n) => n.id);
  const shown = ids.slice(0, 3).join(', ');
  const rest = ids.length - 3;
  const summary = rest > 0 ? `${shown} and ${plural(rest, 'more').replace(' mores', ' more')}` : shown;

  return (
    <div className="restore-card" role="region" aria-labelledby="restore-title">
      <h2 id="restore-title" className="restore-title">Pick up where you left off</h2>
      <p className="restore-body">Your last session was saved automatically on this device.</p>

      <div className="restore-summary">
        <div className="restore-summary-icon" aria-hidden="true">
          <Waypoints size={19} />
        </div>
        <div className="restore-summary-text">
          <div className="restore-summary-counts">
            {plural(autosave.nodes.length, 'verse')} · {plural(autosave.edges.length, 'link')}
          </div>
          <div className="restore-summary-meta">
            {autosavedAgo(autosave.savedAt)} · {summary}
          </div>
        </div>
      </div>

      <div className="restore-actions">
        <span className="restore-note">Autosave kept for 7 days</span>
        <button ref={restoreRef} type="button" className="restore-primary" onClick={onRestore}>
          Restore session
        </button>
        <button type="button" className="restore-secondary" onClick={onStartFresh}>
          Start fresh
        </button>
      </div>
    </div>
  );
}
