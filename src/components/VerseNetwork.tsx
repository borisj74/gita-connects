import { useCallback, useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import ReactFlow, {
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MarkerType,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  type EdgeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { verses, connections } from '../data.js';
import VerseNode from './VerseNode.js';
import ConnectionEdge from './ConnectionEdge.js';
import './VerseNetwork.css';

interface VerseNetworkProps {
  onVerseSelect: (verseId: string) => void;
  selectedVerseId: string | null;
  activeFilters: Set<string>;
  onToggleFilter?: (type: string) => void;
  onNetworkVersesChange: (verses: Set<string>) => void;
}

export interface VerseNetworkRef {
  handleAutoArrange: () => void;
  handleClearAll: () => void;
  getNetworkState: () => { nodes: Node[]; edges: Edge[] };
  loadNetwork: (nodes: Node[], edges: Edge[]) => void;
}

const nodeTypes: NodeTypes = {
  verseNode: VerseNode,
};

const edgeTypes: EdgeTypes = {
  connectionEdge: ConnectionEdge,
};

// Connection type colors
const connectionColors = {
  thematic: '#ca7558', // terracotta
  conceptual: '#7d8a6e', // sage
  practical: '#8d7a66', // brown
};

const VerseNetwork = forwardRef<VerseNetworkRef, VerseNetworkProps>(
  ({ onVerseSelect, selectedVerseId, activeFilters, onNetworkVersesChange }, ref) => {
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [allEdges, setAllEdges] = useState<Edge[]>([]);
    const [networkVerses, setNetworkVerses] = useState<Set<string>>(new Set());
    const { fitView } = useReactFlow();

    // Notify parent when network verses change
    useEffect(() => {
      onNetworkVersesChange(networkVerses);
    }, [networkVerses, onNetworkVersesChange]);

    const onConnect = useCallback(
      (params: Connection) => {
        if (!params.source || !params.target) return;

        // Check if this connection already exists in our data
        const existingConnection = connections.find(
          conn =>
            (conn.from === params.source && conn.to === params.target) ||
            (conn.from === params.target && conn.to === params.source)
        );

        // Get the verse data to determine connection type
        const sourceVerse = verses.find(v => v.id === params.source);
        const targetVerse = verses.find(v => v.id === params.target);

        let connectionType: 'thematic' | 'conceptual' | 'practical' = 'conceptual';
        let description = 'User-created connection';
        let strength = 5;

        if (existingConnection) {
          // Use predefined connection data
          connectionType = existingConnection.type;
          description = existingConnection.description;
          strength = existingConnection.strength;
        } else if (sourceVerse && targetVerse) {
          // Determine connection type based on verse analysis
          const sharedConcepts = sourceVerse.concepts.filter(c =>
            targetVerse.concepts.includes(c)
          );

          if (sourceVerse.chapter === targetVerse.chapter) {
            connectionType = 'thematic';
            description = `Both verses from Chapter ${sourceVerse.chapter}${sharedConcepts.length > 0 ? `, exploring ${sharedConcepts[0]}` : ''}`;
          } else if (sharedConcepts.length > 0) {
            connectionType = 'conceptual';
            description = `Connected through shared concepts: ${sharedConcepts.slice(0, 2).join(', ')}`;
          } else {
            connectionType = 'practical';
            description = 'Related verses from different contexts';
          }
        }

        const newEdge: Edge = {
          id: `${params.source}-${params.target}`,
          source: params.source,
          target: params.target,
          type: 'connectionEdge',
          animated: false,
          label: connectionType,
          style: {
            stroke: connectionColors[connectionType],
            strokeWidth: Math.max(1, strength / 3),
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: connectionColors[connectionType],
          },
          data: {
            description,
            strength,
          },
        };

        setAllEdges((eds) => [...eds, newEdge]);
      },
      [setAllEdges]
    );

  // Handle drop from sidebar
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
    [selectedVerseId, onVerseSelect, setNodes, setAllEdges]
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
      const horizontalSpacing = 480; // spacing between nodes horizontally
      const verticalSpacing = 650; // spacing between nodes vertically (cards are tall)

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

    // Fit view after arranging
    setTimeout(() => {
      fitView({ duration: 400, padding: 0.2 });
    }, 50);
  }, [setNodes, fitView]);

  const handleExpandNetwork = useCallback((verseId: string) => {
    // Find all verses connected to this verse
    const connectedVerseIds = connections
      .filter(conn => conn.from === verseId || conn.to === verseId)
      .map(conn => conn.from === verseId ? conn.to : conn.from)
      .filter(id => !networkVerses.has(id)); // Only add verses not already in network

    if (connectedVerseIds.length === 0) return;

    // Use setNodes with callback to access current nodes without adding to dependencies
    setNodes((currentNodes) => {
      const lastNode = currentNodes[currentNodes.length - 1];
      const startX = lastNode ? lastNode.position.x + 480 : 200;
      const startY = lastNode ? lastNode.position.y : 100;

      // Create new nodes for connected verses
      const newNodes: Node[] = connectedVerseIds.map((vId, index) => {
        const verse = verses.find(v => v.id === vId);
        if (!verse) return null;

        // Calculate connected count for the new verse
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
            onExpand: () => handleExpandNetwork(vId),
            isSelected: selectedVerseId === vId,
            connectedCount: newConnectedCount,
          },
        };
      }).filter(Boolean) as Node[];

      return [...currentNodes, ...newNodes];
    });

    // Create edges for new connections
    const newEdges: Edge[] = [];
    connections.forEach(conn => {
      const isRelevant =
        (conn.from === verseId && connectedVerseIds.includes(conn.to)) ||
        (conn.to === verseId && connectedVerseIds.includes(conn.from));

      if (isRelevant) {
        newEdges.push({
          id: `${conn.from}-${conn.to}`,
          source: conn.from,
          target: conn.to,
          type: 'connectionEdge',
          animated: false,
          label: conn.type,
          style: {
            stroke: connectionColors[conn.type],
            strokeWidth: Math.max(1, conn.strength / 3),
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: connectionColors[conn.type],
          },
          data: {
            description: conn.description,
            strength: conn.strength,
          },
        });
      }
    });

    setAllEdges((eds) => [...eds, ...newEdges]);
    setNetworkVerses(prev => new Set([...prev, ...connectedVerseIds]));

    // Auto-arrange after expansion
    setTimeout(() => {
      fitView({ duration: 400, padding: 0.2 });
    }, 100);
  }, [networkVerses, selectedVerseId, onVerseSelect, handleRemoveNode, setNodes, setAllEdges, fitView]);

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

      // Calculate how many connected verses are not yet in network
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
          onExpand: () => handleExpandNetwork(verseId),
          isSelected: selectedVerseId === verseId,
          connectedCount,
        },
      };

      setNodes((nds) => [...nds, newNode]);
      setNetworkVerses(prev => new Set([...prev, verseId]));

      // Add edges for connected verses that are already in the network
      const newEdges: Edge[] = [];
      connections.forEach(conn => {
        if (conn.from === verseId && networkVerses.has(conn.to)) {
          newEdges.push({
            id: `${conn.from}-${conn.to}`,
            source: conn.from,
            target: conn.to,
            type: 'connectionEdge',
            animated: false,
            label: conn.type,
            style: {
              stroke: connectionColors[conn.type],
              strokeWidth: Math.max(1, conn.strength / 3),
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: connectionColors[conn.type],
            },
            data: {
              description: conn.description,
              strength: conn.strength,
            },
          });
        }
        if (conn.to === verseId && networkVerses.has(conn.from)) {
          newEdges.push({
            id: `${conn.from}-${conn.to}`,
            source: conn.from,
            target: conn.to,
            type: 'connectionEdge',
            animated: false,
            label: conn.type,
            style: {
              stroke: connectionColors[conn.type],
              strokeWidth: Math.max(1, conn.strength / 3),
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: connectionColors[conn.type],
            },
            data: {
              description: conn.description,
              strength: conn.strength,
            },
          });
        }
      });

      if (newEdges.length > 0) {
        setAllEdges((eds) => [...eds, ...newEdges]);
      }
    },
    [networkVerses, setNodes, setAllEdges, onVerseSelect, selectedVerseId, handleRemoveNode, handleExpandNetwork]
  );

  // Filter edges based on active connection types
  useEffect(() => {
    const filteredEdges = allEdges.filter((edge) => {
      const edgeType = edge.label as string;
      return activeFilters.has(edgeType);
    });
    setEdges(filteredEdges);
  }, [allEdges, activeFilters, setEdges]);

  // Update selected state and connected counts when selection or network changes
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
      })
    );
  }, [selectedVerseId, networkVerses, setNodes]);

  const getNetworkState = useCallback(() => {
    return { nodes, edges: allEdges };
  }, [nodes, allEdges]);

  const loadNetwork = useCallback((loadedNodes: Node[], loadedEdges: Edge[]) => {
    // Clear current network first
    setNodes([]);
    setAllEdges([]);
    setNetworkVerses(new Set());
    onVerseSelect('');

    // Load new network
    setTimeout(() => {
      setNodes(loadedNodes);
      setAllEdges(loadedEdges);

      // Extract verse IDs from loaded nodes
      const verseIds = new Set(loadedNodes.map(node => node.id));
      setNetworkVerses(verseIds);

      // Fit view to show all nodes
      setTimeout(() => {
        fitView({ duration: 400, padding: 0.2 });
      }, 100);
    }, 50);
  }, [setNodes, setAllEdges, onVerseSelect, fitView]);

  // Expose methods to parent component via ref
  useImperativeHandle(ref, () => ({
    handleAutoArrange,
    handleClearAll,
    getNetworkState,
    loadNetwork,
  }));

  // Initialize with empty network to show empty state
  // useEffect(() => {
  //   const initialVerses = ['2.47', '3.19', '5.10', '2.14', '12.13'];
  //   const initialNodes: Node[] = initialVerses.map((vId, index) => {
  //     const verse = verses.find(v => v.id === vId);
  //     if (!verse) return null;

  //     return {
  //       id: vId,
  //       type: 'verseNode',
  //       position: {
  //         x: 200 + (index % 3) * 300,
  //         y: 100 + Math.floor(index / 3) * 250,
  //       },
  //       data: {
  //         verse,
  //         onSelect: () => onVerseSelect(vId),
  //         onRemove: () => handleRemoveNode(vId),
  //         isSelected: selectedVerseId === vId,
  //       },
  //     };
  //   }).filter(Boolean) as Node[];

  //   setNodes(initialNodes);
  //   setNetworkVerses(new Set(initialVerses));

  //   // Add edges between initial verses
  //   const initialEdges: Edge[] = [];
  //   connections.forEach(conn => {
  //     if (initialVerses.includes(conn.from) && initialVerses.includes(conn.to)) {
  //       initialEdges.push({
  //         id: `${conn.from}-${conn.to}`,
  //         source: conn.from,
  //         target: conn.to,
  //         type: 'smoothstep',
  //         animated: true,
  //         label: conn.type,
  //         style: {
  //           stroke: connectionColors[conn.type],
  //           strokeWidth: Math.max(1, conn.strength / 3),
  //         },
  //         markerEnd: {
  //           type: MarkerType.ArrowClosed,
  //           color: connectionColors[conn.type],
  //         },
  //         data: {
  //           description: conn.description,
  //           strength: conn.strength,
  //         },
  //       });
  //     }
  //   });

  //   setAllEdges(initialEdges);
  // // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []); // Only run once on mount

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
          </ul>
        </div>
      )}
    </div>
  );
}
);

VerseNetwork.displayName = 'VerseNetwork';

export default VerseNetwork;
