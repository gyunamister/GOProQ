"""
GOProQ: Formal Query Language Implementation
Based on the paper specification for object-centric service process querying.
"""

from __future__ import annotations
from dataclasses import dataclass
from typing import List, Dict, Set, Union, Tuple, Optional, Any
from enum import Enum
import networkx as nx
from ocpa.objects.log.ocel import OCEL


class QuantifierType(Enum):
    """Service quantifiers for activity queries"""
    ANY = "ANY"
    ALL = "ALL"


class OperatorType(Enum):
    """Comparison operators for cardinality constraints"""
    GTE = "gte"  # ≥
    LTE = "lte"  # ≤
    EQ = "eq"    # =


class TemporalRelationType(Enum):
    """Temporal relationship types for control-flow queries"""
    DF = "DF"  # Directly-Follows
    EF = "EF"  # Eventually-Follows


class LogicalOperator(Enum):
    """Logical operators for query composition"""
    AND = "AND"
    OR = "OR"
    NOT = "NOT"


@dataclass
class ServiceObjectComponent:
    """
    Service object type component (c_o) as defined in the paper.
    Can be either:
    - (ot): single service object type
    - (ot, ⊙, n): service object cardinality
    """
    object_type: str  # ot ∈ OT ∪ {ANY}
    operator: Optional[OperatorType] = None  # ⊙ ∈ {≥, ≤, =}
    count: Optional[int] = None  # n ∈ ℕ₀


@dataclass
class ServiceActivityComponent:
    """
    Service activity component (c_a) as defined in the paper.
    Can be one of:
    - (l₁): single service activity
    - (S, {l₁, ..., lₙ}): start service activity
    - (E, {l₁, ..., lₙ}): end service activity
    - (Δ, {l₁, ..., lₙ}): quantified service activities
    - (l₁, ⊙, n): service activity cardinality
    """
    activities: List[str]  # l₁, ..., lₙ ∈ A
    activity_type: str = "single"  # "single", "start", "end", "quantified", "cardinality"
    quantifier: Optional[QuantifierType] = None  # Δ ∈ {ANY, ALL}
    operator: Optional[OperatorType] = None  # ⊙ ∈ {≥, ≤, =}
    count: Optional[int] = None  # n ∈ ℕ₀


@dataclass
class ServiceObjectTypeComponent:
    """
    Service object type component (c_ot) for object type queries.
    Can be either:
    - (ot): simple service object type
    - (ot, ⊙, n): service object type with cardinality
    """
    object_type: str  # ot ∈ OT
    operator: Optional[OperatorType] = None  # ⊙ ∈ {≥, ≤, =}
    count: Optional[int] = None  # n ∈ ℕ₀


@dataclass
class ServiceConstraintComponent:
    """
    Service constraint component (c_cf) for control-flow queries.
    Can be one of:
    - (⊙₁, n₁): service object cardinality constraint
    - (⊙₂, n₂): service relationship cardinality constraint
    - (⊙₁, n₁, ⊙₂, n₂): combined service constraint
    """
    object_operator: Optional[OperatorType] = None  # ⊙₁ ∈ {≥, ≤, =}
    object_count: Optional[int] = None  # n₁ ∈ ℕ₀
    relationship_operator: Optional[OperatorType] = None  # ⊙₂ ∈ {≥, ≤, =}
    relationship_count: Optional[int] = None  # n₂ ∈ ℕ₀


@dataclass
class ActivityQuery:
    """
    Activity Query (Q_a) as defined in the paper.
    Q_a = (c_o, c_a)
    """
    object_component: ServiceObjectComponent  # c_o
    activity_component: ServiceActivityComponent  # c_a


@dataclass
class ObjectTypeQuery:
    """
    Object Type Query (Q_ot) as defined in the paper.
    Q_ot = (c_ot)
    """
    object_type_component: ServiceObjectTypeComponent  # c_ot


