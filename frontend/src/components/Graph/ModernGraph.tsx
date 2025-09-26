import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Chip,
  Stack,
  Tooltip,
  Paper,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Close as CloseIcon,
  Info as InfoIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Schedule as ScheduleIcon
} from '@mui/icons-material';
import CytoscapeComponent from 'react-cytoscapejs';
import { getObjectTypeColor, getURI, secondsToHumanReadableFormat } from "../utils";
import cytoscape, { EventObject } from 'cytoscape';
import elk from 'cytoscape-elk';
import { OCPQNavbar } from "../Navbar/Navbar";

// Register the elk extension
cytoscape.use(elk);

const graphStylesheet: cytoscape.Stylesheet[] = [
  {
    "selector": 'node',
    'style': {
      "opacity": 0.9,
      "label": "data(label)",
      "background-color": "data(color)",
      "color": "#FFFFFF",
      "text-halign": "center",
      "text-valign": "center",
      'width': 80,
      "height": 40,
      "shape": "round-rectangle",
      "padding-left": ".5em",
      "padding-right": ".5em",
      "padding-top": ".2em",
      "padding-bottom": ".2em",
      "font-size": "12px",
      "font-weight": 500,
      "border-width": "2px",
      "border-color": "data(borderColor)",
      "border-style": "solid"
    }
  },
  {
    "selector": 'edge',
    "style": {
      "width": 3,
      "target-arrow-color": "data(color)",
      "target-arrow-shape": "triangle",
      "line-color": "data(color)",
      'arrow-scale': 1.5,
      "curve-style": "bezier",
      "label": "data(label)",
      "font-size": "10px",
      "color": "#333",
      "text-background-opacity": 1,
      "text-background-color": "#fff",
      "text-background-padding": "2px",
      "text-margin-y": -10
    }
  },
  {
    "selector": 'node:selected',
    "style": {
      "border-width": "3px",
      "border-color": "#ff6b35",
      "background-color": "data(color)",
      "opacity": 1
    }
  },
  {
    "selector": 'edge:selected',
    "style": {
      "line-color": "#ff6b35",
      "target-arrow-color": "#ff6b35",
      "width": "4"
    }
  }
];

interface ModernGraphProps {
  allAllowed: boolean;
  ocel?: string;
  indices?: number[];
}

interface ProcessExecutionData {
  nodes: any[];
  edges: any[];
  metadata?: {
    totalEvents: number;
    totalObjects: number;
    duration: number;
    activities: string[];
    objectTypes: string[];
  };
}

interface SelectionState {
  selectedNode: any | null;
  selectedEdge: any | null;
}

