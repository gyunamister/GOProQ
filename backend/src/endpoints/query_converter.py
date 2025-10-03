"""
Query Converter: Transforms legacy query format to GOProQ formal specification.
This module provides conversion functions to maintain compatibility with existing queries
while transitioning to the formal query language structure.
"""

from typing import Dict, Any, Union, List
from .goproq_queries import (
    ActivityQuery, ObjectTypeQuery, ControlFlowQuery, ComposedQuery,
    ServiceObjectComponent, ServiceActivityComponent, ServiceObjectTypeComponent,
    ServiceConstraintComponent, QuantifierType, OperatorType, TemporalRelationType,
    LogicalOperator, Query
)


def _convert_operator_string(operator_str: str) -> OperatorType:
    """Convert operator string to OperatorType enum."""
    if operator_str == "gte":
        return OperatorType.GTE
    elif operator_str == "lte":
        return OperatorType.LTE
    elif operator_str == "eq":
        return OperatorType.EQ
    else:
        raise ValueError(f"Unknown operator string: {operator_str}")


def _convert_quantifier_string(quantifier_str: str) -> QuantifierType:
    """Convert quantifier string to QuantifierType enum."""
    if quantifier_str == "ANY":
        return QuantifierType.ANY
    elif quantifier_str == "ALL":
        return QuantifierType.ALL
    else:
        raise ValueError(f"Unknown quantifier string: {quantifier_str}")


