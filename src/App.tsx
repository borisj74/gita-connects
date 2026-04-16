import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import ChapterSidebar from './components/ChapterSidebar.js';
import VerseNetwork, { type VerseNetworkRef } from './components/VerseNetwork.js';
import VerseDetail from './components/VerseDetail.js';
import SearchBar from './components/SearchBar.js';
import ConnectionFilters from './components/ConnectionFilters.js';
import SaveLoadControls from './components/SaveLoadControls.js';
import {
  PREDEFINED_CONNECTION_TYPES,
  loadCustomConnectionTypes,
  saveCustomConnectionTypes,
  type ConnectionTypeDef,
} from './connectionTypes.js';
import './App.css';

function App() {
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [customTypes, setCustomTypes] = useState<ConnectionTypeDef[]>(() =>
    loadCustomConnectionTypes(),
  );
  const connectionTypes = useMemo(
    () => [...PREDEFINED_CONNECTION_TYPES, ...customTypes],
    [customTypes],
  );
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    () => new Set(PREDEFINED_CONNECTION_TYPES.map((t) => t.id)),
  );
  const [networkVerses, setNetworkVerses] = useState<Set<string>>(new Set());
  const verseNetworkRef = useRef<VerseNetworkRef>(null);

  // Persist custom types whenever they change.
  useEffect(() => {
    saveCustomConnectionTypes(customTypes);
  }, [customTypes]);

  const handleVerseSelect = (verseId: string) => {
    setSelectedVerseId(verseId);
  };

  const handleCloseDetail = () => {
    setSelectedVerseId(null);
  };

  const handleToggleFilter = useCallback((type: string) => {
    setActiveFilters((prev) => {
      const updated = new Set(prev);
      if (updated.has(type)) {
        updated.delete(type);
      } else {
        updated.add(type);
      }
      return updated;
    });
  }, []);

  const handleAddCustomType = useCallback((type: ConnectionTypeDef) => {
    setCustomTypes((prev) => {
      if (prev.some((t) => t.id === type.id)) return prev;
      return [...prev, type];
    });
    setActiveFilters((prev) => {
      if (prev.has(type.id)) return prev;
      const updated = new Set(prev);
      updated.add(type.id);
      return updated;
    });
  }, []);

  const handleRemoveCustomType = useCallback((typeId: string) => {
    setCustomTypes((prev) => prev.filter((t) => t.id !== typeId));
    setActiveFilters((prev) => {
      const updated = new Set(prev);
      updated.delete(typeId);
      return updated;
    });
    verseNetworkRef.current?.removeEdgesByType?.(typeId);
  }, []);

  const handleAutoArrange = () => {
    if (verseNetworkRef.current?.handleAutoArrange) {
      verseNetworkRef.current.handleAutoArrange();
    }
  };

  const handleClearAll = () => {
    if (verseNetworkRef.current?.handleClearAll) {
      verseNetworkRef.current.handleClearAll();
    }
  };

  const handleLoadNetwork = (nodes: Node[], edges: Edge[], selectedId: string | null) => {
    if (verseNetworkRef.current?.loadNetwork) {
      verseNetworkRef.current.loadNetwork(nodes, edges);
      setSelectedVerseId(selectedId);
    }
  };

  const getNetworkState = () => {
    if (verseNetworkRef.current?.getNetworkState) {
      return verseNetworkRef.current.getNetworkState();
    }
    return { nodes: [], edges: [] };
  };

  return (
    <div className="app">
      <div className="app-header">
        <div className="header-content">
          <div className="app-title-section">
            <h1 className="app-title">Gita Connects</h1>
            <p className="app-subtitle">Verse Explorer</p>
          </div>
          <div className="header-controls">
            <SearchBar onVerseSelect={handleVerseSelect} />
            <ConnectionFilters
              connectionTypes={connectionTypes}
              activeFilters={activeFilters}
              onToggleFilter={handleToggleFilter}
              onRemoveCustomType={handleRemoveCustomType}
            />
          </div>
        </div>
      </div>

      <div className="app-body">
        <div className="sidebar-wrapper">
          <div className="section-header">
            <div className="section-info">
              <h2 className="section-title">Chapters & Verses</h2>
              <p className="section-subtitle">Drag verses to explore connections</p>
            </div>
          </div>
          <ChapterSidebar
            onVerseSelect={handleVerseSelect}
            selectedVerseId={selectedVerseId}
          />
        </div>

        <div className="main-content">
          <div className="section-header">
            <div className="section-info">
              <h2 className="section-title">Connection Network</h2>
              <p className="section-subtitle">Ready to explore</p>
            </div>
            <div className="section-actions">
              <SaveLoadControls
                getNetworkState={getNetworkState}
                selectedVerseId={selectedVerseId}
                onLoadNetwork={handleLoadNetwork}
              />
              <button className="action-button arrange-button" onClick={handleAutoArrange}>
                Auto Arrange
              </button>
              <button className="action-button clear-button" onClick={handleClearAll}>
                Clear All
              </button>
            </div>
          </div>
          <div className="network-container">
            <ReactFlowProvider>
              <VerseNetwork
                ref={verseNetworkRef}
                onVerseSelect={handleVerseSelect}
                selectedVerseId={selectedVerseId}
                activeFilters={activeFilters}
                onToggleFilter={handleToggleFilter}
                onNetworkVersesChange={setNetworkVerses}
                connectionTypes={connectionTypes}
                onAddCustomType={handleAddCustomType}
              />
            </ReactFlowProvider>
          </div>
        </div>

        {selectedVerseId && (
          <VerseDetail
            verseId={selectedVerseId}
            onClose={handleCloseDetail}
            networkVerses={networkVerses}
          />
        )}
      </div>
    </div>
  );
}

export default App;
