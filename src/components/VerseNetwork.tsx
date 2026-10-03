import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Background,
  MarkerType,
  Panel,
  useReactFlow,
  useStore,
  type Node,
  type Edge,
  type Connection as RFConnection,
  type NodeTypes,
  type EdgeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { X, MousePointer2, Undo2, Redo2, BookOpen, CircleHelp } from 'lucide-react';
import { verses, connections } from '../data/index.js';
import { expandableNeighbors, edgesJoining } from '../neighbors.js';
import { pickStarterSet } from '../starterSet.js';
import VerseNode from './VerseNode.js';
import ConnectionEdge from './ConnectionEdge.js';
import { captureCanvas, type CanvasImage } from '../exportNetwork.js';
import ConnectionDialog from './ConnectionDialog.js';
import ConnectionLine from './ConnectionLine.js';
import { ConnectTargetContext, type ConnectTarget } from './connectTarget.js';
import SnapBack from './SnapBack.js';
import ZoomControls from './ZoomControls.js';
import type { ConnectionTypeDef } from '../connectionTypes.js';
import type { Verse } from '../types.js';
import type { Concept } from '../concepts.js';
import { getTypeColor, getTypeLabel, isDirectionalType } from '../connectionTypes.js';
import { writeAutosave } from '../autosave.js';
import { useMediaQuery } from '../hooks/useMediaQuery.js';
import './VerseNetwork.css';

interface VerseNetworkProps {
  onVerseSelect: (verseId: string) => void;
  selectedVerseId: string | null;
  /** Concept chip acting as a filter (App 23): non-matching cards fade back. */
  conceptFilter?: string | null;
  onConceptSelect?: (concept: string) => void;
  /** Verses with a personal note (App 29) and the way to open one. */
  noteVerseIds?: ReadonlySet<string>;
  onOpenNote?: (verseId: string) => void;
  activeFilters: Set<string>;
  onToggleFilter?: (type: string) => void;
  onNetworkVersesChange: (verses: Set<string>) => void;
  onNetworkEdgesChange?: (edges: Edge[]) => void;
  connectionTypes: ConnectionTypeDef[];
  onAddCustomType: (type: ConnectionTypeDef) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  /** Autosave lifecycle: 'saving' while a write is pending, 'saved' after. */
  onAutosaveStatus?: (status: 'saving' | 'saved') => void;
  /** Hide the empty-state card (e.g. while a restore prompt is showing). */
  showEmptyState?: boolean;
  /** Links the reader just removed (popover or Delete key), for an undo toast. */
  onEdgesRemoved?: (removed: { source: string; target: string; label: string }[]) => void;
  /** Whether the chapters sidebar is open — the empty state's copy depends on it. */
  sidebarOpen?: boolean;
  onOpenChapters?: () => void;
  /** Opens the keyboard shortcuts / help overlay from the ? button. */
  onShowHelp?: () => void;
  isMobile?: boolean;
  theme?: 'light' | 'dark';
}

export interface VerseNetworkRef {
  handleAutoArrange: () => void;
  handleClearAll: () => void;
  getNetworkState: () => { nodes: Node[]; edges: Edge[] };
  loadNetwork: (nodes: Node[], edges: Edge[]) => void;
  removeEdgesByType?: (typeId: string) => void;
  undo: () => void;
  redo: () => void;
  focusNode: (verseId: string) => void;
  /** Render the whole canvas to a PNG data URL, framed to the cards. */
  captureImage: () => Promise<CanvasImage>;
  addVerse: (verseId: string) => void;
  /** Change a connection's type in place (undoable); it redraws in the new colour. */
  retypeConnection: (edgeId: string, typeId: string) => void;
  addConnection: (
    fromId: string,
    toId: string,
    conn: { type: string; description: string; strength: number },
  ) => void;
}

const nodeTypes: NodeTypes = {
  verseNode: VerseNode,
};

const edgeTypes: EdgeTypes = {
  connectionEdge: ConnectionEdge,
};

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::');
}

const CONNECT_HINT_KEY = 'gita-connects-connect-hint-dismissed';

// Scholarly links that arrive with a verse draw in this far apart...
const FAN_OUT_STEP_MS = 60;
// ...unless there are so many that the last would start later than this.
const FAN_OUT_MAX_MS = 900;

// Grid spacing for manually placed nodes (expand / drop / starter).
// Compact cards are ~320 wide / ~340 tall.
const COL_SPACING = 460;
const ROW_SPACING = 480;

// Place a new batch to the right of all existing nodes so cards never
// stack on top of the current graph, however many are already present.
function nextPlacementOrigin(nodes: Node[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 150, y: 120 };
  let maxRight = -Infinity;
  let minTop = Infinity;
  nodes.forEach((n) => {
    maxRight = Math.max(maxRight, n.position.x + (n.width || 320));
    minTop = Math.min(minTop, n.position.y);
  });
  return { x: maxRight + 120, y: minTop };
}

function buildEdge(
  conn: { from: string; to: string; type: string; description: string; strength: number },
  connectionTypes: ConnectionTypeDef[],
  idSuffix?: string,
): Edge {
  const color = getTypeColor(connectionTypes, conn.type);
  const label = getTypeLabel(connectionTypes, conn.type);
  const baseId = `${conn.from}-${conn.to}-${conn.type}`;
  return {
    id: idSuffix ? `${baseId}-${idSuffix}` : baseId,
    source: conn.from,
    target: conn.to,
    type: 'connectionEdge',
    animated: false,
    // Directional relations (sequential, progression, goal) point from the
    // earlier or more basic verse to the later or resolving one.
    markerEnd: isDirectionalType(connectionTypes, conn.type)
      ? { type: MarkerType.Arrow, color, width: 16, height: 16, strokeWidth: 1.6 }
      : undefined,
    label,
    style: {
      stroke: color,
      strokeWidth: Math.max(1, conn.strength / 3),
    },
    data: {
      typeId: conn.type,
      description: conn.description,
      strength: conn.strength,
      color,
    },
  };
}

