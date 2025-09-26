"""
GOProQ Query Executor: Main execution engine for GOProQ queries.
Integrates with existing OCPA functionality while implementing the formal semantics.
"""

from typing import List, Dict, Any, Tuple, Union
import time
import json
from dataclasses import asdict

from ocpa.objects.log.ocel import OCEL
from .goproq_queries import (
    ActivityQuery, ObjectTypeQuery, ControlFlowQuery, ComposedQuery,
    GOProQEvaluator, Query
)
from .query_converter import convert_legacy_to_goproq, convert_graphical_to_goproq
from .pq import QueryGraph


class GOProQExecutor:
    """
    Main executor for GOProQ queries.
    Maintains compatibility with existing OCPA functionality and graphical interface.
    """
    
    def __init__(self, ocel: OCEL, query_graph: QueryGraph):
        self.ocel = ocel
        self.query_graph = query_graph
        self.evaluator = GOProQEvaluator(ocel, query_graph)
    
    def execute_query(self, query_input: Union[Dict[str, Any], List[Dict], Tuple[List[Dict], List[Dict]]]) -> Dict[str, Any]:
        """
        Execute a query in various input formats.
        
        Args:
            query_input: Can be:
                - Legacy query dictionary
                - Graphical query as (nodes, edges) tuple
                - List of nodes (for single node queries)
                
        Returns:
            Query execution results
        """
        start_time = time.time()
        
        # Convert input to GOProQ format
        goproq_query = self._convert_input_to_goproq(query_input)
        
        # Execute the query against the COMPLETE OCEL data
        # Always use the original process executions, not filtered ones
        complete_process_executions = self.ocel.process_executions
        satisfied_process_executions = []
        satisfied_indices = []
        detailed_results = {}
        
        print(f"DEBUG: Evaluating query against {len(complete_process_executions)} complete process executions")
        
        for idx, pe in enumerate(complete_process_executions):
            if self.evaluator.evaluate_query(goproq_query, idx):
                satisfied_process_executions.append(pe)
                satisfied_indices.append(idx)
                # Store detailed results for visualization - temporarily disabled for debugging
                # detailed_results[idx] = self._get_detailed_results(goproq_query, idx)
        
        end_time = time.time()
        
        # Don't include process_executions in response as they contain complex objects
        # Instead, just return the indices which can be used to retrieve the executions if needed
        return {
            'length': len(satisfied_process_executions),
            'indices': satisfied_indices,
            'detailed_results': detailed_results,
            'query_structure': self._serialize_query(goproq_query),
            'run': {
                'name': 'GOProQ Execution',
                'time': f"{end_time - start_time:.4f}s",
                'raw_time': end_time - start_time,
                'start': time.strftime('%c', time.localtime(start_time)),
                'end': time.strftime('%c', time.localtime(end_time)),
            }
        }
    
    def execute_live_query(self, query_input: Union[Dict[str, Any], List[Dict], Tuple[List[Dict], List[Dict]]], 
                          timeout: float = 30.0) -> Dict[str, Any]:
        """
        Execute query in live mode - stops at first matching process execution.
        """
        start_time = time.time()
        
        # Convert input to GOProQ format
        goproq_query = self._convert_input_to_goproq(query_input)
        
        # Execute with early termination against COMPLETE OCEL data
        complete_process_executions = self.ocel.process_executions
        print(f"DEBUG: Live query evaluating against {len(complete_process_executions)} complete process executions")
        
        for idx, pe in enumerate(complete_process_executions):
            # Check timeout
            if time.time() - start_time > timeout:
                raise TimeoutError("Live query timeout exceeded")
            
            if self.evaluator.evaluate_query(goproq_query, idx):
                end_time = time.time()
                
                return {
                    'length': 1,
                    'indices': [idx],
                    'detailed_results': {},
                    'query_structure': self._serialize_query(goproq_query),
                    'run': {
                        'name': 'GOProQ Live Query',
                        'time': f"{end_time - start_time:.4f}s",
                        'raw_time': end_time - start_time,
                        'start': time.strftime('%c', time.localtime(start_time)),
                        'end': time.strftime('%c', time.localtime(end_time)),
                    }
                }
        
        # No matches found
        end_time = time.time()
        return {
            'length': 0,
            'indices': [],
            'process_executions': [],
            'detailed_results': {},
            'query_structure': self._serialize_query(goproq_query),
            'run': {
                'name': 'GOProQ Live Query',
                'time': f"{end_time - start_time:.4f}s",
                'raw_time': end_time - start_time,
                'start': time.strftime('%c', time.localtime(start_time)),
                'end': time.strftime('%c', time.localtime(end_time)),
            }
        }
    
    def _convert_input_to_goproq(self, query_input: Union[Dict[str, Any], List[Dict], Tuple[List[Dict], List[Dict]]]) -> Union[Query, ComposedQuery]:
        """Convert various input formats to GOProQ format."""
        if isinstance(query_input, dict):
            # Legacy query format
            return convert_legacy_to_goproq(query_input)
        elif isinstance(query_input, tuple) and len(query_input) == 2:
            # Graphical query format (nodes, edges)
            nodes, edges = query_input
            return convert_graphical_to_goproq(nodes, edges)
        elif isinstance(query_input, list):
            # List of nodes (treat as graphical query with no edges)
            return convert_graphical_to_goproq(query_input, [])
        else:
            raise ValueError(f"Unsupported query input format: {type(query_input)}")
    
    def _get_detailed_results(self, query: Union[Query, ComposedQuery], process_execution_index: int) -> Dict[str, Any]:
        """
        Get detailed results for visualization and debugging.
        This maintains compatibility with the existing frontend visualization.
        """
        result = {
            'satisfied_objects': {},
            'satisfied_edges': {},
            'query_breakdown': self._analyze_query_satisfaction(query, process_execution_index)
        }
        
        # Extract objects and edges that contributed to satisfaction
        if isinstance(query, ActivityQuery):
            result.update(self._get_activity_query_details(query, process_execution_index))
        elif isinstance(query, ObjectTypeQuery):
            result.update(self._get_object_type_query_details(query, process_execution_index))
        elif isinstance(query, ControlFlowQuery):
            result.update(self._get_control_flow_query_details(query, process_execution_index))
        elif isinstance(query, ComposedQuery):
            result.update(self._get_composed_query_details(query, process_execution_index))
        
        return result
    
    def _analyze_query_satisfaction(self, query: Union[Query, ComposedQuery], 
                                   process_execution_index: int) -> Dict[str, Any]:
        """Analyze how the query was satisfied for debugging purposes."""
        analysis = {
            'query_type': type(query).__name__,
            'satisfied': self.evaluator.evaluate_query(query, process_execution_index)
        }
        
        if isinstance(query, ComposedQuery):
            analysis['operator'] = query.operator.value
            if query.left:
                analysis['left_satisfied'] = self.evaluator.evaluate_query(query.left, process_execution_index)
            if query.right:
                analysis['right_satisfied'] = self.evaluator.evaluate_query(query.right, process_execution_index)
            if query.query:
                analysis['operand_satisfied'] = self.evaluator.evaluate_query(query.query, process_execution_index)
        
        return analysis
    
    def _get_activity_query_details(self, query: ActivityQuery, process_execution_index: int) -> Dict[str, Any]:
        """Get details for activity query satisfaction."""
        object_type = query.object_component.object_type
        objects_of_type = self.evaluator._get_objects_of_type(process_execution_index, object_type)
        
        satisfied_objects = []
        for obj in objects_of_type:
            if self.evaluator._check_activity_constraint(query.activity_component, obj, process_execution_index):
                events = self.evaluator._get_events_for_object(obj, process_execution_index)
                satisfied_objects.append({
                    'object': obj,
                    'object_type': object_type,
                    'events': events
                })
        
        return {
            'satisfied_objects': {object_type: satisfied_objects},
            'activity_component': {
                'type': query.activity_component.activity_type,
                'activities': query.activity_component.activities,
                'quantifier': query.activity_component.quantifier.value if query.activity_component.quantifier else None
            }
        }
    
    def _get_object_type_query_details(self, query: ObjectTypeQuery, process_execution_index: int) -> Dict[str, Any]:
        """Get details for object type query satisfaction."""
        object_type = query.object_type_component.object_type
        objects_of_type = self.evaluator._get_objects_of_type(process_execution_index, object_type)
        
        return {
            'satisfied_objects': {
                object_type: [{'object': obj, 'object_type': object_type} for obj in objects_of_type]
            },
            'cardinality': {
                'count': len(objects_of_type),
                'operator': query.object_type_component.operator.value if query.object_type_component.operator else None,
                'threshold': query.object_type_component.count
            }
        }
    
    def _get_control_flow_query_details(self, query: ControlFlowQuery, process_execution_index: int) -> Dict[str, Any]:
        """Get details for control flow query satisfaction."""
        temporal_mapping = self.evaluator._compute_temporal_mapping(query, process_execution_index)
        
        satisfied_edges = []
        for (obj1, obj2), event_pairs in temporal_mapping.items():
            for event1, event2 in event_pairs:
                satisfied_edges.append({
                    'source_object': obj1,
                    'target_object': obj2,
                    'source_event': event1,
                    'target_event': event2,
                    'temporal_relation': query.temporal_relation.value
                })
        
        return {
            'satisfied_edges': satisfied_edges,
            'temporal_mapping': temporal_mapping,
            'constraint_satisfaction': {
                'object_pairs': len(temporal_mapping),
                'total_relationships': sum(len(pairs) for pairs in temporal_mapping.values())
            }
        }
    
    def _get_composed_query_details(self, query: ComposedQuery, process_execution_index: int) -> Dict[str, Any]:
        """Get details for composed query satisfaction."""
        details = {
            'operator': query.operator.value,
            'components': {}
        }
        
        if query.left:
            details['components']['left'] = self._get_detailed_results(query.left, process_execution_index)
        if query.right:
            details['components']['right'] = self._get_detailed_results(query.right, process_execution_index)
        if query.query:
            details['components']['operand'] = self._get_detailed_results(query.query, process_execution_index)
        
        return details
    
    def _serialize_query(self, query: Union[Query, ComposedQuery]) -> Dict[str, Any]:
        """Serialize query structure for frontend visualization."""
        from .goproq_queries import ActivityQuery, ObjectTypeQuery, ControlFlowQuery
        
        if isinstance(query, ComposedQuery):
            result = {
                'type': 'ComposedQuery',
                'operator': query.operator.value
            }
            if query.left:
                result['left'] = self._serialize_query(query.left)
            if query.right:
                result['right'] = self._serialize_query(query.right)
            if query.query:
                result['operand'] = self._serialize_query(query.query)
            return result
        elif isinstance(query, ControlFlowQuery):
            # Custom serialization for ControlFlow queries
            return {
                'type': 'ControlFlowQuery',
                'components': {
                    'first_activity_query': self._serialize_query(query.first_activity_query),
                    'second_activity_query': self._serialize_query(query.second_activity_query),
                    'temporal_relation': query.temporal_relation.value,
                    'constraint_component': {
                        'object_operator': query.constraint_component.object_operator.value if query.constraint_component.object_operator else None,
                        'object_count': query.constraint_component.object_count,
                        'relationship_operator': query.constraint_component.relationship_operator.value if query.constraint_component.relationship_operator else None,
                        'relationship_count': query.constraint_component.relationship_count
                    }
                }
            }
        elif isinstance(query, ActivityQuery):
            # Custom serialization for Activity queries
            return {
                'type': 'ActivityQuery',
                'components': {
                    'object_component': {
                        'object_type': query.object_component.object_type,
                        'operator': query.object_component.operator.value if query.object_component.operator else None,
                        'count': query.object_component.count
                    },
                    'activity_component': {
                        'activities': query.activity_component.activities,
                        'activity_type': query.activity_component.activity_type,
                        'quantifier': query.activity_component.quantifier.value if query.activity_component.quantifier else None,
                        'operator': query.activity_component.operator.value if query.activity_component.operator else None,
                        'count': query.activity_component.count
                    }
                }
            }
        elif isinstance(query, ObjectTypeQuery):
            # Custom serialization for ObjectType queries
            return {
                'type': 'ObjectTypeQuery',
                'components': {
                    'object_type_component': {
                        'object_type': query.object_type_component.object_type,
                        'operator': query.object_type_component.operator.value if query.object_type_component.operator else None,
                        'count': query.object_type_component.count
                    }
                }
            }
        else:
            # Fallback for other query types
            try:
                return {
                    'type': type(query).__name__,
                    'components': asdict(query)
                }
            except Exception as e:
                print(f"WARNING: Could not serialize query {type(query).__name__}: {e}")
                return {
                    'type': type(query).__name__,
                    'components': {'error': f'Serialization failed: {str(e)}'}
                }
    
    def export_results(self, query_results: Dict[str, Any], file_path: str) -> Dict[str, Any]:
        """
        Export query results to OCEL format.
        Maintains compatibility with existing export functionality.
        """
        # Filter OCEL to include only satisfied process executions
        satisfied_indices = query_results['indices']
        
        # Use existing export functionality from QueryParser
        # This ensures compatibility with OCPA library
        filtered_process_executions = [
            self.query_graph.process_executions[idx] for idx in satisfied_indices
        ]
        
        # Create a temporary QueryParser for export
        from .pq import QueryParser
        temp_parser = QueryParser({})
        temp_parser._ocel = self.ocel
        temp_parser._process_executions = filtered_process_executions
        temp_parser._process_indices = satisfied_indices
        
        export_result = temp_parser.export(file_path)
        
        return {
            'file': export_result,
            'path': file_path,
            'exported_executions': len(satisfied_indices),
            'query_results': query_results['query_structure']
        }


# Backward compatibility functions
def execute_goproq_query(ocel: OCEL, query_graph: QueryGraph, 
                        query_input: Union[Dict[str, Any], List[Dict], Tuple[List[Dict], List[Dict]]], 
                        live_mode: bool = False) -> Dict[str, Any]:
    """
    Main function for executing GOProQ queries.
    Provides backward compatibility with existing API.
    """
    executor = GOProQExecutor(ocel, query_graph)
    
    if live_mode:
        return executor.execute_live_query(query_input)
    else:
        return executor.execute_query(query_input)


def get_query_statistics(query_results: Dict[str, Any]) -> Dict[str, Any]:
    """
    Get statistics about query execution for performance analysis.
    """
    return {
        'execution_time': query_results['run']['raw_time'],
        'satisfied_executions': query_results['length'],
        'total_executions': len(query_results.get('process_executions', [])),
        'satisfaction_rate': query_results['length'] / max(1, len(query_results.get('process_executions', []))),
        'query_structure': query_results['query_structure']
    }
