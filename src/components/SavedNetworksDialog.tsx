import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Pencil, Copy, Trash2, Download, Upload, ChevronDown, Check } from 'lucide-react';
import type { Node, Edge } from 'reactflow';
import ScrimHint from './ScrimHint.js';
import './SavedNetworksDialog.css';

export interface SavedNetwork {
  id: string;
  name: string;
  timestamp: number;
  nodes: Node[];
  edges: Edge[];
  selectedVerseId: string | null;
}

type SortKey = 'recent' | 'name' | 'size';

interface SavedNetworksDialogProps {
  networks: SavedNetwork[];
  /** Id of the network currently on the canvas, if it was saved or loaded. */
  currentId: string | null;
  /** Canvas contents at the moment the dialog opened. */
  canvas: { nodes: Node[]; edges: Edge[] };
  onOpen: (network: SavedNetwork) => void;
  onSaveChanges: () => void;
  onSaveAsNew: () => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onImport: (networks: SavedNetwork[]) => void;
  onClose: () => void;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

function savedAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'saved just now';
  if (min < 60) return `saved ${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return hr === 1 ? 'saved 1 hour ago' : `saved ${hr} hours ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return 'saved yesterday';
  if (day < 7) return `saved ${day} days ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return wk === 1 ? 'saved last week' : `saved ${wk} weeks ago`;
  return `saved ${new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

/** Describe how the canvas differs from a saved network, or null if it doesn't. */
function describeChanges(saved: SavedNetwork, canvas: { nodes: Node[]; edges: Edge[] }): string | null {
  const savedNodes = new Set(saved.nodes.map((n) => n.id));
  const savedEdges = new Set(saved.edges.map((e) => e.id));
  const canvasNodes = new Set(canvas.nodes.map((n) => n.id));
  const canvasEdges = new Set(canvas.edges.map((e) => e.id));

  const addedV = [...canvasNodes].filter((id) => !savedNodes.has(id)).length;
  const removedV = [...savedNodes].filter((id) => !canvasNodes.has(id)).length;
  const addedL = [...canvasEdges].filter((id) => !savedEdges.has(id)).length;
  const removedL = [...savedEdges].filter((id) => !canvasEdges.has(id)).length;

  if (!addedV && !removedV && !addedL && !removedL) return null;

  const parts: string[] = [];
  if (addedV || addedL) {
    const what = [addedV && plural(addedV, 'verse'), addedL && plural(addedL, 'link')].filter(Boolean);
    parts.push(`${what.join(' and ')} added`);
  }
  if (removedV || removedL) {
    const what = [removedV && plural(removedV, 'verse'), removedL && plural(removedL, 'link')].filter(Boolean);
    parts.push(`${what.join(' and ')} removed`);
  }
  return `${parts.join(', ')} since last save`;
}

function isSavedNetwork(v: unknown): v is SavedNetwork {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.name === 'string' && Array.isArray(o.nodes) && Array.isArray(o.edges);
}

export default function SavedNetworksDialog({
  networks,
  currentId,
  canvas,
  onOpen,
  onSaveChanges,
  onSaveAsNew,
  onRename,
  onDuplicate,
  onDelete,
  onImport,
  onClose,
}: SavedNetworksDialogProps) {
  const [sort, setSort] = useState<SortKey>('recent');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Keep the latest rename state readable from the keydown handler without
  // re-running the mount effect (which would steal focus from the input).
  const renamingRef = useRef(renamingId);
  renamingRef.current = renamingId;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        // Let an in-progress rename cancel first.
        if (renamingRef.current) {
          setRenamingId(null);
          return;
        }
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not([hidden]), select, [tabindex]:not([tabindex="-1"])',
      );
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
  }, [onClose]);

  const current = currentId ? networks.find((n) => n.id === currentId) : undefined;
  const changes = current ? describeChanges(current, canvas) : null;
  const canvasHasContent = canvas.nodes.length > 0;

  const sorted = useMemo(() => {
    const list = [...networks];
    switch (sort) {
      case 'name':
        return list.sort((a, b) => a.name.localeCompare(b.name));
      case 'size':
        return list.sort((a, b) => b.nodes.length - a.nodes.length || b.timestamp - a.timestamp);
      default:
        return list.sort((a, b) => b.timestamp - a.timestamp);
    }
  }, [networks, sort]);

  const startRename = (network: SavedNetwork) => {
    setRenamingId(network.id);
    setDraftName(network.name);
  };

  const commitRename = () => {
    if (!renamingId) return;
    const trimmed = draftName.trim();
    if (trimmed) onRename(renamingId, trimmed);
    setRenamingId(null);
  };

  const exportAll = () => {
    const blob = new Blob([JSON.stringify(networks, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gita-connects-networks-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file: File) => {
    setImportError(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : [parsed];
      const valid = list.filter(isSavedNetwork);
      if (valid.length === 0) throw new Error('No networks in that file');
      onImport(valid);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Could not read that file');
    }
  };

  return (
    <div className="modal-overlay saved-dialog-overlay" onClick={onClose}>
      <ScrimHint label="Click anywhere to close" />
      <div
        ref={dialogRef}
        className="saved-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="saved-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="saved-dialog-header">
          <div>
            <h2 id="saved-dialog-title" className="saved-dialog-title">Saved networks</h2>
            <p className="saved-dialog-subtitle">
              Open one to load it onto the canvas · {networks.length} saved
            </p>
          </div>
          <button ref={closeRef} type="button" className="saved-dialog-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {canvasHasContent && (
          <div className="saved-current">
            <div className="saved-current-text">
              <div className="saved-current-name">
                {current ? current.name : 'Unsaved canvas'}
                {(!current || changes) && (
                  <>
                    <span className="saved-current-dot" aria-hidden="true" />
                    <span className="saved-current-status">{current ? 'Unsaved changes' : 'Not saved yet'}</span>
                  </>
                )}
                {current && !changes && (
                  <span className="saved-current-clean">
                    <Check size={12} /> Saved
                  </span>
                )}
              </div>
              <div className="saved-current-meta">
                Open now ·{' '}
                {current
                  ? changes ?? 'no changes since last save'
                  : `${plural(canvas.nodes.length, 'verse')} and ${plural(canvas.edges.length, 'link')} on the canvas`}
              </div>
            </div>
            <button type="button" className="saved-btn-secondary" onClick={onSaveAsNew}>
              Save as new
            </button>
            {current && (
              <button type="button" className="saved-btn-primary" onClick={onSaveChanges} disabled={!changes}>
                Save changes
              </button>
            )}
          </div>
        )}

        <div className="saved-list-toolbar">
          <span className="saved-list-heading">All networks</span>
          <label className="saved-sort">
            <span className="saved-sort-label">
              {sort === 'recent' ? 'Recently edited' : sort === 'name' ? 'Name' : 'Most verses'}
            </span>
            <ChevronDown size={14} aria-hidden="true" />
            <select
              className="saved-sort-select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              aria-label="Sort networks"
            >
              <option value="recent">Recently edited</option>
              <option value="name">Name</option>
              <option value="size">Most verses</option>
            </select>
          </label>
        </div>

        <div className="saved-list">
          {sorted.length === 0 ? (
            <div className="saved-empty">
              <p>No saved networks yet</p>
              <p className="saved-empty-hint">Build a network on the canvas, then save it here to come back to it later.</p>
            </div>
          ) : (
            sorted.map((network) => {
              const isCurrent = network.id === currentId;
              const isRenaming = network.id === renamingId;
              return (
                <div key={network.id} className={`saved-row ${isCurrent ? 'is-current' : ''}`}>
                  {isRenaming ? (
                    <form
                      className="saved-row-rename"
                      onSubmit={(e) => {
                        e.preventDefault();
                        commitRename();
                      }}
                    >
                      <input
                        className="saved-row-rename-input"
                        value={draftName}
                        autoFocus
                        maxLength={50}
                        onChange={(e) => setDraftName(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRename();
                          }
                        }}
                        onBlur={commitRename}
                        aria-label="Network name"
                      />
                    </form>
                  ) : (
                    <button
                      type="button"
                      className="saved-row-open"
                      onClick={() => onOpen(network)}
                      title={`Open ${network.name}`}
                    >
                      <span className="saved-row-name">
                        {network.name}
                        {isCurrent && <span className="saved-row-badge">Open</span>}
                      </span>
                      <span className="saved-row-meta">
                        {plural(network.nodes.length, 'verse')} · {plural(network.edges.length, 'link')} ·{' '}
                        {savedAgo(network.timestamp)}
                      </span>
                    </button>
                  )}
                  <div className="saved-row-actions">
                    <button
                      type="button"
                      className="saved-row-action"
                      onClick={() => startRename(network)}
                      aria-label={`Rename ${network.name}`}
                      title="Rename"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="saved-row-action"
                      onClick={() => onDuplicate(network.id)}
                      aria-label={`Duplicate ${network.name}`}
                      title="Duplicate"
                    >
                      <Copy size={16} />
                    </button>
                    <button
                      type="button"
                      className="saved-row-action danger"
                      onClick={() => onDelete(network.id, network.name)}
                      aria-label="Delete network"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="saved-dialog-footer">
          <p className="saved-dialog-note">
            {importError ?? 'Networks live in this browser only. Export a copy to keep them if you clear site data.'}
          </p>
          <div className="saved-footer-actions">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void importFile(file);
                e.target.value = '';
              }}
            />
            <button type="button" className="saved-btn-pill" onClick={() => fileRef.current?.click()}>
              <Download size={14} />
              Import
            </button>
            <button type="button" className="saved-btn-pill" onClick={exportAll} disabled={networks.length === 0}>
              <Upload size={14} />
              Export all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
