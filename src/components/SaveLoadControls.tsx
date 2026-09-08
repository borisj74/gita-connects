import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Save, FolderOpen, X, Trash2, Check, AlertTriangle, ChevronDown, FilePlus, Download } from 'lucide-react';
import type { Node, Edge } from 'reactflow';
import SavedNetworksDialog, { type SavedNetwork } from './SavedNetworksDialog.js';
import ScrimHint from './ScrimHint.js';
import DeleteNetworkDialog from './DeleteNetworkDialog.js';
import './SaveLoadControls.css';
import './Toolbar.css';

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const min = Math.round(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return hr === 1 ? '1 hour ago' : `${hr} hours ago`;
  const day = Math.round(hr / 24);
  if (day === 1) return 'yesterday';
  if (day < 7) return `${day} days ago`;
  const wk = Math.round(day / 7);
  if (wk < 5) return wk === 1 ? 'last week' : `${wk} weeks ago`;
  return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface SaveLoadControlsProps {
  getNetworkState: () => { nodes: Node[]; edges: Edge[] };
  selectedVerseId: string | null;
  onLoadNetwork: (nodes: Node[], edges: Edge[], selectedVerseId: string | null) => void;
}

const STORAGE_KEY = 'gita-connects-saved-networks';

export interface SaveLoadControlsRef {
  openSave: () => void;
  openLoad: () => void;
  /** Overwrite the currently loaded network, or open the save dialog if none is loaded. */
  saveChanges: () => void;
}

const SaveLoadControls = forwardRef<SaveLoadControlsRef, SaveLoadControlsProps>(function SaveLoadControls({
  getNetworkState,
  selectedVerseId,
  onLoadNetwork,
}: SaveLoadControlsProps, ref) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [networkName, setNetworkName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [currentNetworkState, setCurrentNetworkState] = useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const [savedNetworks, setSavedNetworks] = useState<SavedNetwork[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Identity of the network currently on the canvas (set on save/load) so
  // "Save changes" can overwrite in place instead of always creating a copy.
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as globalThis.Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 1500);
    return () => clearTimeout(t);
  }, [justSaved]);

  const handleOpenSaveModal = () => {
    // Get the network state when opening the modal (in event handler, not during render)
    const state = getNetworkState();
    setCurrentNetworkState(state);
    setShowSaveModal(true);
  };

  const persist = (list: SavedNetwork[]): boolean => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      return true;
    } catch {
      return false;
    }
  };

  const handleSaveChanges = () => {
    const current = currentId ? savedNetworks.find((n) => n.id === currentId) : undefined;
    if (!current) {
      handleOpenSaveModal();
      return;
    }
    const state = getNetworkState();
    if (state.nodes.length === 0) {
      handleOpenSaveModal();
      return;
    }
    const updated = savedNetworks.map((n) =>
      n.id === current.id
        ? { ...n, timestamp: Date.now(), nodes: state.nodes, edges: state.edges, selectedVerseId }
        : n,
    );
    if (persist(updated)) {
      setSavedNetworks(updated);
      setCurrentNetworkState(state);
      setJustSaved(true);
    }
  };

  const handleOpenLibrary = () => {
    // Menu items unmount when the menu closes, so park focus on the trigger
    // first; the dialog returns focus there when it closes.
    triggerRef.current?.focus();
    setCurrentNetworkState(getNetworkState());
    setShowLoadModal(true);
  };

  const handleRename = (id: string, name: string) => {
    const updated = savedNetworks.map((n) => (n.id === id ? { ...n, name } : n));
    if (persist(updated)) setSavedNetworks(updated);
  };

  const handleDuplicate = (id: string) => {
    const source = savedNetworks.find((n) => n.id === id);
    if (!source) return;
    const copy: SavedNetwork = {
      ...source,
      id: Date.now().toString(),
      name: `${source.name} (copy)`,
      timestamp: Date.now(),
    };
    const updated = [...savedNetworks, copy];
    if (persist(updated)) setSavedNetworks(updated);
  };

  const handleImport = (incoming: SavedNetwork[]) => {
    // Imported networks get fresh ids so they never collide with existing ones.
    const base = Date.now();
    const stamped = incoming.map((n, i) => ({
      id: `${base + i}`,
      name: n.name,
      timestamp: typeof n.timestamp === 'number' ? n.timestamp : base,
      nodes: n.nodes,
      edges: n.edges,
      selectedVerseId: n.selectedVerseId ?? null,
    }));
    const updated = [...savedNetworks, ...stamped];
    if (persist(updated)) setSavedNetworks(updated);
  };

  useImperativeHandle(ref, () => ({
    openSave: handleOpenSaveModal,
    openLoad: handleOpenLibrary,
    saveChanges: handleSaveChanges,
  }));

  const handleSave = () => {
    setSaveError(null);
    setSaveSuccess(null);

    if (!networkName.trim()) {
      setSaveError('Please enter a network name');
      return;
    }

    if (currentNetworkState.nodes.length === 0) {
      setSaveError('Cannot save an empty network');
      return;
    }

    const newNetwork: SavedNetwork = {
      id: Date.now().toString(),
      name: networkName.trim(),
      timestamp: Date.now(),
      nodes: currentNetworkState.nodes,
      edges: currentNetworkState.edges,
      selectedVerseId,
    };

    const updated = [...savedNetworks, newNetwork];
    if (!persist(updated)) {
      setSaveError('Could not save: browser storage is full. Delete old networks and try again.');
      return;
    }
    setSavedNetworks(updated);
    setCurrentId(newNetwork.id);

    setSaveSuccess(`Network "${newNetwork.name}" saved!`);
    setNetworkName('');

    // Auto-close after success
    setTimeout(() => {
      setShowSaveModal(false);
      setSaveSuccess(null);
    }, 1500);
  };

  const handleLoad = (network: SavedNetwork) => {
    onLoadNetwork(network.nodes, network.edges, network.selectedVerseId);
    setCurrentId(network.id);
    setShowLoadModal(false);
    setMenuOpen(false);
  };

  const handleDeleteConfirm = () => {
    if (!deleteConfirm) return;

    const updated = savedNetworks.filter(n => n.id !== deleteConfirm.id);
    setSavedNetworks(updated);
    // Removing data only shrinks the payload; ignore storage errors here.
    persist(updated);
    if (currentId === deleteConfirm.id) setCurrentId(null);
    setDeleteConfirm(null);
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(null);
  };

  const handleCloseSaveModal = () => {
    setShowSaveModal(false);
    setSaveError(null);
    setSaveSuccess(null);
    setNetworkName('');
  };

  const recent = [...savedNetworks].sort((a, b) => b.timestamp - a.timestamp).slice(0, 3);

  return (
    <>
      <div className="tb-menu-anchor save-load-controls" ref={menuRef}>
        <button
          ref={triggerRef}
          type="button"
          className="tb-button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="Networks"
        >
          {justSaved ? (
            <>
              <Check size={16} /> Saved
            </>
          ) : (
            'Networks'
          )}
          <ChevronDown size={16} className="tb-chevron" />
        </button>

        {menuOpen && (
          <div className="tb-menu tb-networks-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              className="tb-menu-item"
              onClick={() => { setMenuOpen(false); handleSaveChanges(); }}
            >
              <Save size={16} />
              <span className="tb-menu-item-label">Save changes</span>
              <span className="tb-menu-item-hint">⌘S</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="tb-menu-item"
              onClick={() => { setMenuOpen(false); handleOpenSaveModal(); }}
            >
              <FilePlus size={16} />
              <span className="tb-menu-item-label">Save as new…</span>
            </button>

            <div className="tb-menu-divider" role="separator" />
            <div className="tb-menu-heading">Recent</div>
            {recent.length === 0 ? (
              <div className="tb-recent-empty">No saved networks yet.</div>
            ) : (
              recent.map((network) => (
                <div key={network.id} className="tb-recent-row">
                  <button
                    type="button"
                    role="menuitem"
                    className="tb-recent-open"
                    onClick={() => handleLoad(network)}
                    title={`Open ${network.name}`}
                  >
                    <span className="tb-recent-name">{network.name}</span>
                    <span className="tb-recent-meta">
                      {network.nodes.length} verses · {network.edges.length} links · {relativeTime(network.timestamp)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="tb-recent-delete"
                    onClick={(e) => { e.stopPropagation(); setDeleteConfirm({ id: network.id, name: network.name }); }}
                    aria-label={`Delete ${network.name}`}
                    title="Delete network"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}

            <div className="tb-menu-divider" role="separator" />
            <button
              type="button"
              role="menuitem"
              className="tb-menu-item"
              onClick={() => { setMenuOpen(false); handleOpenLibrary(); }}
            >
              <FolderOpen size={16} />
              <span className="tb-menu-item-label">All networks…</span>
            </button>
            <button
              type="button"
              role="menuitem"
              className="tb-menu-item"
              disabled
              title="Coming soon"
            >
              <Download size={16} />
              <span className="tb-menu-item-label">Export as PNG or PDF…</span>
              <span className="tb-menu-item-hint">Soon</span>
            </button>
          </div>
        )}
      </div>

      {/* Save as new */}
      {showSaveModal && (
        <div className="modal-overlay saved-dialog-overlay" onClick={handleCloseSaveModal}>
          <ScrimHint />
          <div
            className="saved-dialog save-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="saved-dialog-header">
              <div>
                <h2 id="save-dialog-title" className="saved-dialog-title">Save network</h2>
                <p className="saved-dialog-subtitle">
                  {currentNetworkState.nodes.length === 0
                    ? 'Nothing on the canvas yet'
                    : `${currentNetworkState.nodes.length} ${currentNetworkState.nodes.length === 1 ? 'verse' : 'verses'} · ${currentNetworkState.edges.length} ${currentNetworkState.edges.length === 1 ? 'link' : 'links'} on the canvas`}
                </p>
              </div>
              <button
                type="button"
                className="saved-dialog-close"
                onClick={handleCloseSaveModal}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <div className="save-dialog-body">
              {currentNetworkState.nodes.length === 0 ? (
                <div className="saved-empty">
                  <p>No verses in network</p>
                  <p className="saved-empty-hint">Drag some verses into the network before saving.</p>
                </div>
              ) : (
                <>
                  <label className="save-dialog-label" htmlFor="save-dialog-name">Name</label>
                  <input
                    id="save-dialog-name"
                    type="text"
                    className={`save-dialog-input ${saveError ? 'has-error' : ''}`}
                    placeholder="e.g., Karma Yoga Study"
                    value={networkName}
                    onChange={(e) => {
                      setNetworkName(e.target.value);
                      setSaveError(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                    autoFocus
                    maxLength={50}
                  />
                  {saveError && (
                    <div className="save-dialog-error">
                      <AlertTriangle size={14} />
                      {saveError}
                    </div>
                  )}
                  {saveSuccess && (
                    <div className="save-dialog-success">
                      <Check size={14} />
                      {saveSuccess}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="saved-dialog-footer">
              <p className="saved-dialog-note">Saved to this browser. You can rename or export it later from Networks.</p>
              <div className="saved-footer-actions">
                <button type="button" className="saved-btn-secondary" onClick={handleCloseSaveModal}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="saved-btn-primary"
                  onClick={handleSave}
                  disabled={!networkName.trim() || !!saveSuccess || currentNetworkState.nodes.length === 0}
                >
                  Save network
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Saved networks library */}
      {showLoadModal && (
        <SavedNetworksDialog
          networks={savedNetworks}
          currentId={currentId}
          canvas={currentNetworkState}
          onOpen={handleLoad}
          onSaveChanges={handleSaveChanges}
          onSaveAsNew={() => { setShowLoadModal(false); handleOpenSaveModal(); }}
          onRename={handleRename}
          onDuplicate={handleDuplicate}
          onDelete={(id, name) => setDeleteConfirm({ id, name })}
          onImport={handleImport}
          onClose={() => setShowLoadModal(false)}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (() => {
        const target = savedNetworks.find((n) => n.id === deleteConfirm.id);
        return (
          <DeleteNetworkDialog
            name={deleteConfirm.name}
            verseCount={target?.nodes.length ?? 0}
            linkCount={target?.edges.length ?? 0}
            onCancel={handleDeleteCancel}
            onConfirm={handleDeleteConfirm}
          />
        );
      })()}
    </>
  );
});

export default SaveLoadControls;