export const ModernGraph: React.FC<ModernGraphProps> = ({ allAllowed, ocel, indices }) => {
  const [elements, setElements] = useState<ProcessExecutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<SelectionState>({ selectedNode: null, selectedEdge: null });
  const [currentPEIndex, setCurrentPEIndex] = useState<number>(0);
  const [peIndices, setPeIndices] = useState<number[]>([]);
  const [totalPEs, setTotalPEs] = useState<number>(0);
  const cytoscapeRef = useRef<cytoscape.Core | null>(null);

  const filePath = ocel || localStorage.getItem('ocel') || 'data/order_fulfillment.jsonocel';

  useEffect(() => {
    if (allAllowed) {
      // Load all process executions
      loadAllPEs();
    } else if (indices && indices.length > 0) {
      // Load specific process executions
      setPeIndices(indices);
      setCurrentPEIndex(indices[0]);
      loadProcessExecution(indices[0]);
    } else {
      // Load from localStorage
      const storedIndices = localStorage.getItem('indices');
      if (storedIndices) {
        const parsedIndices = JSON.parse(storedIndices);
        setPeIndices(parsedIndices);
        setCurrentPEIndex(parsedIndices[0]);
        loadProcessExecution(parsedIndices[0]);
      } else {
        loadAllPEs();
      }
    }
  }, [allAllowed, indices]);

  const loadAllPEs = async () => {
    try {
      setLoading(true);
      const uri = getURI('/pq/ocel_metadata', {});
      const response = await fetch(uri, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath })
      });
      const data = await response.json();
      
      if (data.error) {
        setError(data.error);
        return;
      }

      const totalPEs = data.statistics?.total_process_executions || 0;
      setTotalPEs(totalPEs);
      const allIndices = Array.from({ length: totalPEs }, (_, i) => i);
      setPeIndices(allIndices);
      setCurrentPEIndex(0);
      loadProcessExecution(0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadProcessExecution = async (index: number) => {
    try {
      setLoading(true);
      setError(null);
      
      const uri = getURI('/pq/get_process_execution', { index: index, file_path: filePath });
      const response = await fetch(uri);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
        setElements(null);
        return;
      }

      // Transform data for Cytoscape
      const cytoscapeNodes = data.nodes.map((node: any) => ({
        data: {
          id: node.id,
          label: node.label,
          color: node.color || '#2196f3',
          borderColor: node.color || '#2196f3',
          object_type: node.object_type,
          activity: node.activity,
          start_time: node.start_time,
          end_time: node.end_time,
          duration: node.duration,
          events: node.events,
          objects: node.objects,
        }
      }));

      const cytoscapeEdges = data.edges.map((edge: any) => ({
        data: {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          label: edge.label,
          color: edge.color,
          type: edge.type,
          start_time: edge.start_time,
          end_time: edge.end_time,
          duration: edge.duration,
          events: edge.events,
          objects: edge.objects,
        }
      }));

      setElements({
        nodes: cytoscapeNodes,
        edges: cytoscapeEdges,
        metadata: {
          totalEvents: data.nodes.length,
          totalObjects: data.nodes.reduce((sum: number, node: any) => sum + (node.objects?.length || 0), 0),
          duration: data.nodes.reduce((sum: number, node: any) => sum + (node.duration || 0), 0),
          activities: Array.from(new Set(data.nodes.map((node: any) => node.activity))),
          objectTypes: Array.from(new Set(data.nodes.map((node: any) => node.object_type)))
        }
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNextPE = () => {
    const currentIndex = peIndices.indexOf(currentPEIndex);
    if (currentIndex < peIndices.length - 1) {
      const nextIndex = peIndices[currentIndex + 1];
      setCurrentPEIndex(nextIndex);
      loadProcessExecution(nextIndex);
    }
  };

  const handlePrevPE = () => {
    const currentIndex = peIndices.indexOf(currentPEIndex);
    if (currentIndex > 0) {
      const prevIndex = peIndices[currentIndex - 1];
      setCurrentPEIndex(prevIndex);
      loadProcessExecution(prevIndex);
    }
  };

  const handleNodeClick = (event: EventObject) => {
    const nodeData = event.target.data();
    setSelection({
      selectedNode: nodeData,
      selectedEdge: null
    });
  };

  const handleEdgeClick = (event: EventObject) => {
    const edgeData = event.target.data();
    setSelection({
      selectedNode: null,
      selectedEdge: edgeData
    });
  };

  const registerCytoscapeRef = (cy: cytoscape.Core) => {
    cytoscapeRef.current = cy;
    cy.on('tap', "node", handleNodeClick);
    cy.on('tap', 'edge', handleEdgeClick);
    
    // Prevent infinite growing and add proper constraints
    cy.on('ready', () => {
      try {
        cy.fit(undefined, 50); // Fit with padding
        cy.center();
      } catch (error) {
        console.warn('Layout ready handler error:', error);
      }
    });
    
    // Add zoom constraints
    cy.minZoom(0.1);
    cy.maxZoom(3);
  };

  const layout = {
    name: 'breadthfirst',
    directed: true,
    padding: 30,
    spacingFactor: 1.5,
    avoidOverlap: true,
    nodeDimensionsIncludeLabels: true,
    animate: true,
    animationDuration: 1000
  };

  const currentIndexInList = peIndices.indexOf(currentPEIndex) + 1;

  return (
    <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <OCPQNavbar />
      
      {/* Header */}
      <Box sx={{ p: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Process Execution Viewer
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
          Interactive visualization of object-centric process executions
        </Typography>
      </Box>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, display: 'flex', p: 3, gap: 3 }}>
        {/* Graph Area */}
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Controls */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">
              Process Execution {currentIndexInList} of {peIndices.length}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Chip
                label={`PE ID: ${currentPEIndex}`}
                color="primary"
                variant="outlined"
              />
              {elements?.metadata && (
                <>
                  <Chip
                    icon={<TimelineIcon />}
                    label={`${elements.metadata.totalEvents} events`}
                    color="secondary"
                    variant="outlined"
                  />
                  <Chip
                    icon={<SpeedIcon />}
                    label={`${elements.metadata.totalObjects} objects`}
                    color="success"
                    variant="outlined"
                  />
                </>
              )}
            </Stack>
          </Box>

          {/* Graph Container */}
          <Card sx={{ flexGrow: 1, minHeight: 500, overflow: 'hidden' }}>
            <CardContent sx={{ height: '100%', p: 0, position: 'relative' }}>
              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <CircularProgress />
                </Box>
              ) : error ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Alert severity="error">{error}</Alert>
                </Box>
              ) : elements ? (
                <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                  <CytoscapeComponent
                    elements={CytoscapeComponent.normalizeElements({ nodes: elements.nodes, edges: elements.edges })}
                    stylesheet={graphStylesheet}
                    layout={layout}
                    style={{ 
                      width: '100%', 
                      height: '100%', 
                      position: 'absolute',
                      top: 0,
                      left: 0
                    }}
                    cy={registerCytoscapeRef}
                  />
                </Box>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                  <Typography variant="h6" color="text.secondary">
                    No process execution data available
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          {/* Navigation */}
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2, gap: 2 }}>
            <IconButton
              onClick={handlePrevPE}
              disabled={currentIndexInList <= 1}
              color="primary"
              size="large"
            >
              ← Previous
            </IconButton>
            <Typography variant="body1">
              {currentIndexInList} of {peIndices.length}
            </Typography>
            <IconButton
              onClick={handleNextPE}
              disabled={currentIndexInList >= peIndices.length}
              color="primary"
              size="large"
            >
              Next →
            </IconButton>
          </Box>
        </Box>

        {/* Info Panel */}
        {selection.selectedNode || selection.selectedEdge ? (
          <Card sx={{ width: 350, height: 'fit-content' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  {selection.selectedNode ? 'Node Details' : 'Edge Details'}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setSelection({ selectedNode: null, selectedEdge: null })}
                >
                  <CloseIcon />
                </IconButton>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {selection.selectedNode && (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Activity</Typography>
                    <Typography variant="body1">{selection.selectedNode.activity}</Typography>
                  </Box>
                  
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Object Type</Typography>
                    <Chip
                      label={selection.selectedNode.object_type}
                      color="primary"
                      size="small"
                    />
                  </Box>

                  {selection.selectedNode.start_time && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Start Time</Typography>
                      <Typography variant="body2">
                        {new Date(selection.selectedNode.start_time).toLocaleString()}
                      </Typography>
                    </Box>
                  )}

                  {selection.selectedNode.end_time && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">End Time</Typography>
                      <Typography variant="body2">
                        {new Date(selection.selectedNode.end_time).toLocaleString()}
                      </Typography>
                    </Box>
                  )}

                  {selection.selectedNode.duration && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Duration</Typography>
                      <Typography variant="body2">
                        {secondsToHumanReadableFormat(selection.selectedNode.duration, 2)}
                      </Typography>
                    </Box>
                  )}

                  {selection.selectedNode.objects && selection.selectedNode.objects.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Objects</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {selection.selectedNode.objects.map((obj: string, index: number) => (
                          <Chip
                            key={index}
                            label={obj}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              )}

              {selection.selectedEdge && (
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Edge Type</Typography>
                    <Typography variant="body1">{selection.selectedEdge.type || 'Default'}</Typography>
                  </Box>

                  {selection.selectedEdge.label && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Label</Typography>
                      <Typography variant="body1">{selection.selectedEdge.label}</Typography>
                    </Box>
                  )}

                  {selection.selectedEdge.duration && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Duration</Typography>
                      <Typography variant="body2">
                        {secondsToHumanReadableFormat(selection.selectedEdge.duration, 2)}
                      </Typography>
                    </Box>
                  )}

                  {selection.selectedEdge.objects && selection.selectedEdge.objects.length > 0 && (
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">Objects</Typography>
                      <Stack direction="row" spacing={1} flexWrap="wrap">
                        {selection.selectedEdge.objects.map((obj: string, index: number) => (
                          <Chip
                            key={index}
                            label={obj}
                            size="small"
                            variant="outlined"
                          />
                        ))}
                      </Stack>
                    </Box>
                  )}
                </Stack>
              )}
            </CardContent>
          </Card>
        ) : (
          /* Process Execution Summary */
          elements?.metadata && (
            <Card sx={{ width: 350, height: 'fit-content' }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Process Execution Summary
                </Typography>
                
                <Divider sx={{ mb: 2 }} />

                <Stack spacing={2}>
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Total Events</Typography>
                    <Typography variant="h4" color="primary">
                      {elements.metadata.totalEvents}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Total Objects</Typography>
                    <Typography variant="h4" color="secondary">
                      {elements.metadata.totalObjects}
                    </Typography>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Activities</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {elements.metadata.activities.map((activity: string, index: number) => (
                        <Chip
                          key={index}
                          label={activity}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">Object Types</Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {elements.metadata.objectTypes.map((objType: string, index: number) => (
                        <Chip
                          key={index}
                          label={objType}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          )
        )}
      </Box>
    </Box>
  );
};

export default ModernGraph;
