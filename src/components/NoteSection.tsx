import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useNote, saveNote, editedLabel } from '../notes.js';

interface NoteSectionProps {
  verseId: string;
  /** Open straight into the editor (from the card's note button or `N`). */
  startEditing?: boolean;
  onSaved?: (verseId: string) => void;
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * "My note" in the verse panel (App 30/31 + Note flow). Three looks: a dashed
 * "Add a note" pill when empty, a sage-bordered editor, and the saved note
 * with an edit link. Saving an empty note removes it.
 */
export default function NoteSection({ verseId, startEditing = false, onSaved }: NoteSectionProps) {
  const note = useNote(verseId);
  const [editing, setEditing] = useState(startEditing);
  const [draft, setDraft] = useState(note?.text ?? '');
  const [open, setOpen] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow with the text; no scrollbars inside the panel's scroll.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = '0px';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft, editing]);

  useEffect(() => {
    if (editing) textareaRef.current?.focus();
  }, [editing]);

  const beginEdit = () => {
    setDraft(note?.text ?? '');
    setEditing(true);
  };
  const cancel = () => {
    setEditing(false);
    setDraft(note?.text ?? '');
  };
  const dirty = draft.trim() !== (note?.text ?? '');
  const save = () => {
    if (!dirty) return;
    saveNote(verseId, draft);
    setEditing(false);
    onSaved?.(verseId);
  };

  if (editing) {
    return (
      <section className="vd-section vd-note">
        <div className="vd-label vd-note-label">My note</div>
        <div className="vd-note-editor">
          <textarea
            ref={textareaRef}
            className="vd-note-textarea"
            value={draft}
            placeholder="What does this verse mean to you?"
            aria-label={`Note on verse ${verseId}`}
            rows={1}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Keep these from the app: Esc would close the panel, arrows page verses.
              e.stopPropagation();
              if (e.key === 'Escape') {
                e.preventDefault();
                cancel();
              } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                save();
              }
            }}
          />
          <div className="vd-note-footer">
            <span className="vd-note-hint">
              {draft.trim() ? `${isMac ? '⌘' : 'Ctrl'}↵ to save · Esc to discard` : 'Saved to this device'}
            </span>
            <span className="vd-note-actions">
              <button type="button" className="vd-note-cancel" onClick={cancel}>Cancel</button>
              <button type="button" className="vd-note-save" onClick={save} disabled={!dirty}>Save</button>
            </span>
          </div>
        </div>
      </section>
    );
  }

  if (!note) {
    return (
      <section className="vd-section vd-note vd-note-empty">
        <span className="vd-label muted vd-note-label">My note</span>
        <button type="button" className="vd-note-add" onClick={beginEdit}>
          <Plus size={12} strokeWidth={2.4} />
          Add a note
        </button>
      </section>
    );
  }

  return (
    <section className={`vd-section vd-disclosure vd-note ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="vd-disclosure-header vd-note-header"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="vd-note-body"
      >
        {open ? <ChevronDown size={13} strokeWidth={2.6} /> : <ChevronRight size={13} strokeWidth={2.6} />}
        <span className="vd-label vd-note-label">My note</span>
        <span className="vd-note-edited">Edited {editedLabel(note.updatedAt)}</span>
      </button>
      {open && (
        <div id="vd-note-body" className="vd-note-card">
          <p className="vd-note-text">{note.text}</p>
          <div className="vd-note-meta">
            <button type="button" className="vd-note-edit" onClick={beginEdit}>Edit</button>
            <span className="vd-note-sep" aria-hidden="true" />
            <span>Saved to this device</span>
          </div>
        </div>
      )}
    </section>
  );
}
