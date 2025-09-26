import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Paper,
  Stack,
  IconButton,
  Tooltip,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Slider,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  Assessment as StatsIcon,
  Timeline as TimelineIcon,
  Speed as SpeedIcon,
  Memory as MemoryIcon,
  Visibility as ViewIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  BarChart as BarChartIcon,
  PieChart as PieChartIcon,
  ShowChart as LineChartIcon
} from '@mui/icons-material';
import { OCPQNavbar } from '../Navbar/Navbar';
import { getURI } from '../utils';

interface ProcessExecution {
  id: number;
  events: number;
  objects: number;
  duration: number;
  activities: string[];
  objectTypes: string[];
}

interface OCELStatistics {
  total_events: number;
  total_objects: number;
  total_process_executions: number;
  num_activities: number;
  num_object_types: number;
}

interface DataLensProps {
  allAllowed?: boolean;
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
      id={`datalens-tabpanel-${index}`}
      aria-labelledby={`datalens-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export const DataLens: React.FC<DataLensProps> = ({ allAllowed = true }) => {
  const [tabValue, setTabValue] = useState(0);
  const [statistics, setStatistics] = useState<OCELStatistics | null>(null);
  const [processExecutions, setProcessExecutions] = useState<ProcessExecution[]>([]);
  const [filteredPEs, setFilteredPEs] = useState<ProcessExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [minEvents, setMinEvents] = useState(0);
  const [maxEvents, setMaxEvents] = useState(1000);
  const [minDuration, setMinDuration] = useState(0);
  const [maxDuration, setMaxDuration] = useState(1000);
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedObjectTypes, setSelectedObjectTypes] = useState<string[]>([]);
  const [showOnlyFiltered, setShowOnlyFiltered] = useState(false);

  useEffect(() => {
    loadOCELData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [processExecutions, minEvents, maxEvents, minDuration, maxDuration, selectedActivities, selectedObjectTypes, showOnlyFiltered]);

  const loadOCELData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load OCEL metadata
      const metadataResponse = await fetch(getURI('/pq/ocel_metadata', {}), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: localStorage.getItem('ocel') || 'data/order_fulfillment.jsonocel' })
      });
      const metadata = await metadataResponse.json();

      if (metadata.error) {
        throw new Error(metadata.error);
      }

      setStatistics(metadata.statistics);

      // Load process executions from real OCEL data
      const realPEs = await generateRealProcessExecutions(metadata.statistics.total_process_executions);
      setProcessExecutions(realPEs);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load OCEL data');
    } finally {
      setLoading(false);
    }
  };

  const generateRealProcessExecutions = async (count: number): Promise<ProcessExecution[]> => {
    try {
      const filePath = localStorage.getItem('ocel') || 'data/order_process.jsonocel';
      const peData = [];
      
      // Fetch real process execution data
      for (let i = 0; i < Math.min(count, 100); i++) { // Limit to 100 for performance
        try {
          const uri = getURI('/pq/get_process_execution', { index: i, file_path: filePath });
          const response = await fetch(uri);
          const data = await response.json();
          
          if (data.error) {
            console.warn(`Failed to fetch PE ${i}:`, data.error);
            continue;
          }
          
          // Extract real activities and object types from the process execution
          const activities = Array.from(new Set(data.nodes.map((node: any) => node.activity).filter(Boolean))) as string[];
          const objectTypes = Array.from(new Set(data.nodes.map((node: any) => node.object_type).filter(Boolean))) as string[];
          
          // Calculate real duration (difference between last and first event)
          const timestamps = data.nodes
            .map((node: any) => {
              const endTime = node.end_time || node.start_time;
              return endTime ? new Date(endTime) : null;
            })
            .filter(Boolean)
            .sort((a: Date, b: Date) => a.getTime() - b.getTime());
          
          const duration = timestamps.length > 1 
            ? timestamps[timestamps.length - 1]!.getTime() - timestamps[0]!.getTime()
            : 0;
          
          // Calculate unique objects across all object types
          const allObjects = new Set<string>();
          data.nodes.forEach((node: any) => {
            if (node.objects && Array.isArray(node.objects)) {
              node.objects.forEach((obj: any) => allObjects.add(String(obj)));
            }
          });

          peData.push({
            id: i,
            events: data.nodes.length,
            objects: allObjects.size,
            duration: duration,
            activities: activities,
            objectTypes: objectTypes
          });
        } catch (error) {
          console.warn(`Error fetching PE ${i}:`, error);
        }
      }
      
      return peData;
    } catch (error) {
      console.error('Error generating real PEs:', error);
      return [];
    }
  };

  const applyFilters = () => {
    let filtered = processExecutions;

    if (showOnlyFiltered) {
      // Apply filters
      filtered = filtered.filter(pe => 
        pe.events >= minEvents && 
        pe.events <= maxEvents &&
        pe.duration >= minDuration && 
        pe.duration <= maxDuration &&
        (selectedActivities.length === 0 || selectedActivities.some(act => pe.activities.includes(act))) &&
        (selectedObjectTypes.length === 0 || selectedObjectTypes.some(ot => pe.objectTypes.includes(ot)))
      );
    }

    setFilteredPEs(filtered);
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
    if (ms < 86400000) return `${(ms / 3600000).toFixed(1)}h`;
    return `${(ms / 86400000).toFixed(1)}d`;
  };

  const getPerformanceColor = (value: number, max: number): "success" | "warning" | "error" => {
    const ratio = value / max;
    if (ratio < 0.3) return 'success';
    if (ratio < 0.7) return 'warning';
    return 'error';
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Box sx={{ textAlign: 'center' }}>
          <LinearProgress sx={{ width: 200, mb: 2 }} />
          <Typography>Loading OCEL data...</Typography>
        </Box>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <OCPQNavbar />
        <Box sx={{ p: 3 }}>
          <Alert severity="error" action={
            <Button color="inherit" size="small" onClick={loadOCELData}>
              Retry
            </Button>
          }>
            {error}
          </Alert>
        </Box>
      </Box>
    );
  }

  return (
    <Box>
      <OCPQNavbar />
      
      {/* Header */}
      <Box sx={{ p: 3, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Data Lens
        </Typography>
        <Typography variant="body1" sx={{ opacity: 0.9 }}>
          Comprehensive analysis and visualization of your object-centric process data
        </Typography>
      </Box>

      {/* Statistics Overview */}
      {statistics && (
        <Box sx={{ p: 3 }}>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={2.4}>
              <Card sx={{ textAlign: 'center', height: '100%' }}>
                <CardContent>
                  <TimelineIcon color="primary" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" component="div">
                    {statistics.total_events.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Events
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Card sx={{ textAlign: 'center', height: '100%' }}>
                <CardContent>
                  <MemoryIcon color="secondary" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" component="div">
                    {statistics.total_objects.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Unique Objects
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Card sx={{ textAlign: 'center', height: '100%' }}>
                <CardContent>
                  <BarChartIcon color="success" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" component="div">
                    {statistics.total_process_executions.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Process Executions
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Card sx={{ textAlign: 'center', height: '100%' }}>
                <CardContent>
                  <SpeedIcon color="info" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" component="div">
                    {statistics.num_activities}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Activities
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <Card sx={{ textAlign: 'center', height: '100%' }}>
                <CardContent>
                  <PieChartIcon color="warning" sx={{ fontSize: 40, mb: 1 }} />
                  <Typography variant="h4" component="div">
                    {statistics.num_object_types}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Object Types
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>
      )}

      {/* Main Content Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange} aria-label="data lens tabs">
          <Tab icon={<BarChartIcon />} label="Process Executions" iconPosition="start" />
          <Tab icon={<TimelineIcon />} label="Performance Analysis" iconPosition="start" />
          <Tab icon={<FilterIcon />} label="Filters & Search" iconPosition="start" />
          <Tab icon={<StatsIcon />} label="Statistics" iconPosition="start" />
        </Tabs>
      </Box>

      {/* Process Executions Tab */}
      <TabPanel value={tabValue} index={0}>
        <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">
            Process Executions ({filteredPEs.length})
          </Typography>
          <Stack direction="row" spacing={1}>
            <FormControlLabel
              control={
                <Switch
                  checked={showOnlyFiltered}
                  onChange={(e) => setShowOnlyFiltered(e.target.checked)}
                />
              }
              label="Apply Filters"
            />
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={loadOCELData}
            >
              Refresh
            </Button>
          </Stack>
        </Box>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>PE ID</strong></TableCell>
                    <TableCell><strong>Events</strong></TableCell>
                    <TableCell><strong>Objects</strong></TableCell>
                    <TableCell><strong>Duration</strong></TableCell>
                    <TableCell><strong>Activities</strong></TableCell>
                    <TableCell><strong>Object Types</strong></TableCell>
                    <TableCell><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
            <TableBody>
              {filteredPEs.slice(0, 100).map((pe) => (
                <TableRow key={pe.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      PE-{pe.id}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={pe.events}
                      size="small"
                      color={getPerformanceColor(pe.events, 20)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={pe.objects}
                      size="small"
                      color={getPerformanceColor(pe.objects, 10)}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDuration(pe.duration)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {pe.activities.slice(0, 3).map((activity, idx) => (
                        <Chip
                          key={idx}
                          label={activity}
                          size="small"
                          variant="outlined"
                        />
                      ))}
                      {pe.activities.length > 3 && (
                        <Chip
                          label={`+${pe.activities.length - 3}`}
                          size="small"
                          color="default"
                        />
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap">
                      {pe.objectTypes.map((ot, idx) => (
                        <Chip
                          key={idx}
                          label={ot}
                          size="small"
                          color="secondary"
                          variant="outlined"
                        />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="View Process Execution in Graph">
                      <IconButton
                        size="small"
                        onClick={() => {
                          // Store PE index for viewing in graph
                          localStorage.setItem('indices', JSON.stringify([pe.id]));
                          window.open('/process_execution_viewer', '_blank');
                        }}
                      >
                        <ViewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {filteredPEs.length > 100 && (
                <TableRow>
                  <TableCell colSpan={8} sx={{ textAlign: 'center', fontStyle: 'italic' }}>
                    ... and {filteredPEs.length - 100} more process executions
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </TabPanel>

      {/* Performance Analysis Tab */}
      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Duration Distribution
                </Typography>
                <Box sx={{ height: 200, display: 'flex', alignItems: 'end', gap: 1 }}>
                  {Array.from({ length: 10 }, (_, i) => {
                    const range = (maxDuration - minDuration) / 10;
                    const start = minDuration + i * range;
                    const end = start + range;
                    const count = filteredPEs.filter(pe => pe.duration >= start && pe.duration < end).length;
                    const height = (count / Math.max(...Array.from({ length: 10 }, (_, j) => {
                      const r = (maxDuration - minDuration) / 10;
                      const s = minDuration + j * r;
                      const e = s + r;
                      return filteredPEs.filter(pe => pe.duration >= s && pe.duration < e).length;
                    }))) * 100;
                    
                    return (
                      <Box
                        key={i}
                        sx={{
                          flex: 1,
                          height: `${height}%`,
                          backgroundColor: 'primary.main',
                          borderRadius: '4px 4px 0 0',
                          minHeight: 4
                        }}
                      />
                    );
                  })}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Event Count Distribution
                </Typography>
                <List dense>
                  {Array.from({ length: 5 }, (_, i) => {
                    const range = Math.ceil(maxEvents / 5);
                    const start = i * range;
                    const end = Math.min((i + 1) * range, maxEvents);
                    const count = filteredPEs.filter(pe => pe.events >= start && pe.events < end).length;
                    const percentage = (count / filteredPEs.length) * 100;
                    
                    return (
                      <ListItem key={i}>
                        <ListItemText
                          primary={`${start}-${end-1} events`}
                          secondary={`${count} PEs (${percentage.toFixed(1)}%)`}
                        />
                        <LinearProgress
                          variant="determinate"
                          value={percentage}
                          sx={{ width: 100, height: 8, borderRadius: 4 }}
                        />
                      </ListItem>
                    );
                  })}
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Filters & Search Tab */}
      <TabPanel value={tabValue} index={2}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Event Count Filter
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Range: {minEvents} - {maxEvents} events
                </Typography>
                <Slider
                  value={[minEvents, maxEvents]}
                  onChange={(_, newValue) => {
                    const [min, max] = newValue as number[];
                    setMinEvents(min);
                    setMaxEvents(max);
                  }}
                  valueLabelDisplay="auto"
                  min={0}
                  max={Math.max(...processExecutions.map(pe => pe.events))}
                  step={1}
                />
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Duration Filter
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Range: {formatDuration(minDuration)} - {formatDuration(maxDuration)}
                </Typography>
                <Slider
                  value={[minDuration, maxDuration]}
                  onChange={(_, newValue) => {
                    const [min, max] = newValue as number[];
                    setMinDuration(min);
                    setMaxDuration(max);
                  }}
                  valueLabelDisplay="auto"
                  min={0}
                  max={Math.max(...processExecutions.map(pe => pe.duration))}
                  step={10}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Statistics Tab */}
      <TabPanel value={tabValue} index={3}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Process Execution Summary
                </Typography>
                <List>
                  <ListItem>
                    <ListItemIcon><SuccessIcon color="success" /></ListItemIcon>
                    <ListItemText
                      primary="Total Process Executions"
                      secondary={filteredPEs.length.toLocaleString()}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><TimelineIcon color="primary" /></ListItemIcon>
                    <ListItemText
                      primary="Average Events per PE"
                      secondary={(filteredPEs.reduce((sum, pe) => sum + pe.events, 0) / filteredPEs.length).toFixed(1)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><MemoryIcon color="secondary" /></ListItemIcon>
                    <ListItemText
                      primary="Average Objects per PE"
                      secondary={(filteredPEs.reduce((sum, pe) => sum + pe.objects, 0) / filteredPEs.length).toFixed(1)}
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon><SpeedIcon color="info" /></ListItemIcon>
                    <ListItemText
                      primary="Average Duration"
                      secondary={formatDuration(filteredPEs.reduce((sum, pe) => sum + pe.duration, 0) / filteredPEs.length)}
                    />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Performance Insights
                </Typography>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Performance analysis helps identify bottlenecks and optimization opportunities in your process.
                </Alert>
                <Typography variant="body2" color="text.secondary">
                  Use the filters and analysis tools to gain insights into your process execution patterns.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>
    </Box>
  );
};

export default DataLens;
