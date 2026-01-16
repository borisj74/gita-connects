import { useState, useCallback, useRef } from 'react';
import { ReactFlowProvider } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import ChapterSidebar from './components/ChapterSidebar.js';
import VerseNetwork, { type VerseNetworkRef } from './components/VerseNetwork.js';
import VerseDetail from './components/VerseDetail.js';
import SearchBar from './components/SearchBar.js';
import ConnectionFilters from './components/ConnectionFilters.js';
import SaveLoadControls from './components/SaveLoadControls.js';
import './App.css';

function App() {
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(['thematic', 'conceptual', 'practical']));
  const [networkVerses, setNetworkVerses] = useState<Set<string>>(new Set());
  const verseNetworkRef = useRef<VerseNetworkRef>(null);

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
              activeFilters={activeFilters}
              onToggleFilter={handleToggleFilter}
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
