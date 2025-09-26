/**
 * GOProQ Query Creator
 * Graphical query builder implementing the formal GOProQ language specification
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
  Card,
  CardContent,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Autocomplete,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormLabel,
  Grid,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import InfoIcon from '@mui/icons-material/Info';

// Type definitions for GOProQ
export interface ActivityQuery {
  type: 'ActivityQuery';
  objectComponent: {
    objectType: string;
    operator?: 'gte' | 'lte' | 'eq';
    count?: number;
  };
  activityComponent: {
    activities: string[];
    activityType: 'single' | 'start' | 'end' | 'quantified' | 'cardinality';
    quantifier?: 'ANY' | 'ALL';
    operator?: 'gte' | 'lte' | 'eq';
    count?: number;
  };
}

export interface ObjectTypeQuery {
  type: 'ObjectTypeQuery';
  objectTypeComponent: {
    objectType: string;
    operator?: 'gte' | 'lte' | 'eq';
    count?: number;
  };
}

export interface ControlFlowQuery {
  type: 'ControlFlowQuery';
  firstActivityQuery: ActivityQuery;
  secondActivityQuery: ActivityQuery;
  temporalRelation: 'DF' | 'EF';
  constraintComponent: {
    objectOperator?: 'gte' | 'lte' | 'eq';
    objectCount?: number;
    relationshipOperator?: 'gte' | 'lte' | 'eq';
    relationshipCount?: number;
  };
}

export interface ComposedQuery {
  type: 'ComposedQuery';
  operator: 'AND' | 'OR' | 'NOT';
  left?: GOProQuery;
  right?: GOProQuery;
  query?: GOProQuery;
}

export type GOProQuery = ActivityQuery | ObjectTypeQuery | ControlFlowQuery | ComposedQuery;

interface QueryCreatorProps {
  onQueryChange: (query: GOProQuery) => void;
  onExecute?: () => void;
  availableActivities?: string[];
  availableObjectTypes?: string[];
}

export const QueryCreator: React.FC<QueryCreatorProps> = ({
  onQueryChange,
  onExecute,
  availableActivities = [],
  availableObjectTypes = []
}) => {
  const [currentQuery, setCurrentQuery] = useState<GOProQuery | null>(null);
  const [selectedQueryType, setSelectedQueryType] = useState<'Activity' | 'ObjectType' | 'ControlFlow' | 'Composed'>('Activity');

  // Activity Query state
  const [activityQuery, setActivityQuery] = useState<ActivityQuery>({
    type: 'ActivityQuery',
    objectComponent: { objectType: 'ANY' },
    activityComponent: { activities: [], activityType: 'single' }
  });

  // Object Type Query state
  const [objectTypeQuery, setObjectTypeQuery] = useState<ObjectTypeQuery>({
    type: 'ObjectTypeQuery',
    objectTypeComponent: { objectType: 'ANY' }
  });

  // Control Flow Query state
  const [controlFlowQuery, setControlFlowQuery] = useState<ControlFlowQuery>({
    type: 'ControlFlowQuery',
    temporalRelation: 'DF',
    firstActivityQuery: {
      type: 'ActivityQuery',
      objectComponent: { objectType: '' },
      activityComponent: { activities: [], activityType: 'single' }
    },
    secondActivityQuery: {
      type: 'ActivityQuery',
      objectComponent: { objectType: '' },
      activityComponent: { activities: [], activityType: 'single' }
    },
    constraintComponent: {}
  });

  // Composed Query state
  const [composedQuery, setComposedQuery] = useState<Partial<ComposedQuery>>({
    type: 'ComposedQuery',
    operator: 'AND'
  });

  // Update query when state changes
  useEffect(() => {
    let query: GOProQuery | null = null;
    
    switch (selectedQueryType) {
      case 'Activity':
        if (activityQuery.objectComponent && activityQuery.activityComponent) {
          query = activityQuery as ActivityQuery;
        }
        break;
      case 'ObjectType':
        if (objectTypeQuery.objectTypeComponent) {
          query = objectTypeQuery as ObjectTypeQuery;
        }
        break;
      case 'ControlFlow':
        if (controlFlowQuery.firstActivityQuery && controlFlowQuery.secondActivityQuery) {
          query = controlFlowQuery as ControlFlowQuery;
        }
        break;
      case 'Composed':
        if (composedQuery.operator) {
          query = composedQuery as ComposedQuery;
        }
        break;
    }
    
    if (query) {
      setCurrentQuery(query);
      onQueryChange(query);
    }
  }, [selectedQueryType, activityQuery, objectTypeQuery, controlFlowQuery, composedQuery, onQueryChange]);

  const ActivityQueryBuilder = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Activity Query (Q_a)
          <Tooltip title="Queries service activities within process executions based on object types and activity patterns">
            <InfoIcon fontSize="small" style={{ marginLeft: 8 }} />
          </Tooltip>
        </Typography>
        
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Service Object Component (c_o)</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Object Type</InputLabel>
                  <Select
                    value={activityQuery.objectComponent?.objectType || 'ANY'}
                    onChange={(e) => setActivityQuery(prev => ({
                      ...prev,
                      objectComponent: { ...prev.objectComponent, objectType: e.target.value }
                    }))}
                  >
                    <MenuItem value="ANY">ANY</MenuItem>
                    {availableObjectTypes.map(type => (
                      <MenuItem key={type} value={type}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={3}>
                <FormControl fullWidth>
                  <InputLabel>Operator</InputLabel>
                  <Select
                    value={activityQuery.objectComponent?.operator || ''}
                    onChange={(e) => setActivityQuery(prev => ({
                      ...prev,
                      objectComponent: { 
                        ...prev.objectComponent,
                        objectType: prev.objectComponent?.objectType || '',
                        operator: e.target.value as any 
                      }
                    }))}
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
                  fullWidth
                  label="Count"
                  type="number"
                  value={activityQuery.objectComponent?.count || ''}
                  onChange={(e) => setActivityQuery(prev => ({
                    ...prev,
                    objectComponent: { 
                      ...prev.objectComponent,
                      objectType: prev.objectComponent?.objectType || '',
                      count: parseInt(e.target.value) || undefined 
                    }
                  }))}
                  disabled={!activityQuery.objectComponent?.operator}
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Service Activity Component (c_a)</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Activity Type</FormLabel>
                  <RadioGroup
                    row
                    value={activityQuery.activityComponent?.activityType || 'single'}
                    onChange={(e) => setActivityQuery(prev => ({
                      ...prev,
                      activityComponent: { ...prev.activityComponent, activityType: e.target.value as any }
                    }))}
                  >
                    <FormControlLabel value="single" control={<Radio />} label="Single Activity" />
                    <FormControlLabel value="start" control={<Radio />} label="Start Activity" />
                    <FormControlLabel value="end" control={<Radio />} label="End Activity" />
                    <FormControlLabel value="quantified" control={<Radio />} label="Quantified Activities" />
                    <FormControlLabel value="cardinality" control={<Radio />} label="Activity Cardinality" />
                  </RadioGroup>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <Autocomplete
                  multiple
                  options={availableActivities}
                  value={activityQuery.activityComponent?.activities || []}
                  onChange={(_, newValue) => setActivityQuery(prev => ({
                    ...prev,
                    activityComponent: { ...prev.activityComponent, activities: newValue }
                  }))}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => (
                      <Chip variant="outlined" label={option} {...getTagProps({ index })} />
                    ))
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Activities" placeholder="Select activities" />
                  )}
                />
              </Grid>

              {activityQuery.activityComponent?.activityType === 'quantified' && (
                <Grid item xs={12}>
                  <FormControl component="fieldset">
                    <FormLabel component="legend">Quantifier</FormLabel>
                    <RadioGroup
                      row
                      value={activityQuery.activityComponent?.quantifier || 'ANY'}
                      onChange={(e) => setActivityQuery(prev => ({
                        ...prev,
                        activityComponent: { ...prev.activityComponent, quantifier: e.target.value as any }
                      }))}
                    >
                      <FormControlLabel value="ANY" control={<Radio />} label="ANY" />
                      <FormControlLabel value="ALL" control={<Radio />} label="ALL" />
                    </RadioGroup>
                  </FormControl>
                </Grid>
              )}

              {activityQuery.activityComponent?.activityType === 'cardinality' && (
                <Grid container item spacing={2}>
                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Operator</InputLabel>
                      <Select
                        value={activityQuery.activityComponent?.operator || 'gte'}
                        onChange={(e) => setActivityQuery(prev => ({
                          ...prev,
                          activityComponent: { ...prev.activityComponent, operator: e.target.value as any }
                        }))}
                      >
                        <MenuItem value="gte">≥</MenuItem>
                        <MenuItem value="lte">≤</MenuItem>
                        <MenuItem value="eq">=</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      label="Count"
                      type="number"
                      value={activityQuery.activityComponent?.count || ''}
                      onChange={(e) => setActivityQuery(prev => ({
                        ...prev,
                        activityComponent: { ...prev.activityComponent, count: parseInt(e.target.value) || undefined }
                      }))}
                    />
                  </Grid>
                </Grid>
              )}
            </Grid>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );

  const ObjectTypeQueryBuilder = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Object Type Query (Q_ot)
          <Tooltip title="Queries process executions based on the presence and cardinality of specific object types">
            <InfoIcon fontSize="small" style={{ marginLeft: 8 }} />
          </Tooltip>
        </Typography>
        
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <FormControl fullWidth>
              <InputLabel>Object Type</InputLabel>
              <Select
                value={objectTypeQuery.objectTypeComponent?.objectType || 'ANY'}
                onChange={(e) => setObjectTypeQuery(prev => ({
                  ...prev,
                  objectTypeComponent: { ...prev.objectTypeComponent, objectType: e.target.value }
                }))}
              >
                {availableObjectTypes.map(type => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={3}>
            <FormControl fullWidth>
              <InputLabel>Operator</InputLabel>
              <Select
                value={objectTypeQuery.objectTypeComponent?.operator || ''}
                onChange={(e) => setObjectTypeQuery(prev => ({
                  ...prev,
                  objectTypeComponent: { ...prev.objectTypeComponent, operator: e.target.value as any }
                }))}
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
              fullWidth
              label="Count"
              type="number"
              value={objectTypeQuery.objectTypeComponent?.count || ''}
              onChange={(e) => setObjectTypeQuery(prev => ({
                ...prev,
                objectTypeComponent: { ...prev.objectTypeComponent, count: parseInt(e.target.value) || undefined }
              }))}
              disabled={!objectTypeQuery.objectTypeComponent?.operator}
            />
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );

  const ControlFlowQueryBuilder = () => (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Control-Flow Query (Q_cf)
          <Tooltip title="Queries temporal relationships between service activities">
            <InfoIcon fontSize="small" style={{ marginLeft: 8 }} />
          </Tooltip>
        </Typography>
        
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>First Activity Query (Q₁)</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* Simplified activity query builder for first activity */}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Object Type</InputLabel>
                  <Select
                    value={controlFlowQuery.firstActivityQuery?.objectComponent.objectType || 'ANY'}
                    onChange={(e) => setControlFlowQuery(prev => ({
                      ...prev,
                      firstActivityQuery: {
                        ...prev.firstActivityQuery,
                        type: 'ActivityQuery',
                        objectComponent: { objectType: e.target.value },
                        activityComponent: prev.firstActivityQuery?.activityComponent || { activities: [], activityType: 'single' }
                      } as ActivityQuery
                    }))}
                  >
                    <MenuItem value="ANY">ANY</MenuItem>
                    {availableObjectTypes.map(type => (
                      <MenuItem key={type} value={type}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <Autocomplete
                  options={availableActivities}
                  value={controlFlowQuery.firstActivityQuery?.activityComponent.activities[0] || ''}
                  onChange={(_, newValue) => setControlFlowQuery(prev => ({
                    ...prev,
                    firstActivityQuery: {
                      ...prev.firstActivityQuery,
                      type: 'ActivityQuery',
                      objectComponent: prev.firstActivityQuery?.objectComponent || { objectType: 'ANY' },
                      activityComponent: { activities: newValue ? [newValue] : [], activityType: 'single' }
                    } as ActivityQuery
                  }))}
                  renderInput={(params) => <TextField {...params} label="Activity" />}
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Second Activity Query (Q₂)</Typography>
          </AccordionSummary>
          <AccordionDetails>
            {/* Simplified activity query builder for second activity */}
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Object Type</InputLabel>
                  <Select
                    value={controlFlowQuery.secondActivityQuery?.objectComponent.objectType || 'ANY'}
                    onChange={(e) => setControlFlowQuery(prev => ({
                      ...prev,
                      secondActivityQuery: {
                        ...prev.secondActivityQuery,
                        type: 'ActivityQuery',
                        objectComponent: { objectType: e.target.value },
                        activityComponent: prev.secondActivityQuery?.activityComponent || { activities: [], activityType: 'single' }
                      } as ActivityQuery
                    }))}
                  >
                    <MenuItem value="ANY">ANY</MenuItem>
                    {availableObjectTypes.map(type => (
                      <MenuItem key={type} value={type}>{type}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <Autocomplete
                  options={availableActivities}
                  value={controlFlowQuery.secondActivityQuery?.activityComponent.activities[0] || ''}
                  onChange={(_, newValue) => setControlFlowQuery(prev => ({
                    ...prev,
                    secondActivityQuery: {
                      ...prev.secondActivityQuery,
                      type: 'ActivityQuery',
                      objectComponent: prev.secondActivityQuery?.objectComponent || { objectType: 'ANY' },
                      activityComponent: { activities: newValue ? [newValue] : [], activityType: 'single' }
                    } as ActivityQuery
                  }))}
                  renderInput={(params) => <TextField {...params} label="Activity" />}
                />
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>

        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography>Temporal Relationship & Constraints</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <FormControl component="fieldset">
                  <FormLabel component="legend">Temporal Relation</FormLabel>
                  <RadioGroup
                    row
                    value={controlFlowQuery.temporalRelation || 'DF'}
                    onChange={(e) => setControlFlowQuery(prev => ({
                      ...prev,
                      temporalRelation: e.target.value as 'DF' | 'EF'
                    }))}
                  >
                    <FormControlLabel value="DF" control={<Radio />} label="Directly Follows (DF)" />
                    <FormControlLabel value="EF" control={<Radio />} label="Eventually Follows (EF)" />
                  </RadioGroup>
                </FormControl>
              </Grid>
              
              <Grid item xs={6}>
                <Typography variant="subtitle2">Object Constraint</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Operator</InputLabel>
                      <Select
                        value={controlFlowQuery.constraintComponent?.objectOperator || ''}
                        onChange={(e) => setControlFlowQuery(prev => ({
                          ...prev,
                          constraintComponent: { 
                            ...prev.constraintComponent, 
                            objectOperator: e.target.value as any 
                          }
                        }))}
                      >
                        <MenuItem value="">None</MenuItem>
                        <MenuItem value="gte">≥</MenuItem>
                        <MenuItem value="lte">≤</MenuItem>
                        <MenuItem value="eq">=</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Count"
                      type="number"
                      value={controlFlowQuery.constraintComponent?.objectCount || ''}
                      onChange={(e) => setControlFlowQuery(prev => ({
                        ...prev,
                        constraintComponent: { 
                          ...prev.constraintComponent, 
                          objectCount: parseInt(e.target.value) || undefined 
                        }
                      }))}
                      disabled={!controlFlowQuery.constraintComponent?.objectOperator}
                    />
                  </Grid>
                </Grid>
              </Grid>

              <Grid item xs={6}>
                <Typography variant="subtitle2">Relationship Constraint</Typography>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Operator</InputLabel>
                      <Select
                        value={controlFlowQuery.constraintComponent?.relationshipOperator || ''}
                        onChange={(e) => setControlFlowQuery(prev => ({
                          ...prev,
                          constraintComponent: { 
                            ...prev.constraintComponent, 
                            relationshipOperator: e.target.value as any 
                          }
                        }))}
                      >
                        <MenuItem value="">None</MenuItem>
                        <MenuItem value="gte">≥</MenuItem>
                        <MenuItem value="lte">≤</MenuItem>
                        <MenuItem value="eq">=</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={6}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Count"
                      type="number"
                      value={controlFlowQuery.constraintComponent?.relationshipCount || ''}
                      onChange={(e) => setControlFlowQuery(prev => ({
                        ...prev,
                        constraintComponent: { 
                          ...prev.constraintComponent, 
                          relationshipCount: parseInt(e.target.value) || undefined 
                        }
                      }))}
                      disabled={!controlFlowQuery.constraintComponent?.relationshipOperator}
                    />
                  </Grid>
                </Grid>
              </Grid>
            </Grid>
          </AccordionDetails>
        </Accordion>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ maxWidth: 1200, margin: 'auto', padding: 2 }}>
      <Typography variant="h4" gutterBottom>
        GOProQ Query Builder
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Build formal queries for object-centric service process analysis
      </Typography>

      <Box sx={{ marginBottom: 3 }}>
        <FormControl fullWidth>
          <InputLabel>Query Type</InputLabel>
          <Select
            value={selectedQueryType}
            onChange={(e) => setSelectedQueryType(e.target.value as any)}
          >
            <MenuItem value="Activity">Activity Query</MenuItem>
            <MenuItem value="ObjectType">Object Type Query</MenuItem>
            <MenuItem value="ControlFlow">Control-Flow Query</MenuItem>
            <MenuItem value="Composed">Composed Query</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ marginBottom: 3 }}>
        {selectedQueryType === 'Activity' && <ActivityQueryBuilder />}
        {selectedQueryType === 'ObjectType' && <ObjectTypeQueryBuilder />}
        {selectedQueryType === 'ControlFlow' && <ControlFlowQueryBuilder />}
        {selectedQueryType === 'Composed' && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Composed Query (Under Development)
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Composed queries with logical operators (AND, OR, NOT) will be available in a future update.
                For now, use the graphical query builder for complex compositions.
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>

      {onExecute && (
        <Box sx={{ textAlign: 'center', marginTop: 3 }}>
          <Button
            variant="contained"
            size="large"
            onClick={onExecute}
            disabled={!currentQuery}
          >
            Execute Query
          </Button>
        </Box>
      )}
    </Box>
  );
};

// Export utility functions for backward compatibility
export const usedObjectTypes = (query: any): string[] => {
  // Implementation for extracting used object types from query
  return [];
};

export const confirmationDialog = (
  open: boolean,
  setOpen: (open: boolean) => void,
  text: string,
  title: string,
  onConfirm: () => void
) => {
  // Implementation for confirmation dialog
  return null;
};

export default QueryCreator;
