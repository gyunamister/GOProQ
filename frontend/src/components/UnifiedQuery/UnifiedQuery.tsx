import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  Grid,
  Chip,
  Stack,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  Alert,
  Paper,
  Badge
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as PlayIcon,
  ContentCopy as CopyIcon,
  QueryStats as QueryIcon,
  Schedule as ScheduleIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Visibility as ViewIcon,
  Code as CodeIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon
} from '@mui/icons-material';
import { GraphicalQueryCreator } from '../QueryCreator/GraphicalQueryCreator';
import ModernQueryResults from '../QueryResults/ModernQueryResults';
import { Node, Edge } from 'reactflow';
import { OCPQNavbar } from '../Navbar/Navbar';
import { getURI } from '../utils';

interface SavedQuery {
  id: string;
  name: string;
  description?: string;
  nodes: Node[];
  edges: Edge[];
  createdAt: Date;
  lastExecuted?: Date;
  executionCount: number;
  lastResult?: {
    count: number;
    executionTime: number;
    success: boolean;
  };
}

interface UnifiedQueryProps {
  filePath: string;
}


export const UnifiedQuery: React.FC<UnifiedQueryProps> = ({ filePath }) => {
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [selectedQuery, setSelectedQuery] = useState<SavedQuery | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState<string | null>(null);
  const [queryName, setQueryName] = useState('');
  const [queryDescription, setQueryDescription] = useState('');
  const [editingNodes, setEditingNodes] = useState<Node[]>([]);
  const [editingEdges, setEditingEdges] = useState<Edge[]>([]);
  
  // Query execution state
  const [currentNodes, setCurrentNodes] = useState<Node[]>([]);
  const [currentEdges, setCurrentEdges] = useState<Edge[]>([]);
  const [queryCount, setQueryCount] = useState<number>(-1);
  const [queryIndices, setQueryIndices] = useState<number[]>([]);
  const [executionTime, setExecutionTime] = useState<number>(0);
  const [queryStructure, setQueryStructure] = useState<any>(null);
  const [executing, setExecuting] = useState(false);
  const [ocelMetadataLoaded, setOcelMetadataLoaded] = useState(false);

  useEffect(() => {
    loadSavedQueries();
    fetchOcelMetadata();
  }, []);

  const fetchOcelMetadata = async () => {
    try {
      const uri = getURI('/pq/ocel_metadata', {});
      const response = await fetch(uri, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath })
      });
      const data = await response.json();
      
      if (data.error) {
        console.error('Error fetching OCEL metadata:', data.error);
        return;
      }

      // Store OCEL metadata in localStorage for Query Results component
      localStorage.setItem('ocel_metadata_statistics', JSON.stringify(data.statistics));
      setOcelMetadataLoaded(true);
      console.log('OCEL metadata loaded:', data.statistics);
    } catch (error) {
      console.error('Error fetching OCEL metadata:', error);
    }
  };

  const loadSavedQueries = () => {
    try {
      const saved = localStorage.getItem('savedQueries');
      if (saved) {
        const queries = JSON.parse(saved).map((q: any) => ({
          ...q,
          createdAt: new Date(q.createdAt),
          lastExecuted: q.lastExecuted ? new Date(q.lastExecuted) : undefined
        }));
        setSavedQueries(queries);
      }
    } catch (error) {
      console.error('Error loading saved queries:', error);
    }
  };

  const saveQueries = (queries: SavedQuery[]) => {
    localStorage.setItem('savedQueries', JSON.stringify(queries));
    setSavedQueries(queries);
  };

  const handleCreateQuery = () => {
    setQueryName('');
    setQueryDescription('');
    // Don't reset editing nodes/edges - let GraphicalQueryCreator load from localStorage
    setCreateDialogOpen(true);
  };

  const handleEditQuery = (query: SavedQuery) => {
    setSelectedQuery(query);
    setQueryName(query.name);
    setQueryDescription(query.description || '');
    setEditingNodes([...query.nodes]); // Create a copy to avoid reference issues
    setEditingEdges([...query.edges]); // Create a copy to avoid reference issues
    setEditDialogOpen(true);
  };

  const handleSaveQuery = () => {
    if (!queryName.trim()) return;

    // Use the current editing state (which should be updated by the child component)
    let currentNodes = editingNodes;
    let currentEdges = editingEdges;
    
    console.log("DEBUG: Save function - editingNodes:", editingNodes.length, "editingEdges:", editingEdges.length);
    
    // Only use localStorage fallback if we're in create mode and editing state is empty
    if (!selectedQuery && editingNodes.length === 0 && editingEdges.length === 0) {
      try {
        const savedNodes = localStorage.getItem('savedQueryNodes');
        const savedEdges = localStorage.getItem('savedQueryEdges');
        
        if (savedNodes) {
          currentNodes = JSON.parse(savedNodes);
          console.log("DEBUG: Using nodes from localStorage for save (create mode):", currentNodes.length);
        }
        
        if (savedEdges) {
          currentEdges = JSON.parse(savedEdges);
          console.log("DEBUG: Using edges from localStorage for save (create mode):", currentEdges.length);
        }
      } catch (error) {
        console.error("Error loading from localStorage for save:", error);
      }
    } else {
      console.log("DEBUG: Using editing state for save:", currentNodes.length, "nodes,", currentEdges.length, "edges");
    }

    const queryData: SavedQuery = {
      id: selectedQuery?.id || `query-${Date.now()}`,
      name: queryName.trim(),
      description: queryDescription.trim(),
      nodes: currentNodes,
      edges: currentEdges,
      createdAt: selectedQuery?.createdAt || new Date(),
      executionCount: selectedQuery?.executionCount || 0,
      lastResult: selectedQuery?.lastResult
    };

    const updatedQueries = selectedQuery
      ? savedQueries.map(q => q.id === selectedQuery.id ? queryData : q)
      : [...savedQueries, queryData];

    saveQueries(updatedQueries);
    setEditDialogOpen(false);
    setCreateDialogOpen(false);
    setSelectedQuery(null);
  };

  const handleDeleteQuery = (queryId: string) => {
    const updatedQueries = savedQueries.filter(q => q.id !== queryId);
    saveQueries(updatedQueries);
    setDeleteDialogOpen(null);
  };

  const handleExecuteQuery = async (query: SavedQuery) => {
    setCurrentNodes(query.nodes);
    setCurrentEdges(query.edges);
    
    // Execute the query and get the result
    const result = await executeQuery(query.nodes, query.edges);
    
    // Update execution count and timestamp with the actual result
    const updatedQueries = savedQueries.map(q => 
      q.id === query.id 
        ? { 
            ...q, 
            lastExecuted: new Date(), 
            executionCount: q.executionCount + 1,
            lastResult: {
              count: result.count,
              executionTime: result.executionTime,
              success: result.success
            }
          }
        : q
    );
    saveQueries(updatedQueries);
    
    // Results will be displayed below the query list
  };

  const executeQuery = async (nodes: Node[], edges: Edge[]) => {
    if (nodes.length === 0) {
      setQueryCount(0);
      setQueryIndices([]);
      return { count: 0, executionTime: 0, success: true };
    }

    setExecuting(true);
    try {
      const uri = getURI('/pq/goproq_query', {});
      const payload = {
        query: { nodes, edges },
        file_path: filePath,
        live_mode: false
      };
      
      console.log('Executing query with payload:', payload);
      console.log('URI:', uri);

      const response = await fetch(uri, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Query execution result:', result);

      if (result.error) {
        console.error('Query execution error:', result.error);
        setQueryCount(0);
        setQueryIndices([]);
        return { count: 0, executionTime: 0, success: false };
      }

      const count = result.length || 0;
      const executionTime = result.run?.raw_time || 0;
      
      setQueryCount(count);
      setQueryIndices(result.indices || []);
      setExecutionTime(executionTime);
      
      if (result.query_structure) {
        setQueryStructure(result.query_structure);
        localStorage.setItem('last_query_structure', JSON.stringify(result.query_structure));
      }

      return { count, executionTime, success: true };
    } catch (error) {
      console.error('Error executing query:', error);
      setQueryCount(0);
      return { count: 0, executionTime: 0, success: false };
    } finally {
      setExecuting(false);
    }
  };

  const handleDuplicateQuery = (query: SavedQuery) => {
    const duplicatedQuery: SavedQuery = {
      ...query,
      id: `query-${Date.now()}`,
      name: `${query.name} (Copy)`,
      createdAt: new Date(),
      executionCount: 0,
      lastResult: undefined
    };
    
    const updatedQueries = [...savedQueries, duplicatedQuery];
    saveQueries(updatedQueries);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getQueryTypeChip = (nodes: Node[]) => {
    const types = new Set(nodes.map(n => n.type));
    if (types.size === 1) {
      const type = Array.from(types)[0];
      switch (type) {
        case 'activityQuery': return { label: 'Activity', color: 'primary' as const };
        case 'objectTypeQuery': return { label: 'Object Type', color: 'secondary' as const };
        case 'controlFlowQuery': return { label: 'Control Flow', color: 'success' as const };
        case 'logicalOperator': return { label: 'Logical', color: 'info' as const };
        default: return { label: 'Mixed', color: 'default' as const };
      }
    }
    return { label: 'Composed', color: 'warning' as const };
  };


  return (
    <Box>
      <OCPQNavbar />
      
      {/* Header */}
      <Box sx={{ p: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          GOProQ Query System
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
          Build, manage, and execute object-centric process queries
        </Typography>
      </Box>

      {/* Main Content - Saved Queries */}
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h6">
            Saved Queries ({savedQueries.length})
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateQuery}
            sx={{ borderRadius: 2 }}
          >
            New Query
          </Button>
        </Box>

        {savedQueries.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <QueryIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No saved queries yet
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Create your first query to get started with GOProQ
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateQuery}
              sx={{ borderRadius: 2 }}
            >
              Create Query
            </Button>
          </Paper>
        ) : (
          <Grid container spacing={2}>
            {savedQueries.map((query) => {
              const typeChip = getQueryTypeChip(query.nodes);
              return (
                <Grid item xs={12} md={6} lg={4} key={query.id}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: 4
                      }
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                        <Typography variant="h6" component="h3" noWrap>
                          {query.name}
                        </Typography>
                        <Chip 
                          label={typeChip.label} 
                          color={typeChip.color} 
                          size="small"
                        />
                      </Box>
                      
                      {query.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {query.description}
                        </Typography>
                      )}

                      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                        <Chip
                          icon={<ScheduleIcon />}
                          label={`${query.executionCount} runs`}
                          size="small"
                          variant="outlined"
                        />
                        {query.lastResult && (
                          <Chip
                            icon={query.lastResult.success ? <SuccessIcon /> : <ErrorIcon />}
                            label={query.lastResult.success ? `${query.lastResult.count} PEs` : 'Error'}
                            size="small"
                            color={query.lastResult.success ? 'success' : 'error'}
                            variant="outlined"
                          />
                        )}
                      </Stack>

                      <Typography variant="caption" color="text.secondary">
                        Created: {formatDate(query.createdAt)}
                      </Typography>
                      {query.lastExecuted && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Last run: {formatDate(query.lastExecuted)}
                        </Typography>
                      )}
                    </CardContent>

                    <Divider />
                    
                    <Box sx={{ p: 2, display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        startIcon={<PlayIcon />}
                        onClick={() => handleExecuteQuery(query)}
                        sx={{ flexGrow: 1 }}
                      >
                        Execute
                      </Button>
                      <IconButton
                        size="small"
                        onClick={() => handleEditQuery(query)}
                        title="Edit Query"
                      >
                        <EditIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDuplicateQuery(query)}
                        title="Duplicate Query"
                      >
                        <CopyIcon />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => setDeleteDialogOpen(query.id)}
                        title="Delete Query"
                        color="error"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}

        {/* Query Results */}
        {queryCount >= 0 && (
          <Box sx={{ mt: 4 }}>
            <ModernQueryResults 
              key={ocelMetadataLoaded ? 'loaded' : 'loading'}
              queryCount={queryCount}
              queryIndices={queryIndices}
              executionTime={executionTime}
              queryStructure={queryStructure}
              onViewPEs={(indices) => {
                localStorage.setItem('indices', JSON.stringify(indices));
                window.open('/process_execution_viewer', '_blank');
              }}
            />
          </Box>
        )}
        
        {!ocelMetadataLoaded && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Loading OCEL metadata...
          </Alert>
        )}
      </Box>

      {/* Edit/Create Query Dialog */}
      <Dialog 
        open={editDialogOpen || createDialogOpen} 
        onClose={() => {
          setEditDialogOpen(false);
          setCreateDialogOpen(false);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          {editDialogOpen ? 'Edit Query' : 'Create New Query'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 3 }}>
            <TextField
              fullWidth
              label="Query Name"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description (Optional)"
              value={queryDescription}
              onChange={(e) => setQueryDescription(e.target.value)}
              multiline
              rows={2}
            />
          </Box>
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" gutterBottom sx={{ mb: 0 }}>
              Query Builder
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                Nodes: {editingNodes.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Edges: {editingEdges.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Activities: {editingNodes.filter(n => n.type === 'activityQuery').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Object Types: {editingNodes.filter(n => n.type === 'objectTypeQuery').length}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ height: 500, border: '1px solid #e0e0e0', borderRadius: 1 }}>
            <GraphicalQueryCreator
              onClose={() => {
                setEditDialogOpen(false);
                setCreateDialogOpen(false);
              }}
              nodes={editingNodes}
              edges={editingEdges}
              name={queryName}
              filePath={filePath}
              onQueryChange={(nodes, edges) => {
                console.log("DEBUG: Parent received query change:", nodes.length, "nodes,", edges.length, "edges");
                setEditingNodes(nodes);
                setEditingEdges(edges);
              }}
              onNodesInit={(nodes) => setEditingNodes(nodes)}
              onEdgesInit={(edges) => setEditingEdges(edges)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setEditDialogOpen(false);
            setCreateDialogOpen(false);
          }}>
            Cancel
          </Button>
          <Button 
            onClick={handleSaveQuery}
            variant="contained"
            disabled={!queryName.trim()}
          >
            {editDialogOpen ? 'Update Query' : 'Create Query'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen !== null}
        onClose={() => setDeleteDialogOpen(null)}
      >
        <DialogTitle>Delete Query</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this query? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(null)}>Cancel</Button>
          <Button 
            onClick={() => deleteDialogOpen && handleDeleteQuery(deleteDialogOpen)}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UnifiedQuery;