const VerseNetwork = forwardRef<VerseNetworkRef, VerseNetworkProps>(
  (
    {
      onVerseSelect,
      selectedVerseId,
      conceptFilter = null,
      onConceptSelect,
      noteVerseIds,
      onOpenNote,
      activeFilters,
      onNetworkVersesChange,
      onNetworkEdgesChange,
      connectionTypes,
      onAddCustomType,
      onHistoryChange,
      onAutosaveStatus,
      showEmptyState = true,
      onEdgesRemoved,
      sidebarOpen = true,
      onOpenChapters,
      onShowHelp,
      isMobile = false,
      theme = 'light',
    },
    ref,
  ) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [allEdges, setAllEdges] = useState<Edge[]>([]);
    const [networkVerses, setNetworkVerses] = useState<Set<string>>(new Set());
    const [pendingConnection, setPendingConnection] = useState<{
      source: string;
      target: string;
    } | null>(null);
    // A connection the reader just made: both verses pulse once in the
    // type's color (its line draws in through drawingIn below). Cleared once
    // the animation is over, so undo, filters and later redraws never replay it.
    const [justConnected, setJustConnected] = useState<{
      source: string;
      target: string;
      color: string;
    } | null>(null);
    useEffect(() => {
      if (!justConnected) return;
      const t = setTimeout(() => setJustConnected(null), 1600);
      return () => clearTimeout(t);
    }, [justConnected]);

    // Lines that draw themselves in, keyed by node pair, with each line's
    // start delay. A verse that arrives with scholarly links fans them out
    // one after another instead of dropping them all at once.
    const [drawingIn, setDrawingIn] = useState<Map<string, number> | null>(null);
    useEffect(() => {
      if (!drawingIn) return;
      const last = Math.max(0, ...drawingIn.values());
      const t = setTimeout(() => setDrawingIn(null), last + 1600);
      return () => clearTimeout(t);
    }, [drawingIn]);
    const drawIn = useCallback((links: { source: string; target: string }[]) => {
      const pairs = [...new Set(links.map((l) => pairKey(l.source, l.target)))];
      if (pairs.length === 0) return;
      // A big batch (starter set) tightens the spacing so the whole fan-out
      // still lands in under a second.
      const step = Math.min(FAN_OUT_STEP_MS, FAN_OUT_MAX_MS / pairs.length);
      setDrawingIn(new Map(pairs.map((p, i) => [p, Math.round(i * step)])));
    }, []);
    const expandRef = useRef<(verseId: string) => void>(() => {});
    const { fitView, setCenter } = useReactFlow();

    // Mirror live state into refs so history snapshots avoid stale closures.
    const nodesRef = useRef(nodes);
    const allEdgesRef = useRef(allEdges);
    const netRef = useRef(networkVerses);
    useEffect(() => {
      nodesRef.current = nodes;
      allEdgesRef.current = allEdges;
      netRef.current = networkVerses;
    });

    type Snapshot = { nodes: Node[]; edges: Edge[]; verses: string[] };
    const historyRef = useRef<{ past: Snapshot[]; future: Snapshot[] }>({
      past: [],
      future: [],
    });
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const snapshot = useCallback(
      (): Snapshot => ({
        nodes: nodesRef.current,
        edges: allEdgesRef.current,
        verses: [...netRef.current],
      }),
      [],
    );

    // Record current state before a mutation so it can be undone.
    const commit = useCallback(() => {
      const h = historyRef.current;
      h.past.push(snapshot());
      if (h.past.length > 50) h.past.shift();
      h.future = [];
      setCanUndo(true);
      setCanRedo(false);
    }, [snapshot]);

    const restore = useCallback(
      (snap: Snapshot) => {
        setNodes(snap.nodes);
        setAllEdges(snap.edges);
        setNetworkVerses(new Set(snap.verses));
      },
      [setNodes, setAllEdges],
    );

    const undo = useCallback(() => {
      const h = historyRef.current;
      if (h.past.length === 0) return;
      h.future.push(snapshot());
      restore(h.past.pop()!);
      setCanUndo(h.past.length > 0);
      setCanRedo(true);
    }, [snapshot, restore]);

    const redo = useCallback(() => {
      const h = historyRef.current;
      if (h.future.length === 0) return;
      h.past.push(snapshot());
      restore(h.future.pop()!);
      setCanRedo(h.future.length > 0);
      setCanUndo(true);
    }, [snapshot, restore]);

    useEffect(() => {
      onNetworkVersesChange(networkVerses);
    }, [networkVerses, onNetworkVersesChange]);

    useEffect(() => {
      onNetworkEdgesChange?.(allEdges);
    }, [allEdges, onNetworkEdgesChange]);

    useEffect(() => {
      onHistoryChange?.(canUndo, canRedo);
    }, [canUndo, canRedo, onHistoryChange]);

    // Autosave: write the canvas shortly after it settles. An empty canvas
    // only clears the store once this session has actually held content —
    // otherwise the initial mount (run twice under StrictMode) would wipe a
    // restore that is still waiting for the user's answer.
    const hadContent = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
      if (nodes.length === 0 && !hadContent.current) return;
      hadContent.current = true;
      onAutosaveStatus?.('saving');
      const t = setTimeout(() => {
        writeAutosave(nodesRef.current, allEdgesRef.current);
        onAutosaveStatus?.('saved');
      }, 800);
      return () => clearTimeout(t);
    }, [nodes, allEdges, onAutosaveStatus]);

    useEffect(() => {
      const onKey = (e: KeyboardEvent) => {
        if (!(e.metaKey || e.ctrlKey)) return;
        if (e.key.toLowerCase() !== 'z') return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }, [undo, redo]);

    // One-time onboarding hint: handle-to-handle dragging is invisible until
    // you know it exists. Shown once there are 2+ verses, gone forever after
    // the first manual connection (or explicit dismiss).
    const [connectHintDismissed, setConnectHintDismissed] = useState(
      () => localStorage.getItem(CONNECT_HINT_KEY) === '1',
    );
    const dismissConnectHint = useCallback(() => {
      setConnectHintDismissed(true);
      try {
        localStorage.setItem(CONNECT_HINT_KEY, '1');
      } catch {
        // Hint just reappears next session — not worth surfacing.
      }
    }, []);

    // While a connection is dragged: which verse it came from, and which
    // card is under the pointer (or whose top dot it has snapped to). Any
    // card is a drop target, not just its dot.
    const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
    const [connectTarget, setConnectTarget] = useState<ConnectTarget>(null);
    const connectTargetRef = useRef<ConnectTarget>(null);
    const madeConnectionRef = useRef(false);
    const snappedNodeId = useStore((s) => s.connectionEndHandle?.nodeId ?? null);
    const pointerNodeIdRef = useRef<string | null>(null);
    // A drag that did not land: its line reels back, and a drop on the
    // verse's own card shakes that card.
    const [snapBack, setSnapBack] = useState<{
      from: string;
      x: number;
      y: number;
      reject: boolean;
      key: number;
    } | null>(null);
    const [shakeId, setShakeId] = useState<string | null>(null);
    useEffect(() => {
      if (!shakeId) return;
      const t = setTimeout(() => setShakeId(null), 450);
      return () => clearTimeout(t);
    }, [shakeId]);
    const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');

    const updateConnectTarget = useCallback(() => {
      const from = connectingFrom;
      const id = pointerNodeIdRef.current ?? snappedNodeId;
      const next: ConnectTarget = from && id ? { id, valid: id !== from } : null;
      const prev = connectTargetRef.current;
      if (prev?.id === next?.id && prev?.valid === next?.valid) return;
      connectTargetRef.current = next;
      setConnectTarget(next);
    }, [connectingFrom, snappedNodeId]);

    useEffect(() => {
      updateConnectTarget();
    }, [updateConnectTarget]);

    useEffect(() => {
      if (!connectingFrom) return;
      const onMove = (e: PointerEvent) => {
        const card = document.elementFromPoint(e.clientX, e.clientY)?.closest('.react-flow__node');
        pointerNodeIdRef.current = card?.getAttribute('data-id') ?? null;
        updateConnectTarget();
      };
      window.addEventListener('pointermove', onMove);
      return () => window.removeEventListener('pointermove', onMove);
    }, [connectingFrom, updateConnectTarget]);

    const onConnectStart = useCallback(
      (_event: React.MouseEvent | React.TouchEvent, { nodeId }: { nodeId: string | null }) => {
        madeConnectionRef.current = false;
        pointerNodeIdRef.current = null;
        setConnectingFrom(nodeId);
      },
      [],
    );

    const onConnect = useCallback((params: RFConnection) => {
      if (!params.source || !params.target) return;
      if (params.source === params.target) return;
      madeConnectionRef.current = true;
      dismissConnectHint();
      setPendingConnection({ source: params.source, target: params.target });
    }, [dismissConnectHint]);

    // React Flow only connects when the drop lands on (or snaps to) a dot.
    // Finish the drop ourselves when it lands anywhere on another card, and
    // reel the line back when it lands nowhere useful.
    const onConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
      const from = connectingFrom;
      const target = connectTargetRef.current;
      setConnectingFrom(null);
      connectTargetRef.current = null;
      setConnectTarget(null);
      pointerNodeIdRef.current = null;
      if (!from || madeConnectionRef.current) return;

      if (target?.valid) {
        dismissConnectHint();
        setPendingConnection({ source: from, target: target.id });
        return;
      }
      if (reduceMotion) return;
      const reject = target?.id === from;
      if (reject) setShakeId(from);
      const point = 'changedTouches' in event ? event.changedTouches[0] : event;
      if (!point) return;
      setSnapBack({ from, x: point.clientX, y: point.clientY, reject, key: Date.now() });
    }, [connectingFrom, dismissConnectHint, reduceMotion]);

    // Types already linking the pair being connected; the dialog greys them
    // out instead of silently ignoring a duplicate.
    const linkedTypeIds = useMemo(() => {
      if (!pendingConnection) return [];
      const key = pairKey(pendingConnection.source, pendingConnection.target);
      return allEdges
        .filter((e) => pairKey(e.source, e.target) === key)
        .map((e) => (e.data?.typeId as string | undefined) ?? (e.label as string));
    }, [pendingConnection, allEdges]);

    const handleConfirmConnection = useCallback(
      ({
        typeId,
        description,
        strength,
        newType,
      }: {
        typeId: string;
        description: string;
        strength: number;
        newType?: ConnectionTypeDef;
      }) => {
        if (!pendingConnection) return;

        // Same pair + same type already connected — adding again would just
        // pile an invisible duplicate under the collapsed chip.
        const exists = allEdgesRef.current.some((e) => {
          const t = (e.data?.typeId as string | undefined) ?? (e.label as string);
          return t === typeId &&
            pairKey(e.source, e.target) === pairKey(pendingConnection.source, pendingConnection.target);
        });
        if (exists) {
          setPendingConnection(null);
          return;
        }
        commit();

        if (newType) {
          onAddCustomType(newType);
        }

        const effectiveTypes = newType
          ? [...connectionTypes, newType]
          : connectionTypes;

        const newEdge = buildEdge(
          {
            from: pendingConnection.source,
            to: pendingConnection.target,
            type: typeId,
            description,
            strength,
          },
          effectiveTypes,
          `user-${Date.now().toString(36)}`,
        );

        setAllEdges((eds) => [...eds, newEdge]);
        drawIn([newEdge]);
        setJustConnected({
          source: newEdge.source,
          target: newEdge.target,
          color: getTypeColor(effectiveTypes, typeId),
        });
        setPendingConnection(null);
      },
      [pendingConnection, connectionTypes, onAddCustomType, commit, drawIn],
    );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleRemoveNode = useCallback(
    (verseId: string) => {
      commit();
      setNodes((nds) => nds.filter((node) => node.id !== verseId));
      setAllEdges((eds) => eds.filter((edge) => edge.source !== verseId && edge.target !== verseId));
      setNetworkVerses((prev) => {
        const updated = new Set(prev);
        updated.delete(verseId);
        return updated;
      });
      if (selectedVerseId === verseId) {
        onVerseSelect('');
      }
    },
    [selectedVerseId, onVerseSelect, setNodes, setAllEdges, commit],
  );

  const handleNodesDelete = useCallback(
    (deleted: Node[]) => {
      deleted.forEach((node) => handleRemoveNode(node.id));
    },
    [handleRemoveNode],
  );

  const handleClearAll = useCallback(() => {
    if (nodesRef.current.length === 0) return;
    commit();
    setNodes([]);
    setAllEdges([]);
    setNetworkVerses(new Set());
    onVerseSelect('');
  }, [setNodes, setAllEdges, onVerseSelect, commit]);

  const handleAutoArrange = useCallback(async () => {
    // dagre is only needed here — load it on demand to keep it out of the
    // main bundle.
    const dagre = (await import('dagre')).default;
    commit();
    setNodes((nds) => {
      if (nds.length === 0) return nds;

      const NODE_W = 320;
      const NODE_H = 340;
      // Extra breathing room so cards never crowd each other.
      const GAP_X = 90;
      const GAP_Y = 80;

      const g = new dagre.graphlib.Graph();
      g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 150, marginx: 120, marginy: 120 });
      g.setDefaultEdgeLabel(() => ({}));

      nds.forEach((node) => {
        // Pad measured size so dagre reserves space for the real card footprint.
        g.setNode(node.id, {
          width: (node.width || NODE_W) + GAP_X,
          height: (node.height || NODE_H) + GAP_Y,
        });
      });

      const ids = new Set(nds.map((n) => n.id));
      allEdgesRef.current.forEach((e) => {
        if (ids.has(e.source) && ids.has(e.target)) {
          g.setEdge(e.source, e.target);
        }
      });

      dagre.layout(g);

      return nds.map((node) => {
        const pos = g.node(node.id);
        const w = node.width || NODE_W;
        const h = node.height || NODE_H;
        return {
          ...node,
          position: { x: pos.x - w / 2, y: pos.y - h / 2 },
        };
      });
    });

    setTimeout(() => {
      fitView({ duration: 400, padding: 0.2, maxZoom: 1 });
    }, 50);
  }, [setNodes, fitView, commit]);

  const handleExpandNetwork = useCallback((verseId: string) => {
    // Authored links when the verse has any; its top suggestions otherwise.
    const links = expandableNeighbors(verseId, networkVerses);
    const connectedVerseIds = links.map((l) => l.id);

    if (connectedVerseIds.length === 0) return;
    commit();

    setNodes((currentNodes) => {
      const origin = nextPlacementOrigin(currentNodes);
      const willBeOnCanvas = new Set([...networkVerses, ...connectedVerseIds]);

      const newNodes: Node[] = connectedVerseIds.map((vId, index) => {
        const verse = verses.find(v => v.id === vId);
        if (!verse) return null;

        return {
          id: vId,
          type: 'verseNode',
          position: {
            x: origin.x + (index % 3) * COL_SPACING,
            y: origin.y + Math.floor(index / 3) * ROW_SPACING,
          },
          data: {
            verse,
            onSelect: () => onVerseSelect(vId),
            onRemove: () => handleRemoveNode(vId),
            onExpand: () => expandRef.current(vId),
            isSelected: selectedVerseId === vId,
            connectedCount: expandableNeighbors(vId, willBeOnCanvas).length,
          },
        };
      }).filter(Boolean) as Node[];

      return [...currentNodes, ...newNodes];
    });

    const newEdges: Edge[] = links.map((l) => buildEdge(l.connection, connectionTypes));

    setAllEdges((eds) => [...eds, ...newEdges]);
    drawIn(newEdges);
    setNetworkVerses(prev => new Set([...prev, ...connectedVerseIds]));

    setTimeout(() => {
      fitView({ duration: 400, padding: 0.2, maxZoom: 1 });
    }, 100);
  }, [networkVerses, selectedVerseId, onVerseSelect, handleRemoveNode, setNodes, setAllEdges, fitView, connectionTypes, commit, drawIn]);

  useEffect(() => {
    expandRef.current = handleExpandNetwork;
  }, [handleExpandNetwork]);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const verseId = event.dataTransfer.getData('verseId');
      if (!verseId || networkVerses.has(verseId)) return;

      const verse = verses.find(v => v.id === verseId);
      if (!verse) return;
      commit();

      const reactFlowBounds = event.currentTarget.getBoundingClientRect();
      const position = {
        x: event.clientX - reactFlowBounds.left - 100,
        y: event.clientY - reactFlowBounds.top - 50,
      };

      const connectedCount = expandableNeighbors(verseId, networkVerses).length;

      const newNode: Node = {
        id: verseId,
        type: 'verseNode',
        position,
        data: {
          verse,
          onSelect: () => onVerseSelect(verseId),
          onRemove: () => handleRemoveNode(verseId),
          onExpand: () => expandRef.current(verseId),
          isSelected: selectedVerseId === verseId,
          connectedCount,
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setNetworkVerses(prev => new Set([...prev, verseId]));

      const newEdges: Edge[] = edgesJoining([verseId], networkVerses).map((c) =>
        buildEdge(c, connectionTypes),
      );

      if (newEdges.length > 0) {
        setAllEdges((eds) => [...eds, ...newEdges]);
        drawIn(newEdges);
      }
    },
    [networkVerses, setNodes, setAllEdges, onVerseSelect, selectedVerseId, handleRemoveNode, connectionTypes, commit, drawIn],
  );

  // Add a batch of verses (used by starter buttons), wiring edges between
  // any newly added verse and verses already (or also being) in the network.
  const addVerses = useCallback(
    (ids: string[]) => {
      const toAdd = ids.filter(
        (id) => !netRef.current.has(id) && verses.some((v) => v.id === id),
      );
      if (toAdd.length === 0) return;
      commit();

      const finalSet = new Set([...netRef.current, ...toAdd]);
      const origin = nextPlacementOrigin(nodesRef.current);

      const newNodes: Node[] = toAdd
        .map((vId, i) => {
          const verse = verses.find((v) => v.id === vId);
          if (!verse) return null;
          const connectedCount = expandableNeighbors(vId, finalSet).length;
          return {
            id: vId,
            type: 'verseNode',
            position: {
              x: origin.x + (i % 3) * COL_SPACING,
              y: origin.y + Math.floor(i / 3) * ROW_SPACING,
            },
            data: {
              verse,
              onSelect: () => onVerseSelect(vId),
              onRemove: () => handleRemoveNode(vId),
              onExpand: () => expandRef.current(vId),
              isSelected: selectedVerseId === vId,
              connectedCount,
            },
          } as Node;
        })
        .filter(Boolean) as Node[];

      setNodes((nds) => [...nds, ...newNodes]);

      const existing = new Set([...finalSet].filter((id) => !toAdd.includes(id)));
      const newEdges: Edge[] = edgesJoining(toAdd, existing).map((c) => buildEdge(c, connectionTypes));
      if (newEdges.length > 0) {
        setAllEdges((eds) => [...eds, ...newEdges]);
        drawIn(newEdges);
      }

      setNetworkVerses(finalSet);
      setTimeout(() => fitView({ duration: 400, padding: 0.2, maxZoom: 1 }), 100);
    },
    [onVerseSelect, handleRemoveNode, selectedVerseId, connectionTypes, setNodes, setAllEdges, fitView, commit, drawIn],
  );

  const addVerse = useCallback((verseId: string) => addVerses([verseId]), [addVerses]);

  // Add a (possibly suggested) connection: ensure both verses are on the
  // canvas, then create the edge. Skips exact duplicate pair+type.
  const addConnection = useCallback(
    (
      fromId: string,
      toId: string,
      conn: { type: string; description: string; strength: number },
    ) => {
      if (fromId === toId) return;
      commit();

      const finalSet = new Set(netRef.current);
      const origin = nextPlacementOrigin(nodesRef.current);
      const newNodes: Node[] = [];
      [fromId, toId].forEach((vId) => {
        if (finalSet.has(vId)) return;
        const verse = verses.find((v) => v.id === vId);
        if (!verse) return;
        newNodes.push({
          id: vId,
          type: 'verseNode',
          position: {
            x: origin.x + newNodes.length * COL_SPACING,
            y: origin.y,
          },
          data: {
            verse,
            onSelect: () => onVerseSelect(vId),
            onRemove: () => handleRemoveNode(vId),
            onExpand: () => expandRef.current(vId),
            isSelected: selectedVerseId === vId,
            connectedCount: 0,
          },
        } as Node);
        finalSet.add(vId);
      });

      if (newNodes.length > 0) setNodes((nds) => [...nds, ...newNodes]);

      const newEdge = buildEdge(
        { from: fromId, to: toId, type: conn.type, description: conn.description, strength: conn.strength },
        connectionTypes,
        `suggested-${Date.now().toString(36)}`,
      );
      const exists = allEdgesRef.current.some((e) => {
        const t = (e.data?.typeId as string | undefined) ?? (e.label as string);
        return t === conn.type && pairKey(e.source, e.target) === pairKey(fromId, toId);
      });
      if (!exists) {
        setAllEdges((eds) => [...eds, newEdge]);
        drawIn([newEdge]);
        setJustConnected({
          source: fromId,
          target: toId,
          color: getTypeColor(connectionTypes, conn.type),
        });
      }

      setNetworkVerses(finalSet);
      setTimeout(() => fitView({ duration: 400, padding: 0.2, maxZoom: 1 }), 120);
    },
    [commit, onVerseSelect, handleRemoveNode, selectedVerseId, connectionTypes, setNodes, setAllEdges, fitView, drawIn],
  );

  const handleAddRandom = useCallback(() => {
    const available = verses.filter((v) => !netRef.current.has(v.id));
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    addVerses([pick.id]);
  }, [addVerses]);

  const handleAddStarterSet = useCallback(() => {
    const set = pickStarterSet(connections);
    if (set.length === 0) return;
    addVerses(set);
    // Auto-arrange once the new nodes have mounted.
    setTimeout(() => handleAutoArrange(), 120);
  }, [addVerses, handleAutoArrange]);

  // Re-apply current registry styling, filter, and parallel-edge offsets
  // entirely in derived state so labels never overlap and color tweaks
  // propagate immediately.
  // Single removal path for links: popover "Remove connection" and the
  // Delete/Backspace key both land here, so both are undoable and both
  // raise the toast.
  const removeEdges = useCallback((edgeIds: string[]) => {
    const ids = new Set(edgeIds);
    const removed = allEdgesRef.current.filter((e) => ids.has(e.id));
    if (removed.length === 0) return;
    commit();
    setAllEdges((eds) => eds.filter((e) => !ids.has(e.id)));
    onEdgesRemoved?.(
      removed.map((e) => ({
        source: e.source,
        target: e.target,
        label: getTypeLabel(connectionTypes, (e.data?.typeId as string | undefined) ?? (e.label as string) ?? ''),
      })),
    );
  }, [commit, connectionTypes, onEdgesRemoved]);

  const handleDeleteEdge = useCallback((edgeId: string) => removeEdges([edgeId]), [removeEdges]);

  const filteredEdges = useMemo(() => {
    const enabled = allEdges.filter((edge) => {
      const typeId = (edge.data?.typeId as string | undefined) ?? (edge.label as string);
      return activeFilters.has(typeId);
    });

    // Collapse to one chip per node-pair: when a pair carries several
    // connection types, keep only the strongest so the canvas never shows
    // stacked chips between the same two verses.
    const strongestByPair = new Map<string, Edge>();
    enabled.forEach((e) => {
      const key = pairKey(e.source, e.target);
      const current = strongestByPair.get(key);
      const strength = (e.data?.strength as number | undefined) ?? 0;
      const currentStrength = (current?.data?.strength as number | undefined) ?? -1;
      if (!current || strength > currentStrength) {
        strongestByPair.set(key, e);
      }
    });

    const spotlight = !!selectedVerseId && networkVerses.has(selectedVerseId);

    return [...strongestByPair.values()].map((edge) => {
      const typeId = (edge.data?.typeId as string | undefined) ?? (edge.label as string);
      const color = getTypeColor(connectionTypes, typeId);
      const label = getTypeLabel(connectionTypes, typeId);
      const dimmed =
        spotlight && edge.source !== selectedVerseId && edge.target !== selectedVerseId;
      return {
        ...edge,
        label,
        style: { ...edge.style, stroke: color, opacity: dimmed ? 0.12 : 1 },
        // Only directional relations get an arrowhead; this pass rebuilds
        // every edge, so it must decide again rather than inherit.
        markerEnd: isDirectionalType(connectionTypes, typeId)
          ? { type: MarkerType.Arrow, color, width: 16, height: 16, strokeWidth: 1.6 }
          : undefined,
        data: {
          ...edge.data,
          color,
          dimmed,
          parallelIndex: 0,
          parallelTotal: 1,
          onDelete: handleDeleteEdge,
          drawDelay: drawingIn?.get(pairKey(edge.source, edge.target)),
          // The selected verse's own lines come alive: beads travel along
          // directional ones, the rest breathe.
          flowing:
            spotlight && (edge.source === selectedVerseId || edge.target === selectedVerseId),
          directional: isDirectionalType(connectionTypes, typeId),
        },
      };
    });
  }, [allEdges, activeFilters, connectionTypes, handleDeleteEdge, selectedVerseId, networkVerses, drawingIn]);

  useEffect(() => {
    setEdges(filteredEdges);
  }, [filteredEdges, setEdges]);

  useEffect(() => {
    setNodes((nds) => {
      // When the selected verse is on the canvas, spotlight it: direct
      // neighbors stay lit, everything else dims.
      const spotlight = !!selectedVerseId && nds.some((n) => n.id === selectedVerseId);
      const neighbors = new Set<string>();
      if (spotlight) {
        allEdges.forEach((e) => {
          if (e.source === selectedVerseId) neighbors.add(e.target);
          if (e.target === selectedVerseId) neighbors.add(e.source);
        });
      }

      return nds.map((node) => {
        const connectedCount = expandableNeighbors(node.id, networkVerses).length;

        const concepts = (node.data?.verse as Verse | undefined)?.concepts ?? [];
        const offConcept = !!conceptFilter && !concepts.includes(conceptFilter as Concept);
        const dimmed =
          offConcept || (spotlight && node.id !== selectedVerseId && !neighbors.has(node.id));

        const theme = (node.data?.verse as Verse | undefined)?.theme;
        return {
          ...node,
          className: dimmed ? 'node-dimmed' : '',
          ariaLabel: theme ? `Verse ${node.id}, ${theme}` : `Verse ${node.id}`,
          data: {
            ...node.data,
            isSelected: node.id === selectedVerseId,
            connectedCount,
            conceptFilter,
            onConceptSelect,
            hasNote: noteVerseIds?.has(node.id) ?? false,
            onOpenNote: onOpenNote ? () => onOpenNote(node.id) : undefined,
            connectPulse:
              justConnected?.source === node.id ? 'source'
                : justConnected?.target === node.id ? 'target'
                  : null,
            pulseColor: justConnected?.color,
            connectHover: connectTarget?.id === node.id ? (connectTarget.valid ? 'valid' : 'invalid') : null,
            connectReject: shakeId === node.id,
          },
        };
      });
    });
  }, [selectedVerseId, networkVerses, allEdges, setNodes, conceptFilter, onConceptSelect, noteVerseIds, onOpenNote, justConnected, connectTarget, shakeId]);

  const getNetworkState = useCallback(() => {
    return { nodes, edges: allEdges };
  }, [nodes, allEdges]);

  const loadNetwork = useCallback((loadedNodes: Node[], loadedEdges: Edge[]) => {
    setNodes([]);
    setAllEdges([]);
    setNetworkVerses(new Set());
    onVerseSelect('');

    setTimeout(() => {
      // Saved nodes went through JSON.stringify, which dropped the data
      // callbacks — rebuild them (and re-resolve the verse) on hydrate.
      // Skip ids that no longer exist in the dataset.
      const hydrated = loadedNodes.flatMap((node) => {
        const verse = verses.find((v) => v.id === node.id);
        if (!verse) return [];
        return [{
          ...node,
          data: {
            ...node.data,
            verse,
            onSelect: () => onVerseSelect(node.id),
            onRemove: () => handleRemoveNode(node.id),
            onExpand: () => expandRef.current(node.id),
          },
        }];
      });
      const verseIds = new Set(hydrated.map((node) => node.id));

      setNodes(hydrated);
      setAllEdges(loadedEdges.filter((e) => verseIds.has(e.source) && verseIds.has(e.target)));
      setNetworkVerses(verseIds);

      setTimeout(() => {
        fitView({ duration: 400, padding: 0.2, maxZoom: 1 });
      }, 100);
    }, 50);
  }, [setNodes, setAllEdges, onVerseSelect, handleRemoveNode, fitView]);

  // Pan + zoom the canvas to a node when it exists in the network.
  const focusNode = useCallback(
    (verseId: string) => {
      const node = nodesRef.current.find((n) => n.id === verseId);
      if (!node) return;
      const w = node.width || 320;
      const h = node.height || 340;
      setCenter(node.position.x + w / 2, node.position.y + h / 2, {
        zoom: 0.85,
        duration: 600,
      });
    },
    [setCenter],
  );

  // Keyboard on a focused card (App 24): Enter opens it, Delete removes it,
  // arrows move focus to the linked card nearest in that direction. Capture
  // phase so React Flow's own handlers (which would nudge the node) stay out.
  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (!active || !active.classList.contains('react-flow__node')) return;
      const id = active.dataset.id;
      if (!id) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        onVerseSelect(id);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        e.stopPropagation();
        handleRemoveNode(id);
        return;
      }
      if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && onOpenNote) {
        e.preventDefault();
        e.stopPropagation();
        onOpenNote(id);
        return;
      }
      const axis = e.key === 'ArrowLeft' || e.key === 'ArrowRight' ? 'x' : e.key === 'ArrowUp' || e.key === 'ArrowDown' ? 'y' : null;
      if (!axis) return;
      e.preventDefault();
      e.stopPropagation();

      const current = nodesRef.current.find((n) => n.id === id);
      if (!current) return;
      const linkedIds = new Set<string>();
      allEdgesRef.current.forEach((edge) => {
        if (edge.source === id) linkedIds.add(edge.target);
        if (edge.target === id) linkedIds.add(edge.source);
      });
      const linked = nodesRef.current.filter((n) => linkedIds.has(n.id));
      if (linked.length === 0) return;

      const forward = e.key === 'ArrowRight' || e.key === 'ArrowDown';
      const pos = (n: Node) => n.position[axis];
      const ahead = linked.filter((n) => (forward ? pos(n) > pos(current) : pos(n) < pos(current)));
      // Nearest card in that direction; wrap to the far side when none lies ahead.
      const pool = ahead.length > 0 ? ahead : linked;
      const target = pool.reduce((best, n) =>
        forward ? (pos(n) < pos(best) ? n : best) : (pos(n) > pos(best) ? n : best),
      );
      const el = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${target.id}"]`);
      el?.focus();
    },
    [onVerseSelect, handleRemoveNode, onOpenNote],
  );

  const removeEdgesByType = useCallback((typeId: string) => {
    commit();
    setAllEdges((eds) =>
      eds.filter((edge) => {
        const t = (edge.data?.typeId as string | undefined) ?? (edge.label as string);
        return t !== typeId;
      }),
    );
  }, [commit]);

  const retypeConnection = useCallback((edgeId: string, typeId: string) => {
    const edge = allEdgesRef.current.find((e) => e.id === edgeId);
    if (!edge) return;
    commit();
    const retyped = buildEdge(
      {
        from: edge.source,
        to: edge.target,
        type: typeId,
        description: (edge.data?.description as string | undefined) ?? '',
        strength: (edge.data?.strength as number | undefined) ?? 5,
      },
      connectionTypes,
    );
    // Keep the id so the reader's link stays the same link, just retyped.
    setAllEdges((eds) => eds.map((e) => (e.id === edgeId ? { ...retyped, id: edgeId } : e)));
    drawIn([edge]);
  }, [commit, connectionTypes, drawIn]);

  const captureImage = useCallback(() => {
    const viewport = containerRef.current?.querySelector<HTMLElement>('.react-flow__viewport');
    if (!viewport || nodesRef.current.length === 0) return Promise.reject(new Error('Nothing on the canvas to export.'));
    return captureCanvas(viewport, nodesRef.current, theme);
  }, [theme]);

  useImperativeHandle(ref, () => ({
    handleAutoArrange,
    handleClearAll,
    getNetworkState,
    loadNetwork,
    removeEdgesByType,
    undo,
    redo,
    focusNode,
    captureImage,
    addVerse,
    addConnection,
    retypeConnection,
  }));

  const showConnectHint = !connectHintDismissed && nodes.length >= 2;

  return (
    <div
      ref={containerRef}
      className={`verse-network ${showConnectHint ? 'connect-hint-active' : ''} ${isMobile ? 'is-mobile' : ''}`}
      onDragOver={isMobile ? undefined : handleDragOver}
      onDrop={isMobile ? undefined : handleDrop}
      onKeyDownCapture={handleCanvasKeyDown}
    >
      <ConnectTargetContext.Provider value={connectTarget}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnectStart={onConnectStart}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          isValidConnection={(c) => c.source !== c.target}
          connectionLineComponent={ConnectionLine}
          connectionRadius={40}
          onNodesDelete={handleNodesDelete}
          onEdgesDelete={(deleted) => removeEdges(deleted.map((e) => e.id))}
          // Clicking empty canvas closes the verse panel and lifts the spotlight.
          onPaneClick={() => onVerseSelect('')}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          deleteKeyCode={isMobile ? null : ['Delete', 'Backspace']}
          fitView
          // Never zoom past 100% just to fill the view with one card.
          fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
          minZoom={0.2}
          maxZoom={1.5}
          defaultViewport={{ x: 0, y: 0, zoom: isMobile ? 0.65 : 0.8 }}
          panOnDrag
          panOnScroll={false}
          zoomOnPinch
          zoomOnScroll={false}
          preventScrolling
          nodesConnectable
          elementsSelectable
        >
          {theme === 'light' && <Background color="#FBF8F4" gap={20} />}
          {(nodes.length > 0 || canUndo || canRedo) && (
            <Panel position="bottom-left" className="canvas-history">
              <button
                className="control-button icon-only"
                onClick={undo}
                disabled={!canUndo}
                title="Undo (⌘Z)"
                aria-label="Undo"
              >
                <Undo2 size={16} />
              </button>
              <button
                className="control-button icon-only"
                onClick={redo}
                disabled={!canRedo}
                title="Redo (⌘⇧Z)"
                aria-label="Redo"
              >
                <Redo2 size={16} />
              </button>
            </Panel>
          )}
          {!isMobile && nodes.length > 0 && (
            <Panel position="bottom-right" className="canvas-zoom">
              {onShowHelp && (
                <button
                  type="button"
                  className="canvas-help-fab"
                  onClick={onShowHelp}
                  title="Help and keyboard shortcuts (?)"
                  aria-label="Help and keyboard shortcuts"
                >
                  <CircleHelp size={19} />
                </button>
              )}
              <ZoomControls />
            </Panel>
          )}
        </ReactFlow>
      </ConnectTargetContext.Provider>

      {showConnectHint && (
        <div className="connect-hint" role="status">
          <MousePointer2 size={17} className="connect-hint-icon" />
          <div className="connect-hint-text">
            <div className="connect-hint-title">Connect two verses</div>
            <div className="connect-hint-body">
              {isMobile
                ? 'Touch and drag from the dot under one card to the dot above another.'
                : 'Drag from the dot under one card to the dot above another.'}
            </div>
          </div>
          <button
            type="button"
            className="connect-hint-close"
            onClick={dismissConnectHint}
            aria-label="Dismiss tip"
          >
            <X size={15} />
          </button>
        </div>
      )}

      {nodes.length === 0 && showEmptyState && (
        <div className="network-empty-state">
          <h2 className="network-empty-state-title">Start Your Journey</h2>
          <p className="network-empty-state-description">
            {sidebarOpen && !isMobile
              ? 'Drag a verse card from the chapters on the left, or seed the canvas with a set of connected teachings.'
              : 'Open Chapters to browse all 18 chapters, or seed the canvas with a set of connected teachings.'}
          </p>
          <div className="network-empty-state-actions">
            {(!sidebarOpen || isMobile) && onOpenChapters ? (
              <>
                <button type="button" className="starter-button primary" onClick={onOpenChapters}>
                  <BookOpen size={17} />
                  Open Chapters
                </button>
                <button type="button" className="starter-button" onClick={handleAddStarterSet}>
                  Add starter set
                </button>
              </>
            ) : (
              <>
                <button type="button" className="starter-button primary" onClick={handleAddStarterSet}>
                  Add starter set
                </button>
                <button type="button" className="starter-button" onClick={handleAddRandom}>
                  Add random verse
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {snapBack && (
        <SnapBack
          key={snapBack.key}
          fromId={snapBack.from}
          x={snapBack.x}
          y={snapBack.y}
          reject={snapBack.reject}
          container={containerRef.current}
          onDone={() => setSnapBack(null)}
        />
      )}

      {pendingConnection && (
        <ConnectionDialog
          sourceVerseId={pendingConnection.source}
          targetVerseId={pendingConnection.target}
          connectionTypes={connectionTypes}
          linkedTypeIds={linkedTypeIds}
          onCancel={() => setPendingConnection(null)}
          onConfirm={handleConfirmConnection}
        />
      )}
    </div>
  );
}
);

VerseNetwork.displayName = 'VerseNetwork';

export default VerseNetwork;
