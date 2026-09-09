import { useEffect, useRef, useState } from 'react';
import { X, Image, FileText } from 'lucide-react';
import ScrimHint from './ScrimHint.js';
import './ExportDialog.css';

export type ExportFormat = 'png' | 'pdf';

interface ExportDialogProps {
  verseCount: number;
  linkCount: number;
  noteCount: number;
  onCancel: () => void;
  /** Resolves when the file has been handed to the browser; rejects on failure. */
  onExport: (format: ExportFormat, includeNotes: boolean) => Promise<void>;
}

/**
 * Export the canvas. PNG is the picture; PDF is the picture plus a readable
 * list of the verses and links, optionally with the reader's notes.
 */
export default function ExportDialog({ verseCount, linkCount, noteCount, onCancel, onExport }: ExportDialogProps) {
  const [format, setFormat] = useState<ExportFormat>('png');
  const [includeNotes, setIncludeNotes] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
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

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      await onExport(format, format === 'pdf' && includeNotes);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not export right now.');
      setBusy(false);
    }
  };

  const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

  return (
    <div className="modal-overlay saved-dialog-overlay" onClick={busy ? undefined : onCancel}>
      <ScrimHint />
      <div
        ref={dialogRef}
        className="saved-dialog export-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="saved-dialog-header">
          <div>
            <h2 id="export-title" className="saved-dialog-title">Export</h2>
            <p className="saved-dialog-subtitle">
              {plural(verseCount, 'verse')} · {plural(linkCount, 'link')} on the canvas
            </p>
          </div>
          <button type="button" className="saved-dialog-close" onClick={onCancel} aria-label="Close" disabled={busy}>
            <X size={20} />
          </button>
        </div>

        <div className="export-options" role="radiogroup" aria-label="Format">
          <label className={`export-option ${format === 'png' ? 'is-selected' : ''}`}>
            <input
              ref={firstRef}
              type="radio"
              name="export-format"
              value="png"
              checked={format === 'png'}
              onChange={() => setFormat('png')}
              disabled={busy}
            />
            <Image size={18} />
            <span className="export-option-text">
              <span className="export-option-title">PNG image</span>
              <span className="export-option-desc">The canvas as a picture, at 2× for sharp text.</span>
            </span>
          </label>
          <label className={`export-option ${format === 'pdf' ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name="export-format"
              value="pdf"
              checked={format === 'pdf'}
              onChange={() => setFormat('pdf')}
              disabled={busy}
            />
            <FileText size={18} />
            <span className="export-option-text">
              <span className="export-option-title">PDF document</span>
              <span className="export-option-desc">The picture, then every verse and link as text.</span>
            </span>
          </label>
          <label className={`export-check ${format !== 'pdf' ? 'is-disabled' : ''}`}>
            <input
              type="checkbox"
              checked={includeNotes}
              onChange={(e) => setIncludeNotes(e.target.checked)}
              disabled={busy || format !== 'pdf'}
            />
            Include my notes
            <span className="export-check-hint">
              {noteCount === 0 ? 'none on these verses' : plural(noteCount, 'note')}
            </span>
          </label>
        </div>

        {error && <p className="export-error" role="alert">{error}</p>}

        <div className="saved-dialog-footer">
          <p className="saved-dialog-note">
            Verse text stays out of the file. Only themes, summaries, concepts and your notes go in.
          </p>
          <div className="saved-footer-actions">
            <button type="button" className="saved-btn-secondary" onClick={onCancel} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="saved-btn-primary" onClick={run} disabled={busy || verseCount === 0}>
              {busy ? 'Preparing…' : format === 'png' ? 'Export PNG' : 'Export PDF'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
