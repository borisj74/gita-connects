import { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import './UndoToast.css';

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  /** Auto-dismiss window in ms. */
  duration?: number;
}

/**
 * Post-action toast with an undo window. The progress bar depletes over
 * `duration`; hovering or focusing the toast pauses the clock.
 */
export default function UndoToast({ message, onUndo, onDismiss, duration = 8000 }: UndoToastProps) {
  const [paused, setPaused] = useState(false);
  const [remaining, setRemaining] = useState(duration);
  const lastTick = useRef<number | null>(null);

  useEffect(() => {
    if (paused) {
      lastTick.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      if (lastTick.current !== null) {
        const elapsed = now - lastTick.current;
        setRemaining((r) => Math.max(0, r - elapsed));
      }
      lastTick.current = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused]);

  useEffect(() => {
    if (remaining <= 0) onDismiss();
  }, [remaining, onDismiss]);

  return (
    <div
      className="undo-toast"
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="undo-toast-row">
        <Trash2 size={18} className="undo-toast-icon" aria-hidden="true" />
        <span className="undo-toast-message">{message}</span>
        <button type="button" className="undo-toast-undo" onClick={onUndo}>
          Undo
        </button>
        <button type="button" className="undo-toast-close" onClick={onDismiss} aria-label="Dismiss">
          <X size={16} />
        </button>
      </div>
      <div className="undo-toast-track" aria-hidden="true">
        <div className="undo-toast-bar" style={{ width: `${(remaining / duration) * 100}%` }} />
      </div>
    </div>
  );
}
