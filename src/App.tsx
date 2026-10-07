import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ReactFlowProvider } from 'reactflow';
import type { Node, Edge } from 'reactflow';
import { PanelRightOpen, Moon, Sun, Menu, Save, FolderOpen, LayoutGrid, Trash2, BookOpen, Check, Sparkles, Compass } from 'lucide-react';
import { useMediaQuery, MOBILE_BREAKPOINT } from './hooks/useMediaQuery.js';
import ChapterSidebar from './components/ChapterSidebar.js';
import VerseNetwork, { type VerseNetworkRef } from './components/VerseNetwork.js';
import VerseDetail from './components/VerseDetail.js';
import SearchField, { type SearchFieldRef } from './components/SearchField.js';
import ConnectionFilters from './components/ConnectionFilters.js';
import SaveLoadControls, { type SaveLoadControlsRef } from './components/SaveLoadControls.js';
import OverflowMenu from './components/OverflowMenu.js';
import ClearCanvasDialog from './components/ClearCanvasDialog.js';
import UndoToast from './components/UndoToast.js';
import RestoreSessionCard from './components/RestoreSessionCard.js';
import ShortcutsOverlay, { type HelpTab } from './components/ShortcutsOverlay.js';
import DeleteLinkTypeDialog from './components/DeleteLinkTypeDialog.js';
import GuidedTour from './components/GuidedTour.js';
import { shouldWelcome, saveTourStatus, type TourStatus } from './tour/tourStore.js';
import { readAutosave, clearAutosave, type Autosave } from './autosave.js';
import './components/Toolbar.css';
import {
  PREDEFINED_CONNECTION_TYPES,
  loadCustomConnectionTypes,
  saveCustomConnectionTypes,
  loadActiveFilters,
  saveActiveFilters,
  type ConnectionTypeDef,
} from './connectionTypes.js';
import { verses } from './data/index.js';
import { useNotes } from './notes.js';
import { collectUsage, downloadJson } from './usage.js';
import { buildPdf, downloadBlob, downloadDataUrl } from './exportNetwork.js';
import ExportDialog, { type ExportFormat } from './components/ExportDialog.js';
import AccountDialog from './components/AccountDialog.js';
import NetworkInsights from './components/NetworkInsights.js';
import { cloudEnabled } from './cloud/supabase.js';
import { useSession, accountLabel } from './cloud/useSession.js';
import { startSync, stopSync } from './cloud/sync.js';
import {
  persistWithSignal, useRemoteSettingsVersion, readPreferences, readCustomTypes,
} from './settingsStore.js';
import type { Concept } from './concepts.js';
import './App.css';

const INSIGHTS_HIDDEN_KEY = 'gita-connects-insights-hidden';

