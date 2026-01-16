import { useState } from 'react';
import { Save, FolderOpen, X, Trash2, Check, AlertTriangle } from 'lucide-react';
import type { Node, Edge } from 'reactflow';
import './SaveLoadControls.css';

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

export default function SaveLoadControls({
  getNetworkState,
  selectedVerseId,
  onLoadNetwork,
}: SaveLoadControlsProps) {
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [networkName, setNetworkName] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [currentNetworkState, setCurrentNetworkState] = useState<{ nodes: Node[]; edges: Edge[] }>({ nodes: [], edges: [] });
  const [savedNetworks, setSavedNetworks] = useState<SavedNetwork[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });

  const handleOpenSaveModal = () => {
    // Get the network state when opening the modal (in event handler, not during render)
    const state = getNetworkState();
    setCurrentNetworkState(state);
    setShowSaveModal(true);
  };

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
    setSavedNetworks(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

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
    setShowLoadModal(false);
  };

  const handleDeleteClick = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ id, name });
  };

  const handleDeleteConfirm = () => {
    if (!deleteConfirm) return;

    const updated = savedNetworks.filter(n => n.id !== deleteConfirm.id);
    setSavedNetworks(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
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

  return (
    <>
      <div className="save-load-controls">
        <button
          className="control-button save-button"
          onClick={handleOpenSaveModal}
          title="Save network"
        >
          <Save size={16} />
          Save
        </button>
        <button
          className="control-button load-button"
          onClick={() => setShowLoadModal(true)}
          title="Load network"
        >
          <FolderOpen size={16} />
          Load
        </button>
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
}
