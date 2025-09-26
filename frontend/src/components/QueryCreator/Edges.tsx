/**
 * Edge Components for Graphical GOProQ Query Building
 * Implements edges for connecting query components in the graphical interface
 */

import React, { useState } from 'react';
import { EdgeProps, getBezierPath, useReactFlow } from 'reactflow';
import { 
  Box, 
  Typography, 
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
  FormControlLabel,
  Radio,
  RadioGroup,
  Grid
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

// Custom edge for query composition
export const QueryCompositionEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          stroke: data?.color || '#b1b1b7',
          strokeWidth: 2,
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      {data?.label && (
        <foreignObject
          width={60}
          height={20}
          x={labelX - 30}
          y={labelY - 10}
          className="edgebutton-foreignobject"
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <Box
            sx={{
              backgroundColor: 'white',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '10px',
              textAlign: 'center',
            }}
          >
            <Typography variant="caption" sx={{ fontSize: '10px' }}>
              {data.label}
            </Typography>
          </Box>
        </foreignObject>
      )}
    </>
  );
};

// Temporal relationship edge for control flow queries
export const TemporalRelationEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}) => {
  const [editOpen, setEditOpen] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Local state for editing control flow constraints
  const [localData, setLocalData] = useState({
    temporalRelation: data?.temporalRelation || 'DF',
    objectOperator: data?.objectOperator || '',
    objectCount: data?.objectCount || '',
    relationshipOperator: data?.relationshipOperator || '',
    relationshipCount: data?.relationshipCount || ''
  });

  const { setEdges } = useReactFlow();

  const handleSave = () => {
    setEdges((edges) =>
      edges.map((edge) =>
        edge.id === id ? { ...edge, data: localData } : edge
      )
    );
    setEditOpen(false);
  };

  const handleDelete = () => {
    setEdges((es) => es.filter((e) => e.id !== id));
  };

  const getRelationColor = (relation: string) => {
    switch (relation) {
      case 'DF': return '#4caf50'; // Green for directly follows
      case 'EF': return '#2196f3'; // Blue for eventually follows
      default: return '#9e9e9e';
    }
  };

  const relationLabel = data?.temporalRelation || 'DF';

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          stroke: getRelationColor(relationLabel),
          strokeWidth: 3,
          strokeDasharray: relationLabel === 'EF' ? '5,5' : 'none',
        }}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <foreignObject
        width={100}
        height={28}
        x={labelX - 50}
        y={labelY - 14}
        className="edgebutton-foreignobject"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <Box
          sx={{
            backgroundColor: getRelationColor(relationLabel),
            color: 'white',
            borderRadius: '14px',
            padding: '4px 12px',
            fontSize: '11px',
            textAlign: 'center',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
          onClick={() => setEditOpen(true)}
        >
          <Typography variant="caption" sx={{ fontSize: '11px', color: 'white' }}>
            {relationLabel}
          </Typography>
          <IconButton 
            size="small" 
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            sx={{ color: 'white', padding: '2px', ml: 1 }}
          >
            <CloseIcon sx={{ fontSize: '12px' }} />
          </IconButton>
        </Box>
      </foreignObject>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            Edit Control Flow Relationship
            <IconButton onClick={() => setEditOpen(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            
            {/* Temporal Relation Section */}
            <Box>
              <Typography variant="h6" gutterBottom>Temporal Relationship (T)</Typography>
              <FormControl component="fieldset">
                <RadioGroup
                  row
                  value={localData.temporalRelation}
                  onChange={(e) => setLocalData(prev => ({ ...prev, temporalRelation: e.target.value }))}
                >
                  <FormControlLabel 
                    value="DF" 
                    control={<Radio />} 
                    label="Directly-Follows (DF)" 
                  />
                  <FormControlLabel 
                    value="EF" 
                    control={<Radio />} 
                    label="Eventually-Follows (EF)" 
                  />
                </RadioGroup>
              </FormControl>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                DF: Activity Q₂ directly follows Q₁ (no other activities in between)<br/>
                EF: Activity Q₂ eventually follows Q₁ (other activities may be in between)
              </Typography>
            </Box>

            {/* Service Constraint Component Section */}
            <Box>
              <Typography variant="h6" gutterBottom>Service Constraint Component (c_cf)</Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Optional constraints on object cardinality and relationship cardinality
              </Typography>

              {/* Object Cardinality Constraint */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>Object Cardinality Constraint (⊙₁, n₁)</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Object Operator (⊙₁)</InputLabel>
                      <Select
                        value={localData.objectOperator}
                        onChange={(e) => setLocalData(prev => ({ ...prev, objectOperator: e.target.value }))}
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
                      label="Object Count (n₁)"
                      type="number"
                      value={localData.objectCount}
                      onChange={(e) => setLocalData(prev => ({ ...prev, objectCount: e.target.value }))}
                      disabled={!localData.objectOperator}
                      helperText="Number of objects involved in the relationship"
                    />
                  </Grid>
                </Grid>
              </Box>

              {/* Relationship Cardinality Constraint */}
              <Box>
                <Typography variant="subtitle1" gutterBottom>Relationship Cardinality Constraint (⊙₂, n₂)</Typography>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <FormControl fullWidth>
                      <InputLabel>Relationship Operator (⊙₂)</InputLabel>
                      <Select
                        value={localData.relationshipOperator}
                        onChange={(e) => setLocalData(prev => ({ ...prev, relationshipOperator: e.target.value }))}
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
                      label="Relationship Count (n₂)"
                      type="number"
                      value={localData.relationshipCount}
                      onChange={(e) => setLocalData(prev => ({ ...prev, relationshipCount: e.target.value }))}
                      disabled={!localData.relationshipOperator}
                      helperText="Number of times the relationship occurs"
                    />
                  </Grid>
                </Grid>
              </Box>
            </Box>

            {/* Query Examples */}
            <Box sx={{ backgroundColor: '#f5f5f5', padding: 2, borderRadius: 1 }}>
              <Typography variant="subtitle2" gutterBottom>Control-Flow Query Examples:</Typography>
              <Typography variant="caption" component="div">
                • Q₁ →ᴰᶠ Q₂ - Q₂ directly follows Q₁<br/>
                • Q₁ →ᴱᶠ Q₂ - Q₂ eventually follows Q₁<br/>
                • Q₁ →ᴰᶠ⁽≥,2⁾ Q₂ - Q₂ directly follows Q₁ with at least 2 shared objects<br/>
                • Q₁ →ᴱᶠ⁽≤,1,=,3⁾ Q₂ - Q₂ eventually follows Q₁ with ≤1 shared objects, exactly 3 times
              </Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save Relationship</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};


// Logical Composition Edge for AND/OR/NOT operators
export const LogicalCompositionEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
  markerEnd,
}) => {
  const [editOpen, setEditOpen] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const [localData, setLocalData] = useState({
    operator: data?.operator || 'AND'
  });

  const { setEdges } = useReactFlow();

  const handleSave = () => {
    setEdges((edges) =>
      edges.map((edge) =>
        edge.id === id ? { ...edge, data: localData } : edge
      )
    );
    setEditOpen(false);
  };

  const handleDelete = () => {
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  const operatorLabel = localData.operator || 'AND';
  const operatorColor = operatorLabel === 'AND' ? '#2196f3' : operatorLabel === 'OR' ? '#ff9800' : '#f44336';

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        stroke={operatorColor}
        strokeWidth={2}
      />
      <foreignObject
        width={60}
        height={24}
        x={labelX - 30}
        y={labelY - 12}
        className="edgebutton-foreignobject"
        requiredExtensions="http://www.w3.org/1999/xhtml"
      >
        <Box
          sx={{
            backgroundColor: operatorColor,
            color: 'white',
            borderRadius: '12px',
            padding: '2px 8px',
            fontSize: '10px',
            textAlign: 'center',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
          onClick={() => setEditOpen(true)}
        >
          <Typography variant="caption" sx={{ fontSize: '10px', color: 'white' }}>
            {operatorLabel}
          </Typography>
          <IconButton 
            size="small" 
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            sx={{ color: 'white', padding: '1px', ml: 0.5 }}
          >
            <CloseIcon sx={{ fontSize: '10px' }} />
          </IconButton>
        </Box>
      </foreignObject>

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
          <FormControl fullWidth margin="normal">
            <InputLabel>Logical Operator</InputLabel>
            <Select
              value={localData.operator}
              onChange={(e) => setLocalData({ ...localData, operator: e.target.value })}
              label="Logical Operator"
            >
              <MenuItem value="AND">AND</MenuItem>
              <MenuItem value="OR">OR</MenuItem>
              <MenuItem value="NOT">NOT</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

// Default Query Edge for general purpose connections
export const DefaultQueryEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}) => {
  const [edgePath] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  return (
    <path
      id={id}
      style={style}
      className="react-flow__edge-path"
      d={edgePath}
      markerEnd={markerEnd}
      stroke="#999"
      strokeWidth={1}
    />
  );
};

// Edge type mapping for ReactFlow
export const edgeTypes = {
  'queryComposition': QueryCompositionEdge,
  'temporalRelation': TemporalRelationEdge,
  'logicalComposition': LogicalCompositionEdge,
  'default': DefaultQueryEdge,
  // Legacy compatibility
  'smoothstep': QueryCompositionEdge,
  'straight': DefaultQueryEdge
};

export default edgeTypes;
