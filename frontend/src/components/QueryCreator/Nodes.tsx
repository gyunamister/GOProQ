/**
 * Node Components for Graphical GOProQ Query Building
 * Implements the three fundamental query types as drag-and-drop nodes
 */

import React, { useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { 
  Box, 
  Typography, 
  Chip, 
  Card, 
  CardContent, 
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Autocomplete,
  FormControlLabel,
  Radio,
  RadioGroup,
  Grid
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import CloseIcon from '@mui/icons-material/Close';
import { ActivityQuery, ObjectTypeQuery, ControlFlowQuery } from './QueryCreator';

// Activity Query Node
export const ActivityQueryNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  const [editOpen, setEditOpen] = useState(false);
  const query: ActivityQuery = data?.query || {};
  
  // Local state for editing
  const [localQuery, setLocalQuery] = useState<ActivityQuery>({
    type: 'ActivityQuery',
    objectComponent: {
      objectType: query.objectComponent?.objectType || 'ANY',
      operator: query.objectComponent?.operator,
      count: query.objectComponent?.count
    },
    activityComponent: {
      activities: query.activityComponent?.activities || [],
      activityType: query.activityComponent?.activityType || 'single',
      quantifier: query.activityComponent?.quantifier,
      operator: query.activityComponent?.operator,
      count: query.activityComponent?.count
    }
  });

  const handleSave = () => {
    console.log("DEBUG: ActivityQuery handleSave called");
    console.log("DEBUG: Node ID:", id);
    console.log("DEBUG: Current data:", data);
    console.log("DEBUG: Local query:", localQuery);
    console.log("DEBUG: New data to save:", { ...data, query: localQuery });
    
    if (data.onUpdate) {
      data.onUpdate(id, { ...data, query: localQuery });
    }
    setEditOpen(false);
  };

  const handleDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
  };

  const handleActivityChange = (newActivities: string[]) => {
    setLocalQuery(prev => ({
      ...prev,
      activityComponent: {
        ...prev.activityComponent,
        activities: newActivities
      }
    }));
  };

  const getDisplayLabel = () => {
    const activities = query.activityComponent?.activities || [];
    if (activities.length === 0) return 'No activities';
    if (activities.length === 1) return activities[0];
    return `${activities.length} activities`;
  };

  return (
    <>
      <Card 
        sx={{ 
          minWidth: 220, 
          border: selected ? '2px solid #1976d2' : '1px solid #ccc',
          backgroundColor: '#e3f2fd',
          cursor: 'pointer'
        }}
        onClick={() => setEditOpen(true)}
      >
        <Handle type="target" position={Position.Top} />
        <CardContent sx={{ padding: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6" sx={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
              Activity Query
            </Typography>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(); }} color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
          
          <Box sx={{ marginBottom: 1 }}>
            <Typography variant="caption" color="text.secondary">Object:</Typography>
            <Chip 
              label={query?.objectComponent?.objectType || 'ANY'} 
              size="small" 
              sx={{ marginLeft: 1 }}
            />
            {query?.objectComponent?.operator && (
              <Chip 
                label={`${query.objectComponent.operator} ${query.objectComponent.count}`}
                size="small"
                color="warning"
                sx={{ marginLeft: 0.5 }}
              />
            )}
          </Box>
          
          <Box sx={{ marginBottom: 1 }}>
            <Typography variant="caption" color="text.secondary">Type:</Typography>
            <Chip 
              label={query?.activityComponent?.activityType || 'single'} 
              size="small" 
              sx={{ marginLeft: 1 }}
              color="primary"
            />
          </Box>
          
          <Box sx={{ marginBottom: 1 }}>
            <Typography variant="caption" color="text.secondary">Activities:</Typography>
            <Chip 
              label={getDisplayLabel()}
              size="small"
              variant="outlined"
              sx={{ marginLeft: 1 }}
            />
          </Box>
          
          {query?.activityComponent?.quantifier && (
            <Box sx={{ marginBottom: 1 }}>
              <Chip 
                label={`Quantifier: ${query.activityComponent.quantifier}`}
                size="small"
                color="secondary"
              />
            </Box>
          )}
          
          {query?.activityComponent?.operator && query?.activityComponent?.count && (
            <Box>
              <Chip 
                label={`${query.activityComponent.operator} ${query.activityComponent.count}`}
                size="small"
                color="warning"
              />
            </Box>
          )}
        </CardContent>
        <Handle type="source" position={Position.Bottom} />
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            Edit Activity Query
            <IconButton onClick={() => setEditOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            
            {/* Object Component Section */}
            <Box>
              <Typography variant="h6" gutterBottom>Object Component (c_o)</Typography>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Autocomplete
                    freeSolo
                    options={data.availableObjectTypes || ['ANY']}
                    value={localQuery.objectComponent.objectType}
                    onChange={(_, value) => setLocalQuery(prev => ({
                      ...prev,
                      objectComponent: { ...prev.objectComponent, objectType: value || 'ANY' }
                    }))}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Object Type (ot)"
                        placeholder="Select or type object type..."
                        helperText={`Available: ${(data.availableObjectTypes || []).length} object types from OCEL`}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={3}>
                  <FormControl fullWidth>
                    <InputLabel>Operator (⊙)</InputLabel>
                    <Select
                      value={localQuery.objectComponent.operator || ''}
                      onChange={(e) => setLocalQuery(prev => ({
                        ...prev,
                        objectComponent: { ...prev.objectComponent, operator: e.target.value as any }
                      }))}
                    >
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="gte">≥ (gte)</MenuItem>
                      <MenuItem value="lte">≤ (lte)</MenuItem>
                      <MenuItem value="eq">= (eq)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Count (n)"
                    type="number"
                    value={localQuery.objectComponent.count || ''}
                    onChange={(e) => setLocalQuery(prev => ({
                      ...prev,
                      objectComponent: { ...prev.objectComponent, count: parseInt(e.target.value) || undefined }
                    }))}
                    disabled={!localQuery.objectComponent.operator}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Activity Component Section */}
            <Box>
              <Typography variant="h6" gutterBottom>Activity Component (c_a)</Typography>
              
              {/* Activity Type Selection */}
              <FormControl component="fieldset" sx={{ mb: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Activity Type</Typography>
                <RadioGroup
                  row
                  value={localQuery.activityComponent.activityType}
                  onChange={(e) => setLocalQuery(prev => ({
                    ...prev,
                    activityComponent: { ...prev.activityComponent, activityType: e.target.value as "single" | "start" | "end" | "quantified" | "cardinality" }
                  }))}
                >
                  <FormControlLabel value="single" control={<Radio />} label="Single (l₁)" />
                  <FormControlLabel value="start" control={<Radio />} label="Start (S)" />
                  <FormControlLabel value="end" control={<Radio />} label="End (E)" />
                  <FormControlLabel value="quantified" control={<Radio />} label="Quantified (Δ)" />
                  <FormControlLabel value="cardinality" control={<Radio />} label="Cardinality" />
                </RadioGroup>
              </FormControl>

              {/* Activities Input */}
              <Autocomplete
                multiple
                freeSolo
                options={data.availableActivities || []}
                value={localQuery.activityComponent.activities}
                onChange={(_, value) => handleActivityChange(value)}
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    label="Activities {l₁, ..., lₙ}" 
                    placeholder="Select or type activity names..."
                    helperText={`Available: ${(data.availableActivities || []).length} activities from OCEL`}
                  />
                )}
                sx={{ mb: 2 }}
              />

              {/* Quantifier for quantified activities */}
              {localQuery.activityComponent.activityType === 'quantified' && (
                <FormControl sx={{ mb: 2, minWidth: 120 }}>
                  <InputLabel>Quantifier (Δ)</InputLabel>
                  <Select
                    value={localQuery.activityComponent.quantifier || ''}
                    onChange={(e) => setLocalQuery(prev => ({
                      ...prev,
                      activityComponent: { ...prev.activityComponent, quantifier: e.target.value as any }
                    }))}
                  >
                    <MenuItem value="">None</MenuItem>
                    <MenuItem value="ANY">ANY</MenuItem>
                    <MenuItem value="ALL">ALL</MenuItem>
                  </Select>
                </FormControl>
              )}

              {/* Cardinality for cardinality type */}
              {localQuery.activityComponent.activityType === 'cardinality' && (
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Operator (⊙)</InputLabel>
                      <Select
                        value={localQuery.activityComponent.operator || ''}
                        onChange={(e) => setLocalQuery(prev => ({
                          ...prev,
                          activityComponent: { ...prev.activityComponent, operator: e.target.value as any }
                        }))}
                      >
                        <MenuItem value="">None</MenuItem>
                        <MenuItem value="gte">≥ (gte)</MenuItem>
                        <MenuItem value="lte">≤ (lte)</MenuItem>
                        <MenuItem value="eq">= (eq)</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Count (n)"
                      type="number"
                      value={localQuery.activityComponent.count || ''}
                      onChange={(e) => setLocalQuery(prev => ({
                        ...prev,
                        activityComponent: { ...prev.activityComponent, count: parseInt(e.target.value) || undefined }
                      }))}
                      disabled={!localQuery.activityComponent.operator}
                    />
                  </Grid>
                </Grid>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save Query</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Object Type Query Node
export const ObjectTypeQueryNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  const [editOpen, setEditOpen] = useState(false);
  const query: ObjectTypeQuery = data?.query || {};
  
  // Local state for editing
  const [localQuery, setLocalQuery] = useState<ObjectTypeQuery>({
    type: 'ObjectTypeQuery',
    objectTypeComponent: {
      objectType: query.objectTypeComponent?.objectType || 'ANY',
      operator: query.objectTypeComponent?.operator,
      count: query.objectTypeComponent?.count
    }
  });

  const handleSave = () => {
    if (data.onUpdate) {
      data.onUpdate(id, { ...data, query: localQuery });
    }
    setEditOpen(false);
  };

  const handleDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
  };
  
  return (
    <>
      <Card 
        sx={{ 
          minWidth: 200, 
          border: selected ? '2px solid #1976d2' : '1px solid #ccc',
          backgroundColor: '#f3e5f5',
          cursor: 'pointer'
        }}
        onClick={() => setEditOpen(true)}
      >
        <Handle type="target" position={Position.Top} />
        <CardContent sx={{ padding: 2 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
            <Typography variant="h6" sx={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
              Object Type Query
            </Typography>
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDelete(); }} color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
          
          <Box sx={{ marginBottom: 1 }}>
            <Typography variant="caption" color="text.secondary">Object Type:</Typography>
            <Chip 
              label={query?.objectTypeComponent?.objectType || 'ANY'} 
              size="small" 
              sx={{ marginLeft: 1 }}
              color="primary"
            />
          </Box>
          
          {query?.objectTypeComponent?.operator && query?.objectTypeComponent?.count && (
            <Box>
              <Typography variant="caption" color="text.secondary">Cardinality:</Typography>
              <Chip 
                label={`${query.objectTypeComponent.operator} ${query.objectTypeComponent.count}`}
                size="small"
                color="warning"
                sx={{ marginLeft: 1 }}
              />
            </Box>
          )}
        </CardContent>
        <Handle type="source" position={Position.Bottom} />
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            Edit Object Type Query
            <IconButton onClick={() => setEditOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            
            {/* Object Type Component Section */}
            <Box>
              <Typography variant="h6" gutterBottom>Object Type Component (c_ot)</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Can be either (ot) or (ot, ⊙, n) for cardinality constraints
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Autocomplete
                    freeSolo
                    options={data.availableObjectTypes || ['ANY']}
                    value={localQuery.objectTypeComponent.objectType}
                    onChange={(_, value) => setLocalQuery(prev => ({
                      ...prev,
                      objectTypeComponent: { ...prev.objectTypeComponent, objectType: value || 'ANY' }
                    }))}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Object Type (ot)"
                        placeholder="Select or type object type..."
                        helperText={`Available: ${(data.availableObjectTypes || []).length} object types from OCEL`}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={3}>
                  <FormControl fullWidth>
                    <InputLabel>Operator (⊙)</InputLabel>
                    <Select
                      value={localQuery.objectTypeComponent.operator || ''}
                      onChange={(e) => setLocalQuery(prev => ({
                        ...prev,
                        objectTypeComponent: { ...prev.objectTypeComponent, operator: e.target.value as any }
                      }))}
                    >
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="gte">≥ (gte)</MenuItem>
                      <MenuItem value="lte">≤ (lte)</MenuItem>
                      <MenuItem value="eq">= (eq)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    fullWidth
                    label="Count (n)"
                    type="number"
                    value={localQuery.objectTypeComponent.count || ''}
                    onChange={(e) => setLocalQuery(prev => ({
                      ...prev,
                      objectTypeComponent: { ...prev.objectTypeComponent, count: parseInt(e.target.value) || undefined }
                    }))}
                    disabled={!localQuery.objectTypeComponent.operator}
                    helperText="Cardinality constraint"
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Query Examples */}
            <Box sx={{ backgroundColor: '#f5f5f5', padding: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>Query Examples:</Typography>
              <Typography variant="caption" component="div">
                • (ORDER) - Check if process execution contains objects of type ORDER<br/>
                • (ITEM, ≥, 3) - Check if process execution contains at least 3 objects of type ITEM<br/>
                • (CUSTOMER, =, 1) - Check if process execution contains exactly 1 object of type CUSTOMER
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save Query</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Control Flow Query Node with Interactive Editing
export const ControlFlowQueryNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  const [editOpen, setEditOpen] = useState(false);
  const query: ControlFlowQuery = data?.query || {};
  
  const [localQuery, setLocalQuery] = useState<ControlFlowQuery>({
    type: 'ControlFlowQuery',
    firstActivityQuery: query.firstActivityQuery || {
      type: 'ActivityQuery',
      objectComponent: { objectType: 'ANY' },
      activityComponent: { activities: [], activityType: 'single' }
    },
    secondActivityQuery: query.secondActivityQuery || {
      type: 'ActivityQuery',
      objectComponent: { objectType: 'ANY' },
      activityComponent: { activities: [], activityType: 'single' }
    },
    temporalRelation: query.temporalRelation || 'DF',
    constraintComponent: query.constraintComponent || {}
  });

  const handleSave = () => {
    console.log("DEBUG: ControlFlowQuery handleSave called");
    console.log("DEBUG: Node ID:", id);
    console.log("DEBUG: Local query:", localQuery);
    
    if (data.onUpdate) {
      data.onUpdate(id, { ...data, query: localQuery });
    }
    setEditOpen(false);
  };

  const handleDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
  };
  
  return (
    <>
      <Card 
        sx={{ 
          minWidth: 250, 
          border: selected ? '2px solid #1976d2' : '1px solid #ccc',
          backgroundColor: '#e8f5e8',
          cursor: 'pointer'
        }}
        onClick={() => setEditOpen(true)}
      >
        <Handle type="target" position={Position.Top} />
        <CardContent sx={{ padding: 2 }}>
          <Typography variant="h6" sx={{ fontSize: '0.9rem', fontWeight: 'bold', marginBottom: 1 }}>
            Control-Flow Query
            <IconButton 
              size="small" 
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              sx={{ float: 'right', padding: '2px' }}
            >
              <DeleteIcon sx={{ fontSize: '0.8rem' }} />
            </IconButton>
          </Typography>
          
          <Box sx={{ marginBottom: 1 }}>
            <Typography variant="caption" color="text.secondary">Temporal Relation:</Typography>
            <Chip 
              label={query?.temporalRelation || 'DF'} 
              size="small" 
              sx={{ marginLeft: 1 }}
              color="primary"
            />
          </Box>
          
          {query?.firstActivityQuery && (
            <Box sx={{ marginBottom: 1 }}>
              <Typography variant="caption" color="text.secondary">First Activity:</Typography>
              <Chip 
                label={`${query.firstActivityQuery.objectComponent?.objectType || 'ANY'}: ${query.firstActivityQuery.activityComponent?.activities?.[0] || 'None'}`}
                size="small"
                variant="outlined"
                sx={{ marginLeft: 1 }}
              />
            </Box>
          )}
          
          {query?.secondActivityQuery && (
            <Box sx={{ marginBottom: 1 }}>
              <Typography variant="caption" color="text.secondary">Second Activity:</Typography>
              <Chip 
                label={`${query.secondActivityQuery.objectComponent?.objectType || 'ANY'}: ${query.secondActivityQuery.activityComponent?.activities?.[0] || 'None'}`}
                size="small"
                variant="outlined"
                sx={{ marginLeft: 1 }}
              />
            </Box>
          )}
          
          {(query?.constraintComponent?.objectOperator || query?.constraintComponent?.relationshipOperator) && (
            <Box>
              <Typography variant="caption" color="text.secondary">Constraints:</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, marginTop: 0.5 }}>
                {query.constraintComponent.objectOperator && (
                  <Chip 
                    label={`Obj: ${query.constraintComponent.objectOperator} ${query.constraintComponent.objectCount}`}
                    size="small"
                    color="warning"
                  />
                )}
                {query.constraintComponent.relationshipOperator && (
                  <Chip 
                    label={`Rel: ${query.constraintComponent.relationshipOperator} ${query.constraintComponent.relationshipCount}`}
                    size="small"
                    color="warning"
                  />
                )}
              </Box>
            </Box>
          )}
        </CardContent>
        <Handle type="source" position={Position.Bottom} />
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            Edit Control-Flow Query (Q_cf)
            <IconButton onClick={() => setEditOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            
            {/* Temporal Relation Section */}
            <Box>
              <Typography variant="h6" gutterBottom>Temporal Relation (T)</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                T ∈ {'{DF, EF}'} - Type of temporal service relationship
              </Typography>
              
              <RadioGroup
                value={localQuery.temporalRelation}
                onChange={(e) => setLocalQuery({...localQuery, temporalRelation: e.target.value as 'DF' | 'EF'})}
                row
              >
                <FormControlLabel value="DF" control={<Radio />} label="DF (Directly-Follows)" />
                <FormControlLabel value="EF" control={<Radio />} label="EF (Eventually-Follows)" />
              </RadioGroup>
            </Box>

            {/* First Activity Query Section */}
            <Box>
              <Typography variant="h6" gutterBottom>First Activity Query (Q₁)</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Define the first activity in the control-flow relationship
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Autocomplete
                    freeSolo
                    options={data.availableObjectTypes || ['ANY']}
                    value={localQuery.firstActivityQuery.objectComponent.objectType}
                    onChange={(_, value) => setLocalQuery({
                      ...localQuery,
                      firstActivityQuery: {
                        ...localQuery.firstActivityQuery,
                        objectComponent: {
                          ...localQuery.firstActivityQuery.objectComponent,
                          objectType: value || 'ANY'
                        }
                      }
                    })}
                    renderInput={(params) => (
                      <TextField {...params} label="Object Type" size="small" />
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Autocomplete
                    freeSolo
                    options={data.availableActivities || []}
                    value={localQuery.firstActivityQuery.activityComponent.activities[0] || ''}
                    onChange={(_, value) => setLocalQuery({
                      ...localQuery,
                      firstActivityQuery: {
                        ...localQuery.firstActivityQuery,
                        activityComponent: {
                          ...localQuery.firstActivityQuery.activityComponent,
                          activities: value ? [value] : []
                        }
                      }
                    })}
                    renderInput={(params) => (
                      <TextField {...params} label="Activity" size="small" />
                    )}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Second Activity Query Section */}
            <Box>
              <Typography variant="h6" gutterBottom>Second Activity Query (Q₂)</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Define the second activity in the control-flow relationship
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Autocomplete
                    freeSolo
                    options={data.availableObjectTypes || ['ANY']}
                    value={localQuery.secondActivityQuery.objectComponent.objectType}
                    onChange={(_, value) => setLocalQuery({
                      ...localQuery,
                      secondActivityQuery: {
                        ...localQuery.secondActivityQuery,
                        objectComponent: {
                          ...localQuery.secondActivityQuery.objectComponent,
                          objectType: value || 'ANY'
                        }
                      }
                    })}
                    renderInput={(params) => (
                      <TextField {...params} label="Object Type" size="small" />
                    )}
                  />
                </Grid>
                <Grid item xs={6}>
                  <Autocomplete
                    freeSolo
                    options={data.availableActivities || []}
                    value={localQuery.secondActivityQuery.activityComponent.activities[0] || ''}
                    onChange={(_, value) => setLocalQuery({
                      ...localQuery,
                      secondActivityQuery: {
                        ...localQuery.secondActivityQuery,
                        activityComponent: {
                          ...localQuery.secondActivityQuery.activityComponent,
                          activities: value ? [value] : []
                        }
                      }
                    })}
                    renderInput={(params) => (
                      <TextField {...params} label="Activity" size="small" />
                    )}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Service Constraint Component Section */}
            <Box>
              <Typography variant="h6" gutterBottom>Service Constraint Component (c_cf)</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Optional constraints on objects and relationships
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Object Operator</InputLabel>
                    <Select
                      value={localQuery.constraintComponent.objectOperator || ''}
                      onChange={(e) => setLocalQuery({
                        ...localQuery,
                        constraintComponent: {
                          ...localQuery.constraintComponent,
                          objectOperator: (e.target.value as "gte" | "lte" | "eq") || undefined
                        }
                      })}
                      label="Object Operator"
                    >
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="gte">≥</MenuItem>
                      <MenuItem value="lte">≤</MenuItem>
                      <MenuItem value="eq">=</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    label="Object Count"
                    type="number"
                    size="small"
                    fullWidth
                    value={localQuery.constraintComponent.objectCount || ''}
                    onChange={(e) => setLocalQuery({
                      ...localQuery,
                      constraintComponent: {
                        ...localQuery.constraintComponent,
                        objectCount: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    })}
                  />
                </Grid>
                <Grid item xs={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Relationship Operator</InputLabel>
                    <Select
                      value={localQuery.constraintComponent.relationshipOperator || ''}
                      onChange={(e) => setLocalQuery({
                        ...localQuery,
                        constraintComponent: {
                          ...localQuery.constraintComponent,
                          relationshipOperator: (e.target.value as "gte" | "lte" | "eq") || undefined
                        }
                      })}
                      label="Relationship Operator"
                    >
                      <MenuItem value="">None</MenuItem>
                      <MenuItem value="gte">≥</MenuItem>
                      <MenuItem value="lte">≤</MenuItem>
                      <MenuItem value="eq">=</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={3}>
                  <TextField
                    label="Relationship Count"
                    type="number"
                    size="small"
                    fullWidth
                    value={localQuery.constraintComponent.relationshipCount || ''}
                    onChange={(e) => setLocalQuery({
                      ...localQuery,
                      constraintComponent: {
                        ...localQuery.constraintComponent,
                        relationshipCount: e.target.value ? parseInt(e.target.value) : undefined
                      }
                    })}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Examples Section */}
            <Box sx={{ backgroundColor: '#f5f5f5', padding: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>Control-Flow Query Examples:</Typography>
              <Typography variant="caption" component="div">
                • (Q₁: ORDER→Place Order, Q₂: ORDER→Load Cargo, DF) - Place Order directly followed by Load Cargo<br/>
                • (Q₁: ORDER→Receive Payment, Q₂: ORDER→Ship Items, EF, c_cf: ≥2 objects) - Payment eventually followed by shipment with at least 2 orders<br/>
                • (Q₁: CUSTOMER→Browse, Q₂: CUSTOMER→Purchase, EF, c_cf: relationship ≥3) - Browse eventually followed by purchase in at least 3 instances
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save Query</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Logical Operator Node with Interactive Editing
export const LogicalOperatorNode: React.FC<NodeProps> = ({ data, selected, id }) => {
  const [editOpen, setEditOpen] = useState(false);
  const [localOperator, setLocalOperator] = useState(data?.operator || 'AND');
  
  // Check if this node has any incoming connections (for validation)
  const hasIncomingConnections = data?.hasIncomingConnections || false;
  
  const getOperatorColor = (op: string) => {
    switch (op) {
      case 'AND': return '#4caf50';
      case 'OR': return '#ff9800';
      case 'NOT': return '#f44336';
      default: return '#9e9e9e';
    }
  };

  const handleSave = () => {
    console.log("DEBUG: LogicalOperator handleSave called");
    console.log("DEBUG: Node ID:", id);
    console.log("DEBUG: Local operator:", localOperator);
    
    if (data.onUpdate) {
      data.onUpdate(id, { ...data, operator: localOperator });
    }
    setEditOpen(false);
  };

  const handleDelete = () => {
    if (data.onDelete) {
      data.onDelete(id);
    }
  };
  
  return (
    <>
      <Card 
        sx={{ 
          minWidth: 100, 
          border: selected ? '2px solid #1976d2' : hasIncomingConnections ? '1px solid #ccc' : '2px dashed #ff9800',
          backgroundColor: hasIncomingConnections ? '#fff3e0' : '#fff8e1',
          cursor: 'pointer',
          opacity: hasIncomingConnections ? 1 : 0.7
        }}
        onClick={() => setEditOpen(true)}
      >
        <Handle type="target" position={Position.Top} />
        <CardContent sx={{ padding: 2, textAlign: 'center', position: 'relative' }}>
          <IconButton 
            size="small" 
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            sx={{ position: 'absolute', top: 2, right: 2, padding: '2px' }}
          >
            <DeleteIcon sx={{ fontSize: '0.7rem' }} />
          </IconButton>
          <Typography 
            variant="h6" 
            sx={{ 
              fontSize: '1.2rem', 
              fontWeight: 'bold',
              color: getOperatorColor(data?.operator || 'AND'),
              marginTop: '8px'
            }}
          >
            {data?.operator || 'AND'}
          </Typography>
        </CardContent>
        <Handle type="source" position={Position.Bottom} />
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm">
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            Edit Logical Operator
            <IconButton onClick={() => setEditOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Select the logical operator for composing queries:
            </Typography>
            
            <FormControl fullWidth>
              <InputLabel>Logical Operator</InputLabel>
              <Select
                value={localOperator}
                onChange={(e) => setLocalOperator(e.target.value)}
                label="Logical Operator"
              >
                <MenuItem value="AND">AND - Both conditions must be true</MenuItem>
                <MenuItem value="OR">OR - Either condition can be true</MenuItem>
                <MenuItem value="NOT">NOT - Negates the condition</MenuItem>
              </Select>
            </FormControl>

            <Box sx={{ backgroundColor: '#f5f5f5', padding: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>Usage Examples:</Typography>
              <Typography variant="caption" component="div">
                • <strong>AND</strong>: Find process executions that satisfy both Query A and Query B<br/>
                • <strong>OR</strong>: Find process executions that satisfy either Query A or Query B<br/>
                • <strong>NOT</strong>: Find process executions that do NOT satisfy the connected query
              </Typography>
            </Box>
            
            {!hasIncomingConnections && (
              <Box sx={{ backgroundColor: '#fff3e0', padding: 2, borderRadius: 1, border: '1px solid #ff9800', mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom color="warning.main">⚠ Connection Required</Typography>
                <Typography variant="caption" component="div">
                  This logical operator needs input connections from other query nodes to be functional. 
                  Connect other nodes to this operator to compose queries.
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Event Node (for graphical representation)
export const EventNode: React.FC<NodeProps> = ({ data, selected }) => {
  return (
    <Card 
      sx={{ 
        minWidth: 80, 
        border: selected ? '2px solid #1976d2' : '1px solid #ccc',
        backgroundColor: '#f5f5f5'
      }}
    >
      <Handle type="target" position={Position.Top} />
      <CardContent sx={{ padding: 1, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          Event
        </Typography>
      </CardContent>
      <Handle type="source" position={Position.Bottom} />
    </Card>
  );
};

// Node type mapping for ReactFlow
export const nodeTypes = {
  'activityQuery': ActivityQueryNode,
  'objectTypeQuery': ObjectTypeQueryNode,
  'controlFlowQuery': ControlFlowQueryNode,
  'logicalOperator': LogicalOperatorNode,
  'event': EventNode,
  // Legacy compatibility
  'activityNode': ActivityQueryNode,
  'objectTypeNode': ObjectTypeQueryNode,
  'objectNode': ObjectTypeQueryNode,
  'orNode': LogicalOperatorNode
};

export default nodeTypes;
