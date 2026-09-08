import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import { PanelRightOpen, Moon, Sun, Menu, Save, FolderOpen, LayoutGrid, Trash2, Search, BookOpen } from 'lucide-react';
import { useMediaQuery, MOBILE_BREAKPOINT } from './hooks/useMediaQuery.js';
import ChapterSidebar from './components/ChapterSidebar.js';
import VerseNetwork, { type VerseNetworkRef } from './components/VerseNetwork.js';
import VerseDetail from './components/VerseDetail.js';
import SearchPalette from './components/SearchPalette.js';
import ConnectionFilters from './components/ConnectionFilters.js';
import SaveLoadControls, { type SaveLoadControlsRef } from './components/SaveLoadControls.js';
import OverflowMenu from './components/OverflowMenu.js';
import ClearCanvasDialog from './components/ClearCanvasDialog.js';
import UndoToast from './components/UndoToast.js';
import './components/Toolbar.css';
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
    loadActiveFilters([...PREDEFINED_CONNECTION_TYPES, ...loadCustomConnectionTypes()].map((t) => t.id)),
  );
  const [networkVerses, setNetworkVerses] = useState<Set<string>>(new Set());
  const [networkEdges, setNetworkEdges] = useState<Edge[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('gita-connects-theme') as 'light' | 'dark') || 'light',
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearedToast, setClearedToast] = useState<{ verses: number; links: number } | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const verseNetworkRef = useRef<VerseNetworkRef>(null);
  const saveLoadRef = useRef<SaveLoadControlsRef>(null);

  // Persist custom types whenever they change.
  useEffect(() => {
    saveCustomConnectionTypes(customTypes);
  }, [customTypes]);

  // Persist active filters so they survive reloads.
  useEffect(() => {
    saveActiveFilters(activeFilters, connectionTypes.map((t) => t.id));
  }, [activeFilters, connectionTypes]);

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
        saveLoadRef.current?.saveChanges();
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

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  const handleAutoArrange = () => {
    if (verseNetworkRef.current?.handleAutoArrange) {
      verseNetworkRef.current.handleAutoArrange();
    }
  };

  // "Clear canvas…" opens a confirm; the actual clear happens on confirm.
  const handleClearAll = () => {
    if (networkVerses.size === 0) return;
    setClearDialogOpen(true);
  };

  const confirmClearCanvas = () => {
    setClearDialogOpen(false);
    const verses = networkVerses.size;
    const links = networkEdges.length;
    verseNetworkRef.current?.handleClearAll?.();
    setClearedToast({ verses, links });
  };

  const undoClear = useCallback(() => {
    setClearedToast(null);
    verseNetworkRef.current?.undo?.();
  }, []);

  const dismissClearedToast = useCallback(() => setClearedToast(null), []);

  // The toast only makes sense while the canvas is still empty — if the user
  // undoes via ⌘Z or adds a verse, it has nothing left to offer.
  const handleNetworkVersesChange = useCallback((verses: Set<string>) => {
    setNetworkVerses(verses);
    if (verses.size > 0) setClearedToast(null);
  }, []);

  const saveBeforeClear = () => {
    setClearDialogOpen(false);
    saveLoadRef.current?.openSave();
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
      <div className="app-body">
        <div className={`sidebar-wrapper ${isMobile ? 'sidebar-drawer' : ''} ${!sidebarOpen ? 'collapsed' : ''}`}>
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
            className="sidebar-toggle sidebar-floating-toggle chapters-fab"
            onClick={() => setSidebarOpen(true)}
            title="Browse chapters"
            aria-label="Browse chapters"
          >
            <BookOpen size={18} />
            <span className="chapters-fab-label">Chapters</span>
          </button>
        )}

        <div className="main-content">
          {/* Toolbar row: search on the left, canvas tools on the right */}
          <div className={`canvas-toolbar ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
          <button
            type="button"
            className="tb-button tb-search"
            onClick={() => setSearchOpen(true)}
            aria-label="Search verses"
            title="Search verses (⌘K)"
          >
            <Search size={16} className="tb-search-icon" />
            <span className="tb-search-label">Search verses</span>
            <kbd className="tb-kbd">⌘K</kbd>
          </button>

          {/* Canvas tools, top-right */}
          <div className="canvas-actions">
            <div className="tb-desktop-only">
              <ConnectionFilters
                connectionTypes={connectionTypes}
                activeFilters={activeFilters}
                onToggleFilter={handleToggleFilter}
                onRemoveCustomType={handleRemoveCustomType}
              />
            </div>
            <button
              type="button"
              className="tb-button tb-desktop-only"
              onClick={handleAutoArrange}
              disabled={networkVerses.size === 0}
              title="Arrange verses automatically"
            >
              <LayoutGrid size={15} />
              Auto Arrange
            </button>
            <div className="tb-desktop-only">
              <SaveLoadControls
                ref={saveLoadRef}
                getNetworkState={getNetworkState}
                selectedVerseId={selectedVerseId}
                onLoadNetwork={handleLoadNetwork}
              />
            </div>
            <div className="tb-desktop-only">
              <OverflowMenu
                theme={theme}
                onToggleTheme={toggleTheme}
                onClearCanvas={handleClearAll}
                canClear={networkVerses.size > 0}
              />
            </div>

            {/* Mobile: search + everything else in a hamburger menu */}
            <button
              type="button"
              className="tb-button tb-icon tb-mobile-only"
              onClick={() => setSearchOpen(true)}
              aria-label="Search verses"
            >
              <Search size={18} />
            </button>
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
                    className="mobile-menu-item"
                    onClick={() => { toggleTheme(); setMobileMenuOpen(false); }}
                  >
                    {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    {theme === 'dark' ? 'Light mode' : 'Dark mode'}
                  </button>
                  <button
                    className="mobile-menu-item danger"
                    onClick={() => { handleClearAll(); setMobileMenuOpen(false); }}
                  >
                    <Trash2 size={16} /> Clear canvas
                  </button>
                </div>
              )}
            </div>
          </div>
          </div>

          {clearedToast && (
            <UndoToast
              message={`Canvas cleared — ${clearedToast.verses} ${clearedToast.verses === 1 ? 'verse' : 'verses'}, ${clearedToast.links} ${clearedToast.links === 1 ? 'link' : 'links'}`}
              onUndo={undoClear}
              onDismiss={dismissClearedToast}
            />
          )}

          <div className="network-container">
            <ReactFlowProvider>
              <VerseNetwork
                ref={verseNetworkRef}
                onVerseSelect={handleVerseSelect}
                selectedVerseId={selectedVerseId}
                activeFilters={activeFilters}
                onToggleFilter={handleToggleFilter}
                onNetworkVersesChange={handleNetworkVersesChange}
                onNetworkEdgesChange={setNetworkEdges}
                connectionTypes={connectionTypes}
                onAddCustomType={handleAddCustomType}
                isMobile={isMobile}
                theme={theme}
              />
            </ReactFlowProvider>
          </div>
        </div>

        {selectedVerseId && (
          <VerseDetail
            key={selectedVerseId}
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

      {clearDialogOpen && (
        <ClearCanvasDialog
          verseCount={networkVerses.size}
          linkCount={networkEdges.length}
          onCancel={() => setClearDialogOpen(false)}
          onConfirm={confirmClearCanvas}
          onSaveFirst={saveBeforeClear}
        />
      )}

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
