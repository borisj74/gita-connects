import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import { PanelLeftOpen, PanelRightOpen, Moon, Sun, Menu, Save, FolderOpen, LayoutGrid, Trash2, Search, BookOpen } from 'lucide-react';
import { useMediaQuery, MOBILE_BREAKPOINT } from './hooks/useMediaQuery.js';
import ChapterSidebar from './components/ChapterSidebar.js';
import VerseNetwork, { type VerseNetworkRef } from './components/VerseNetwork.js';
import VerseDetail from './components/VerseDetail.js';
import SearchPalette from './components/SearchPalette.js';
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
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > 768,
  );
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
  const [networkEdges, setNetworkEdges] = useState<Edge[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('gita-connects-theme') as 'light' | 'dark') || 'light',
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
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

  // Close mobile menu on outside click.
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as globalThis.Node)) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [mobileMenuOpen]);

  const handleVerseSelect = useCallback((verseId: string) => {
    setSelectedVerseId(verseId);
    verseNetworkRef.current?.focusNode?.(verseId);
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  const handleAddVerseToNetwork = useCallback((verseId: string) => {
    verseNetworkRef.current?.addVerse(verseId);
  }, []);

  const handleCloseDetail = () => {
    setSelectedVerseId(null);
  };

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (searchOpen) {
          setSearchOpen(false);
        } else if (typing) {
          (e.target as HTMLElement).blur();
        } else if (selectedVerseId) {
          setSelectedVerseId(null);
        }
        return;
      }

      // Cmd/Ctrl+K — open search palette (works anywhere)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      // Cmd/Ctrl+S — save (works anywhere)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveLoadRef.current?.openSave();
        return;
      }

      if (typing) return;

      // "/" — open search palette
      if (e.key === '/') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedVerseId, searchOpen]);

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

  // Verses directly connected to the selected one on the canvas — lets the
  // suggestion list mark accepted links as added.
  const connectedNeighbors = useMemo(() => {
    const set = new Set<string>();
    if (!selectedVerseId) return set;
    networkEdges.forEach((e) => {
      if (e.source === selectedVerseId) set.add(e.target);
      if (e.target === selectedVerseId) set.add(e.source);
    });
    return set;
  }, [selectedVerseId, networkEdges]);

  const showSidebarBackdrop = isMobile && sidebarOpen;
  const showDetailBackdrop = isMobile && !!selectedVerseId;

  return (
    <div className={`app ${isMobile ? 'is-mobile' : ''}`}>
      {(showSidebarBackdrop || showDetailBackdrop) && (
        <button
          type="button"
          className="drawer-backdrop"
          aria-label="Close panel"
          onClick={() => {
            if (showDetailBackdrop) setSelectedVerseId(null);
            else setSidebarOpen(false);
          }}
        />
      )}

      <div className="app-body">
        <div className={`sidebar-wrapper ${!sidebarOpen ? 'collapsed' : ''} ${isMobile ? 'mobile-drawer' : ''}`}>
          <div className="section-header">
            <div className="section-info">
              <h2 className="section-title">Chapters & Verses</h2>
              <p className="section-subtitle">
                {isMobile ? 'Tap verses to read, or + to add to canvas' : 'Drag verses to explore connections'}
              </p>
            </div>
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarOpen(false)}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
            >
              <PanelRightOpen size={18} />
            </button>
          </div>
          {sidebarOpen && (
            <ChapterSidebar
              onVerseSelect={handleVerseSelect}
              selectedVerseId={selectedVerseId}
              networkVerses={networkVerses}
              isMobile={isMobile}
              onAddToNetwork={handleAddVerseToNetwork}
            />
          )}
        </div>

        {!sidebarOpen && (
          <button
            className={`sidebar-toggle sidebar-floating-toggle ${isMobile ? 'chapters-fab' : ''}`}
            onClick={() => setSidebarOpen(true)}
            title={isMobile ? 'Browse chapters' : 'Expand sidebar'}
            aria-label={isMobile ? 'Browse chapters' : 'Expand sidebar'}
          >
            {isMobile ? <BookOpen size={18} /> : <PanelLeftOpen size={18} />}
            {isMobile && <span className="chapters-fab-label">Chapters</span>}
          </button>
        )}

        <div className="main-content">
          {/* Floating actions, top-right over the canvas */}
          <div className="canvas-actions">
            <button
              className="control-button icon-only"
              onClick={() => setSearchOpen(true)}
              title="Search verses (⌘K)"
              aria-label="Search verses"
            >
              <Search size={16} />
            </button>
            <SaveLoadControls
              ref={saveLoadRef}
              getNetworkState={getNetworkState}
              selectedVerseId={selectedVerseId}
              onLoadNetwork={handleLoadNetwork}
            />
            <ConnectionFilters
              connectionTypes={connectionTypes}
              activeFilters={activeFilters}
              onToggleFilter={handleToggleFilter}
              onRemoveCustomType={handleRemoveCustomType}
            />
            <button className="action-button arrange-button" onClick={handleAutoArrange}>
              Auto Arrange
            </button>
            <button className="action-button clear-button" onClick={handleClearAll}>
              Clear All
            </button>

            {/* Mobile: collapse all actions into a hamburger menu */}
            <div className="mobile-actions" ref={mobileMenuRef}>
              <button
                className="hamburger-button"
                onClick={() => setMobileMenuOpen((v) => !v)}
                aria-label="Actions menu"
                aria-expanded={mobileMenuOpen}
              >
                <Menu size={20} />
              </button>
              {mobileMenuOpen && (
                <div className="mobile-actions-menu">
                  <div className="mobile-menu-filters">
                    <ConnectionFilters
                      connectionTypes={connectionTypes}
                      activeFilters={activeFilters}
                      onToggleFilter={handleToggleFilter}
                      onRemoveCustomType={handleRemoveCustomType}
                    />
                  </div>
                  <button
                    className="mobile-menu-item"
                    onClick={() => { saveLoadRef.current?.openSave(); setMobileMenuOpen(false); }}
                  >
                    <Save size={16} /> Save
                  </button>
                  <button
                    className="mobile-menu-item"
                    onClick={() => { saveLoadRef.current?.openLoad(); setMobileMenuOpen(false); }}
                  >
                    <FolderOpen size={16} /> Load
                  </button>
                  <button
                    className="mobile-menu-item"
                    onClick={() => { handleAutoArrange(); setMobileMenuOpen(false); }}
                  >
                    <LayoutGrid size={16} /> Auto Arrange
                  </button>
                  <button
                    className="mobile-menu-item danger"
                    onClick={() => { handleClearAll(); setMobileMenuOpen(false); }}
                  >
                    <Trash2 size={16} /> Clear All
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Theme toggle, bottom-right corner */}
          <button
            className="control-button icon-only theme-toggle-btn"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title="Toggle dark mode"
            aria-label="Toggle dark mode"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          <div className="network-container">
            <ReactFlowProvider>
              <VerseNetwork
                ref={verseNetworkRef}
                onVerseSelect={handleVerseSelect}
                selectedVerseId={selectedVerseId}
                activeFilters={activeFilters}
                onToggleFilter={handleToggleFilter}
                onNetworkVersesChange={setNetworkVerses}
                onNetworkEdgesChange={setNetworkEdges}
                connectionTypes={connectionTypes}
                onAddCustomType={handleAddCustomType}
                isMobile={isMobile}
              />
            </ReactFlowProvider>
          </div>
        </div>

        {selectedVerseId && (
          <VerseDetail
            verseId={selectedVerseId}
            onClose={handleCloseDetail}
            networkVerses={networkVerses}
            onAddToNetwork={handleAddVerseToNetwork}
            onAddSuggestion={(fromId, toId, conn) => verseNetworkRef.current?.addConnection(fromId, toId, conn)}
            connectedNeighbors={connectedNeighbors}
            isMobile={isMobile}
          />
        )}
      </div>

      {searchOpen && (
        <SearchPalette
          onVerseSelect={handleVerseSelect}
          onAddVerse={(id) => verseNetworkRef.current?.addVerse(id)}
          networkVerses={networkVerses}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}

export default App;
