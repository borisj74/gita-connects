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
}

export interface VerseNetworkRef {
  handleAutoArrange: () => void;
  handleClearAll: () => void;
  getNetworkState: () => { nodes: Node[]; edges: Edge[] };
  loadNetwork: (nodes: Node[], edges: Edge[]) => void;
  removeEdgesByType?: (typeId: string) => void;
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
    const { fitView } = useReactFlow();

    useEffect(() => {
      onNetworkVersesChange(networkVerses);
    }, [networkVerses, onNetworkVersesChange]);

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
      [pendingConnection, connectionTypes, onAddCustomType],
    );

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleRemoveNode = useCallback(
    (verseId: string) => {
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
    [selectedVerseId, onVerseSelect, setNodes, setAllEdges],
  );

  const handleClearAll = useCallback(() => {
    setNodes([]);
    setAllEdges([]);
    setNetworkVerses(new Set());
    onVerseSelect('');
  }, [setNodes, setAllEdges, onVerseSelect]);

  const handleAutoArrange = useCallback(() => {
    setNodes((nds) => {
      const cols = Math.ceil(Math.sqrt(nds.length));
      const horizontalSpacing = 480;
      const verticalSpacing = 650;

      return nds.map((node, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);

        return {
          ...node,
          position: {
            x: col * horizontalSpacing + 100,
            y: row * verticalSpacing + 100,
          },
        };
      });
    });

    setTimeout(() => {
      fitView({ duration: 400, padding: 0.2 });
    }, 50);
  }, [setNodes, fitView]);

  const handleExpandNetwork = useCallback((verseId: string) => {
    const connectedVerseIds = connections
      .filter(conn => conn.from === verseId || conn.to === verseId)
      .map(conn => conn.from === verseId ? conn.to : conn.from)
      .filter(id => !networkVerses.has(id));

    if (connectedVerseIds.length === 0) return;

    setNodes((currentNodes) => {
      const lastNode = currentNodes[currentNodes.length - 1];
      const startX = lastNode ? lastNode.position.x + 480 : 200;
      const startY = lastNode ? lastNode.position.y : 100;

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
            x: startX + (index % 3) * 480,
            y: startY + Math.floor(index / 3) * 650,
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
  }, [networkVerses, selectedVerseId, onVerseSelect, handleRemoveNode, setNodes, setAllEdges, fitView, connectionTypes]);

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
    [networkVerses, setNodes, setAllEdges, onVerseSelect, selectedVerseId, handleRemoveNode, connectionTypes],
  );

  // Re-apply current registry styling, filter, and parallel-edge offsets
  // entirely in derived state so labels never overlap and color tweaks
  // propagate immediately.
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
        },
      };
    });
  }, [allEdges, activeFilters, connectionTypes]);

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
  }));

  return (
    <div
      className="verse-network"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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
