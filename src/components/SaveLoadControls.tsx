import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Save, FolderOpen, X, Trash2, Check, AlertTriangle, ChevronDown, FilePlus, Download } from 'lucide-react';
import type { Node, Edge } from 'reactflow';
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

interface SavedNetwork {
  id: string;
  name: string;
  timestamp: number;
  nodes: Node[];
  edges: Edge[];
  selectedVerseId: string | null;
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
      setJustSaved(true);
    }
  };

  useImperativeHandle(ref, () => ({
    openSave: handleOpenSaveModal,
    openLoad: () => setShowLoadModal(true),
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

  const handleDeleteClick = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ id, name });
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

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const recent = [...savedNetworks].sort((a, b) => b.timestamp - a.timestamp).slice(0, 3);

  return (
    <>
      <div className="tb-menu-anchor save-load-controls" ref={menuRef}>
        <button
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
                    onClick={(e) => handleDeleteClick(network.id, network.name, e)}
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
              onClick={() => { setMenuOpen(false); setShowLoadModal(true); }}
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

      {/* Save Modal */}
      {showSaveModal && (
        <div className="modal-overlay" onClick={handleCloseSaveModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Save Network</h3>
              <button
                className="modal-close"
                onClick={handleCloseSaveModal}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {currentNetworkState.nodes.length === 0 ? (
                <div className="empty-networks">
                  <Save size={48} className="empty-icon" />
                  <p>No verses in network</p>
                  <p className="empty-hint">
                    Drag some verses into the network before saving.
                  </p>
                </div>
              ) : (
                <>
                  <p className="modal-description">
                    Give your network a name to save it for later.
                  </p>
                  <div className="input-wrapper">
                    <input
                      type="text"
                      className={`network-name-input ${saveError ? 'has-error' : ''}`}
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
                      <div className="input-error">
                        <AlertTriangle size={14} />
                        {saveError}
                      </div>
                    )}
                    {saveSuccess && (
                      <div className="input-success">
                        <Check size={14} />
                        {saveSuccess}
                      </div>
                    )}
                  </div>
                  <div className="network-info">
                    <span>{currentNetworkState.nodes.length} verses</span>
                    <span>•</span>
                    <span>{currentNetworkState.edges.length} connections</span>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="modal-button cancel-button"
                onClick={handleCloseSaveModal}
              >
                Cancel
              </button>
              <button
                className="modal-button save-modal-button"
                onClick={handleSave}
                disabled={!networkName.trim() || !!saveSuccess || currentNetworkState.nodes.length === 0}
              >
                Save Network
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Modal */}
      {showLoadModal && (
        <div className="modal-overlay" onClick={() => setShowLoadModal(false)}>
          <div className="modal-content load-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Load Network</h3>
              <button
                className="modal-close"
                onClick={() => setShowLoadModal(false)}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {savedNetworks.length === 0 ? (
                <div className="empty-networks">
                  <FolderOpen size={48} className="empty-icon" />
                  <p>No saved networks yet</p>
                  <p className="empty-hint">
                    Create a network and click Save to save it for later.
                  </p>
                </div>
              ) : (
                <div className="networks-list">
                  {savedNetworks
                    .sort((a, b) => b.timestamp - a.timestamp)
                    .map((network) => (
                      <div
                        key={network.id}
                        className="network-item"
                        onClick={() => handleLoad(network)}
                      >
                        <div className="network-item-header">
                          <h4 className="network-name">{network.name}</h4>
                          <button
                            className="delete-button"
                            onClick={(e) => handleDeleteClick(network.id, network.name, e)}
                            aria-label="Delete network"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div className="network-meta">
                          <span>{network.nodes.length} verses</span>
                          <span>•</span>
                          <span>{network.edges.length} connections</span>
                          <span>•</span>
                          <span className="network-date">{formatDate(network.timestamp)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="modal-content delete-modal" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-labelledby="delete-title" aria-describedby="delete-desc">
            <div className="modal-header">
              <h3 id="delete-title">Delete Network</h3>
              <button
                className="modal-close"
                onClick={handleDeleteCancel}
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <div className="delete-warning">
                <AlertTriangle size={24} className="warning-icon" />
                <p id="delete-desc">
                  Are you sure you want to delete <strong>"{deleteConfirm.name}"</strong>? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="modal-button cancel-button"
                onClick={handleDeleteCancel}
              >
                Cancel
              </button>
              <button
                className="modal-button delete-confirm-button"
                onClick={handleDeleteConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export default SaveLoadControls;
