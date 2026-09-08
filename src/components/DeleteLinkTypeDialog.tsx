import { useEffect, useRef } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { Edge } from 'reactflow';
import type { ConnectionTypeDef } from '../connectionTypes.js';
import ScrimHint from './ScrimHint.js';
import './ClearCanvasDialog.css';

interface DeleteLinkTypeDialogProps {
  type: ConnectionTypeDef;
  /** Canvas edges that use this type and will go with it. */
  affected: Edge[];
  onCancel: () => void;
  onConfirm: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * Confirm for removing a custom link type (App 17). Names the type and the
 * blast radius, previews the first affected links in the type's own colour.
 */
export default function DeleteLinkTypeDialog({ type, affected, onCancel, onConfirm }: DeleteLinkTypeDialogProps) {
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

  const preview = affected.slice(0, 2);
  const more = affected.length - preview.length;

  return (
    <div className="modal-overlay clear-dialog-overlay" onClick={onCancel}>
      <ScrimHint />
      <div
        ref={dialogRef}
        className="clear-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-type-title"
        aria-describedby="delete-type-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="clear-dialog-body">
          <div className="clear-dialog-icon" aria-hidden="true">
            <TriangleAlert size={19} />
          </div>
          <div className="clear-dialog-text">
            <h2 id="delete-type-title" className="clear-dialog-title">
              Delete the “{type.label}” link type?
            </h2>
            <p id="delete-type-desc" className="clear-dialog-desc">
              {affected.length > 0 ? (
                <>
                  This also deletes the <strong>{plural(affected.length, 'connection')}</strong> on your canvas
                  that use it. You can undo this right after.
                </>
              ) : (
                <>Nothing on your canvas uses it yet, so only the type is removed.</>
              )}
            </p>
          </div>
        </div>

        {affected.length > 0 && (
          <div className="clear-dialog-list">
            {preview.map((edge) => (
              <div key={edge.id} className="clear-dialog-list-row">
                <span className="clear-dialog-list-swatch" style={{ background: type.color }} aria-hidden="true" />
                <span>
                  {edge.source} → {edge.target}
                </span>
              </div>
            ))}
            {more > 0 && <div className="clear-dialog-list-more">and {more} more</div>}
          </div>
        )}

        <div className="clear-dialog-footer clear-dialog-footer-end">
          <div className="clear-dialog-actions">
            <button ref={cancelRef} type="button" className="clear-dialog-cancel" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className="clear-dialog-confirm" onClick={onConfirm}>
              {affected.length > 0 ? 'Delete type and links' : 'Delete type'}
            </button>
          </div>
        </div>
        <p className="clear-dialog-keynote">
          <kbd>Esc</kbd>
          <span>closes and returns focus to Link types. Tab cycles inside this dialog only.</span>
        </p>
      </div>
    </div>
  );
}
