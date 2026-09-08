import { useEffect, useRef } from 'react';
import { TriangleAlert } from 'lucide-react';
import ScrimHint from './ScrimHint.js';
import './ClearCanvasDialog.css';

interface DeleteNetworkDialogProps {
  name: string;
  verseCount: number;
  linkCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Confirm for deleting a saved network. Same shell as the clear-canvas and
 * delete-link-type confirms: consequence in the title, Cancel focused first,
 * Esc closes and returns focus to the opener, Tab stays inside.
 */
export default function DeleteNetworkDialog({ name, verseCount, linkCount, onCancel, onConfirm }: DeleteNetworkDialogProps) {
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
        aria-labelledby="delete-network-title"
        aria-describedby="delete-network-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="clear-dialog-body">
          <div className="clear-dialog-icon" aria-hidden="true">
            <TriangleAlert size={19} />
          </div>
          <div className="clear-dialog-text">
            <h2 id="delete-network-title" className="clear-dialog-title">
              Delete “{name}”?
            </h2>
            <p id="delete-network-desc" className="clear-dialog-desc">
              This removes the saved network with its <strong>{plural(verseCount, 'verse')}</strong> and{' '}
              <strong>{plural(linkCount, 'link')}</strong>. Whatever is on your canvas stays. This cannot be undone.
            </p>
          </div>
        </div>
        <div className="clear-dialog-footer clear-dialog-footer-end">
          <div className="clear-dialog-actions">
            <button ref={cancelRef} type="button" className="clear-dialog-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="clear-dialog-confirm" onClick={onConfirm}>
              Delete
            </button>
          </div>
        </div>
        <p className="clear-dialog-keynote">
          <kbd>Esc</kbd>
          <span>closes and keeps the network. Tab cycles inside this dialog only.</span>
        </p>
      </div>
    </div>
  );
}