function App() {
  const isMobile = useMediaQuery(MOBILE_BREAKPOINT);
  const [selectedVerseId, setSelectedVerseId] = useState<string | null>(null);
  // Concept chip acting as a filter (App 23): the sidebar narrows to verses
  // that share it and unrelated cards on the canvas fade back.
  const [conceptFilter, setConceptFilter] = useState<string | null>(null);
  // Personal notes (App 29–31). `noteEdit` bumps to open the panel's editor.
  const notes = useNotes();
  const noteVerseIds = useMemo(() => new Set(Object.keys(notes)), [notes]);
  const [noteEdit, setNoteEdit] = useState<{ verseId: string; seq: number } | null>(null);
  const [noteToast, setNoteToast] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  // "What your network says" can be hidden outright (× on the panel); the ⋯
  // menu and the I key bring it back. Remembered across visits.
  const [insightsHidden, setInsightsHidden] = useState(() => {
    try {
      return localStorage.getItem(INSIGHTS_HIDDEN_KEY) === '1';
    } catch {
      return false;
    }
  });
  // Brought back on purpose: open it expanded, whatever its folded state was.
  const [insightsReshown, setInsightsReshown] = useState(false);
  const toggleInsights = useCallback(() => {
    const next = !insightsHidden;
    setInsightsHidden(next);
    if (!next) setInsightsReshown(true);
    try {
      localStorage.setItem(INSIGHTS_HIDDEN_KEY, next ? '1' : '0');
    } catch {
      // Preference just doesn't stick — not worth surfacing.
    }
  }, [insightsHidden]);
  const { session } = useSession();

  // Mirror this device's work to the account while one is signed in. Signing
  // out stops the mirror and leaves the local copy untouched.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (!userId) {
      stopSync();
      return;
    }
    void startSync(userId);
    return () => stopSync();
  }, [userId]);
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth > 768,
  );
  const [customTypes, setCustomTypes] = useState<ConnectionTypeDef[]>(() =>
    loadCustomConnectionTypes(),
  );
  // Custom types the reader deleted this session. They stay resolvable (colour,
  // label) so that undoing the deletion brings the links back intact, but
  // they no longer appear in the Link types menu.
  const [retiredTypes, setRetiredTypes] = useState<ConnectionTypeDef[]>([]);
  const connectionTypes = useMemo(
    () => [...PREDEFINED_CONNECTION_TYPES, ...customTypes],
    [customTypes],
  );
  const renderableTypes = useMemo(
    () => [...connectionTypes, ...retiredTypes],
    [connectionTypes, retiredTypes],
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
  const searchRef = useRef<SearchFieldRef>(null);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearedToast, setClearedToast] = useState<{ verses: number; links: number } | null>(null);
  const [removedLinksToast, setRemovedLinksToast] = useState<string | null>(null);
  // Pending autosave from a previous session, until the user restores or declines.
  const [pendingRestore, setPendingRestore] = useState<Autosave | null>(() => readAutosave());
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [typeToDelete, setTypeToDelete] = useState<ConnectionTypeDef | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<HelpTab>('shortcuts');
  // The help panel, on the tab asked for: "?" opens shortcuts, the
  // "What do these mean?" links open the guide to the kinds of connection.
  const openHelp = useCallback((tab: HelpTab = 'shortcuts') => {
    setHelpTab(tab);
    setShortcutsOpen(true);
  }, []);
  const openConnectionGuide = useCallback(() => openHelp('kinds'), [openHelp]);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const verseNetworkRef = useRef<VerseNetworkRef>(null);
  // The guided tour: a welcome on the first visit, and a replay from the menu.
  // `run` remounts it so a replay starts clean.
  const [tour, setTour] = useState<{ startAt: 'welcome' | 'tour'; run: number } | null>(
    () => (shouldWelcome() ? { startAt: 'welcome', run: 0 } : null),
  );
  const takeTour = useCallback(() => {
    setTour((t) => ({ startAt: 'tour', run: (t?.run ?? 0) + 1 }));
  }, []);
  const saveLoadRef = useRef<SaveLoadControlsRef>(null);

  // Each of these runs on mount too, where nothing has really changed.
  // persistWithSignal stamps the settings only when the stored value actually
  // differs, so a mount never registers as an edit and this device does not
  // win every merge just by having loaded last.

  // Persist custom types whenever they change.
  useEffect(() => {
    persistWithSignal(() => saveCustomConnectionTypes(customTypes));
  }, [customTypes]);

  // Persist active filters so they survive reloads.
  useEffect(() => {
    persistWithSignal(() => saveActiveFilters(activeFilters, connectionTypes.map((t) => t.id)));
  }, [activeFilters, connectionTypes]);

  // Apply + persist theme.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    persistWithSignal(() => localStorage.setItem('gita-connects-theme', theme));
  }, [theme]);

  // Settings pulled from another device: adopt them without re-persisting,
  // which would look like a fresh local edit and bounce back to the server.
  const remoteSettings = useRemoteSettingsVersion();
  useEffect(() => {
    if (remoteSettings === 0) return;
    const prefs = readPreferences();
    // Adopting a pull is exactly the "external system changed" case the rule
    // exempts; the version counter is only how the store announces it, so the
    // reads have to happen here rather than in the subscribe callback.
    /* eslint-disable react-hooks/set-state-in-effect */
    setCustomTypes(readCustomTypes());
    setTheme(prefs.theme);
    setActiveFilters(
      loadActiveFilters([...PREDEFINED_CONNECTION_TYPES, ...readCustomTypes()].map((t) => t.id)),
    );
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [remoteSettings]);

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

  const handleExport = useCallback(async (format: ExportFormat, includeNotes: boolean) => {
    const net = verseNetworkRef.current;
    if (!net?.captureImage) throw new Error('Canvas is not ready.');
    const image = await net.captureImage();
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === 'png') {
      downloadDataUrl(`gita-network-${stamp}.png`, image.dataUrl);
    } else {
      const { nodes, edges } = net.getNetworkState();
      const blob = await buildPdf({
        title: 'Gita Connects network',
        image,
        nodes,
        edges,
        connectionTypes: renderableTypes,
        includeNotes,
      });
      downloadBlob(`gita-network-${stamp}.pdf`, blob);
    }
    setExportOpen(false);
    setNoteToast(`Exported ${format.toUpperCase()}`);
  }, [renderableTypes]);

  const handleOpenNote = useCallback((verseId: string) => {
    setSelectedVerseId(verseId);
    setNoteEdit((prev) => ({ verseId, seq: (prev?.seq ?? 0) + 1 }));
  }, []);

  const handleNoteSaved = useCallback((verseId: string) => {
    setNoteToast(`Note saved to ${verseId}`);
  }, []);

  useEffect(() => {
    if (!noteToast) return;
    const t = setTimeout(() => setNoteToast(null), 2500);
    return () => clearTimeout(t);
  }, [noteToast]);

  const handleVerseSelect = useCallback((verseId: string) => {
    setSelectedVerseId(verseId);
    verseNetworkRef.current?.focusNode?.(verseId);
    if (isMobile) {
      setSidebarOpen(false);
    }
  }, [isMobile]);

  // On a phone the chapters list covers the canvas: close it after adding,
  // so the reader sees the verse land.
  const handleAddVerseToNetwork = useCallback((verseId: string) => {
    verseNetworkRef.current?.addVerse(verseId);
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  // "Connect to…" in the verse panel. On a phone the panel makes way for the
  // New connection dialog; on a wide screen it stays open beside it.
  const handleConnectTo = useCallback((fromId: string, toId: string) => {
    if (isMobile) setSelectedVerseId(null);
    verseNetworkRef.current?.connectVerses(fromId, toId);
  }, [isMobile]);

  // A search result goes onto the canvas; one already there is brought into view.
  const handlePlaceFromSearch = useCallback((verseId: string) => {
    if (networkVerses.has(verseId)) verseNetworkRef.current?.focusNode(verseId);
    else verseNetworkRef.current?.addVerse(verseId);
  }, [networkVerses]);

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
        } else if (conceptFilter) {
          setConceptFilter(null);
        }
        return;
      }

      // Cmd/Ctrl+K — jump to the search field (works anywhere)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // Cmd/Ctrl+S — save (works anywhere)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveLoadRef.current?.saveChanges();
        return;
      }

      if (typing) return;

      // "/" — jump to the search field
      if (e.key === '/') {
        e.preventDefault();
        searchRef.current?.focus();
        return;
      }

      // "?" — keyboard shortcuts overlay (the overlay closes itself)
      if (e.key === '?' && !shortcutsOpen) {
        e.preventDefault();
        openHelp('shortcuts');
        return;
      }

      // "B" — browse chapters
      if (e.key.toLowerCase() === 'b' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setSidebarOpen((v) => !v);
        return;
      }

      // "I" — show or hide "What your network says"
      if (e.key.toLowerCase() === 'i' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        toggleInsights();
        return;
      }

      // "N" — note on the open verse (a focused card handles its own N)
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && selectedVerseId) {
        e.preventDefault();
        handleOpenNote(selectedVerseId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedVerseId, shortcutsOpen, conceptFilter, handleOpenNote, toggleInsights, openHelp]);

  // Clicking the active chip again clears the filter.
  const handleConceptSelect = useCallback((concept: string) => {
    setConceptFilter((prev) => (prev === concept ? null : concept));
  }, []);

  const conceptMatchCount = useMemo(
    () => (conceptFilter ? verses.filter((v) => v.concepts.includes(conceptFilter as Concept)).length : 0),
    [conceptFilter],
  );

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

  const handleSetAllFilters = useCallback((active: boolean) => {
    setActiveFilters(active ? new Set(connectionTypes.map((t) => t.id)) : new Set());
  }, [connectionTypes]);

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

  const removeCustomType = useCallback((typeId: string) => {
    setCustomTypes((prev) => {
      const type = prev.find((t) => t.id === typeId);
      if (type) setRetiredTypes((r) => (r.some((t) => t.id === typeId) ? r : [...r, type]));
      return prev.filter((t) => t.id !== typeId);
    });
    // The filter stays on so that an undo shows the restored links.
    verseNetworkRef.current?.removeEdgesByType?.(typeId);
  }, []);

  // Removing a type deletes every canvas edge of that type, so confirm first,
  // naming the count. Nothing to lose → no dialog.
  const edgesOfType = useCallback(
    (typeId: string) => networkEdges.filter((e) => (e.data as { typeId?: string } | undefined)?.typeId === typeId),
    [networkEdges],
  );
  const handleRemoveCustomType = useCallback((typeId: string) => {
    const type = customTypes.find((t) => t.id === typeId);
    if (!type) return;
    if (edgesOfType(typeId).length === 0) {
      removeCustomType(typeId);
      return;
    }
    setTypeToDelete(type);
  }, [customTypes, edgesOfType, removeCustomType]);

  const handleRestoreSession = useCallback(() => {
    if (!pendingRestore) return;
    verseNetworkRef.current?.loadNetwork(pendingRestore.nodes, pendingRestore.edges);
    setPendingRestore(null);
  }, [pendingRestore]);

  const handleStartFresh = useCallback(() => {
    clearAutosave();
    setPendingRestore(null);
  }, []);

  const handleAutosaveStatus = useCallback((status: 'saving' | 'saved') => setAutosaveStatus(status), []);

  // "All changes saved" lingers briefly, then gets out of the way.
  useEffect(() => {
    if (autosaveStatus !== 'saved') return;
    const t = setTimeout(() => setAutosaveStatus('idle'), 2500);
    return () => clearTimeout(t);
  }, [autosaveStatus]);

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
    setRemovedLinksToast(null);
    setClearedToast({ verses, links });
  };

  const undoClear = useCallback(() => {
    setClearedToast(null);
    verseNetworkRef.current?.undo?.();
  }, []);

  const dismissClearedToast = useCallback(() => setClearedToast(null), []);

  const handleEdgesRemoved = useCallback((removed: { source: string; target: string; label: string }[]) => {
    setClearedToast(null);
    setRemovedLinksToast(
      removed.length === 1
        ? `Link removed — ${removed[0].source} → ${removed[0].target} · ${removed[0].label}`
        : `${removed.length} links removed`,
    );
  }, []);
  const undoRemovedLinks = useCallback(() => {
    setRemovedLinksToast(null);
    verseNetworkRef.current?.undo?.();
  }, []);
  const dismissRemovedLinks = useCallback(() => setRemovedLinksToast(null), []);

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

  // The tour needs something to point at: on an empty canvas it lays out a
  // starter set and talks about its hub; otherwise it uses what is there.
  const networkVersesRef = useRef(networkVerses);
  useEffect(() => {
    networkVersesRef.current = networkVerses;
  }, [networkVerses]);
  const beginTour = useCallback(() => {
    setSelectedVerseId(null);
    setMobileMenuOpen(false);
    if (networkVersesRef.current.size > 0) return null;
    return verseNetworkRef.current?.addStarterSet() ?? null;
  }, []);
  // Each stop gets the screen it talks about: the chapters list open for its
  // stop, the verse open for "Read the verse", and the panel out of the way otherwise.
  const enterTourStep = useCallback((stepId: string, focusId: string | null) => {
    if (stepId === 'chapters' && !isMobile) setSidebarOpen(true);
    if (stepId === 'read') {
      const verse = focusId ?? [...networkVersesRef.current][0] ?? null;
      setSelectedVerseId(verse);
      if (isMobile) setSidebarOpen(false);
    } else {
      setSelectedVerseId(null);
    }
  }, [isMobile]);
  const closeTour = useCallback((status: TourStatus) => {
    saveTourStatus(status);
    setTour(null);
  }, []);

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
                {conceptFilter
                  ? `${conceptMatchCount} verse${conceptMatchCount === 1 ? '' : 's'} share this concept`
                  : isMobile
                    ? 'Tap verses to read, or + to add to canvas'
                    : 'Drag verses to explore connections'}
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
              key={conceptFilter ?? 'all'}
              conceptFilter={conceptFilter}
              onConceptSelect={handleConceptSelect}
              onClearConceptFilter={() => setConceptFilter(null)}
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
          {/* Toolbar row: search centred, canvas tools to its right */}
          <div className={`canvas-toolbar ${!sidebarOpen ? 'sidebar-collapsed' : ''}`}>
          <div className="tb-search-slot">
            <SearchField
              ref={searchRef}
              onVerseSelect={handleVerseSelect}
              onAddVerse={handlePlaceFromSearch}
              networkVerses={networkVerses}
            />
          </div>

          {/* Canvas tools, top-right */}
          <div className="canvas-actions">
            <div className="tb-desktop-only">
              <ConnectionFilters
                connectionTypes={connectionTypes}
                activeFilters={activeFilters}
                onToggleFilter={handleToggleFilter}
                onSetAllFilters={handleSetAllFilters}
                onRemoveCustomType={handleRemoveCustomType}
                onAddCustomType={handleAddCustomType}
                networkEdges={networkEdges}
                onShowGuide={openConnectionGuide}
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
            <div className="tb-desktop-only" data-tour="networks">
              <SaveLoadControls
                ref={saveLoadRef}
                getNetworkState={getNetworkState}
                selectedVerseId={selectedVerseId}
                onLoadNetwork={handleLoadNetwork}
                onExport={() => setExportOpen(true)}
                canExport={networkVerses.size > 0}
                onExportUsage={() => downloadJson(`gita-usage-${new Date().toISOString().slice(0, 10)}.json`, collectUsage())}
              />
            </div>
            <div className="tb-desktop-only" data-tour="more">
              <OverflowMenu
                theme={theme}
                onToggleTheme={toggleTheme}
                onClearCanvas={handleClearAll}
                canClear={networkVerses.size > 0}
                onOpenAccount={cloudEnabled ? () => setAccountOpen(true) : undefined}
                accountEmail={session ? accountLabel(session) : null}
                onShowShortcuts={() => openHelp('shortcuts')}
                insightsShown={!insightsHidden}
                onToggleInsights={toggleInsights}
                onTakeTour={takeTour}
              />
            </div>

            {/* Mobile: everything but search lives in a hamburger menu */}
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
                      onSetAllFilters={handleSetAllFilters}
                      onRemoveCustomType={handleRemoveCustomType}
                      onAddCustomType={handleAddCustomType}
                      networkEdges={networkEdges}
                      onShowGuide={openConnectionGuide}
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
                    role="menuitemcheckbox"
                    aria-checked={!insightsHidden}
                    onClick={() => { toggleInsights(); setMobileMenuOpen(false); }}
                  >
                    <Sparkles size={16} /> {insightsHidden ? 'Show' : 'Hide'} what your network says
                  </button>
                  <button
                    className="mobile-menu-item"
                    onClick={() => { takeTour(); setMobileMenuOpen(false); }}
                  >
                    <Compass size={16} /> Take the tour
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

          {autosaveStatus !== 'idle' && networkVerses.size > 0 && !removedLinksToast && !clearedToast && (
            <div
              className={`autosave-pill ${autosaveStatus === 'saving' ? 'is-saving' : ''}`}
              role="status"
              aria-live="polite"
            >
              <Check size={14} />
              {autosaveStatus === 'saving' ? 'Saving…' : 'All changes saved'}
            </div>
          )}
          {noteToast && (
            <div className="note-toast" role="status" aria-live="polite">
              <Check size={15} strokeWidth={2.6} />
              {noteToast}
            </div>
          )}
          {removedLinksToast && !clearedToast && (
            <UndoToast message={removedLinksToast} onUndo={undoRemovedLinks} onDismiss={dismissRemovedLinks} />
          )}
          {clearedToast && (
            <UndoToast
              message={`Canvas cleared — ${clearedToast.verses} ${clearedToast.verses === 1 ? 'verse' : 'verses'}, ${clearedToast.links} ${clearedToast.links === 1 ? 'link' : 'links'}`}
              onUndo={undoClear}
              onDismiss={dismissClearedToast}
            />
          )}

          {pendingRestore && networkVerses.size === 0 && (
            <RestoreSessionCard
              autosave={pendingRestore}
              onRestore={handleRestoreSession}
              onStartFresh={handleStartFresh}
            />
          )}

          {networkVerses.size >= 2 && !insightsHidden && (
            <NetworkInsights
              networkVerses={networkVerses}
              networkEdges={networkEdges}
              connectionTypes={renderableTypes}
              conceptFilter={conceptFilter}
              onConceptSelect={handleConceptSelect}
              onVerseSelect={handleVerseSelect}
              onAddVerse={(id) => verseNetworkRef.current?.addVerse(id)}
              defaultOpen={!isMobile}
              cloudEnabled={cloudEnabled}
              accessToken={session?.access_token ?? null}
              onSignIn={() => setAccountOpen(true)}
              onRetype={(edgeId, typeId) => verseNetworkRef.current?.retypeConnection(edgeId, typeId)}
              onClose={toggleInsights}
              forceOpen={insightsReshown}
            />
          )}

          <div className="network-container">
            <ReactFlowProvider>
              <VerseNetwork
                ref={verseNetworkRef}
                onVerseSelect={handleVerseSelect}
                selectedVerseId={selectedVerseId}
                conceptFilter={conceptFilter}
                onConceptSelect={handleConceptSelect}
                noteVerseIds={noteVerseIds}
                onOpenNote={handleOpenNote}
                activeFilters={activeFilters}
                onToggleFilter={handleToggleFilter}
                onNetworkVersesChange={handleNetworkVersesChange}
                onNetworkEdgesChange={setNetworkEdges}
                connectionTypes={renderableTypes}
                onAddCustomType={handleAddCustomType}
                onAutosaveStatus={handleAutosaveStatus}
                showEmptyState={!pendingRestore}
                hideHints={tour !== null}
                onEdgesRemoved={handleEdgesRemoved}
                sidebarOpen={sidebarOpen}
                onOpenChapters={() => setSidebarOpen(true)}
                onShowHelp={() => openHelp('shortcuts')}
                onShowConnectionGuide={openConnectionGuide}
                isMobile={isMobile}
                theme={theme}
              />
            </ReactFlowProvider>
          </div>
        </div>

        {selectedVerseId && (
          <VerseDetail
            key={`${selectedVerseId}:${noteEdit?.verseId === selectedVerseId ? noteEdit.seq : 0}`}
            startEditingNote={noteEdit?.verseId === selectedVerseId}
            onNoteSaved={handleNoteSaved}
            verseId={selectedVerseId}
            onClose={handleCloseDetail}
            networkVerses={networkVerses}
            onAddToNetwork={handleAddVerseToNetwork}
            onAddSuggestion={(fromId, toId, conn) => verseNetworkRef.current?.addConnection(fromId, toId, conn)}
            connectedNeighbors={connectedNeighbors}
            onNavigate={handleVerseSelect}
            isMobile={isMobile}
            onConnectTo={handleConnectTo}
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

      {accountOpen && <AccountDialog session={session} onClose={() => setAccountOpen(false)} />}
      {exportOpen && (
        <ExportDialog
          verseCount={networkVerses.size}
          linkCount={networkEdges.length}
          noteCount={[...networkVerses].filter((id) => noteVerseIds.has(id)).length}
          onCancel={() => setExportOpen(false)}
          onExport={handleExport}
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

      {typeToDelete && (
        <DeleteLinkTypeDialog
          type={typeToDelete}
          affected={edgesOfType(typeToDelete.id)}
          onCancel={() => setTypeToDelete(null)}
          onConfirm={() => {
            removeCustomType(typeToDelete.id);
            setTypeToDelete(null);
          }}
        />
      )}

      {shortcutsOpen && <ShortcutsOverlay initialTab={helpTab} onClose={() => setShortcutsOpen(false)} />}

      {tour && (
        <GuidedTour
          key={tour.run}
          startAt={tour.startAt}
          isMobile={isMobile}
          onBegin={beginTour}
          onStepEnter={enterTourStep}
          onClose={closeTour}
        />
      )}

    </div>
  );
}

export default App;