class QueryConverter:
    """
    Converts legacy query formats to GOProQ formal specification.
    """
    
    @staticmethod
    def convert_legacy_query(legacy_query: Dict[str, Any]) -> Union[Query, ComposedQuery]:
        """
        Convert a legacy query to GOProQ format.
        
        Args:
            legacy_query: Legacy query dictionary
            
        Returns:
            Converted GOProQ query
        """
        query_type = legacy_query.get("query", "")
        
        # Handle empty or invalid query types
        if not query_type or query_type.strip() == "":
            raise ValueError("Empty or invalid query type provided")
        
        # Handle composed queries (binary tree structure)
        if query_type in ["AND", "OR"]:
            return QueryConverter._convert_composed_query(legacy_query)
        elif "left" in legacy_query and "right" in legacy_query and legacy_query.get("data"):
            return QueryConverter._convert_binary_tree_query(legacy_query)
        
        # Handle atomic queries
        elif query_type in ["isStart", "isEnd", "isContainedEvent", "areContainedEvents"]:
            return QueryConverter._convert_to_activity_query(legacy_query)
        elif query_type == "containsObjectsOfType":
            return QueryConverter._convert_to_object_type_query(legacy_query)
        elif query_type in ["isDirectlyFollowed", "isEventuallyFollowed"]:
            return QueryConverter._convert_to_control_flow_query(legacy_query)
        else:
            raise ValueError(f"Unknown legacy query type: '{query_type}'")
    
    @staticmethod
    def _convert_composed_query(legacy_query: Dict[str, Any]) -> ComposedQuery:
        """Convert legacy composed query to GOProQ format."""
        operator_map = {
            "AND": LogicalOperator.AND,
            "OR": LogicalOperator.OR,
            "NOT": LogicalOperator.NOT
        }
        
        operator = operator_map.get(legacy_query["query"])
        if not operator:
            raise ValueError(f"Unknown logical operator: {legacy_query['query']}")
        
        if operator == LogicalOperator.NOT:
            # NOT has single operand
            operand_query = legacy_query.get("operand") or legacy_query.get("left")
            return ComposedQuery(
                operator=operator,
                query=QueryConverter.convert_legacy_query(operand_query)
            )
        else:
            # AND/OR have two operands
            return ComposedQuery(
                operator=operator,
                left=QueryConverter.convert_legacy_query(legacy_query["left"]),
                right=QueryConverter.convert_legacy_query(legacy_query["right"])
            )
    
    @staticmethod
    def _convert_binary_tree_query(legacy_query: Dict[str, Any]) -> ComposedQuery:
        """Convert binary tree structure to composed query."""
        data = legacy_query["data"]
        
        if isinstance(data, str) and data in ["AND", "OR", "NOT"]:
            operator_map = {
                "AND": LogicalOperator.AND,
                "OR": LogicalOperator.OR,
                "NOT": LogicalOperator.NOT
            }
            
            operator = operator_map[data]
            
            if operator == LogicalOperator.NOT:
                # NOT typically has left operand only
                return ComposedQuery(
                    operator=operator,
                    query=QueryConverter.convert_legacy_query(legacy_query["left"])
                )
            else:
                return ComposedQuery(
                    operator=operator,
                    left=QueryConverter.convert_legacy_query(legacy_query["left"]) if legacy_query.get("left") else None,
                    right=QueryConverter.convert_legacy_query(legacy_query["right"]) if legacy_query.get("right") else None
                )
        else:
            # Data contains the actual query
            return QueryConverter.convert_legacy_query(data)
    
    @staticmethod
    def _convert_to_activity_query(legacy_query: Dict[str, Any]) -> ActivityQuery:
        """Convert legacy activity-related queries to ActivityQuery."""
        query_type = legacy_query["query"]
        
        # Create service object component
        object_component = ServiceObjectComponent(
            object_type=legacy_query.get("object_type", "ANY")
        )
        
        # Add cardinality constraints if present
        if "n_operator" in legacy_query and "n" in legacy_query:
            object_component.operator = QueryConverter._convert_operator(legacy_query["n_operator"])
            object_component.count = legacy_query["n"]
        
        # Create service activity component based on query type
        activities = legacy_query.get("event_activity", [])
        if isinstance(activities, str):
            activities = [activities]
        
        if query_type == "isStart":
            activity_component = ServiceActivityComponent(
                activities=activities,
                activity_type="start"
            )
        elif query_type == "isEnd":
            activity_component = ServiceActivityComponent(
                activities=activities,
                activity_type="end"
            )
        elif query_type == "isContainedEvent":
            # Check if it's a cardinality query
            if "n_operator" in legacy_query and "n" in legacy_query:
                activity_component = ServiceActivityComponent(
                    activities=activities,
                    activity_type="cardinality",
                    operator=QueryConverter._convert_operator(legacy_query["n_operator"]),
                    count=legacy_query["n"]
                )
            else:
                activity_component = ServiceActivityComponent(
                    activities=activities,
                    activity_type="single"
                )
        elif query_type == "areContainedEvents":
            quantifier = QuantifierType.ALL if legacy_query.get("quantifier") == "ALL" else QuantifierType.ANY
            activity_component = ServiceActivityComponent(
                activities=activities,
                activity_type="quantified",
                quantifier=quantifier
            )
        else:
            # Default to single activity
            activity_component = ServiceActivityComponent(
                activities=activities,
                activity_type="single"
            )
        
        return ActivityQuery(
            object_component=object_component,
            activity_component=activity_component
        )
    
    @staticmethod
    def _convert_to_object_type_query(legacy_query: Dict[str, Any]) -> ObjectTypeQuery:
        """Convert legacy object type query to ObjectTypeQuery."""
        object_type_component = ServiceObjectTypeComponent(
            object_type=legacy_query.get("object_type", "ANY")
        )
        
        # Add cardinality constraints
        if "n_operator" in legacy_query and "n" in legacy_query:
            object_type_component.operator = QueryConverter._convert_operator(legacy_query["n_operator"])
            object_type_component.count = legacy_query["n"]
        
        return ObjectTypeQuery(object_type_component=object_type_component)
    
    @staticmethod
    def _convert_to_control_flow_query(legacy_query: Dict[str, Any]) -> ControlFlowQuery:
        """Convert legacy control flow queries to ControlFlowQuery."""
        query_type = legacy_query["query"]
        
        # Create first activity query
        first_activities = legacy_query.get("first_activity", [])
        if isinstance(first_activities, str):
            first_activities = [first_activities]
        
        first_activity_query = ActivityQuery(
            object_component=ServiceObjectComponent(
                object_type=legacy_query.get("first_type", "ANY")
            ),
            activity_component=ServiceActivityComponent(
                activities=first_activities,
                activity_type="single"
            )
        )
        
        # Create second activity query
        second_activities = legacy_query.get("second_activity", [])
        if isinstance(second_activities, str):
            second_activities = [second_activities]
        
        second_activity_query = ActivityQuery(
            object_component=ServiceObjectComponent(
                object_type=legacy_query.get("second_type", "ANY")
            ),
            activity_component=ServiceActivityComponent(
                activities=second_activities,
                activity_type="single"
            )
        )
        
        # Determine temporal relation
        temporal_relation = TemporalRelationType.DF if query_type == "isDirectlyFollowed" else TemporalRelationType.EF
        
        # Create constraint component
        constraint_component = ServiceConstraintComponent()
        
        # Add constraints if present
        if "n_operator" in legacy_query and "n" in legacy_query:
            # This is typically a relationship constraint
            constraint_component.relationship_operator = QueryConverter._convert_operator(legacy_query["n_operator"])
            constraint_component.relationship_count = legacy_query["n"]
        
        # Add p-constraints (object cardinality)
        if "p_operator" in legacy_query and "p" in legacy_query:
            constraint_component.object_operator = QueryConverter._convert_operator(legacy_query["p_operator"])
            constraint_component.object_count = int(legacy_query["p"]) if isinstance(legacy_query["p"], (int, float)) else 1
        
        return ControlFlowQuery(
            first_activity_query=first_activity_query,
            second_activity_query=second_activity_query,
            temporal_relation=temporal_relation,
            constraint_component=constraint_component
        )
    
    @staticmethod
    def _convert_operator(operator_str: str) -> OperatorType:
        """Convert string operator to OperatorType."""
        operator_map = {
            "gte": OperatorType.GTE,
            "lte": OperatorType.LTE,
            "eq": OperatorType.EQ,
            ">=": OperatorType.GTE,
            "<=": OperatorType.LTE,
            "=": OperatorType.EQ,
            "==": OperatorType.EQ
        }
        
        return operator_map.get(operator_str, OperatorType.GTE)
    
    @staticmethod
    def convert_graphical_query(nodes: List[Dict], edges: List[Dict]) -> Union[Query, ComposedQuery]:
        """
        Convert graphical query (nodes and edges) to GOProQ format.
        This preserves the graphical query building functionality.
        
        Args:
            nodes: List of query nodes from the graphical interface
            edges: List of query edges from the graphical interface
            
        Returns:
            Converted GOProQ query
        """
        if not nodes:
            raise ValueError("No nodes provided in graphical query")
        
        # Handle single node queries
        if len(nodes) == 1 and not edges:
            return QueryConverter._convert_single_node(nodes[0])
        
        # Handle multi-node queries - build composition based on graph structure
        return QueryConverter._build_composed_query_from_graph(nodes, edges)
    
    @staticmethod
    def _convert_single_node(node: Dict) -> Query:
        """Convert a single graphical node to a query."""
        node_type = node.get("type", "")
        query_data = node.get("data", {}).get("query", {})
        
        if node_type == "activityNode":
            return QueryConverter._convert_to_activity_query(query_data)
        elif node_type == "objectTypeNode":
            return QueryConverter._convert_to_object_type_query(query_data)
        elif node_type == "objectNode":
            # Convert to object type query with specific objects
            return QueryConverter._convert_to_object_type_query(query_data)
        elif node_type == "activityQuery":
            # New ReactFlow node type for activity queries
            return QueryConverter._convert_reactflow_activity_query(query_data)
        elif node_type == "objectTypeQuery":
            # New ReactFlow node type for object type queries
            return QueryConverter._convert_reactflow_object_type_query(query_data)
        elif node_type == "controlFlowQuery":
            # New ReactFlow node type for control flow queries
            return QueryConverter._convert_reactflow_control_flow_query(query_data)
        elif node_type == "logicalOperator":
            # Logical operator nodes should be handled in graph composition, not as single nodes
            raise ValueError(f"Logical operator nodes should not be converted as single nodes: {node_type}")
        else:
            raise ValueError(f"Unknown graphical node type: {node_type}")
    
    @staticmethod
    def _build_composed_query_from_graph(nodes: List[Dict], edges: List[Dict]) -> Union[Query, ComposedQuery]:
        """
        Build a composed query from graphical nodes and edges.
        This preserves the graphical query building approach.
        """
        # Convert individual nodes to queries
        node_queries = {}
        for node in nodes:
            node_id = node["id"]
            if node.get("type") != "orNode":  # Skip OR/AND nodes
                node_queries[node_id] = QueryConverter._convert_single_node(node)
        
        # Handle simple case: no edges means AND composition
        if not edges:
            query_list = list(node_queries.values())
            if len(query_list) == 1:
                return query_list[0]
            return QueryConverter._create_and_composition(query_list)
        
        # Build composition based on edge structure and OR nodes
        return QueryConverter._analyze_graph_structure(nodes, edges, node_queries)
    
    @staticmethod
    def _create_and_composition(queries: List[Query]) -> ComposedQuery:
        """Create AND composition of multiple queries."""
        if len(queries) == 1:
            return queries[0]
        elif len(queries) == 2:
            return ComposedQuery(
                operator=LogicalOperator.AND,
                left=queries[0],
                right=queries[1]
            )
        else:
            # Recursive AND composition
            return ComposedQuery(
                operator=LogicalOperator.AND,
                left=queries[0],
                right=QueryConverter._create_and_composition(queries[1:])
            )
    
    @staticmethod
    def _analyze_graph_structure(nodes: List[Dict], edges: List[Dict], 
                               node_queries: Dict[str, Query]) -> Union[Query, ComposedQuery]:
        """
        Analyze the graph structure to determine the appropriate query composition.
        This implements the logic for handling OR nodes and complex graph structures.
        """
        # Find OR nodes
        or_nodes = [node for node in nodes if node.get("type") == "orNode"]
        
        if not or_nodes:
            # Simple AND composition
            query_list = list(node_queries.values())
            return QueryConverter._create_and_composition(query_list)
        
        # Handle OR compositions - this is a simplified approach
        # In practice, this would need more sophisticated graph analysis
        # to handle complex OR/AND combinations
        
        # For now, create OR between first two queries and AND with the rest
        query_list = list(node_queries.values())
        if len(query_list) >= 2:
            or_part = ComposedQuery(
                operator=LogicalOperator.OR,
                left=query_list[0],
                right=query_list[1]
            )
            
            if len(query_list) > 2:
                return ComposedQuery(
                    operator=LogicalOperator.AND,
                    left=or_part,
                    right=QueryConverter._create_and_composition(query_list[2:])
                )
            return or_part
        
        return query_list[0] if query_list else None

    @staticmethod
    def _convert_reactflow_activity_query(query_data: Dict) -> ActivityQuery:
        """Convert ReactFlow ActivityQuery node data to GOProQ ActivityQuery."""
        # Extract object component
        obj_comp_data = query_data.get("objectComponent", {})
        # Convert operator string to enum
        operator_str = obj_comp_data.get("operator")
        operator_enum = _convert_operator_string(operator_str) if operator_str else None
        
        object_component = ServiceObjectComponent(
            object_type=obj_comp_data.get("objectType", "ANY"),
            operator=operator_enum,
            count=obj_comp_data.get("count")
        )
        
        # Extract activity component
        act_comp_data = query_data.get("activityComponent", {})
        activities = act_comp_data.get("activities", [])
        
        # Handle single string vs list
        if isinstance(activities, str):
            activities = [activities]
        elif not activities:
            activities = ["ANY"]
        
        # Convert quantifier and operator strings to enums
        quantifier_str = act_comp_data.get("quantifier")
        quantifier_enum = _convert_quantifier_string(quantifier_str) if quantifier_str else None
        
        activity_operator_str = act_comp_data.get("operator")
        activity_operator_enum = _convert_operator_string(activity_operator_str) if activity_operator_str else None
        
        # Handle default values for cardinality queries
        activity_type = act_comp_data.get("activityType", "single")
        count = act_comp_data.get("count")
        
        # If activity type is cardinality but no operator/count provided, default to gte/1
        if activity_type == "cardinality" and not activity_operator_enum and count is None:
            activity_operator_enum = OperatorType.GTE
            count = 1
        
        activity_component = ServiceActivityComponent(
            activities=activities,
            activity_type=activity_type,
            quantifier=quantifier_enum,
            operator=activity_operator_enum,
            count=count
        )
        
        return ActivityQuery(
            object_component=object_component,
            activity_component=activity_component
        )
    
    @staticmethod
    def _convert_reactflow_object_type_query(query_data: Dict) -> ObjectTypeQuery:
        """Convert ReactFlow ObjectTypeQuery node data to GOProQ ObjectTypeQuery."""
        # Extract object type component
        obj_type_comp_data = query_data.get("objectTypeComponent", {})
        # Convert operator string to enum
        obj_type_operator_str = obj_type_comp_data.get("operator")
        obj_type_operator_enum = _convert_operator_string(obj_type_operator_str) if obj_type_operator_str else None
        
        object_type_component = ServiceObjectTypeComponent(
            object_type=obj_type_comp_data.get("objectType", "ANY"),
            operator=obj_type_operator_enum,
            count=obj_type_comp_data.get("count")
        )
        
        return ObjectTypeQuery(object_type_component=object_type_component)
    
    @staticmethod
    def _convert_reactflow_control_flow_query(query_data: Dict) -> ControlFlowQuery:
        """Convert ReactFlow ControlFlowQuery node data to GOProQ ControlFlowQuery."""
        # Extract first activity query
        first_activity_data = query_data.get("firstActivityQuery", {})
        first_activity_query = QueryConverter._convert_reactflow_activity_query(first_activity_data)
        
        # Extract second activity query
        second_activity_data = query_data.get("secondActivityQuery", {})
        second_activity_query = QueryConverter._convert_reactflow_activity_query(second_activity_data)
        
        # Extract temporal relation
        temporal_relation_str = query_data.get("temporalRelation", "DF")
        temporal_relation = TemporalRelationType.DF if temporal_relation_str == "DF" else TemporalRelationType.EF
        
        # Extract constraint component
        constraint_comp_data = query_data.get("constraintComponent", {})
        constraint_component = ServiceConstraintComponent(
            object_operator=_convert_operator_string(constraint_comp_data.get("objectOperator")) if constraint_comp_data.get("objectOperator") else None,
            object_count=constraint_comp_data.get("objectCount"),
            relationship_operator=_convert_operator_string(constraint_comp_data.get("relationshipOperator")) if constraint_comp_data.get("relationshipOperator") else None,
            relationship_count=constraint_comp_data.get("relationshipCount")
        )
        
        return ControlFlowQuery(
            first_activity_query=first_activity_query,
            second_activity_query=second_activity_query,
            temporal_relation=temporal_relation,
            constraint_component=constraint_component
        )
    
    @staticmethod
    def convert_graphical_query(nodes: List[Dict], edges: List[Dict]) -> Union[Query, ComposedQuery]:
        """
        Convert graphical query with tree-based architecture to GOProQ format.
        
        New Architecture:
        - Control Flow queries are nodes (not edges)
        - Logical operators are nodes that compose multiple inputs
        - Edges represent data flow and composition structure
        - Tree structure supports nested compositions
        
        Args:
            nodes: List of ReactFlow nodes
            edges: List of ReactFlow edges
            
        Returns:
            GOProQ formatted query (single Query or ComposedQuery)
        """
        print(f"DEBUG: Converting tree-based graphical query - {len(nodes)} nodes, {len(edges)} edges")
        
        # Handle empty query
        if not nodes:
            raise ValueError("Empty query: no nodes provided")
        
        # Separate nodes by type
        logical_operator_nodes = [n for n in nodes if n.get('type') == 'logicalOperator']
        query_nodes = [n for n in nodes if n.get('type') in ['activityQuery', 'objectTypeQuery', 'controlFlowQuery']]
        
        # Filter out isolated logical operators (those with no incoming edges)
        connected_logical_operators = []
        if edges:
            logical_targets = {edge.get("target") for edge in edges if edge.get("target")}
            connected_logical_operators = [n for n in logical_operator_nodes if n["id"] in logical_targets]
        
        print(f"DEBUG: Found {len(logical_operator_nodes)} logical operators ({len(connected_logical_operators)} connected), {len(query_nodes)} query nodes")
        
        # Handle single query node with no connected logical operators
        if len(query_nodes) == 1 and not connected_logical_operators:
            print("DEBUG: Single query node - converting directly")
            return QueryConverter._convert_single_node(query_nodes[0])
        
        # Handle multiple nodes - build tree structure
        if connected_logical_operators:
            print("DEBUG: Building tree from connected logical operators")
            return QueryConverter._build_tree_from_logical_operators(nodes, edges)
        else:
            # Check if there are isolated logical operators that could be applied
            isolated_logical_operators = [n for n in logical_operator_nodes if n["id"] not in {edge.get("target") for edge in edges}]
            
            if isolated_logical_operators and len(query_nodes) > 1:
                # Use the first isolated logical operator to combine query nodes
                operator_node = isolated_logical_operators[0]
                operator_str = operator_node.get("data", {}).get("operator", "AND")
                logical_operator = LogicalOperator.AND if operator_str == "AND" else \
                                 LogicalOperator.OR if operator_str == "OR" else \
                                 LogicalOperator.NOT
                
                print(f"DEBUG: Using isolated logical operator '{operator_str}' to combine {len(query_nodes)} query nodes")
                queries = [QueryConverter._convert_single_node(node) for node in query_nodes]
                return QueryConverter._compose_queries_with_operator(queries, logical_operator)
            else:
                print("DEBUG: No logical operators - combining query nodes with AND")
                # Multiple query nodes without any logical operators = AND composition
                queries = [QueryConverter._convert_single_node(node) for node in query_nodes]
                return QueryConverter._compose_queries_with_and(queries)
    
    @staticmethod
    def _build_tree_from_logical_operators(nodes: List[Dict], edges: List[Dict]) -> Union[Query, ComposedQuery]:
        """
        Build a tree structure from logical operator nodes and their connections.
        
        This method processes the graph as a tree where:
        - Logical operator nodes are internal tree nodes
        - Query nodes are leaf nodes
        - Edges define parent-child relationships
        
        Args:
            nodes: All graph nodes
            edges: All graph edges showing connections
            
        Returns:
            Root of the composition tree
        """
        print(f"DEBUG: Building composition tree from {len(nodes)} nodes and {len(edges)} edges")
        
        # Create mappings
        node_map = {node["id"]: node for node in nodes}
        
        # Consider logical operators connected if they are either sources or targets
        logical_targets = {edge.get("target") for edge in edges if edge.get("target")}
        logical_sources = {edge.get("source") for edge in edges if edge.get("source")}
        connected_logical_ids = logical_targets | logical_sources
        logical_nodes = [n for n in nodes if n.get('type') == 'logicalOperator' and n["id"] in connected_logical_ids]
        query_nodes = [n for n in nodes if n.get('type') in ['activityQuery', 'objectTypeQuery', 'controlFlowQuery']]
        
        # Build input mapping: which nodes feed into each logical operator
        logical_inputs = {logical_node["id"]: [] for logical_node in logical_nodes}
        
        # Detect the connection pattern by analyzing edge directions
        edges_to_logical = sum(1 for edge in edges if edge.get("target") in {n["id"] for n in logical_nodes})
        edges_from_logical = sum(1 for edge in edges if edge.get("source") in {n["id"] for n in logical_nodes})
        
        print(f"DEBUG: Edges TO logical operators: {edges_to_logical}, FROM logical operators: {edges_from_logical}")
        
        if edges_to_logical >= edges_from_logical:
            # Standard pattern: query nodes → logical operators
            print("DEBUG: Using standard pattern (query nodes → logical operators)")
            for edge in edges:
                target_id = edge.get("target")
                source_id = edge.get("source")
                
                if target_id in logical_inputs:
                    logical_inputs[target_id].append(source_id)
                    print(f"DEBUG: Node {source_id} feeds into logical operator {target_id}")
        else:
            # Reverse pattern: logical operators → query nodes
            print("DEBUG: Using reverse pattern (logical operators → query nodes)")
            # In reverse pattern, logical operators are sources pointing to their inputs
            for edge in edges:
                source_id = edge.get("source")
                target_id = edge.get("target")
                
                if source_id in logical_inputs:
                    logical_inputs[source_id].append(target_id)
                    print(f"DEBUG: Node {target_id} feeds into logical operator {source_id} (reverse pattern)")
        
        # Find root logical operator (the one that no other logical operator feeds into)
        output_nodes = set(logical_inputs.keys())
        for logical_node_id, inputs in logical_inputs.items():
            for input_node_id in inputs:
                if input_node_id in output_nodes:
                    output_nodes.discard(input_node_id)
        
        if len(output_nodes) != 1:
            print(f"WARNING: Expected 1 root logical operator, found {len(output_nodes)}. Using first available.")
            root_logical_id = list(output_nodes)[0] if output_nodes else logical_nodes[0]["id"]
        else:
            root_logical_id = list(output_nodes)[0]
        
        print(f"DEBUG: Root logical operator: {root_logical_id}")
        
        # Recursively build the tree starting from root
        result = QueryConverter._build_logical_composition_tree(root_logical_id, node_map, logical_inputs)
        
        # Handle case where root returns None (all operands were invalid)
        if result is None:
            print("WARNING: Root logical operator returned None - falling back to AND composition of query nodes")
            # Fall back to combining all query nodes with AND
            queries = [QueryConverter._convert_single_node(node) for node in query_nodes]
            if len(queries) == 1:
                return queries[0]
            else:
                return QueryConverter._compose_queries_with_and(queries)
        
        return result
    
    @staticmethod
    def _build_logical_composition_tree(node_id: str, node_map: Dict[str, Dict], logical_inputs: Dict[str, List[str]]) -> Union[Query, ComposedQuery]:
        """
        Recursively build a composition tree from a logical operator node.
        
        Args:
            node_id: ID of current node to process
            node_map: Mapping of node IDs to node objects
            logical_inputs: Mapping of logical operator IDs to their input node IDs
            
        Returns:
            Query or ComposedQuery representing this subtree
        """
        node = node_map[node_id]
        node_type = node.get("type")
        
        if node_type == "logicalOperator":
            # This is a logical operator - build ComposedQuery from its inputs
            operator_str = node.get("data", {}).get("operator", "AND")
            logical_operator = LogicalOperator.AND if operator_str == "AND" else \
                             LogicalOperator.OR if operator_str == "OR" else \
                             LogicalOperator.NOT
            
            inputs = logical_inputs.get(node_id, [])
            print(f"DEBUG: Processing logical operator {node_id} ({operator_str}) with {len(inputs)} inputs")
            
            if len(inputs) == 0:
                print(f"WARNING: Logical operator {node_id} has no inputs - treating as isolated node")
                # Return a placeholder query that will be filtered out
                return None
            elif len(inputs) == 1:
                # Unary operator (typically NOT)
                operand = QueryConverter._build_logical_composition_tree(inputs[0], node_map, logical_inputs)
                if operand is None:
                    print(f"WARNING: Unary logical operator {node_id} has None operand - skipping")
                    return None
                return ComposedQuery(
                    operator=logical_operator,
                    query=operand
                )
            elif len(inputs) == 2:
                # Binary operator (AND, OR)
                left = QueryConverter._build_logical_composition_tree(inputs[0], node_map, logical_inputs)
                right = QueryConverter._build_logical_composition_tree(inputs[1], node_map, logical_inputs)
                
                # Handle None operands from isolated logical operators
                if left is None and right is None:
                    print(f"WARNING: Binary logical operator {node_id} has both operands as None - skipping")
                    return None
                elif left is None:
                    print(f"WARNING: Binary logical operator {node_id} has left operand as None - returning right")
                    return right
                elif right is None:
                    print(f"WARNING: Binary logical operator {node_id} has right operand as None - returning left")
                    return left
                
                return ComposedQuery(
                    left=left,
                    operator=logical_operator,
                    right=right
                )
            else:
                # Multiple inputs - create nested binary structure
                # First, build all operands and filter out None values
                operands = []
                for input_id in inputs:
                    operand = QueryConverter._build_logical_composition_tree(input_id, node_map, logical_inputs)
                    if operand is not None:
                        operands.append(operand)
                
                if len(operands) == 0:
                    print(f"WARNING: Multiple-input logical operator {node_id} has no valid operands - skipping")
                    return None
                elif len(operands) == 1:
                    print(f"WARNING: Multiple-input logical operator {node_id} has only one valid operand - returning it")
                    return operands[0]
                else:
                    # Compose the valid operands
                    return QueryConverter._compose_queries_with_operator(operands, logical_operator)
                
        else:
            # This is a query node - convert to base query
            print(f"DEBUG: Processing query node {node_id} ({node_type})")
            return QueryConverter._convert_single_node(node)
    
    @staticmethod
    def _compose_queries_with_operator(queries: List[Union[Query, ComposedQuery]], operator: LogicalOperator) -> ComposedQuery:
        """Compose multiple queries with a specific logical operator."""
        if len(queries) < 2:
            raise ValueError("Need at least 2 queries to compose")
        
        result = ComposedQuery(
            left=queries[0],
            operator=operator,
            right=queries[1]
        )
        
        for i in range(2, len(queries)):
            result = ComposedQuery(
                left=result,
                operator=operator,
                right=queries[i]
            )
        
        return result
    
    
    @staticmethod
    def _compose_queries_with_and(queries: List[Union[Query, ComposedQuery]]) -> ComposedQuery:
        """Compose multiple queries with AND operator."""
        if len(queries) < 2:
            raise ValueError("Need at least 2 queries to compose")
        
        result = ComposedQuery(
            left=queries[0],
            operator=LogicalOperator.AND,
            right=queries[1]
        )
        
        for i in range(2, len(queries)):
            result = ComposedQuery(
                left=result,
                operator=LogicalOperator.AND,
                right=queries[i]
            )
        
        return result


def convert_legacy_to_goproq(legacy_query: Dict[str, Any]) -> Union[Query, ComposedQuery]:
    """
    Main conversion function for transforming legacy queries to GOProQ format.
    
    Args:
        legacy_query: Legacy query in old format
        
    Returns:
        GOProQ formatted query
    """
    return QueryConverter.convert_legacy_query(legacy_query)


def convert_graphical_to_goproq(nodes: List[Dict], edges: List[Dict]) -> Union[Query, ComposedQuery]:
    """
    Main conversion function for transforming graphical queries to GOProQ format.
    
    Args:
        nodes: Graphical query nodes
        edges: Graphical query edges
        
    Returns:
        GOProQ formatted query
    """
    return QueryConverter.convert_graphical_query(nodes, edges)
