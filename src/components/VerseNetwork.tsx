import { useCallback, useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MarkerType,
  useReactFlow,
  type Node,
  type Edge,
  type Connection as RFConnection,
  type NodeTypes,
  type EdgeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { verses, connections } from '../data.js';
import VerseNode from './VerseNode.js';
import ConnectionEdge from './ConnectionEdge.js';
import ConnectionDialog from './ConnectionDialog.js';
import type { ConnectionTypeDef } from '../connectionTypes.js';
import { getTypeColor, getTypeLabel } from '../connectionTypes.js';
import './VerseNetwork.css';

interface VerseNetworkProps {
  onVerseSelect: (verseId: string) => void;
  selectedVerseId: string | null;
  activeFilters: Set<string>;
  onToggleFilter?: (type: string) => void;
  onNetworkVersesChange: (verses: Set<string>) => void;
  connectionTypes: ConnectionTypeDef[];
  onAddCustomType: (type: ConnectionTypeDef) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
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
  addVerse: (verseId: string) => void;
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

// Grid spacing for manually placed nodes (expand / drop / starter).
// Cards are ~380 wide and can run tall, so leave generous gaps.
const COL_SPACING = 650;
const ROW_SPACING = 880;

// Place a new batch to the right of all existing nodes so cards never
// stack on top of the current graph, however many are already present.
function nextPlacementOrigin(nodes: Node[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 150, y: 120 };
  let maxRight = -Infinity;
  let minTop = Infinity;
  nodes.forEach((n) => {
    maxRight = Math.max(maxRight, n.position.x + (n.width || 380));
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
    label,
    style: {
      stroke: color,
      strokeWidth: Math.max(1, conn.strength / 3),
    },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color,
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
      activeFilters,
      onNetworkVersesChange,
      connectionTypes,
      onAddCustomType,
      onHistoryChange,
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
      onHistoryChange?.(canUndo, canRedo);
    }, [canUndo, canRedo, onHistoryChange]);

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

    const onConnect = useCallback((params: RFConnection) => {
      if (!params.source || !params.target) return;
      if (params.source === params.target) return;
      setPendingConnection({ source: params.source, target: params.target });
    }, []);

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
        setPendingConnection(null);
      },
      [pendingConnection, connectionTypes, onAddCustomType, commit],
    );

  const [dragGhost, setDragGhost] = useState<{ x: number; y: number } | null>(null);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    const bounds = event.currentTarget.getBoundingClientRect();
    setDragGhost({ x: event.clientX - bounds.left, y: event.clientY - bounds.top });
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    // Only clear when actually leaving the canvas, not crossing child elements.
    if (event.currentTarget.contains(event.relatedTarget as globalThis.Node)) return;
    setDragGhost(null);
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

  const handleAutoArrange = useCallback(() => {
    commit();
    setNodes((nds) => {
      if (nds.length === 0) return nds;

      const NODE_W = 380;
      const NODE_H = 680;
      // Extra breathing room so cards never crowd each other.
      const GAP_X = 90;
      const GAP_Y = 80;

      const g = new dagre.graphlib.Graph();
      g.setGraph({ rankdir: 'TB', nodesep: 140, ranksep: 200, marginx: 120, marginy: 120 });
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
      fitView({ duration: 400, padding: 0.2 });
    }, 50);
  }, [setNodes, fitView, commit]);

  const handleExpandNetwork = useCallback((verseId: string) => {
    const connectedVerseIds = connections
      .filter(conn => conn.from === verseId || conn.to === verseId)
      .map(conn => conn.from === verseId ? conn.to : conn.from)
      .filter(id => !networkVerses.has(id));

    if (connectedVerseIds.length === 0) return;
    commit();

    setNodes((currentNodes) => {
      const origin = nextPlacementOrigin(currentNodes);

      const newNodes: Node[] = connectedVerseIds.map((vId, index) => {
        const verse = verses.find(v => v.id === vId);
        if (!verse) return null;

        const newConnectedCount = connections
          .filter(conn => conn.from === vId || conn.to === vId)
          .map(conn => conn.from === vId ? conn.to : conn.from)
          .filter(id => !networkVerses.has(id) && !connectedVerseIds.includes(id)).length;

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
            connectedCount: newConnectedCount,
          },
        };
      }).filter(Boolean) as Node[];

      return [...currentNodes, ...newNodes];
    });

    const newEdges: Edge[] = [];
    connections.forEach(conn => {
      const isRelevant =
        (conn.from === verseId && connectedVerseIds.includes(conn.to)) ||
        (conn.to === verseId && connectedVerseIds.includes(conn.from));

      if (isRelevant) {
        newEdges.push(buildEdge(conn, connectionTypes));
      }
    });

    setAllEdges((eds) => [...eds, ...newEdges]);
    setNetworkVerses(prev => new Set([...prev, ...connectedVerseIds]));

    setTimeout(() => {
      fitView({ duration: 400, padding: 0.2 });
    }, 100);
  }, [networkVerses, selectedVerseId, onVerseSelect, handleRemoveNode, setNodes, setAllEdges, fitView, connectionTypes, commit]);

  useEffect(() => {
    expandRef.current = handleExpandNetwork;
  }, [handleExpandNetwork]);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setDragGhost(null);

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

      const connectedCount = connections
        .filter(conn => conn.from === verseId || conn.to === verseId)
        .map(conn => conn.from === verseId ? conn.to : conn.from)
        .filter(id => !networkVerses.has(id)).length;

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

      const newEdges: Edge[] = [];
      connections.forEach(conn => {
        if (
          (conn.from === verseId && networkVerses.has(conn.to)) ||
          (conn.to === verseId && networkVerses.has(conn.from))
        ) {
          newEdges.push(buildEdge(conn, connectionTypes));
        }
      });

      if (newEdges.length > 0) {
        setAllEdges((eds) => [...eds, ...newEdges]);
      }
    },
    [networkVerses, setNodes, setAllEdges, onVerseSelect, selectedVerseId, handleRemoveNode, connectionTypes, commit],
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
          const connectedCount = connections
            .filter((c) => c.from === vId || c.to === vId)
            .map((c) => (c.from === vId ? c.to : c.from))
            .filter((id) => !finalSet.has(id)).length;
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

      const newEdges: Edge[] = [];
      connections.forEach((conn) => {
        const touchesNew = toAdd.includes(conn.from) || toAdd.includes(conn.to);
        if (touchesNew && finalSet.has(conn.from) && finalSet.has(conn.to)) {
          newEdges.push(buildEdge(conn, connectionTypes));
        }
      });
      if (newEdges.length > 0) setAllEdges((eds) => [...eds, ...newEdges]);

      setNetworkVerses(finalSet);
      setTimeout(() => fitView({ duration: 400, padding: 0.2 }), 100);
    },
    [onVerseSelect, handleRemoveNode, selectedVerseId, connectionTypes, setNodes, setAllEdges, fitView, commit],
  );

  const addVerse = useCallback((verseId: string) => addVerses([verseId]), [addVerses]);

  const handleAddRandom = useCallback(() => {
    const available = verses.filter((v) => !netRef.current.has(v.id));
    if (available.length === 0) return;
    const pick = available[Math.floor(Math.random() * available.length)];
    addVerses([pick.id]);
  }, [addVerses]);

  const handleAddStarterSet = useCallback(() => {
    const counts = verses
      .map((v) => ({
        id: v.id,
        n: connections.filter((c) => c.from === v.id || c.to === v.id).length,
      }))
      .sort((a, b) => b.n - a.n);
    const hub = counts[0]?.id;
    if (!hub) return;
    const neighbors = Array.from(
      new Set(
        connections
          .filter((c) => c.from === hub || c.to === hub)
          .map((c) => (c.from === hub ? c.to : c.from)),
      ),
    ).slice(0, 5);
    addVerses([hub, ...neighbors]);
  }, [addVerses]);

  // Re-apply current registry styling, filter, and parallel-edge offsets
  // entirely in derived state so labels never overlap and color tweaks
  // propagate immediately.
  const handleDeleteEdge = useCallback((edgeId: string) => {
    commit();
    setAllEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }, [commit]);

  const filteredEdges = useMemo(() => {
    const enabled = allEdges.filter((edge) => {
      const typeId = (edge.data?.typeId as string | undefined) ?? (edge.label as string);
      return activeFilters.has(typeId);
    });

    const groups = new Map<string, Edge[]>();
    enabled.forEach((e) => {
      const key = pairKey(e.source, e.target);
      const list = groups.get(key) ?? [];
      list.push(e);
      groups.set(key, list);
    });

    return enabled.map((edge) => {
      const key = pairKey(edge.source, edge.target);
      const group = groups.get(key) ?? [edge];
      const index = group.indexOf(edge);
      const typeId = (edge.data?.typeId as string | undefined) ?? (edge.label as string);
      const color = getTypeColor(connectionTypes, typeId);
      const label = getTypeLabel(connectionTypes, typeId);
      return {
        ...edge,
        label,
        style: { ...edge.style, stroke: color },
        markerEnd: { type: MarkerType.ArrowClosed, color },
        data: {
          ...edge.data,
          color,
          parallelIndex: index,
          parallelTotal: group.length,
          onDelete: handleDeleteEdge,
        },
      };
    });
  }, [allEdges, activeFilters, connectionTypes, handleDeleteEdge]);

  useEffect(() => {
    setEdges(filteredEdges);
  }, [filteredEdges, setEdges]);

  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const connectedCount = connections
          .filter(conn => conn.from === node.id || conn.to === node.id)
          .map(conn => conn.from === node.id ? conn.to : conn.from)
          .filter(id => !networkVerses.has(id)).length;

        return {
          ...node,
          data: {
            ...node.data,
            isSelected: node.id === selectedVerseId,
            connectedCount,
          },
        };
      }),
    );
  }, [selectedVerseId, networkVerses, setNodes]);

  const getNetworkState = useCallback(() => {
    return { nodes, edges: allEdges };
  }, [nodes, allEdges]);

  const loadNetwork = useCallback((loadedNodes: Node[], loadedEdges: Edge[]) => {
    setNodes([]);
    setAllEdges([]);
    setNetworkVerses(new Set());
    onVerseSelect('');

    setTimeout(() => {
      setNodes(loadedNodes);
      setAllEdges(loadedEdges);

      const verseIds = new Set(loadedNodes.map(node => node.id));
      setNetworkVerses(verseIds);

      setTimeout(() => {
        fitView({ duration: 400, padding: 0.2 });
      }, 100);
    }, 50);
  }, [setNodes, setAllEdges, onVerseSelect, fitView]);

  // Pan + zoom the canvas to a node when it exists in the network.
  const focusNode = useCallback(
    (verseId: string) => {
      const node = nodesRef.current.find((n) => n.id === verseId);
      if (!node) return;
      const w = node.width || 380;
      const h = node.height || 680;
      setCenter(node.position.x + w / 2, node.position.y + h / 2, {
        zoom: 0.85,
        duration: 600,
      });
    },
    [setCenter],
  );

  const removeEdgesByType = useCallback((typeId: string) => {
    setAllEdges((eds) =>
      eds.filter((edge) => {
        const t = (edge.data?.typeId as string | undefined) ?? (edge.label as string);
        return t !== typeId;
      }),
    );
  }, []);

  useImperativeHandle(ref, () => ({
    handleAutoArrange,
    handleClearAll,
    getNetworkState,
    loadNetwork,
    removeEdgesByType,
    undo,
    redo,
    focusNode,
    addVerse,
  }));

  return (
    <div
      className="verse-network"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {dragGhost && (
        <div
          className="drag-ghost"
          style={{ left: dragGhost.x, top: dragGhost.y }}
        >
          Drop to add verse
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={handleNodesDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        deleteKeyCode={['Delete', 'Backspace']}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
      >
        <Background color="#FBF8F4" gap={20} />
        <Controls className="controls" />
      </ReactFlow>

      {nodes.length === 0 && (
        <div className="network-empty-state">
          <h2 className="network-empty-state-title">Start Your Journey</h2>
          <p className="network-empty-state-description">
            Drag a verse card from the left sidebar to begin exploring the beautiful connections between the teachings of the Bhagavad Gita.
          </p>
          <ul className="network-empty-state-list">
            <li>Each verse reveals thematic, conceptual, practical, and doctrinal connections</li>
            <li>Connection lines display relationship types with colored badges</li>
            <li>Click verses to discover related teachings</li>
            <li>Drag verses around to organize your network</li>
            <li>Drag from one verse handle to another to create a custom connection</li>
          </ul>
          <div className="network-empty-state-actions">
            <button className="starter-button primary" onClick={handleAddStarterSet}>
              Add starter set
            </button>
            <button className="starter-button" onClick={handleAddRandom}>
              Add random verse
            </button>
          </div>
        </div>
      )}

      {pendingConnection && (
        <ConnectionDialog
          sourceVerseId={pendingConnection.source}
          targetVerseId={pendingConnection.target}
          connectionTypes={connectionTypes}
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
