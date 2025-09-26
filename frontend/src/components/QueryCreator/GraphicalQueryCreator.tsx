/**
 * Graphical Query Creator for Drag-and-Drop Interface
 * Provides ReactFlow-based query building with nodes and edges
 */

import React, { useState, useEffect, useCallback } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ReactFlowProvider,
  MiniMap,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Box,
  Typography,
  Paper,
  Button,
  Toolbar,
  Divider,
  ButtonGroup
} from '@mui/material';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faAtom, faCube, faArrowRight, faProjectDiagram, faTrash, faSave } from '@fortawesome/free-solid-svg-icons';
import { getURI } from '../utils';

// Import our custom node and edge types
import { nodeTypes } from './Nodes';
import { edgeTypes } from './Edges';

interface GraphicalQueryCreatorProps {
  onClose: (nodes: Node[], edges: Edge[]) => void;
  nodes: Node[];
  edges: Edge[];
  name: string;
  filePath: string;
  onQueryChange: (nodes: Node[], edges: Edge[]) => void;
  onNodesInit: (nodes: Node[]) => void;
  onEdgesInit: (edges: Edge[]) => void;
}

const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

export const GraphicalQueryCreator: React.FC<GraphicalQueryCreatorProps> = ({
  onClose,
  nodes: initialNodesFromProps,
  edges: initialEdgesFromProps,
  name,
  filePath,
  onQueryChange,
  onNodesInit,
  onEdgesInit
}) => {
  console.log("DEBUG: GraphicalQueryCreator initialized with nodes:", initialNodesFromProps);
  console.log("DEBUG: GraphicalQueryCreator initialized with edges:", initialEdgesFromProps);
  
  // Initialize with empty arrays first, will be populated by useEffect
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isEditMode, setIsEditMode] = useState(false);
  
  // Define update and delete handlers that use current state
  const handleNodeUpdate = useCallback((id: string, newData: any) => {
    console.log("DEBUG: handleNodeUpdate called for node:", id);
    console.log("DEBUG: handleNodeUpdate newData:", newData);
    setNodes((currentNodes) => {
      console.log("DEBUG: handleNodeUpdate - Current nodes before update:", currentNodes.length);
      const updatedNodes = currentNodes.map((node) => {
        if (node.id === id) {
          console.log("DEBUG: handleNodeUpdate - Updating node:", node.id);
          console.log("DEBUG: handleNodeUpdate - Old node data:", node.data);
          console.log("DEBUG: handleNodeUpdate - New node data:", newData);
          const updatedNode = { ...node, data: { ...node.data, ...newData } };
          console.log("DEBUG: handleNodeUpdate - Final updated node:", updatedNode);
          return updatedNode;
        }
        return node;
      });
      console.log("DEBUG: handleNodeUpdate - Updated nodes:", updatedNodes.length);
      return updatedNodes;
    });
  }, [setNodes]);

  const handleNodeDelete = useCallback((id: string) => {
    console.log("DEBUG: handleNodeDelete called for node:", id);
    setNodes((currentNodes) => {
      const updatedNodes = currentNodes.filter((node) => node.id !== id);
      console.log("DEBUG: handleNodeDelete - Updated nodes:", updatedNodes.length);
      return updatedNodes;
    });
    setEdges((currentEdges) => {
      const updatedEdges = currentEdges.filter((edge) => edge.source !== id && edge.target !== id);
      console.log("DEBUG: handleNodeDelete - Updated edges:", updatedEdges.length);
      return updatedEdges;
    });
    // Parent will be notified via useEffect
  }, [setNodes, setEdges]);

  // Function to restore callbacks to nodes loaded from storage
  const restoreNodeCallbacks = useCallback((nodes: Node[]) => {
    console.log("DEBUG: restoreNodeCallbacks called with nodes:", nodes);
    const restoredNodes = nodes.map(node => {
      const restoredNode = {
        ...node,
        data: {
          ...node.data,
          onUpdate: handleNodeUpdate,
          onDelete: handleNodeDelete
        }
      };
      console.log("DEBUG: Restored node:", restoredNode.id, "data:", restoredNode.data);
      return restoredNode;
    });
    console.log("DEBUG: restoreNodeCallbacks returning:", restoredNodes.length, "nodes");
    return restoredNodes;
  }, [handleNodeUpdate, handleNodeDelete]);

  // Update logical operator nodes with connection status
  useEffect(() => {
    const logicalTargets = new Set(edges.map(edge => edge.target));
    const logicalSources = new Set(edges.map(edge => edge.source));
    
    setNodes(currentNodes => 
      currentNodes.map(node => {
        if (node.type === 'logicalOperator') {
          // Logical operators are connected if they are either sources or targets
          const hasIncomingConnections = logicalTargets.has(node.id) || logicalSources.has(node.id);
          return {
            ...node,
            data: {
              ...node.data,
              hasIncomingConnections
            }
          };
        }
        return node;
      })
    );
  }, [edges, setNodes]);

  // Save changes to localStorage when in create mode (but only when user makes changes)
  const [lastSavedNodes, setLastSavedNodes] = useState<Node[]>([]);
  const [lastSavedEdges, setLastSavedEdges] = useState<Edge[]>([]);
  
  useEffect(() => {
    if (!isEditMode && nodes.length > 0) {
      // Only save if the nodes/edges have actually changed from what we last saved
      const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(lastSavedNodes);
      const edgesChanged = JSON.stringify(edges) !== JSON.stringify(lastSavedEdges);
      
      if (nodesChanged || edgesChanged) {
        console.log("DEBUG: Saving nodes to localStorage (create mode)");
        console.log("DEBUG: Nodes to save:", nodes);
        console.log("DEBUG: Edges to save:", edges);
        try {
          localStorage.setItem('savedQueryNodes', JSON.stringify(nodes));
          localStorage.setItem('savedQueryEdges', JSON.stringify(edges));
          console.log("DEBUG: Successfully saved to localStorage");
          setLastSavedNodes([...nodes]);
          setLastSavedEdges([...edges]);
        } catch (error) {
          console.error("Error saving to localStorage:", error);
        }
      } else {
        console.log("DEBUG: Skipping localStorage save - no changes detected");
      }
    }
  }, [nodes, edges, isEditMode, lastSavedNodes, lastSavedEdges]);
  
  // OCEL metadata state
  const [ocelMetadata, setOcelMetadata] = useState({
    activities: [],
    object_types: ['ANY'],
    statistics: {
      total_events: 0,
      total_objects: 0,
      num_activities: 0,
      num_object_types: 0
    }
  });
  const [metadataLoading, setMetadataLoading] = useState(true);

  useEffect(() => {
    // onNodesInit and onEdgesInit removed to prevent infinite loops
    fetchOcelMetadata();
    
    // Check if we're in edit mode (props provided) or create mode
    const hasProps = initialNodesFromProps && initialNodesFromProps.length > 0;
    setIsEditMode(hasProps);
    
    console.log("DEBUG: Initialization - hasProps:", hasProps);
    console.log("DEBUG: Initialization - initialNodesFromProps:", initialNodesFromProps);
    console.log("DEBUG: Initialization - initialEdgesFromProps:", initialEdgesFromProps);
    
    if (hasProps) {
      // Edit mode: use props
      console.log("DEBUG: Edit mode - using props");
      const nodesWithCallbacks = restoreNodeCallbacks(initialNodesFromProps);
      setNodes(nodesWithCallbacks);
      if (initialEdgesFromProps && initialEdgesFromProps.length > 0) {
        setEdges(initialEdgesFromProps);
      }
    } else {
      // Create mode: load from localStorage
      console.log("DEBUG: Create mode - checking localStorage");
      try {
        const savedNodes = localStorage.getItem('savedQueryNodes');
        const savedEdges = localStorage.getItem('savedQueryEdges');
        
        console.log("DEBUG: savedNodes:", savedNodes);
        console.log("DEBUG: savedEdges:", savedEdges);
        
        if (savedNodes) {
          const parsedNodes = JSON.parse(savedNodes);
          console.log("DEBUG: Loading saved nodes from localStorage:", parsedNodes);
          const nodesWithCallbacks = restoreNodeCallbacks(parsedNodes);
          console.log("DEBUG: Restored callbacks to nodes:", nodesWithCallbacks.length);
          setNodes(nodesWithCallbacks);
        }
        
        if (savedEdges) {
          const parsedEdges = JSON.parse(savedEdges);
          console.log("DEBUG: Loading saved edges from localStorage:", parsedEdges);
          setEdges(parsedEdges);
        }
      } catch (error) {
        console.error("Error loading saved query from localStorage:", error);
      }
    }
  }, []); // Only run once on mount

  // Notify parent component when nodes/edges change (but avoid loops)
  const [lastNotifiedNodes, setLastNotifiedNodes] = useState<Node[]>([]);
  const [lastNotifiedEdges, setLastNotifiedEdges] = useState<Edge[]>([]);
  
  useEffect(() => {
    // Only notify if the nodes/edges have actually changed
    const nodesChanged = JSON.stringify(nodes) !== JSON.stringify(lastNotifiedNodes);
    const edgesChanged = JSON.stringify(edges) !== JSON.stringify(lastNotifiedEdges);
    
    if (nodesChanged || edgesChanged) {
      console.log("DEBUG: Notifying parent of node/edge changes:", nodes.length, "nodes,", edges.length, "edges", "isEditMode:", isEditMode);
      onQueryChange(nodes, edges);
      setLastNotifiedNodes([...nodes]);
      setLastNotifiedEdges([...edges]);
    } else {
      console.log("DEBUG: Skipping parent notification - no changes detected");
    }
  }, [nodes, edges, onQueryChange, isEditMode, lastNotifiedNodes, lastNotifiedEdges]);

  const fetchOcelMetadata = async () => {
    try {
      setMetadataLoading(true);
      const uri = getURI('/pq/ocel_metadata', {});
      const response = await fetch(uri, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_path: filePath
        })
      });
      const data = await response.json();
      
      if (data.error) {
        console.warn('Failed to fetch OCEL metadata:', data.error);
        // Keep default values
      } else {
        setOcelMetadata(data);
      }
    } catch (error) {
      console.error('Error fetching OCEL metadata:', error);
      // Keep default values
    } finally {
      setMetadataLoading(false);
    }
  };


  const handleDone = () => {
    console.log("DEBUG: handleDone called with nodes:", nodes);
    console.log("DEBUG: handleDone called with edges:", edges);
    
    // Save to localStorage before closing
    try {
      localStorage.setItem('savedQueryNodes', JSON.stringify(nodes));
      localStorage.setItem('savedQueryEdges', JSON.stringify(edges));
      console.log("DEBUG: Saved to localStorage - nodes:", nodes.length, "edges:", edges.length);
    } catch (error) {
      console.error("Error saving to localStorage:", error);
    }
    
    onQueryChange(nodes, edges); // Update parent with final state
    onNodesInit(nodes); // Initialize parent with final nodes
    onEdgesInit(edges); // Initialize parent with final edges
    onClose(nodes, edges);
  };

  const createActivityNode = () => {
    const newNode: Node = {
      id: `activity-${Date.now()}`,
      type: 'activityQuery',
      position: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
      data: {
        query: {
          type: 'ActivityQuery',
          objectComponent: { objectType: 'ANY' },
          activityComponent: { activities: [], activityType: 'single' }
        },
        availableActivities: ocelMetadata.activities,
        availableObjectTypes: ocelMetadata.object_types,
        onUpdate: handleNodeUpdate,
        onDelete: handleNodeDelete
      }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const createObjectTypeNode = () => {
    const newNode: Node = {
      id: `objectType-${Date.now()}`,
      type: 'objectTypeQuery',
      position: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
      data: {
        query: {
          type: 'ObjectTypeQuery',
          objectTypeComponent: { objectType: 'ANY' }
        },
        availableObjectTypes: ocelMetadata.object_types,
        onUpdate: handleNodeUpdate,
        onDelete: handleNodeDelete
      }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const createControlFlowNode = () => {
    const newNode: Node = {
      id: `controlFlow-${Date.now()}`,
      type: 'controlFlowQuery', 
      position: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
      data: {
        query: {
          type: 'ControlFlowQuery',
          firstActivityQuery: {
            type: 'ActivityQuery',
            objectComponent: { objectType: 'ANY' },
            activityComponent: { activities: [], activityType: 'single' }
          },
          secondActivityQuery: {
            type: 'ActivityQuery', 
            objectComponent: { objectType: 'ANY' },
            activityComponent: { activities: [], activityType: 'single' }
          },
          temporalRelation: 'DF',
          constraintComponent: {}
        },
        availableActivities: ocelMetadata.activities,
        availableObjectTypes: ocelMetadata.object_types,
        onUpdate: handleNodeUpdate,
        onDelete: handleNodeDelete
      }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const createLogicalOperatorNode = () => {
    const newNode: Node = {
      id: `logical-${Date.now()}`,
      type: 'logicalOperator',
      position: { x: 100 + Math.random() * 400, y: 100 + Math.random() * 300 },
      data: {
        operator: 'AND',
        onUpdate: handleNodeUpdate,
        onDelete: handleNodeDelete
      }
    };
    setNodes((nds) => [...nds, newNode]);
  };


  const onConnect = useCallback(
    (params: Connection) => {
      console.log("DEBUG: onConnect called with params:", params);
      
      const newEdge = {
        ...params,
        type: 'default',
        data: {}
      };
      
      console.log("DEBUG: Creating new edge:", newEdge);
      setEdges((eds) => addEdge(newEdge, eds));
    },
    [setEdges]
  );

  const clearAll = () => {
    setNodes([]);
    setEdges([]);
    // Parent will be notified via useEffect
  };

  const nodeColor = (node: Node) => {
    switch (node.type) {
      case 'activityQuery': return '#e3f2fd';
      case 'objectTypeQuery': return '#f3e5f5';
      case 'controlFlowQuery': return '#e8f5e8';
      case 'logicalOperator': return '#fff3e0';
      default: return '#f5f5f5';
    }
  };

  return (
    <Box sx={{ height: '90vh', width: '100%', position: 'relative' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView={false}
          attributionPosition="bottom-left"
          nodesDraggable={true}
          nodesConnectable={true}
          elementsSelectable={true}
          panOnDrag={true}
          panOnScroll={true}
          zoomOnScroll={true}
          preventScrolling={false}
          deleteKeyCode={null}
          multiSelectionKeyCode={null}
        >
          {/* Top Toolbar Panel */}
          <Panel position="top-left">
            <Paper sx={{ padding: 1 }}>
              <Toolbar variant="dense" sx={{ minHeight: '40px' }}>
                <Typography variant="h6" sx={{ flexGrow: 1, marginRight: 2, fontSize: '0.9rem' }}>
                  Query Builder: {name}
                </Typography>
                
                <ButtonGroup size="small" sx={{ marginRight: 2 }}>
                  <Button onClick={createActivityNode} startIcon={<FontAwesomeIcon icon={faAtom} />}>
                    Activity
                  </Button>
                  <Button onClick={createObjectTypeNode} startIcon={<FontAwesomeIcon icon={faCube} />}>
                    Object Type
                  </Button>
                  <Button onClick={createControlFlowNode} startIcon={<FontAwesomeIcon icon={faArrowRight} />}>
                    Control Flow
                  </Button>
                  <Button onClick={createLogicalOperatorNode} startIcon={<FontAwesomeIcon icon={faProjectDiagram} />}>
                    Logic Op
                  </Button>
                </ButtonGroup>

                <Divider orientation="vertical" flexItem sx={{ marginRight: 2 }} />

                <ButtonGroup size="small">
                  <Button onClick={clearAll} color="warning" startIcon={<FontAwesomeIcon icon={faTrash} />}>
                    Clear
                  </Button>
                </ButtonGroup>
              </Toolbar>
            </Paper>
          </Panel>

          {/* Query Statistics Panel */}
          <Panel position="top-right">
            <Paper sx={{ padding: 2, minWidth: 220 }}>
              <Typography variant="subtitle2" gutterBottom>
                Query Statistics
              </Typography>
              <Typography variant="body2">
                Nodes: {nodes.length}
              </Typography>
              <Typography variant="body2">
                Edges: {edges.length}
              </Typography>
              <Typography variant="body2">
                Activities: {nodes.filter(n => n.type === 'activityQuery').length}
              </Typography>
              <Typography variant="body2">
                Object Types: {nodes.filter(n => n.type === 'objectTypeQuery').length}
              </Typography>
              <Typography variant="body2">
                Control Flow: {nodes.filter(n => n.type === 'controlFlowQuery').length}
              </Typography>
              <Typography variant="body2">
                Logic Ops: {nodes.filter(n => n.type === 'logicalOperator').length}
              </Typography>
              
              
              {metadataLoading && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Loading OCEL data...
                </Typography>
              )}
            </Paper>
          </Panel>

          {/* Instructions Panel */}
          {nodes.length === 0 && (
            <Panel position="bottom-center">
              <Paper sx={{ padding: 2, textAlign: 'center', maxWidth: 400 }}>
                <Typography variant="h6" gutterBottom>
                  Welcome to GOProQ Query Builder
                </Typography>
                <Typography variant="body2" paragraph>
                  Start by adding query nodes using the toolbar above, then connect them with edges to define relationships.
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  • Add Activity/Object Type nodes for your queries<br/>
                  • Connect nodes with Control Flow (DF/EF) or Logical (AND/OR/NOT) edges<br/>
                  • Double-click nodes to edit their properties<br/>
                  • Click edge labels to change operators
                </Typography>
              </Paper>
            </Panel>
          )}

          <Background />
          <Controls />
          <MiniMap 
            nodeColor={nodeColor}
            nodeStrokeWidth={2}
            position="bottom-right"
            style={{
              backgroundColor: '#f8f9fa',
            }}
          />
        </ReactFlow>
      </ReactFlowProvider>
    </Box>
  );
};

export default GraphicalQueryCreator;
