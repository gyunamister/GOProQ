import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Stack,
  Divider,
  IconButton,
  Tooltip,
  LinearProgress,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Badge
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  PlayArrow as PlayIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as TimeIcon,
  Assessment as StatsIcon,
  Visibility as ViewIcon,
  Code as CodeIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon
} from '@mui/icons-material';
import { Node, Edge } from 'reactflow';
import { getURI } from '../utils';

interface QueryResults {
  length: number;
  indices: number[];
  executionTime: number;
  queryStructure?: any;
  statistics?: {
    total_executions: number;
    satisfied_executions: number;
    satisfaction_rate: number;
    execution_time: number;
  };
}

interface ModernQueryResultsProps {
  queryCount: number;
  queryIndices: number[];
  executionTime?: number;
  queryStructure?: any;
  onViewPEs?: (indices: number[]) => void;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`results-tabpanel-${index}`}
      aria-labelledby={`results-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const ModernQueryResults: React.FC<ModernQueryResultsProps> = ({
  queryCount,
  queryIndices,
  executionTime = 0,
  queryStructure,
  onViewPEs
}) => {
  const [tabValue, setTabValue] = useState(0);
  const [statistics, setStatistics] = useState<any>(null);

  useEffect(() => {
    // Load statistics from localStorage
    const storedStats = localStorage.getItem('last_query_statistics');
    if (storedStats) {
      try {
        setStatistics(JSON.parse(storedStats));
      } catch (e) {
        console.error('Error parsing query statistics:', e);
      }
    }
  }, [queryCount]);

  // Ensure OCEL metadata is loaded
  useEffect(() => {
    const ocelStats = localStorage.getItem('ocel_metadata_statistics');
    if (!ocelStats) {
      console.warn('OCEL metadata not found in localStorage. Total PEs may not be calculated correctly.');
      // Try to fetch OCEL metadata if not available
      fetchOcelMetadataIfNeeded();
    }
  }, []);

  const fetchOcelMetadataIfNeeded = async () => {
    try {
      const filePath = localStorage.getItem('ocel') || 'data/order_fulfillment.jsonocel';
      const uri = getURI('/pq/ocel_metadata', {});
      const response = await fetch(uri, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath })
      });
      const data = await response.json();
      
      if (!data.error) {
        localStorage.setItem('ocel_metadata_statistics', JSON.stringify(data.statistics));
        console.log('OCEL metadata fetched and stored:', data.statistics);
        // Force re-render by updating a state
        setStatistics(data.statistics);
      }
    } catch (error) {
      console.error('Error fetching OCEL metadata:', error);
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const formatExecutionTime = (time: number): string => {
    if (time < 0.001) {
      return '<1ms';
    } else if (time < 1) {
      return `${(time * 1000).toFixed(1)}ms`;
    } else {
      return `${time.toFixed(3)}s`;
    }
  };

  const getSatisfactionRate = (): number => {
    const ocelStats = localStorage.getItem('ocel_metadata_statistics');
    if (ocelStats) {
      const stats = JSON.parse(ocelStats);
      const totalPEs = stats.total_process_executions || 0;
      return totalPEs > 0 ? (queryCount / totalPEs) * 100 : 0;
    }
    return 0;
  };

  const getTotalPEs = (): number => {
    const ocelStats = localStorage.getItem('ocel_metadata_statistics');
    if (ocelStats) {
      const stats = JSON.parse(ocelStats);
      const totalPEs = stats.total_process_executions || 0;
      console.log('Total PEs from OCEL metadata:', totalPEs);
      return totalPEs;
    }
    console.warn('OCEL metadata not found in localStorage');
    return 0;
  };

  const getSatisfactionColor = (rate: number): "success" | "warning" | "error" => {
    if (rate >= 50) return 'success';
    if (rate >= 20) return 'warning';
    return 'error';
  };

  const renderQueryStructure = (structure: any, depth: number = 0): React.ReactNode => {
    if (!structure) return null;

    const indent = depth * 20;
    const getQueryTypeColor = (queryType: string) => {
      switch (queryType) {
        case 'ActivityQuery': return '#1976d2';
        case 'ObjectTypeQuery': return '#9c27b0';
        case 'ControlFlowQuery': return '#2e7d32';
        case 'ComposedQuery': return '#ed6c02';
        default: return '#666';
      }
    };

    return (
      <Box sx={{ marginLeft: `${indent}px`, marginBottom: 1 }}>
        <Card variant="outlined" sx={{ backgroundColor: depth === 0 ? '#f8f9fa' : 'white' }}>
          <CardContent sx={{ padding: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', marginBottom: 1 }}>
              <Chip
                label={structure.type}
                sx={{ 
                  backgroundColor: getQueryTypeColor(structure.type),
                  color: 'white',
                  fontWeight: 'bold'
                }}
                size="small"
              />
              {structure.operator && (
                <Chip
                  label={structure.operator}
                  variant="outlined"
                  size="small"
                  sx={{ marginLeft: 1 }}
                />
              )}
            </Box>

            {structure.components && (
              <Box sx={{ marginTop: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Components:
                </Typography>
                <Box sx={{ 
                  backgroundColor: '#f5f5f5', 
                  padding: 1, 
                  borderRadius: 1, 
                  marginTop: 0.5,
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  overflow: 'auto',
                  maxHeight: '200px'
                }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(structure.components, null, 2)}
                  </pre>
                </Box>
              </Box>
            )}

            {structure.left && (
              <Box sx={{ marginTop: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Left Operand:
                </Typography>
                {renderQueryStructure(structure.left, depth + 1)}
              </Box>
            )}
            {structure.right && (
              <Box sx={{ marginTop: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Right Operand:
                </Typography>
                {renderQueryStructure(structure.right, depth + 1)}
              </Box>
            )}
            {structure.operand && (
              <Box sx={{ marginTop: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">
                  Operand:
                </Typography>
                {renderQueryStructure(structure.operand, depth + 1)}
              </Box>
            )}
          </CardContent>
        </Card>
      </Box>
    );
  };

  if (queryCount < 0) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        Query execution failed. Please check your query and try again.
      </Alert>
    );
  }

  const satisfactionRate = getSatisfactionRate();
  const totalPEs = getTotalPEs();

  return (
    <Box sx={{ width: '100%', mt: 3 }}>
      {/* Results Summary Card */}
      <Card sx={{ mb: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <CardContent>
          <Grid container spacing={3} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="h4" component="h2" gutterBottom>
                Query Results
              </Typography>
              <Typography variant="h6" sx={{ opacity: 0.9 }}>
                {queryCount} Process Executions Found
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Stack direction="row" spacing={2} justifyContent="flex-end">
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" component="div">
                    {queryCount}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Matching PEs
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.3)' }} />
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" component="div">
                    {totalPEs}
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Total PEs
                  </Typography>
                </Box>
                <Divider orientation="vertical" flexItem sx={{ bgcolor: 'rgba(255,255,255,0.3)' }} />
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h3" component="div">
                    {satisfactionRate.toFixed(1)}%
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>
                    Satisfaction Rate
                  </Typography>
                </Box>
              </Stack>
            </Grid>
          </Grid>
          
          {/* Execution Time and Performance */}
          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip
              icon={<TimeIcon />}
              label={`Execution Time: ${formatExecutionTime(executionTime)}`}
              variant="outlined"
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}
            />
            <Chip
              icon={<SpeedIcon />}
              label={`${(queryCount / executionTime).toFixed(0)} PEs/sec`}
              variant="outlined"
              sx={{ color: 'white', borderColor: 'rgba(255,255,255,0.5)' }}
            />
          </Box>
        </CardContent>
      </Card>

      {/* Tabs for different views */}
      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs value={tabValue} onChange={handleTabChange} aria-label="query results tabs">
            <Tab 
              icon={<ViewIcon />} 
              label="Process Executions" 
              iconPosition="start"
            />
            <Tab 
              icon={<CodeIcon />} 
              label="Query Structure" 
              iconPosition="start"
            />
            <Tab 
              icon={<StatsIcon />} 
              label="Performance" 
              iconPosition="start"
            />
          </Tabs>
        </Box>

        {/* Process Executions Tab */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Satisfied Process Executions ({queryIndices.length})
            </Typography>
            {onViewPEs && (
              <Button
                variant="contained"
                startIcon={<ViewIcon />}
                onClick={() => onViewPEs(queryIndices)}
                sx={{ borderRadius: 2 }}
              >
                View in Graph
              </Button>
            )}
          </Box>

          {queryIndices.length === 0 ? (
            <Alert severity="info">
              No process executions satisfy this query.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>#</strong></TableCell>
                    <TableCell><strong>Process Execution ID</strong></TableCell>
                    <TableCell><strong>Status</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {queryIndices.slice(0, 100).map((index, i) => (
                    <TableRow key={i} hover>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          PE-{index}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<SuccessIcon />}
                          label="Satisfied"
                          color="success"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Tooltip title="View in Graph">
                          <IconButton
                            size="small"
                            onClick={() => onViewPEs && onViewPEs([index])}
                          >
                            <ViewIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                  {queryIndices.length > 100 && (
                    <TableRow>
                      <TableCell colSpan={4} sx={{ textAlign: 'center', fontStyle: 'italic' }}>
                        ... and {queryIndices.length - 100} more process executions
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* Query Structure Tab */}
        <TabPanel value={tabValue} index={1}>
          {queryStructure ? (
            <Box>
              <Typography variant="h6" gutterBottom>
                Query Structure Analysis
              </Typography>
              {renderQueryStructure(queryStructure)}
            </Box>
          ) : (
            <Alert severity="info">
              No query structure information available.
            </Alert>
          )}
        </TabPanel>

        {/* Performance Tab */}
        <TabPanel value={tabValue} index={2}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Execution Metrics
                  </Typography>
                  <List dense>
                    <ListItem>
                      <ListItemIcon>
                        <TimeIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Execution Time"
                        secondary={formatExecutionTime(executionTime)}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <MemoryIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Process Executions Evaluated"
                        secondary={totalPEs.toLocaleString()}
                      />
                    </ListItem>
                    <ListItem>
                      <ListItemIcon>
                        <SuccessIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary="Satisfied Executions"
                        secondary={queryCount.toLocaleString()}
                      />
                    </ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Satisfaction Analysis
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2">Satisfaction Rate</Typography>
                      <Typography variant="body2">{satisfactionRate.toFixed(1)}%</Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={satisfactionRate}
                      color={getSatisfactionColor(satisfactionRate)}
                      sx={{ height: 8, borderRadius: 4 }}
                    />
                  </Box>
                  
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Performance Rating
                    </Typography>
                    <Chip
                      label={satisfactionRate >= 50 ? 'High' : satisfactionRate >= 20 ? 'Medium' : 'Low'}
                      color={getSatisfactionColor(satisfactionRate)}
                      variant="outlined"
                    />
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>
      </Card>
    </Box>
  );
};

export default ModernQueryResults;
