import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import { ChevronLeft, ChevronRight, Undo2, Redo2, Moon, Sun } from 'lucide-react';
import ChapterSidebar from './components/ChapterSidebar.js';
import VerseNetwork, { type VerseNetworkRef } from './components/VerseNetwork.js';
import VerseDetail from './components/VerseDetail.js';
import SearchBar from './components/SearchBar.js';
import ConnectionFilters from './components/ConnectionFilters.js';
import SaveLoadControls, { type SaveLoadControlsRef } from './components/SaveLoadControls.js';
import {
  PREDEFINED_CONNECTION_TYPES,
  loadCustomConnectionTypes,
  saveCustomConnectionTypes,
  loadActiveFilters,
  saveActiveFilters,
  type ConnectionTypeDef,
} from './connectionTypes.js';
import './App.css';

function App() {
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [customTypes, setCustomTypes] = useState<ConnectionTypeDef[]>(() =>
    loadCustomConnectionTypes(),
  );
  const connectionTypes = useMemo(
    () => [...PREDEFINED_CONNECTION_TYPES, ...customTypes],
    [customTypes],
  );
  const [activeFilters, setActiveFilters] = useState<Set<string>>(() =>
    loadActiveFilters(PREDEFINED_CONNECTION_TYPES.map((t) => t.id)),
  );
  const [networkVerses, setNetworkVerses] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState({ canUndo: false, canRedo: false });
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('gita-connects-theme') as 'light' | 'dark') || 'light',
  );
  const verseNetworkRef = useRef<VerseNetworkRef>(null);
  const saveLoadRef = useRef<SaveLoadControlsRef>(null);

  // Persist custom types whenever they change.
  useEffect(() => {
    saveCustomConnectionTypes(customTypes);
  }, [customTypes]);

  // Persist active filters so they survive reloads.
  useEffect(() => {
    saveActiveFilters(activeFilters);
  }, [activeFilters]);

  // Apply + persist theme.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('gita-connects-theme', theme);
  }, [theme]);

  const handleVerseSelect = (verseId: string) => {
    setSelectedVerseId(verseId);
    verseNetworkRef.current?.focusNode?.(verseId);
  };

  const handleCloseDetail = () => {
    setSelectedVerseId(null);
  };

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (typing) {
          (e.target as HTMLElement).blur();
        } else if (selectedVerseId) {
          setSelectedVerseId(null);
        }
        return;
      }

      // Cmd/Ctrl+S — save (works anywhere)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveLoadRef.current?.openSave();
        return;
      }

      if (typing) return;

      // "/" — focus search
      if (e.key === '/') {
        e.preventDefault();
        document.querySelector<HTMLInputElement>('.search-input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedVerseId]);

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

  const handleUndo = () => verseNetworkRef.current?.undo();
  const handleRedo = () => verseNetworkRef.current?.redo();
  const handleHistoryChange = useCallback((canUndo: boolean, canRedo: boolean) => {
    setHistory({ canUndo, canRedo });
  }, []);

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
            <button
              className="theme-toggle"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              aria-label="Toggle dark mode"
              title="Toggle dark mode"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </div>
      </div>

      <div className="app-body">
        <div className={`sidebar-wrapper ${!sidebarOpen ? 'collapsed' : ''}`}>
          <div className="section-header">
            <div className="section-info">
              <h2 className="section-title">Chapters & Verses</h2>
              <p className="section-subtitle">Drag verses to explore connections</p>
            </div>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>
          {sidebarOpen && (
            <ChapterSidebar
              onVerseSelect={handleVerseSelect}
              selectedVerseId={selectedVerseId}
            />
          )}
        </div>

        <div className="main-content">
          {!sidebarOpen && (
            <button
              className="sidebar-expand-fab"
              onClick={() => setSidebarOpen(true)}
              title="Expand sidebar"
              aria-label="Expand sidebar"
            >
              <ChevronRight size={18} />
            </button>
          )}
          <div className="section-header">
            <div className="section-info">
              <h2 className="section-title">Connection Network</h2>
              <p className="section-subtitle">Ready to explore</p>
            </div>
            <div className="section-actions">
              <SaveLoadControls
                ref={saveLoadRef}
                getNetworkState={getNetworkState}
                selectedVerseId={selectedVerseId}
                onLoadNetwork={handleLoadNetwork}
              />
              <button
                className="action-button icon-button"
                onClick={handleUndo}
                disabled={!history.canUndo}
                title="Undo (⌘Z)"
                aria-label="Undo"
              >
                <Undo2 size={16} />
              </button>
              <button
                className="action-button icon-button"
                onClick={handleRedo}
                disabled={!history.canRedo}
                title="Redo (⌘⇧Z)"
                aria-label="Redo"
              >
                <Redo2 size={16} />
              </button>
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
                onHistoryChange={handleHistoryChange}
              />
            </ReactFlowProvider>
          </div>
        </div>

        {selectedVerseId && (
          <VerseDetail
            verseId={selectedVerseId}
            onClose={handleCloseDetail}
            networkVerses={networkVerses}
            onAddToNetwork={(id) => verseNetworkRef.current?.addVerse(id)}
          />
        )}
      </div>
    </div>
  );
}

export default App;