@dataclass
class ControlFlowQuery:
    """
    Control-Flow Query (Q_cf) as defined in the paper.
    Q_cf = (Q₁, Q₂, T, c_cf)
    """
    first_activity_query: ActivityQuery  # Q₁
    second_activity_query: ActivityQuery  # Q₂
    temporal_relation: TemporalRelationType  # T ∈ {DF, EF}
    constraint_component: ServiceConstraintComponent  # c_cf


# Union type for all query types
Query = Union[ActivityQuery, ObjectTypeQuery, ControlFlowQuery]


@dataclass
class ComposedQuery:
    """
    Composed query using logical operators.
    """
    operator: LogicalOperator
    left: Optional[Union[Query, 'ComposedQuery']] = None
    right: Optional[Union[Query, 'ComposedQuery']] = None
    query: Optional[Query] = None  # For NOT operator with single query


class GOProQEvaluator:
    """
    Formal semantics evaluator for GOProQ queries.
    Implements the evaluation functions from the paper.
    """
    
    def __init__(self, ocel: OCEL, query_graph):
        self.ocel = ocel
        self.query_graph = query_graph
    
    def evaluate_query(self, query: Union[Query, ComposedQuery], process_execution_index: int) -> bool:
        """
        Main evaluation function Φ: U_Q × U_P → {true, false}
        """
        print(f"DEBUG: Evaluating {type(query).__name__} for PE {process_execution_index}")
        
        if isinstance(query, ComposedQuery):
            return self._evaluate_composed_query(query, process_execution_index)
        elif isinstance(query, ActivityQuery):
            return self._evaluate_activity_query(query, process_execution_index)
        elif isinstance(query, ObjectTypeQuery):
            return self._evaluate_object_type_query(query, process_execution_index)
        elif isinstance(query, ControlFlowQuery):
            return self._evaluate_control_flow_query(query, process_execution_index)
        else:
            raise ValueError(f"Unknown query type: {type(query)}")
    
    def _evaluate_composed_query(self, query: ComposedQuery, process_execution_index: int) -> bool:
        """
        Evaluate composed queries with logical operators.
        """
        if query.operator == LogicalOperator.AND:
            left_result = self.evaluate_query(query.left, process_execution_index)
            right_result = self.evaluate_query(query.right, process_execution_index)
            return left_result and right_result
        elif query.operator == LogicalOperator.OR:
            left_result = self.evaluate_query(query.left, process_execution_index)
            right_result = self.evaluate_query(query.right, process_execution_index)
            return left_result or right_result
        elif query.operator == LogicalOperator.NOT:
            query_result = self.evaluate_query(query.query, process_execution_index)
            return not query_result
        else:
            raise ValueError(f"Unknown logical operator: {query.operator}")
    
    def _evaluate_activity_query(self, query: ActivityQuery, process_execution_index: int) -> bool:
        """
        Evaluate Activity Query according to paper semantics.
        Ψ(Q_a, p) ⟺ Ψ₁(c_o, O_p^ot) ∧ Ψ₂(c_a, O_p^ot)
        """
        object_type = query.object_component.object_type
        
        if object_type == "ANY":
            # For ANY: check if ANY object type can satisfy the query
            # This means we need to check across all object types
            all_object_types = self.query_graph.objects[process_execution_index].keys()
            
            for ot in all_object_types:
                objects_of_type = self.query_graph.objects[process_execution_index][ot]
                
                # Check object cardinality constraint Ψ₁ for this object type
                if not self._check_object_cardinality(query.object_component, objects_of_type):
                    continue  # Try next object type
                
                # Check activity constraint for objects Ψ₂ for this object type
                # For ANY, we need at least one object type where ALL objects satisfy the constraint
                all_objects_satisfy = True
                for obj in objects_of_type:
                    if not self._check_activity_constraint(query.activity_component, obj, process_execution_index):
                        all_objects_satisfy = False
                        break
                
                if all_objects_satisfy:
                    return True  # Found at least one object type that satisfies the query
            
            return False  # No object type satisfied the query
        else:
            # For specific object types: check only objects of that type
            objects_of_type = self._get_objects_of_type(process_execution_index, object_type)
            
            # Check object cardinality constraint Ψ₁
            if not self._check_object_cardinality(query.object_component, objects_of_type):
                return False
            
            # Check activity constraint for objects Ψ₂
            # All objects of this type must satisfy the activity constraint
            for obj in objects_of_type:
                if not self._check_activity_constraint(query.activity_component, obj, process_execution_index):
                    return False
            return True
    
    def _evaluate_object_type_query(self, query: ObjectTypeQuery, process_execution_index: int) -> bool:
        """
        Evaluate Object Type Query according to paper semantics.
        Ψ(Q_ot, p) ⟺ |O_p^ot| ⊙ n
        """
        object_type = query.object_type_component.object_type
        
        if object_type == "ANY":
            # For ANY: check if ANY object type satisfies the cardinality constraint
            all_object_types = self.query_graph.objects[process_execution_index].keys()
            
            for ot in all_object_types:
                objects_of_type = self.query_graph.objects[process_execution_index][ot]
                if self._check_object_cardinality(query.object_type_component, objects_of_type):
                    return True  # Found at least one object type that satisfies the constraint
            
            return False  # No object type satisfied the constraint
        else:
            # For specific object types: check only objects of that type
            objects_of_type = self._get_objects_of_type(process_execution_index, object_type)
            return self._check_object_cardinality(query.object_type_component, objects_of_type)
    
    def _evaluate_control_flow_query(self, query: ControlFlowQuery, process_execution_index: int) -> bool:
        """
        Evaluate Control-Flow Query according to paper semantics.
        Ψ(Q_cf, p) ⟺ Ψ(Q₁, p) ∧ Ψ(Q₂, p) ∧ Ω(Λ(T, p), c_cf)
        """
        print(f"DEBUG: Evaluating ControlFlow query for PE {process_execution_index}")
        
        # Check if both activity queries are satisfied
        print(f"DEBUG: Checking first activity query...")
        if not self._evaluate_activity_query(query.first_activity_query, process_execution_index):
            print(f"DEBUG: First activity query failed for PE {process_execution_index}")
            return False
            
        print(f"DEBUG: Checking second activity query...")
        if not self._evaluate_activity_query(query.second_activity_query, process_execution_index):
            print(f"DEBUG: Second activity query failed for PE {process_execution_index}")
            return False
        
        print(f"DEBUG: Computing temporal mapping...")
        # Evaluate temporal constraint
        temporal_mapping = self._compute_temporal_mapping(
            query, process_execution_index
        )
        print(f"DEBUG: Temporal mapping computed, checking constraints...")
        
        result = self._check_constraint_component(
            query.constraint_component, temporal_mapping
        )
        print(f"DEBUG: ControlFlow result for PE {process_execution_index}: {result}")
        return result
    
    def _get_objects_of_type(self, process_execution_index: int, object_type: str) -> List[str]:
        """Get objects of specified type in the process execution."""
        if object_type == "ANY":
            return self.query_graph.objects_flattened[process_execution_index]
        elif object_type in self.query_graph.objects[process_execution_index]:
            return self.query_graph.objects[process_execution_index][object_type]
        else:
            return []
    
    def _check_object_cardinality(self, component: Union[ServiceObjectComponent, ServiceObjectTypeComponent], 
                                 objects: List[str]) -> bool:
        """Check if object cardinality constraint is satisfied."""
        if component.operator is None:
            # Default: at least one object
            return len(objects) >= 1
        
        count = len(objects)
        if component.operator == OperatorType.GTE:
            return count >= component.count
        elif component.operator == OperatorType.LTE:
            return count <= component.count
        elif component.operator == OperatorType.EQ:
            return count == component.count
        else:
            raise ValueError(f"Unknown operator: {component.operator}")
    
    def _check_activity_constraint(self, component: ServiceActivityComponent, 
                                  obj: str, process_execution_index: int) -> bool:
        """
        Check if activity constraint is satisfied for a service object.
        Implements δ(o, c_a) from the paper.
        """
        # Get events associated with the object
        events = self._get_events_for_object(obj, process_execution_index)
        
        if component.activity_type == "single":
            # Check if object has the specified activity
            activity = component.activities[0]
            return any(self.query_graph.get_event_id_to_activity(event_id) == activity 
                      for event_id in events)
        
        elif component.activity_type == "start":
            # Check if object starts with one of the specified activities
            if not events:
                return False
            start_event = min(events)  # Earliest event
            start_activity = self.query_graph.get_event_id_to_activity(start_event)
            return start_activity in component.activities
        
        elif component.activity_type == "end":
            # Check if object ends with one of the specified activities
            if not events:
                return False
            end_event = max(events)  # Latest event
            end_activity = self.query_graph.get_event_id_to_activity(end_event)
            return end_activity in component.activities
        
        elif component.activity_type == "quantified":
            # Check quantified activities (ANY or ALL)
            object_activities = set(self.query_graph.get_event_id_to_activity(event_id) 
                                  for event_id in events)
            target_activities = set(component.activities)
            
            if component.quantifier == QuantifierType.ANY:
                return bool(target_activities.intersection(object_activities))
            elif component.quantifier == QuantifierType.ALL:
                return target_activities.issubset(object_activities)
        
        elif component.activity_type == "cardinality":
            # Check activity cardinality
            activity = component.activities[0]
            count = sum(1 for event_id in events 
                       if self.query_graph.get_event_id_to_activity(event_id) == activity)
            
            if component.operator == OperatorType.GTE:
                return count >= component.count
            elif component.operator == OperatorType.LTE:
                return count <= component.count
            elif component.operator == OperatorType.EQ:
                return count == component.count
        
        return False
    
    def _get_events_for_object(self, obj: str, process_execution_index: int) -> List[int]:
        """Get all events associated with a service object."""
        events = []
        exec_graph = self.query_graph.annotated_graphs[process_execution_index]
        
        for node, data in exec_graph.nodes(data=True):
            if obj in data.get("objects", []):
                events.append(node)
        
        return events
    
    def _compute_temporal_mapping(self, query: ControlFlowQuery, 
                                 process_execution_index: int) -> Dict[Tuple[str, str], List[Tuple[int, int]]]:
        """
        Compute temporal mapping Λ(T, p) from the paper.
        Returns mapping of object pairs to event pairs satisfying temporal relation.
        """
        mapping = {}
        exec_graph = self.query_graph.annotated_graphs[process_execution_index]
        
        # Get objects for both activity queries
        first_objects = self._get_objects_for_activity_query(query.first_activity_query, process_execution_index)
        second_objects = self._get_objects_for_activity_query(query.second_activity_query, process_execution_index)
        
        print(f"DEBUG: PE {process_execution_index} - First objects: {len(first_objects)}, Second objects: {len(second_objects)}")
        print(f"DEBUG: Total iterations will be: {len(first_objects) * len(second_objects)}")
        
        if len(first_objects) * len(second_objects) > 10000:
            print(f"WARNING: Very large number of iterations ({len(first_objects) * len(second_objects)}) - this might be slow!")
            return {}  # Early return to prevent hanging
        
        for obj1 in first_objects:
            for obj2 in second_objects:
                event_pairs = self._find_temporal_event_pairs(
                    obj1, obj2, query, process_execution_index, exec_graph
                )
                if event_pairs:
                    mapping[(obj1, obj2)] = event_pairs
        
        return mapping
    
    def _get_objects_for_activity_query(self, activity_query: ActivityQuery, 
                                       process_execution_index: int) -> List[str]:
        """Get objects that satisfy the activity query."""
        object_type = activity_query.object_component.object_type
        objects_of_type = self._get_objects_of_type(process_execution_index, object_type)
        
        # Filter objects that satisfy the activity constraint
        satisfied_objects = []
        for obj in objects_of_type:
            if self._check_activity_constraint(activity_query.activity_component, obj, process_execution_index):
                satisfied_objects.append(obj)
        
        return satisfied_objects
    
    def _find_temporal_event_pairs(self, obj1: str, obj2: str, query: ControlFlowQuery,
                                  process_execution_index: int, exec_graph: nx.DiGraph) -> List[Tuple[int, int]]:
        """Find event pairs satisfying temporal relation between two objects."""
        event_pairs = []
        
        # Get events for both objects with matching activities
        events1 = self._get_events_with_activities(obj1, query.first_activity_query.activity_component, process_execution_index)
        events2 = self._get_events_with_activities(obj2, query.second_activity_query.activity_component, process_execution_index)
        
        for event1 in events1:
            for event2 in events2:
                if self._satisfies_temporal_relation(event1, event2, query.temporal_relation, exec_graph):
                    event_pairs.append((event1, event2))
        
        return event_pairs
    
    def _get_events_with_activities(self, obj: str, activity_component: ServiceActivityComponent,
                                   process_execution_index: int) -> List[int]:
        """Get events for object that match the activity component."""
        all_events = self._get_events_for_object(obj, process_execution_index)
        matching_events = []
        
        for event_id in all_events:
            activity = self.query_graph.get_event_id_to_activity(event_id)
            if activity in activity_component.activities:
                matching_events.append(event_id)
        
        return matching_events
    
    def _satisfies_temporal_relation(self, event1: int, event2: int, 
                                   relation: TemporalRelationType, exec_graph: nx.DiGraph) -> bool:
        """Check if two events satisfy the temporal relation."""
        if relation == TemporalRelationType.DF:
            # Directly-follows: direct edge exists
            return exec_graph.has_edge(event1, event2)
        elif relation == TemporalRelationType.EF:
            # Eventually-follows: path exists
            return nx.has_path(exec_graph, event1, event2)
        else:
            raise ValueError(f"Unknown temporal relation: {relation}")
    
    def _check_constraint_component(self, constraint: ServiceConstraintComponent, 
                                   temporal_mapping: Dict[Tuple[str, str], List[Tuple[int, int]]]) -> bool:
        """
        Check if constraint component is satisfied.
        Implements Ω function from the paper.
        """
        if constraint.object_operator is not None and constraint.relationship_operator is not None:
            # Combined constraint
            object_satisfied = self._check_object_constraint(constraint, temporal_mapping)
            relationship_satisfied = self._check_relationship_constraint(constraint, temporal_mapping)
            return object_satisfied and relationship_satisfied
        elif constraint.object_operator is not None:
            # Object cardinality constraint only
            return self._check_object_constraint(constraint, temporal_mapping)
        elif constraint.relationship_operator is not None:
            # Relationship cardinality constraint only
            return self._check_relationship_constraint(constraint, temporal_mapping)
        else:
            # No constraints specified - default to true if any mappings exist
            return len(temporal_mapping) > 0
    
    def _check_object_constraint(self, constraint: ServiceConstraintComponent,
                               temporal_mapping: Dict[Tuple[str, str], List[Tuple[int, int]]]) -> bool:
        """Check object cardinality constraint."""
        object_count = len(temporal_mapping)
        
        if constraint.object_operator == OperatorType.GTE:
            return object_count >= constraint.object_count
        elif constraint.object_operator == OperatorType.LTE:
            return object_count <= constraint.object_count
        elif constraint.object_operator == OperatorType.EQ:
            return object_count == constraint.object_count
        else:
            raise ValueError(f"Unknown operator: {constraint.object_operator}")
    
    def _check_relationship_constraint(self, constraint: ServiceConstraintComponent,
                                     temporal_mapping: Dict[Tuple[str, str], List[Tuple[int, int]]]) -> bool:
        """Check relationship cardinality constraint."""
        if not temporal_mapping:
            return False
        
        # Get minimum relationship count across all object pairs
        min_relationships = min(len(event_pairs) for event_pairs in temporal_mapping.values())
        
        if constraint.relationship_operator == OperatorType.GTE:
            return min_relationships >= constraint.relationship_count
        elif constraint.relationship_operator == OperatorType.LTE:
            return min_relationships <= constraint.relationship_count
        elif constraint.relationship_operator == OperatorType.EQ:
            return min_relationships == constraint.relationship_count
        else:
            raise ValueError(f"Unknown operator: {constraint.relationship_operator}")
