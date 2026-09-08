import { useEffect, useRef } from 'react';
import { TriangleAlert, Save } from 'lucide-react';
import ScrimHint from './ScrimHint.js';
import './ClearCanvasDialog.css';

interface ClearCanvasDialogProps {
  verseCount: number;
  linkCount: number;
  onCancel: () => void;
  onConfirm: () => void;
  onSaveFirst: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Confirm step for "Clear canvas…". Titled with the consequence, counts from
 * live state, Cancel is the default focus, and "Save it first" is reachable
 * without cancelling. Esc closes and focus returns to the opener.
 */
export default function ClearCanvasDialog({
  verseCount,
  linkCount,
  onCancel,
  onConfirm,
  onSaveFirst,
}: ClearCanvasDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
        return;
      }
      // Trap Tab inside the dialog.
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)');
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // Capture phase so the app-level Escape handler doesn't also fire.
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      opener?.focus?.();
    };
  }, [onCancel]);

  return (
    <div className="modal-overlay clear-dialog-overlay" onClick={onCancel}>
      <ScrimHint />
      <div
        ref={dialogRef}
        className="clear-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="clear-dialog-title"
        aria-describedby="clear-dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="clear-dialog-body">
          <div className="clear-dialog-icon" aria-hidden="true">
            <TriangleAlert size={19} />
          </div>
          <div className="clear-dialog-text">
            <h2 id="clear-dialog-title" className="clear-dialog-title">Clear the canvas?</h2>
            <p id="clear-dialog-desc" className="clear-dialog-desc">
              This removes <strong>{plural(verseCount, 'verse')}</strong> and{' '}
              <strong>{plural(linkCount, 'link')}</strong> from the canvas. Your saved networks are
              not affected, and you can undo this.
            </p>
          </div>
        </div>
        <div className="clear-dialog-footer">
          <button type="button" className="clear-dialog-save" onClick={onSaveFirst}>
            <Save size={15} />
            Save it first
          </button>
          <div className="clear-dialog-actions">
            <button ref={cancelRef} type="button" className="clear-dialog-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="clear-dialog-confirm" onClick={onConfirm}>
              Clear canvas
            </button>
          </div>
        </div>
        <p className="clear-dialog-keynote">
          <kbd>Esc</kbd>
          <span>closes and returns focus to Clear canvas. Tab cycles inside this dialog only.</span>
        </p>
      </div>
    </div>
  );
}
