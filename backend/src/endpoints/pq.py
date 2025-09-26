# Set matplotlib backend before any imports that might trigger matplotlib
import matplotlib
matplotlib.use('Agg')

import datetime
import os
from collections import defaultdict
from typing import Any
import random
import multiprocessing as mp

import pm4py
from fastapi import APIRouter
from pydantic import BaseModel

import networkx as nx
import json
import time
from dataclasses import dataclass
from ocpa.objects.log.ocel import OCEL
from ocpa.objects.log.util.param import JsonParseParameters

from src.endpoints.log_management import get_ocel
from src.endpoints.performance import get_projected_event_log
from pandas import DataFrame
from pandas.core.groupby import DataFrameGroupBy
from pm4py.objects.log.obj import EventLog
from functools import cmp_to_key
import pandas as pd

router = APIRouter(prefix="/pq", tags=["Process querying"])
LIVE_QUERY_TIMEOUT = 30.0

wildcards = {}
performance_flag_global = False


@router.put("/ocel_metadata")  
def get_ocel_metadata(query_dict: dict):
    """
    Extract activities and object types from the current OCEL
    for use in the graphical query builder.
    """
    try:
        ocel, _ = get_ocel(query_dict["file_path"], two_return_values=True)
        
        # Extract activities from event log
        activities = []
        if 'event_activity' in ocel.log.log.columns:
            activities = list(ocel.log.log['event_activity'].unique())
            activities = [str(a) for a in activities if pd.notna(a)]  # Remove NaN values
            activities.sort()
            print(f"Found {len(activities)} activities from event_activity column")
        else:
            print("Warning: 'event_activity' column not found in OCEL log")
            # Fallback: try other possible column names
            possible_columns = ['ocel:activity', 'concept:name', 'activity', 'Activity']
            for col in possible_columns:
                if col in ocel.log.log.columns:
                    activities = list(ocel.log.log[col].unique())
                    activities = [str(a) for a in activities if pd.notna(a)]
                    activities.sort()
                    print(f"Found {len(activities)} activities from {col} column")
                    break
        
        # Extract object types directly from OCEL object
        object_types = []
        if hasattr(ocel, 'object_types'):
            object_types = list(ocel.object_types)
            object_types = [str(ot) for ot in object_types if ot]  # Remove empty strings
            object_types.sort()
            print(f"Found {len(object_types)} object types from ocel.object_types")
        else:
            print("Warning: ocel.object_types not available")
        
        # Add ANY as default option for object types
        if 'ANY' not in object_types:
            object_types.insert(0, 'ANY')
        
        # Get some basic statistics
        total_events = len(ocel.log.log)
        total_process_executions = len(ocel.process_executions) if hasattr(ocel, 'process_executions') else 0
        
        # Count unique objects across all object types
        # Objects are stored as lists in columns named after object types
        unique_objects = set()
        for obj_type in object_types:
            if obj_type != 'ANY' and obj_type in ocel.log.log.columns:
                # Get all object IDs from this object type column
                for obj_list in ocel.log.log[obj_type]:
                    if isinstance(obj_list, list):
                        unique_objects.update(obj_list)
                    elif pd.notna(obj_list):  # Handle single values
                        unique_objects.add(obj_list)
        
        total_unique_objects = len(unique_objects)
        
        print(f"Final result - Activities: {len(activities)}, Object Types: {len(object_types)}")
        print(f"Activities: {activities[:10]}...")  # Show first 10
        print(f"Object Types: {object_types}")
        print(f"Statistics - Events: {total_events}, Objects: {total_unique_objects}, PEs: {total_process_executions}")
        
        return {
            'activities': activities,
            'object_types': object_types,
            'statistics': {
                'total_events': total_events,
                'total_objects': total_unique_objects,  # Fixed: count unique objects
                'total_process_executions': total_process_executions,  # Added: PE count
                'num_activities': len([a for a in activities if a != 'ANY']),
                'num_object_types': len([ot for ot in object_types if ot != 'ANY'])
            }
        }
        
    except Exception as e:
        import traceback
        print(f"Error in get_ocel_metadata: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        return {
            'error': str(e),
            'activities': [],
            'object_types': ['ANY'],
            'statistics': {
                'total_events': 0,
                'total_objects': 0,
                'total_process_executions': 0,  # Added: PE count
                'num_activities': 0,
                'num_object_types': 0
            }
        }


def set_wildcards(new_wildcard: str, object_type: str):
    global wildcards
    if new_wildcard not in wildcards:
        wildcards[new_wildcard] = object_type
    else:
        # Reduce existing wildcard
        prev = wildcards[new_wildcard].split(",")
        new = object_type.split(",")
        wildcards[new_wildcard] = ','.join(list(set(prev) & set(new)))


def reset_wildcards():
    global wildcards
    wildcards = {}


def reset_performance_flag():
    global performance_flag_global
    performance_flag_global = False


# IDEA: When WC is replaced by object types, remember that something was replaced
# and later on, look at types of WC again and do intersection between them to narrow down to one type!
def translate_object_types(query):
    replaced_wildcard = ""
    if "object_type" in query and query["object_type"] in wildcards:
        replaced_wildcard = query["object_type"]
        query["object_type"] = wildcards[query["object_type"]]
    if "first_type" in query and query["first_type"] in wildcards:
        query["first_type"] = wildcards[query["first_type"]]
    if "second_type" in query and query["second_type"] in wildcards:
        query["second_type"] = wildcards[query["second_type"]]
    return replaced_wildcard


def set_wildcards_from_query(query, all_objects, replaced_wildcard=""):
    if "object_type" in query:
        if query["object_type"][:2] == "WC":
            set_wildcards(query["object_type"], ','.join(all_objects))
        elif replaced_wildcard != "":
            set_wildcards(replaced_wildcard, ','.join(all_objects))
    # if "first_type" in query and query["first_type"][:2] == "WC":
    #    set_wildcards(query["first_type"], ','.join(all_objects))
    # if "second_type" in query and query["second_type"][:2] == "WC":
    #    set_wildcards(query["second_type"], ','.join(all_objects))


@router.get("/live_timeout")
def set_live_timeout(new_timeout: float):
    global LIVE_QUERY_TIMEOUT
    LIVE_QUERY_TIMEOUT = new_timeout


def flatten_list_of_tuples(l):
    return [ele for (ele, _) in l]


def aggregate_tuples(satisfied_objects):
    d = defaultdict(list)
    for tup in satisfied_objects:
        if tup[0] not in d:
            d[tup[0]] = tup[1]
        else:
            d[tup[0]].extend(tup[1])

    return list(map(tuple, d.items()))


def get_object_graph(graph, object):
    object_nodes = [node for node, data in graph.nodes(data=True) if object in data["objects"]]
    object_edges = [(source, target) for source, target, data in graph.edges(data=True) if
                    object in data["objects"]]
    g = nx.DiGraph()
    g.add_nodes_from(object_nodes)
    g.add_edges_from(object_edges)
    return g


def _get_start_node(graph, object):
    g = get_object_graph(graph, object)
    for node in g.nodes():
        if g.out_degree(node) >= 1 and g.in_degree(node) == 0:
            return node
    # If we have no edges in the graph, there can be no node with out_degree >= 1
    if len(list(g.nodes())) > 0 and len(list(g.edges())) == 0:
        return list(g.nodes())[0]
    return None


def _get_end_node(graph, object):
    g = get_object_graph(graph, object)
    for node in g.nodes():
        if g.out_degree(node) == 0 and g.in_degree(node) >= 1:
            return node
    # If we have no edges in the graph, there can be no node with in_degree >= 1
    if len(list(g.nodes())) == 1 and len(list(g.edges())) == 0:
        return list(g.nodes())[0]
    return None


def get_path(graph, object):
    path = []
    for source, target, data in graph.edges(data=True):
        if object in data["objects"]:
            path.append((source, target))
    return path


def get_nodes(graph, object):
    events = []
    for node, data in graph.nodes(data=True):
        if object in data["objects"]:
            events.append(node)
    return events


def _satisfies_p(operator, p, mode, object_count, objects_len):
    if mode == "relative":
        if objects_len == 0:
            return True
        match operator:
            case "gte":
                if (object_count / objects_len) >= p:
                    return True
            case "lte":
                if (object_count / objects_len) <= p:
                    return True
            case "eq":
                if (object_count / objects_len) == p:
                    return True
    else:
        match operator:
            case "gte":
                if object_count >= p:
                    return True
            case "lte":
                if object_count <= p:
                    return True
            case "eq":
                if object_count == p:
                    return True


def _satisfies_count(operator, n, count, p):
    match operator:
        case "gte":
            if count >= n:
                return True
        case "lte":
            if count <= n:
                return True
        case "eq":
            if count == n:
                return True
        case "":
            if p == 1:
                return True


def contains_object_types(objects, n_operator="gte", n=1):
    object_count = len(objects)
    match n_operator:
        case "gte":
            if object_count < n:
                return []
        case "lte":
            if object_count > n:
                return []
        case "eq":
            if object_count != n:
                return []
    return objects


def contains_objects(objects, needed_objects, quantifier="ALL"):
    # This does not make much sense in itself
    # The purpose is to remove duplicated code and unify executions
    objects = flatten_list_of_tuples(objects)
    broke_flag = False
    if quantifier == "ALL":
        for obj in needed_objects:
            if obj not in objects:
                broke_flag = True
    else:
        broke_flag = True
        for obj in needed_objects:
            if obj in objects:
                broke_flag = False
                break
    if not broke_flag:
        return objects

    return []


def _check_paths(graph, node, target, all_paths):
    node_obj = graph.nodes[node]["event_activity"]
    target_obj = graph.nodes[target]["event_activity"]
    valid_flag = False
    for path in all_paths:
        broke_flag = False
        for path_node in path:
            if not {node_obj, target_obj}.intersection(graph.nodes[path_node]["objects"]):
                broke_flag = True
                break
        if not broke_flag:
            valid_flag = True
            break
    if valid_flag:
        return True
    return False


@dataclass
class QueryGraph:
    # TODO: refactor code to remove duplicates
    # TODO: optimize the PE/indices thingie
    # TODO: textual description of operator on hover
    # TODO: progress bar based on tree?
    # TODO: allow P as an int to query overall occurence? => e.g. PEs where at least 2 items are reordered
    # TODO: optimize p (keep track of remaining X, if not possible to reach p anymore, stop)
    ocel: OCEL

    def __init__(self, ocel):
        self.ocel = ocel
        self._objects = None
        self._all_objects = None
        self._objects_flattened = None
        self._annotated_graphs = None
        self._performance_metrics = None
        self._process_executions = self.ocel.process_executions
        self._process_execution_indices = list(range(0, len(ocel.process_executions)))
        self._event_id_to_activity_mapping = ocel.log.log["event_activity"].to_dict()
        self._activity_to_event_id_mapping = None
        self._object_edges = None
        self._calculate_aggregated_objects()
        self._calculate_annotated_graphs()
        self._calculate_activity_to_event_id_mapping()

    def __post_init__(self):
        pass

    def reset_process_executions(self):
        self._process_executions = self.ocel.process_executions
        self._process_execution_indices = list(range(0, len(self.ocel.process_executions)))

    def performance_metrics(self):
        if not self._performance_metrics:
            self._calculate_performance_metrics()
        return self._performance_metrics

    @property
    def aggregated_objects(self):
        if not self._objects or not self._all_objects:
            self._calculate_aggregated_objects()
        return self._objects, self._all_objects

    @property
    def objects(self):
        if not self._objects or not self._all_objects:
            self._calculate_aggregated_objects()
        return self._objects

    @property
    def objects_flattened(self):
        if not self._objects_flattened or not self._all_objects:
            self._calculate_aggregated_objects()
        return self._objects_flattened

    @property
    def all_objects(self):
        if not self._objects or not self._all_objects:
            self._calculate_aggregated_objects()
        return self._all_objects

    @property
    def annotated_graphs(self):
        if not self._annotated_graphs:
            self._calculate_annotated_graphs()
        return self._annotated_graphs

    @property
    def id_activity_mapping(self):
        return self._event_id_to_activity_mapping

    @property
    def process_executions(self):
        return self._process_executions

    @process_executions.setter
    def process_executions(self, value):
        self._process_executions = value

    @property
    def process_execution_indices(self):
        return self._process_execution_indices

    @process_execution_indices.setter
    def process_execution_indices(self, value):
        self._process_execution_indices = value

    def get_aggregated_objects_of_event_id(self, event_id):
        objects = self.ocel.object_types
        aggr = []
        for obj in objects:
            aggr.extend(self.ocel.log.get_value(event_id, obj))
        return aggr

    def get_values_of_event_id(self, event_id):
        return self.ocel.log.log.loc[event_id]

    def get_translated_path(self, path):
        return [self.ocel.get_value(event_id, "event_activity") for event_id in path]

    def get_event_id_to_activity(self, event_id):
        # return self.ocel.get_value(event_id, "event_activity")
        return self._event_id_to_activity_mapping[event_id]

    def activity_to_event_ids(self, event_activity):
        return self._activity_to_event_id_mapping[event_activity]

    # For start / end event, we assume there to be only one event per object
    # This is based upon how process executions are extracted
    def _is_start_event_with_ids(self, graph, object, ids, event_activity):
        if not ids:
            # TODO: Check if this really works everytime
            # start_nodes = [_get_start_node(graph, object)]
            pot_nodes = []
            for (node, data) in graph.nodes(data=True):
                if object in data["objects"]:
                    pot_nodes.append(node)
            start_nodes = [min(pot_nodes)]
        else:
            start_nodes = ids

        satisfied_ids = []
        for node in start_nodes:
            start_activity = self._event_id_to_activity_mapping[node]
            if event_activity == start_activity:
                satisfied_ids.append(node)
        return satisfied_ids

    def _is_end_event_with_ids(self, graph, object, ids, event_activity):
        if not ids:
            # TODO: Check if this really works everytime
            # end_nodes = [_get_end_node(graph, object)]
            pot_nodes = []
            for (node, data) in graph.nodes(data=True):
                if object in data["objects"]:
                    pot_nodes.append(node)
            end_nodes = [max(pot_nodes)]
        else:
            end_nodes = ids

        satisfied_ids = []
        for node in end_nodes:
            end_activity = self._event_id_to_activity_mapping[node]
            if event_activity == end_activity:
                satisfied_ids.append(node)
        return satisfied_ids

    def _contains_event(self, graph, object, event_activity, mode, n):
        events = get_nodes(graph, object)
        translated_events = self.get_translated_path(events)
        count = 0
        for activity in translated_events:
            if event_activity == activity:
                count += 1
        match mode:
            case "gte":
                return count >= n
            case "lte":
                return count <= n
            case "eq":
                return count == n

    def get_objects(self, process_execution_index, object_type):
        if object_type not in self._objects[process_execution_index]:
            if object_type == "ANY" or object_type[:2] == "WC":
                return self._objects_flattened[process_execution_index]
            elif "," in object_type:
                object_types = object_type.split(",")
                objects = []
                for ot in object_types:
                    objects.extend(self._objects[process_execution_index][ot])
                return objects
            else:
                return []
        return self._objects[process_execution_index][object_type]

    def get_objects_with_id(self, process_execution_index, object_type):
        if object_type not in self._objects[process_execution_index]:
            if object_type == "ANY" or object_type[:2] == "WC":
                return list(map(lambda x: (x, []), self._objects_flattened[process_execution_index]))
            elif "," in object_type:
                object_types = object_type.split(",")
                objects = []
                for ot in object_types:
                    objects.extend(list(map(lambda x: (x, []), self._objects[process_execution_index][ot])))
                return objects
            else:
                return []
        return list(map(lambda x: (x, []), self._objects[process_execution_index][object_type]))

    # Query: Give me all PE where "Create Purchase Requisition" is start event of MATERIAL
    # isStartEvent("Create Purchase Requisition", "MATERIAL")

    def execute_start_or_end(self, mode, event_activity, object_type, process_execution_index, objects, metrics,
                             quantifier="", p=1.0, p_operator="gte", p_mode="relative", boolean_operator=""):
        if mode == "START":
            start_or_end_func = self._is_start_event_with_ids
        else:
            start_or_end_func = self._is_end_event_with_ids

        if quantifier == "ANY" and not isinstance(event_activity, list):
            print("Error: event_activity should be a list since \"ANY\" was specified as mode.")
            return
        if len(event_activity) == 1 and quantifier != "ANY":
            event_activity = event_activity[0]

        exec_graph = self.annotated_graphs[process_execution_index]
        # Not all object_types need to be present in each process execution
        if object_type not in self._objects[process_execution_index]:
            return

        # Check if amount of objects that satisfy condition is enough
        satisfied_objects = []
        not_satisfied_objects = []
        for (object, ids) in objects:
            # Reset broke_flag for != "ANY" case
            broke_flag = False
            remaining_ids = []
            if quantifier != "ANY":
                # If there are several start nodes, just one of them needs to have event_activity right now!
                remaining_ids = start_or_end_func(exec_graph, object, ids, event_activity)
                if not remaining_ids:
                    broke_flag = True
                    # We should not break here, since then cant find executions where only p% are needed
                    # break
            else:
                broke_flag = True
                for activity in event_activity:
                    remaining_ids.extend(start_or_end_func(exec_graph, object, ids, activity))
                if remaining_ids:
                    broke_flag = False
                # When broke_flag is True, object does not satisfy condition and we can stop
                # Cant stop here, since else cant find executions where only p% are needed
                # if broke_flag:
                #    break
            if not broke_flag:
                satisfied_objects.append((object, remaining_ids))
            else:
                not_satisfied_objects.append((object, []))
        if len(metrics) == 3:
            satisfied_objects, new_unsat_objects = self.filter_nodes_with_metrics(satisfied_objects, metrics[0],
                                                                                  metrics[1], metrics[2])
            not_satisfied_objects.extend(new_unsat_objects)

        if boolean_operator == "NOT":
            if _satisfies_p(p_operator, p, p_mode, len(not_satisfied_objects), len(objects)):
                return not_satisfied_objects
        else:
            if _satisfies_p(p_operator, p, p_mode, len(satisfied_objects), len(objects)):
                return satisfied_objects
        return []

    def _check_n(self, nodes, mode, n):
        count = len(nodes)
        match mode:
            case "gte":
                return count >= n
            case "lte":
                return count <= n
            case "eq":
                return count == n

    def _contains_event_with_id(self, graph, object, ids, event_activity, mode, n):
        if not ids:
            nodes = get_nodes(graph, object)
        else:
            nodes = ids
        satisfied_nodes = []
        translated_events = self.get_translated_path(nodes)
        count = 0
        for id, activity in enumerate(translated_events):
            if event_activity == activity:
                satisfied_nodes.append(nodes[id])
                count += 1
        match mode:
            case "gte":
                return count >= n, satisfied_nodes
            case "lte":
                return count <= n, satisfied_nodes
            case "eq":
                return count == n, satisfied_nodes

    def contains_event(self, event_activity, object_type, process_execution_index, objects, metrics, n_operator="gte",
                       n=1, p=1.0, p_operator="gte", p_mode="relative", boolean_operator="", same_event=False):
        # TODO: Check if notion of "contains event (5)" => DF makes sense
        if len(event_activity) == 1:
            event_activity = event_activity[0]

        exec_graph = self.annotated_graphs[process_execution_index]
        # objects = self._objects[process_execution_index][object_type]
        # broke_flag = False
        # Check if amount of objects that satisfy condition is enough
        satisfied_objects = []
        not_satisfied_objects = []
        for (object, ids) in objects:
            sat_flag, sat_nodes = self._contains_event_with_id(exec_graph, object, ids, event_activity, n_operator, n)
            if sat_flag:
                satisfied_objects.append((object, sat_nodes))
            else:
                not_satisfied_objects.append((object, sat_nodes))

        if len(metrics) == 3:
            satisfied_objects, new_unsat_objects = self.filter_nodes_with_metrics(satisfied_objects, metrics[0],
                                                                                  metrics[1], metrics[2])
            not_satisfied_objects.extend(new_unsat_objects)

        if same_event:
            # Dictionary to store the objects, nodes that satisfy the same event condition
            new_sat_dict = {}
            # Form: {node: ['obj1', 'obj2']}
            reversed_sat_dict = {}

            for (key, value) in satisfied_objects:
                for num in value:
                    if num not in reversed_sat_dict:
                        reversed_sat_dict[num] = []
                    reversed_sat_dict[num].append(key)

            for (node, node_objects) in reversed_sat_dict.items():
                if self._check_n(node_objects, p_operator, p):
                    for obj in node_objects:
                        if obj not in new_sat_dict:
                            new_sat_dict[obj] = []
                        new_sat_dict[obj].append(node)

            satisfied_objects = list(new_sat_dict.items())

        if boolean_operator == "NOT":
            if _satisfies_p(p_operator, p, p_mode, len(not_satisfied_objects), len(objects)):
                return not_satisfied_objects
        else:
            if _satisfies_p(p_operator, p, p_mode, len(satisfied_objects), len(objects)):
                return satisfied_objects

        return []

    def contains_events(self, event_activities, object_type, process_execution_index, objects, metrics,
                        n_operator="gte", n=1, p=1.0, p_operator="gte", p_mode="relative", quantifier="ALL",
                        boolean_operator=""):

        # For each process execution, we check for each object of object_type,
        # if all or any of the event_activities are contained

        exec_graph = self.annotated_graphs[process_execution_index]
        # objects = self._objects[process_execution_index][object_type]
        # Check if amount of objects that satisfy condition is enough
        object_count = 0
        satisfied_objects = []
        not_satisfied_objects = []
        if quantifier == "ALL":
            for (object, ids) in objects:
                broke_flag = False
                potential_objects = []
                potential_not_objects = []
                for event_activity in event_activities:
                    sat_flag, sat_nodes = self._contains_event_with_id(exec_graph, object, ids, event_activity,
                                                                       n_operator, n)
                    if not sat_flag:
                        broke_flag = True
                        potential_not_objects.append((object, []))
                        # Do we need to go on here to collect all?
                        # break
                    else:
                        potential_objects.append((object, sat_nodes))
                if not broke_flag:
                    satisfied_objects.extend(potential_objects)
                    object_count += 1
                else:
                    not_satisfied_objects.extend(potential_not_objects)
                # if broke_flag:
                #    break
        else:
            for (object, ids) in objects:
                broke_flag = True
                for event_activity in event_activities:
                    sat_flag, sat_nodes = self._contains_event_with_id(exec_graph, object, ids, event_activity,
                                                                       n_operator, n)
                    if sat_flag:
                        broke_flag = False
                        satisfied_objects.append((object, sat_nodes))
                        # Cant break here, need to gather all nodes which satisfy condition
                # When broke_flag is True, object does not satisfy condition and we can stop
                if not broke_flag:
                    object_count += 1
                else:
                    not_satisfied_objects.append((object, []))
                # if broke_flag:
                #    break

        if len(metrics) == 3:
            satisfied_objects, new_unsat_objects = self.filter_nodes_with_metrics(satisfied_objects, metrics[0],
                                                                                  metrics[1], metrics[2])
            not_satisfied_objects.extend(new_unsat_objects)

        if boolean_operator == "NOT":
            if _satisfies_p(p_operator, p, p_mode, len(not_satisfied_objects), len(objects)):
                return aggregate_tuples(not_satisfied_objects)
        else:
            if _satisfies_p(p_operator, p, p_mode, object_count, len(objects)):
                return aggregate_tuples(satisfied_objects)
        return []

    def _has_directly_follows_relation_with_ids(self, graph, object, ids, activity, target_objects, target_activity,
                                                metrics):
        # We search for an edge connecting nodes with event_activity = activity and object in objects
        # to a node with the target activity where one of the target_objects must be present
        object_nodes = []
        satisfied_objects = []
        not_satisfied_objects = []
        if not ids:
            for node, data in graph.nodes(data=True):
                if activity == data["event_activity"] and object in data["objects"]:
                    object_nodes.append(node)
        else:
            object_nodes = ids

        if len(object_nodes) == 0:
            return 0, 0, [], [], 0, 0, target_objects

        edge_mappings = []
        count = 0
        for node in object_nodes:
            for source, target, data in graph.edges(node, data=True):
                if (target_activity == graph.nodes[target]["event_activity"] and
                        set(target_objects).intersection(data["objects"]) != []):

                    for obj in graph.nodes[target]["objects"]:
                        if obj in target_objects:
                            satisfied_objects.append((obj, [target]))
                            edge_mappings.append((obj, [(source, target)]))
                    count += 1
                else:
                    for obj in graph.nodes[target]["objects"]:
                        if obj in target_objects:
                            not_satisfied_objects.append((obj, [target]))

        satisfied_objects = aggregate_tuples(satisfied_objects)
        edge_mappings = aggregate_tuples(edge_mappings)
        not_satisfied_objects = aggregate_tuples(not_satisfied_objects)

        if len(metrics) == 3:
            satisfied_objects, new_unsat_objects, edge_mappings = self.filter_edges_with_metrics(ids, satisfied_objects,
                                                                                                 edge_mappings,
                                                                                                 metrics[0],
                                                                                                 metrics[1],
                                                                                                 metrics[2])
            not_satisfied_objects.extend(new_unsat_objects)

        count = len(satisfied_objects)

        return count, (count / len(object_nodes)), satisfied_objects, edge_mappings, \
               len(not_satisfied_objects), (len(not_satisfied_objects) / len(object_nodes)), \
               not_satisfied_objects

    def _has_eventually_follows_relation_with_ids(self, graph, object, ids, activity, target_objects, target_activity,
                                                  metrics):
        # We search for a path connecting nodes with event_activity = activity and object in objects
        # to a node with the target activity where one of the target_objects must be present
        # TODO: if there are several nodes in object_nodes, the (n) count does not work anymore, fix it
        object_nodes = []
        target_nodes = []
        satisfied_objects = []
        not_satisfied_objects = []
        for node, data in graph.nodes(data=True):
            if not ids and activity == data["event_activity"] and object in data["objects"]:
                object_nodes.append(node)
            if target_activity == data["event_activity"] and set(target_objects).intersection(data["objects"]) != []:
                target_nodes.append(node)

        if ids:
            object_nodes = ids

        if len(object_nodes) == 0 or len(target_nodes) == 0:
            return 0, 0, [], [], 0, 0, target_objects

        count = 0
        edge_mappings = []
        for node in object_nodes:
            for target in target_nodes:
                if node != target:
                    if nx.has_path(graph, source=node, target=target):
                        edges = []
                        paths = nx.all_simple_edge_paths(graph, source=node, target=target)
                        for path in paths:
                           edges.extend(path)
                        # Might be faster to just go over intersection with target_objects here
                        for obj in graph.nodes[target]["objects"]:
                            if obj in target_objects:
                                satisfied_objects.append((obj, [target]))
                                edge_mappings.append((obj, edges))
                        count += 1
                    else:
                        for obj in graph.nodes[target]["objects"]:
                            if obj in target_objects:
                                not_satisfied_objects.append((obj, [target]))

        satisfied_objects = aggregate_tuples(satisfied_objects)
        edge_mappings = aggregate_tuples(edge_mappings)
        not_satisfied_objects = aggregate_tuples(not_satisfied_objects)

        if len(metrics) == 3:
            satisfied_objects, new_unsat_objects, edge_mappings = self.filter_edges_with_metrics(ids, satisfied_objects,
                                                                                                 edge_mappings,
                                                                                                 metrics[0],
                                                                                                 metrics[1],
                                                                                                 metrics[2])
            not_satisfied_objects.extend(new_unsat_objects)

        count = len(satisfied_objects)

        return count, (count / len(object_nodes)), satisfied_objects, edge_mappings, \
               len(not_satisfied_objects), (len(not_satisfied_objects) / len(object_nodes)), not_satisfied_objects

    def execute_edge_query(self, mode, first_activity, objects_first, second_activity, second_type,
                           process_execution_index, metrics, n_operator="", n=1,
                           quantifier="ALL", p_operator="gte", p=1.0, p_mode="relative",
                           boolean_operator=""):
        if mode == "DF":
            func = self._has_directly_follows_relation_with_ids
        else:
            func = self._has_eventually_follows_relation_with_ids

        if len(first_activity) == 1:
            first_activity = first_activity[0]
        if len(second_activity) == 1:
            second_activity = second_activity[0]

        exec_graph = self.annotated_graphs[process_execution_index]
        # objects_second = self._objects[process_execution_index][second_type]
        objects_second = self.get_objects(process_execution_index, second_type)
        # For each object of first_type, we need to check if there is a path from first_activity to second_activity
        # of type second_type? Or just generally a path?
        n_counter = 0
        satisfied_objects = []
        not_satisfied_objects = []
        satisfied_edge_objects = []
        for (object_first, ids) in objects_first:
            obj_count, obj_p, objects, edge_objects, rem_count, rem_p, rem_objects = func(exec_graph, object_first, ids,
                                                                                          first_activity,
                                                                                          objects_second,
                                                                                          second_activity, metrics)
            # If a mode was set (!= None), then we check if count suffices,
            # else it must hold for all activities (p == 1)
            if _satisfies_count(n_operator, n, obj_count, obj_p):
                satisfied_objects.extend(objects)
                satisfied_edge_objects.extend(edge_objects)
                # for (object, ids) in objects:
                #    if object not in satisfied_dict:
                #        satisfied_dict[object] = ids
                #    else:
                #        satisfied_dict[object].extend(ids)
                n_counter += 1
            elif _satisfies_count(n_operator, n, rem_count, rem_p):
                not_satisfied_objects.extend(rem_objects)
            # not_satisfied_objects.extend(rem_objects)
        if boolean_operator == "NOT":
            if _satisfies_p(p_operator, p, p_mode, len(not_satisfied_objects), len(objects_second)):
                return not_satisfied_objects, []
        else:
            if _satisfies_p(p_operator, p, p_mode, n_counter, len(objects_first)):
                return satisfied_objects, satisfied_edge_objects
        return [], []

    def reset_process_executions(self):
        self._process_executions = self.ocel.process_executions
        self._process_execution_indices = list(range(0, len(self.ocel.process_executions)))

    def filter_nodes_with_metrics(self, sat_objects, perf_metric, metric_value, metric_operator):
        metrics = self.performance_metrics()
        new_sat_objects = []
        new_unsat_objects = []
        metric_value = int(metric_value)
        for index, (_, nodes) in enumerate(sat_objects):
            for node in nodes:
                perf_value = getattr(metrics.nodes[str(node)], perf_metric)
                if perf_metric == "timestamp":
                    perf_value = time.mktime(perf_value.timetuple())
                match metric_operator:
                    case "gte":
                        if perf_value >= metric_value:
                            new_sat_objects.append(sat_objects[index])
                        else:
                            new_unsat_objects.append(sat_objects[index])
                    case "lte":
                        if perf_value <= metric_value:
                            new_sat_objects.append(sat_objects[index])
                        else:
                            new_unsat_objects.append(sat_objects[index])
                    case "eq":
                        if perf_value == metric_value:
                            new_sat_objects.append(sat_objects[index])
                        else:
                            new_unsat_objects.append(sat_objects[index])
        return new_sat_objects, new_unsat_objects

    def filter_edges_with_metrics(self, start_nodes, sat_objects, sat_edge_objects, perf_metric, metric_value,
                                  metric_operator):
        metrics = self.performance_metrics()
        new_sat_objects = []
        new_unsat_objects = []
        new_sat_edge_objects = []
        metric_value = int(metric_value)
        if perf_metric == "elapsed_time":
            perf_metric = "lead_time"
        for index, (_, nodes) in enumerate(sat_objects):
            # An easier way is to subtract lead time of last node to first node (since we only consider elapsed time)
            for start_node in start_nodes:
                for end_node in nodes:
                    perf_value = getattr(metrics.nodes[str(end_node)], perf_metric) - \
                                 getattr(metrics.nodes[str(start_node)], perf_metric)
                    match metric_operator:
                        case "gte":
                            if perf_value >= metric_value:
                                new_sat_objects.append(sat_objects[index])
                                new_sat_edge_objects.append(sat_edge_objects[index])
                            else:
                                new_unsat_objects.append(sat_objects[index])
                        case "lte":
                            if perf_value <= metric_value:
                                new_sat_objects.append(sat_objects[index])
                                new_sat_edge_objects.append(sat_edge_objects[index])
                            else:
                                new_unsat_objects.append(sat_objects[index])
                        case "eq":
                            if perf_value == metric_value:
                                new_sat_objects.append(sat_objects[index])
                                new_sat_edge_objects.append(sat_edge_objects[index])
                            else:
                                new_unsat_objects.append(sat_objects[index])
        return new_sat_objects, new_unsat_objects, new_sat_edge_objects

    def _calculate_aggregated_objects(self):
        all_objects = {}
        for objectType in self.ocel.object_types:
            all_objects[objectType] = []
        objects = [{"ANY": []} for _ in range(len(self.ocel.process_execution_objects))]
        objects_flattened = [[] for _ in range(len(self.ocel.process_execution_objects))]
        for count, process_execution_object in enumerate(self.ocel.process_execution_objects):
            for objectType, value in process_execution_object:
                if objectType not in objects[count]:
                    objects[count][objectType] = []
                objects[count][objectType].append(value)
                objects[count]["ANY"].append(value)
                all_objects[objectType].append(value)
                objects_flattened[count].append(value)
        self._objects, self._all_objects, self._objects_flattened = objects, all_objects, objects_flattened

    # We need to calculate which objects are present on which edge of the process execution
    # by flattening the OCEL and iterating through the cases. By just looking at the process
    # execution graph and extracting the objects that way, we get incorrect results.
    def _calculate_object_edges(self):
        base_ocel = self.ocel
        object_edges = {}
        for object_type in self.ocel.object_types:
            projected_event_log: EventLog = get_projected_event_log(base_ocel, object_type)
            projected_event_log: DataFrame = pm4py.convert_to_dataframe(projected_event_log)
            projected_event_log: DataFrameGroupBy = projected_event_log.groupby('case:concept:name')

            for object_id, case in projected_event_log:
                case: DataFrame = case

                for (index1, event1), (index2, event2) in zip(case.iterrows(), case[1:].iterrows()):
                    event_id1 = event1['event_id']
                    event_id2 = event2['event_id']
                    object_edges.setdefault(event_id1, {}).setdefault(event_id2, []).append(object_id)

        self._object_edges = object_edges

    def _calculate_annotated_graphs(self):
        process_execution_graphs = []
        self._calculate_object_edges()
        for count, pe in enumerate(self.ocel.process_executions):
            node_attrs = {}
            exec_graph: nx.Graph = self.ocel.get_process_execution_graph(count)
            for event_id in pe:
                objects = self.get_aggregated_objects_of_event_id(event_id)
                activity = self.ocel.get_value(event_id, "event_activity")
                node_attrs[event_id] = {"event_activity": activity, "objects": objects, "label": activity,
                                        "numberId": event_id}

            # for each edge check source and target and objects present in both are put on edge
            edge_attrs = {}
            for source, target in exec_graph.edges:
                # This is the old way of extracting edge objects.
                # source_objects = node_attrs[source]["objects"]
                # target_objects = node_attrs[target]["objects"]
                # intersection = set(source_objects).intersection(target_objects)
                intersection = self._object_edges[source][target]
                edge_attrs[(source, target)] = {"objects": intersection, "label": intersection, "sourceId": source,
                                                "targetId": target}

            nx.set_node_attributes(exec_graph, node_attrs)
            nx.set_edge_attributes(exec_graph, edge_attrs)
            process_execution_graphs.append(exec_graph)
        self._annotated_graphs = process_execution_graphs

    def _calculate_activity_to_event_id_mapping(self):
        inv_map = {}
        for key, value in self._event_id_to_activity_mapping.items():
            inv_map[value] = inv_map.get(value, []) + [key]
        self._activity_to_event_id_mapping = inv_map

    def _calculate_performance_metrics(self):
        from src.endpoints.performance import get_current_times
        times = get_current_times(self.ocel)
        self._performance_metrics = times


def _flatten_process_executions(process_executions):
    events = []
    for execution in process_executions:
        events.extend(execution)
    return events


def flatten_objects(objects):
    result = []
    for (index, object) in objects:
        result.append((index, [item for sublist in object for item in sublist]))
    return result


class QueryExecution:
    process_executions = []

    def __init__(self, path):
        self.process_execution_indices = None
        self._path = path
        self._query: QueryGraph = None
        self._ocel = None
        self._process_executions = None
        self._process_indices = None

    @property
    def query(self):
        return self._query

    @query.setter
    def query(self, value):
        self._query = value

    def extract_objects(self, satisfied_objects):
        present_object_types = set()
        if satisfied_objects is None:
            return present_object_types
        for (object, _) in satisfied_objects:
            for object_type in self._query.ocel.object_types:
                if object in self._query.all_objects[object_type]:
                    present_object_types.add(object_type)
                    break
        return present_object_types

    def execute_query(self, query, process_execution_index, objects):
        satisfied_objects = []
        satisfied_edge_objects = []
        node_metrics = []
        edge_metrics = []
        check_boolean_operator = False

        replaced_wildcard = translate_object_types(query)

        # Debug: print query structure to understand the issue
        print(f"DEBUG execute_query: query structure = {query}")
        print(f"DEBUG execute_query: query keys = {list(query.keys()) if isinstance(query, dict) else 'Not a dict'}")

        if not objects:
            # Handle both old and new query structures
            query_type = query.get("query") if isinstance(query, dict) else None
            if query_type == "isDirectlyFollowed" or query_type == "isEventuallyFollowed":
                first_type = query.get("first_type", "ANY")
                objects = self._query.get_objects_with_id(process_execution_index, first_type)
            else:
                object_type = query.get("object_type", "ANY")
                objects = self._query.get_objects_with_id(process_execution_index, object_type)

        global performance_flag_global
        if query.get("node_metric") and query["node_metric"] != "":
            # satisfied_objects = self._query.filter_nodes_with_metrics(satisfied_objects,
            #                                                          query["node_metric"],
            #                                                          query["node_metric_value"],
            #                                                          query["node_metric_operator"])
            node_metrics = [query.get("node_metric", ""), query.get("node_metric_value", ""), query.get("node_metric_operator", "")]
            performance_flag_global = True

        if query.get("edge_metric") and query["edge_metric"] != "":
            # satisfied_objects = self._query.filter_edges_with_metrics(objects, satisfied_objects,
            #                                                          satisfied_edge_objects,
            #                                                          query["edge_metric"],
            #                                                          query["edge_metric_value"],
            #                                                          query["edge_metric_operator"])
            edge_metrics = [query.get("edge_metric", ""), query.get("edge_metric_value", ""), query.get("edge_metric_operator", "")]
            performance_flag_global = True
        
        # Helper function for safe query field access
        def get_query_field(field, default=""):
            return query.get(field, default)
        
        # Safe access to query type
        query_type = get_query_field("query")
        match query_type:
            case "isStart":
                satisfied_objects = self._query.execute_start_or_end(
                    "START", get_query_field("event_activity"), get_query_field("object_type"),
                    process_execution_index, objects, node_metrics,
                    quantifier=get_query_field("quantifier"),
                    p=get_query_field("p"), p_operator=get_query_field("p_operator"),
                    p_mode=get_query_field("p_mode"), boolean_operator=get_query_field("boolean_operator"))
            case "isEnd":
                satisfied_objects = self._query.execute_start_or_end(
                    "END", get_query_field("event_activity"), get_query_field("object_type"),
                    process_execution_index, objects, node_metrics,
                    quantifier=get_query_field("quantifier"),
                    p=get_query_field("p"), p_operator=get_query_field("p_operator"),
                    p_mode=get_query_field("p_mode"), boolean_operator=get_query_field("boolean_operator"))
            case "isDirectlyFollowed":
                satisfied_objects, edge_objects = self._query.execute_edge_query(
                    "DF", get_query_field("first_activity"), objects,
                    get_query_field("second_activity"), get_query_field("second_type"),
                    process_execution_index, edge_metrics,
                    n_operator=get_query_field("n_operator"), n=get_query_field("n"),
                    p=get_query_field("p"),
                    p_operator=get_query_field("p_operator"), p_mode=get_query_field("p_mode"),
                    quantifier=get_query_field("quantifier"), boolean_operator=get_query_field("boolean_operator"))
                satisfied_edge_objects.extend(edge_objects)
            case "isEventuallyFollowed":
                satisfied_objects, edge_objects = self._query.execute_edge_query(
                    "EF", get_query_field("first_activity"), objects,
                    get_query_field("second_activity"), get_query_field("second_type"),
                    process_execution_index, edge_metrics,
                    n_operator=get_query_field("n_operator"), n=get_query_field("n"),
                    p=get_query_field("p"),
                    p_operator=get_query_field("p_operator"), p_mode=get_query_field("p_mode"),
                    quantifier=get_query_field("quantifier"), boolean_operator=get_query_field("boolean_operator"))
                satisfied_edge_objects.extend(edge_objects)
            case "isContainedEvent":
                same_event = False
                if "same_event" in query:
                    same_event = (get_query_field("same_event") == "true")
                satisfied_objects = self._query.contains_event(
                    get_query_field("event_activity"), get_query_field("object_type"),
                    process_execution_index, objects, node_metrics,
                    n_operator=get_query_field("n_operator"), n=get_query_field("n"), p=get_query_field("p"),
                    p_operator=get_query_field("p_operator"), p_mode=get_query_field("p_mode"),
                    boolean_operator=get_query_field("boolean_operator"), same_event=same_event)
            case "areContainedEvents":
                satisfied_objects = self._query.contains_events(
                    get_query_field("event_activity"), get_query_field("object_type"),
                    process_execution_index, objects, node_metrics,
                    n_operator=get_query_field("n_operator"), n=get_query_field("n"), p=get_query_field("p"),
                    p_operator=get_query_field("p_operator"), p_mode=get_query_field("p_mode"),
                    quantifier=get_query_field("quantifier"), boolean_operator=get_query_field("boolean_operator"))
            case "containsObjectsOfType":
                satisfied_objects = contains_object_types(
                    objects, n_operator=get_query_field("n_operator"),
                    n=get_query_field("n"))
                check_boolean_operator = True
            case "containsObjects":
                satisfied_objects = contains_objects(
                    objects, get_query_field("needed_objects"),
                    quantifier=get_query_field("quantifier"))
                check_boolean_operator = True
            case "isParallel":
                pass
            # We pass through all objects and go on with the query
            # The evaluation of the OR happens elsewhere
            case "OR-Split" | "OR-Join" | "orNode":
                satisfied_objects = objects

        if query_type != "containsObjects":
            set_wildcards_from_query(query, self.extract_objects(satisfied_objects), replaced_wildcard)

        if check_boolean_operator and "boolean_operator" in query and get_query_field("boolean_operator") == "NOT":
            if len(satisfied_objects) == 0:
                return objects, []
            else:
                return [], []
        return satisfied_objects, satisfied_edge_objects

    def _execute(self):
        remaining_pe = []
        remaining_indices = []
        saved_objects = []
        saved_edges = []
        for index, execution in zip(self._process_indices, self._process_executions):
            start_time = time.time()
            objects = []
            intermediate_objects = []
            intermediate_edges = []
            for element in self._path:
                objects, edge_objects = self.execute_query(element, index, objects)
                intermediate_objects.append(objects)
                intermediate_edges.append(edge_objects)
                if not objects:
                    # Early termination
                    break
            if objects:
                saved_objects.append((index, intermediate_objects))
                saved_edges.append((index, intermediate_edges))
                remaining_pe.append(execution)
                remaining_indices.append(index)
            # print("Execution " + str(index) + " took " + str(time.time() - start_time))
        # print(flatten_objects(saved_objects))
        return remaining_pe, remaining_indices, saved_objects, saved_edges

    def execute(self, ocel):
        if self._query is None:
            self._query = QueryGraph(ocel)
        self._ocel = ocel
        self._process_executions = self._query.process_executions
        self._process_indices = self._query.process_execution_indices
        # Could also only return process_executions here
        executions, indices, saved_objects, saved_edges = self._execute()
        self._process_executions = executions
        self._process_indices = indices
        return executions, indices, saved_objects, saved_edges

    def _extract_objects(self, process_indices):
        objects = []
        for idx in process_indices:
            for obj in self._ocel.process_execution_objects[idx]:
                objects.append(obj[1])
        return objects


# Legacy QueryParser class removed - using GOProQ implementation instead


# Helper functions for legacy compatibility

    def execute_single_query(self, query, process_executions, process_execution_indices):
        self._query.process_executions = process_executions
        self._query.process_execution_indices = process_execution_indices
        nodes = query['nodes']
        edges = query['edges']

        graph_nodes = []
        for node in nodes:
            graph_nodes.append((node['id'], node))
            # print(node)

        graph_edges = []
        for edge in edges:
            graph_edges.append((edge['source'], edge['target'], edge))
            # print(edge)

        graph = nx.DiGraph()
        graph.add_nodes_from(graph_nodes)
        graph.add_edges_from(graph_edges)
        # print(list(graph.nodes))
        # print(list(graph.edges))

        start_nodes = []
        end_nodes = []
        unique_nodes = []
        for node, data in graph.nodes(data=True):
            if graph.out_degree(node) >= 1 and graph.in_degree(node) == 0:
                start_nodes.append(node)
            if graph.out_degree(node) == 0 and graph.in_degree(node) >= 1:
                end_nodes.append(node)
            if graph.out_degree(node) == 0 and graph.in_degree(node) == 0:
                unique_nodes.append((node, data))
        all_paths = []
        for start in start_nodes:
            for end in end_nodes:
                # For large graphs, might need to check if path even exists since all_simple_path does not check that
                # and that can result in very long runtimes O(n!)
                all_paths.extend(list(nx.all_simple_paths(graph, start, end)))

        # print(unique_nodes)
        start_time = time.time()
        # These are "atomic" queries which can be just executed
        # First "atomic" queries since they can hopefully filter many PEs with less time
        ocel = self._ocel
        query_graph = self._query
        all_saved_objects = []
        all_saved_edges = []

        query_elements = [[] for _ in all_paths]
        query_or = [[] for _ in all_paths]
        for path_idx, path in enumerate(all_paths):
            or_idxs = []
            node_idxs = []
            for idx, node in enumerate(path):
                node_data = graph.nodes[node]["data"]["query"]
                if node_data["query"] != "Event":
                    query_elements[path_idx].append(node_data)
                    node_idxs.append(graph.nodes[node]["id"])
                if node_data["query"] == "orNode":
                    or_idxs.append(graph.nodes[node]["id"])
                if idx != len(path) - 1:
                    edge_data = self.get_edge_query(graph, (node, path[idx + 1]))
                    query_elements[path_idx].append(edge_data)
            if len(or_idxs) != 0:
                query_or[path_idx] = [or_idxs, node_idxs]
            else:
                query_or[path_idx] = [[]]

        runtime_dict = {key: '' for key in process_execution_indices}

        for index, execution in zip(process_execution_indices, process_executions):

            if time.time() - start_time > LIVE_QUERY_TIMEOUT:
                raise Exception("timeout")

            query_graph.process_executions = [execution]
            query_graph.process_execution_indices = [index]

            for (id, node) in unique_nodes:
                node_data = node["data"]["query"]
                query_execution = QueryExecution([node_data])
                query_execution.query = query_graph

                pes, pes_idx, saved_objects, saved_edges = query_execution.execute(ocel)
                query_graph.process_executions = pes
                query_graph.process_execution_indices = pes_idx
                all_saved_objects.extend(saved_objects)
                all_saved_edges.extend(saved_edges)

            if len(query_or) < 2:
                for element in query_elements:
                    query_execution = QueryExecution(element)
                    query_execution.query = query_graph

                    pes, pes_idx, saved_objects, saved_edges = query_execution.execute(ocel)
                    query_graph.process_executions = pes
                    query_graph.process_execution_indices = pes_idx
                    all_saved_objects.extend(saved_objects)
                    all_saved_edges.extend(saved_edges)
            else:
                # First we execute the paths which reduce the amount of process executions we need to query for
                for e_idx, element in enumerate(query_elements):
                    if len(query_or[e_idx]) <= 1:
                        query_execution = QueryExecution(element)
                        query_execution.query = query_graph
                        pes, pes_idx, saved_objects, saved_edges = query_execution.execute(ocel)
                        query_graph.process_executions = pes
                        query_graph.process_execution_indices = pes_idx
                        all_saved_objects.extend(saved_objects)
                        all_saved_edges.extend(saved_edges)

                # Then we execute the OR paths
                for e_idx, element in enumerate(query_elements):
                    if len(query_or[e_idx]) > 1:
                        query_execution = QueryExecution(element)
                        query_execution.query = query_graph
                        saved_pes = query_graph.process_executions
                        saved_pes_idx = query_graph.process_execution_indices
                        # query_graph.reset_process_executions()
                        _, pes_idx, saved_objects, saved_edges = query_execution.execute(ocel)
                        query_or[e_idx].append(pes_idx)
                        query_or[e_idx].append(saved_objects)
                        query_or[e_idx].append(saved_edges)
                        query_graph.process_executions = saved_pes
                        query_graph.process_execution_indices = saved_pes_idx

                # query_or : [or_idxs, node_idxs, pes_idx, saved_objects, saved_edges]

                # unique_values = list(set(value for sublist in pes_idx_res for value in sublist))
                sorted_ors = sorted(query_or, key=lambda x: len(x[0]))

                # We OR all paths which share the same OR-split and OR-join
                # We AND all paths that share an OR-split but no OR-join and have the same next node after the split
                # We AND all paths that share an OR-join but no OR-split and have the same previous node before the join
                # Else we OR?
                # We go through the paths from the smallest OR amount to the largest to ensure correct ordering
                # 1. For each OR-Split/OR-Join pair, search for others with same pair => OR
                # 2. For each OR-Split, search for OR-Split with same next node => AND
                # 3. For each OR-Join, search for OR-Join with same previous node => AND
                # 4. If no case holds, OR with all paths with same OR-Node (id)

                def extract_ors(or_nodes):
                    or_types = {}
                    for or_node in or_nodes:
                        or_type = graph.nodes[or_node]["data"]["query"]["type"]
                        or_types[or_node] = or_type
                    reverse_types = {}
                    for k, v in or_types.items():
                        reverse_types[v] = reverse_types.get(v, []) + [k]
                    if 'Join' in reverse_types and 'Split' in reverse_types:
                        pairs = [(x, y) for x in reverse_types['Split'] for y in reverse_types['Join']]
                        return {'pairs': pairs, 'Split': reverse_types['Split'], 'Join': reverse_types['Join']}
                    elif 'Join' in reverse_types:
                        return {'Join': reverse_types['Join']}
                    else:
                        return {'Split': reverse_types['Split']}

                # TODO: write function to merge objects / edges to show in frontend
                def merge_objects(left_saved_objects, right_saved_objects):
                    for (pe_idx, left_objs) in left_saved_objects:
                        right_objs = right_saved_objects[pe_idx]
                        if pe_idx in query_graph.process_execution_indices:
                            resulting_objects.append((p_idx, objs))

                found_matches = {'OR': [], 'AND': []}
                for res_idx, result in enumerate(sorted_ors):
                    # print(result)
                    if len(result) == 1:
                        continue
                    extracted_ors = extract_ors(result[0])
                    # 1. For each OR-Split/OR-Join pair, search for others with same pair => OR
                    if 'pairs' in extracted_ors:
                        for (split_id, join_id) in extracted_ors['pairs']:
                            for res_idx2, result2 in enumerate(sorted_ors):
                                if res_idx != res_idx2 and split_id in result2[0] and join_id in result2[0] and \
                                        (res_idx, res_idx2) not in found_matches['OR'] and \
                                        (res_idx2, res_idx) not in found_matches['OR']:
                                    found_matches['OR'].append((res_idx, res_idx2))
                    # 2. For each OR-Split, search for OR-Split with same next node => AND
                    if 'Split' in extracted_ors:
                        for or_id in extracted_ors['Split']:
                            res_or_idx = result[1].index(or_id)
                            if res_or_idx == len(result[1]) - 1:
                                continue
                            for res_idx2, result2 in enumerate(sorted_ors):
                                if res_idx != res_idx2 and or_id in result2[0]:
                                    res2_or_idx = result2[1].index(or_id)
                                    if res2_or_idx == len(result2[1]) - 1:
                                        continue
                                    # Check that the next nodes are the same, but no orNode
                                    if result[1][res_or_idx + 1] == result2[1][res2_or_idx + 1] and \
                                            result[1][res_or_idx - 1] not in result[0] and \
                                            result2[1][res2_or_idx - 1] not in result2[0]:
                                        if (res_idx, res_idx2) not in found_matches['AND'] and \
                                                (res_idx2, res_idx) not in found_matches['AND']:
                                            found_matches['AND'].append((res_idx, res_idx2))
                                    elif (res_idx, res_idx2) not in found_matches['OR'] and \
                                            (res_idx2, res_idx) not in found_matches['OR']:
                                        found_matches['OR'].append((res_idx, res_idx2))
                    # 3. For each OR-Join, search for OR-Join with same previous node => AND
                    if 'Join' in extracted_ors:
                        for or_id in extracted_ors['Join']:
                            res_or_idx = result[1].index(or_id)
                            if res_or_idx == 0:
                                continue
                            for res_idx2, result2 in enumerate(sorted_ors):
                                if res_idx != res_idx2 and or_id in result2[0]:
                                    res2_or_idx = result2[1].index(or_id)
                                    if res2_or_idx == 0:
                                        continue
                                    # Check that the previous nodes are the same, but no orNode
                                    if result[1][res_or_idx - 1] == result2[1][res2_or_idx - 1] and \
                                            result[1][res_or_idx - 1] not in result[0] and \
                                            result2[1][res2_or_idx - 1] not in result2[0]:
                                        if (res_idx, res_idx2) not in found_matches['AND'] and \
                                                (res_idx2, res_idx) not in found_matches['AND']:
                                            found_matches['AND'].append((res_idx, res_idx2))
                                    elif (res_idx, res_idx2) not in found_matches['OR'] and \
                                            (res_idx2, res_idx) not in found_matches['OR']:
                                        found_matches['OR'].append((res_idx, res_idx2))
                    # 4. If no case holds, OR with all paths with same OR-Node (id)
                    # if not found_flag:

                combined_dict = {key: str(key) for key in range(len(sorted_ors))}
                for (idx1, idx2) in found_matches['AND']:
                    or1 = sorted_ors[idx1]
                    or2 = sorted_ors[idx2]
                    or12 = list(set(or1[2]).intersection(set(or2[2])))
                    or1[2] = or12
                    or2[2] = or12
                    curr_idx1 = combined_dict[idx1]
                    combined_dict[idx1] += "," + combined_dict[idx2]
                    combined_dict[idx2] += "," + curr_idx1

                for (idx1, idx2) in found_matches['OR']:
                    or1 = sorted_ors[idx1]
                    or2 = sorted_ors[idx2]
                    or12 = list(set(or1[2]).union(set(or2[2])))
                    or1[2] = or12
                    or2[2] = or12
                    curr_idx1 = combined_dict[idx1]
                    combined_dict[idx1] += "," + combined_dict[idx2]
                    combined_dict[idx2] += "," + curr_idx1

                sorted_combined_dict = dict(sorted(combined_dict.items(), key=lambda item: len(item[1].split(',')),
                                                   reverse=True))
                visited = []
                or_result_idxs = list(range(0, len(self._ocel.process_executions)))
                for (key, value) in sorted_combined_dict.items():
                    if key not in visited and value != str(key):
                        or_result_idxs = list(set(or_result_idxs).intersection(set(sorted_ors[key][2])))
                        visited.extend([int(x) for x in value.split(',')])

                query_graph.process_execution_indices = list(set(or_result_idxs).intersection(
                    set(query_graph.process_execution_indices)))

            if len(query_graph.process_execution_indices) != 0:
                # We found a process execution usable for live querying
                break
            # runtime_dict[index] = time.time() - start_time
            # query_graph.process_execution_indices = []
            # query_graph.process_executions = []

        # print(runtime_dict)

        all_saved_objects = aggregate_tuples(all_saved_objects)
        all_saved_edges = aggregate_tuples(all_saved_edges)
        # print(len(query_graph.process_executions))
        # print(query_graph.process_execution_indices)
        resulting_objects = []
        resulting_edges = []
        for (p_idx, objs) in all_saved_objects:
            if p_idx in query_graph.process_execution_indices:
                resulting_objects.append((p_idx, objs))
        for (p_idx, egs) in all_saved_edges:
            if p_idx in query_graph.process_execution_indices:
                resulting_edges.append((p_idx, egs))
        print("--- %s seconds ---" % (time.time() - start_time))
        return query_graph.process_executions, query_graph.process_execution_indices, resulting_objects, resulting_edges

    def execute_query(self, query, process_executions, process_execution_indices):
        self._query.process_executions = process_executions
        self._query.process_execution_indices = process_execution_indices
        nodes = query['nodes']
        edges = query['edges']

        exact_flag = False
        if "exact" in query:
            exact_flag = query["exact"]

        graph_nodes = []
        for node in nodes:
            graph_nodes.append((node['id'], node))
            # print(node)

        graph_edges = []
        for edge in edges:
            graph_edges.append((edge['source'], edge['target'], edge))
            # print(edge)

        graph = nx.DiGraph()
        graph.add_nodes_from(graph_nodes)
        graph.add_edges_from(graph_edges)
        # print(list(graph.nodes))
        # print(list(graph.edges))

        start_nodes = []
        end_nodes = []
        unique_nodes = []
        for node, data in graph.nodes(data=True):
            if graph.out_degree(node) >= 1 and graph.in_degree(node) == 0:
                start_nodes.append(node)
            if graph.out_degree(node) == 0 and graph.in_degree(node) >= 1:
                end_nodes.append(node)
            if graph.out_degree(node) == 0 and graph.in_degree(node) == 0:
                unique_nodes.append((node, data))
        all_paths = []
        for start in start_nodes:
            for end in end_nodes:
                # For large graphs, might need to check if path even exists since all_simple_path does not check that
                # and that can result in very long runtimes O(n!)
                all_paths.extend(list(nx.all_simple_paths(graph, start, end)))

        # print(unique_nodes)
        start_time = time.time()
        # These are "atomic" queries which can be just executed
        # First "atomic" queries since they can hopefully filter many PEs with less time
        ocel = self._ocel
        query_graph = self._query
        all_saved_objects = []
        all_saved_edges = []

        query_elements = [[] for _ in all_paths]
        query_or = [[] for _ in all_paths]
        for path_idx, path in enumerate(all_paths):
            or_idxs = []
            node_idxs = []
            for idx, node in enumerate(path):
                node_data = graph.nodes[node]["data"]["query"]
                if node_data["query"] != "Event":
                    query_elements[path_idx].append(node_data)
                    node_idxs.append(graph.nodes[node]["id"])
                if node_data["query"] == "orNode":
                    or_idxs.append(graph.nodes[node]["id"])
                if idx != len(path) - 1:
                    edge_data = self.get_edge_query(graph, (node, path[idx + 1]))
                    query_elements[path_idx].append(edge_data)
            if len(or_idxs) != 0:
                query_or[path_idx] = [or_idxs, node_idxs]
            else:
                query_or[path_idx] = [[]]

        # Sort unique nodes based on object type (if exists)
        # 1. Object Type query
        # 2. Object query
        # 3. Query based on object type cardinality

        all_objects = query_graph.all_objects
        objects_length = {}
        for obj_type in ocel.object_types:
            objects_length[obj_type] = len(all_objects[obj_type])
        objects_length["ANY"] = sum(list(objects_length.values()))

        # print(unique_nodes)
        extended_unique_nodes = []

        for (id, node) in unique_nodes:
            obj_length = 0
            if node["type"] == "activityNode":
                curr_obj_type =  node["data"]["query"]["object_type"]
                if curr_obj_type in objects_length:
                    obj_length = objects_length[curr_obj_type]
            extended_unique_nodes.append((obj_length, node))

        def compare_node(node1, node2):
            # If node1 should be before node2, return -1, else 1.
            # 1. Object Type query
            if node1[1]["type"] == "objectTypeNode":
                return -1
            elif node2[1]["type"] == "objectTypeNode":
                return 1
            # 2. Object query
            if node1[1]["type"] == "objectNode":
                return -1
            elif node2[1]["type"] == "objectNode":
                return 1
            # 3. Query based on object type cardinality
            if node1[0] < node2[0]:
                return -1
            elif node1[0] > node2[0]:
                return 1
            return 0

        def get_last_element(lst):
            return lst[-1]

        sorted_unique_nodes = sorted(extended_unique_nodes, key=cmp_to_key(compare_node))
        # print(sorted_query_elements)
        if exact_flag:
            unique_nodes: list[Any] = list(map(get_last_element, sorted_unique_nodes))

            # pool = mp.Pool(processes=mp.cpu_count() - 2)

            # args_list = [(node, query_graph, ocel) for node in unique_nodes]

            # results = pool.map(execute_unique_node, args_list)
            # pool.close()
            # pool.join()
            # print(results)

            for node in unique_nodes:
                node_data = node["data"]["query"]
                query_execution = QueryExecution([node_data])
                query_execution.query = query_graph

                pes, pes_idx, saved_objects, saved_edges = query_execution.execute(ocel)
                query_graph.process_executions = pes
                query_graph.process_execution_indices = pes_idx
                all_saved_objects.extend(saved_objects)
                all_saved_edges.extend(saved_edges)
        else:
            for (id, node) in unique_nodes:
            # for node in unique_nodes:
                node_data = node["data"]["query"]
                query_execution = QueryExecution([node_data])
                query_execution.query = query_graph

                pes, pes_idx, saved_objects, saved_edges = query_execution.execute(ocel)
                query_graph.process_executions = pes
                query_graph.process_execution_indices = pes_idx
                all_saved_objects.extend(saved_objects)
                all_saved_edges.extend(saved_edges)

        extended_query_elements = []
        for path in query_elements:
            df_count = 0
            ef_count = 0
            obj_length = 0
            efs = []
            for idx, ele in enumerate(path):
                # print(ele)
                if ele["query"] == "isDirectlyFollowed":
                    df_count += 1
                elif ele["query"] == "isEventuallyFollowed":
                    ef_count += 1
                    efs.append(idx)
                # First element should be an activity query
                if idx == 0 and "object_type" in ele:
                    obj_length = objects_length[ele["object_type"]]

            extended_query_elements.append((df_count, ef_count, efs, obj_length, path))

        # We sort the paths using the following ideas:
        # (1. Single nodes are faster in execution than paths and thus are executed first.) - already cared for above
        # 2. EF is a lot slower for huge PEs than DF. That is why we sort by the number of EF in a path.
        # 3. Object Type cardinality of first element can have huge impact.
        # 4. For the same amount of EFs, we look at the length of the query (this does not have a huge impact)
        # 5. If all is equal, at the end, we look at their first position
        def compare_path(path1, path2):
            # print(path1)
            # print(path2)
            # 1. Lower EF count
            if path1[1] < path2[1]:
                return -1
            elif path1[1] > path2[1]:
                return 1
            elif path1[1] == 0 or path2[1] == 0:
                return 0
            if path1[3] < path2[3]:
                return -1
            elif path1[3] < path2[3]:
                return 1
            # 3. Look at the length (ef_count is equal, so just df_count suffices)
            if path1[0] < path2[0]:
                return -1
            elif path1[0] > path2[0]:
                return 1
            # 4. Look at position
            if path1[2][0] > path2[2][0]:
                return -1
            elif path1[2][0] < path2[2][0]:
                return 1
            return 0

        # print(extended_query_elements)
        sorted_query_elements = sorted(extended_query_elements, key=cmp_to_key(compare_path))
        # print(sorted_query_elements)
        if exact_flag:
            query_elements = list(map(get_last_element, sorted_query_elements))

        if len(query_or) < 2:
            for element in query_elements:
                query_execution = QueryExecution(element)
                query_execution.query = query_graph

                pes, pes_idx, saved_objects, saved_edges = query_execution.execute(ocel)
                query_graph.process_executions = pes
                query_graph.process_execution_indices = pes_idx
                all_saved_objects.extend(saved_objects)
                all_saved_edges.extend(saved_edges)
        else:
            # First we execute the paths which reduce the amount of process executions we need to query for
            for e_idx, element in enumerate(query_elements):
                if len(query_or[e_idx]) <= 1:
                    query_execution = QueryExecution(element)
                    query_execution.query = query_graph
                    pes, pes_idx, saved_objects, saved_edges = query_execution.execute(ocel)
                    query_graph.process_executions = pes
                    query_graph.process_execution_indices = pes_idx
                    all_saved_objects.extend(saved_objects)
                    all_saved_edges.extend(saved_edges)

            # Then we execute the OR paths
            for e_idx, element in enumerate(query_elements):
                if len(query_or[e_idx]) > 1:
                    query_execution = QueryExecution(element)
                    query_execution.query = query_graph
                    saved_pes = query_graph.process_executions
                    saved_pes_idx = query_graph.process_execution_indices
                    # query_graph.reset_process_executions()
                    _, pes_idx, saved_objects, saved_edges = query_execution.execute(ocel)
                    query_or[e_idx].append(pes_idx)
                    query_or[e_idx].append(saved_objects)
                    query_or[e_idx].append(saved_edges)
                    query_graph.process_executions = saved_pes
                    query_graph.process_execution_indices = saved_pes_idx

            # query_or : [or_idxs, node_idxs, pes_idx, saved_objects, saved_edges]

            # unique_values = list(set(value for sublist in pes_idx_res for value in sublist))
            sorted_ors = sorted(query_or, key=lambda x: len(x[0]))

            # We OR all paths which share the same OR-split and OR-join
            # We AND all paths that share an OR-split but no OR-join and have the same next node after the split
            # We AND all paths that share an OR-join but no OR-split and have the same previous node before the join
            # Else we OR?
            # We go through the paths from the smallest OR amount to the largest to ensure correct ordering
            # 1. For each OR-Split/OR-Join pair, search for others with same pair => OR
            # 2. For each OR-Split, search for OR-Split with same next node => AND
            # 3. For each OR-Join, search for OR-Join with same previous node => AND
            # 4. If no case holds, OR with all paths with same OR-Node (id)

            def extract_ors(or_nodes):
                or_types = {}
                for or_node in or_nodes:
                    or_type = graph.nodes[or_node]["data"]["query"]["type"]
                    or_types[or_node] = or_type
                reverse_types = {}
                for k, v in or_types.items():
                    reverse_types[v] = reverse_types.get(v, []) + [k]
                if 'Join' in reverse_types and 'Split' in reverse_types:
                    pairs = [(x, y) for x in reverse_types['Split'] for y in reverse_types['Join']]
                    return {'pairs': pairs, 'Split': reverse_types['Split'], 'Join': reverse_types['Join']}
                elif 'Join' in reverse_types:
                    return {'Join': reverse_types['Join']}
                else:
                    return {'Split': reverse_types['Split']}

            def merge_objects(left_saved_objects, right_saved_objects, exec_indices):
                result_objects = {}
                # Merge values from the first list
                for number, values in left_saved_objects:
                    if number not in exec_indices:
                        continue
                    if number in result_objects:
                        result_objects[number].extend(values)
                    else:
                        result_objects[number] = values

                # Merge values from the second list
                for number, values in right_saved_objects:
                    if number not in exec_indices:
                        continue
                    if number in result_objects:
                        result_objects[number].extend(values)
                    else:
                        result_objects[number] = values
                return [(k, v) for k, v in result_objects.items()]

            found_matches = {'OR': [], 'AND': []}
            for res_idx, result in enumerate(sorted_ors):
                if len(result) == 1:
                    continue
                extracted_ors = extract_ors(result[0])
                # 1. For each OR-Split/OR-Join pair, search for others with same pair => OR
                if 'pairs' in extracted_ors:
                    for (split_id, join_id) in extracted_ors['pairs']:
                        for res_idx2, result2 in enumerate(sorted_ors):
                            if res_idx != res_idx2 and split_id in result2[0] and join_id in result2[0] and \
                                    (res_idx, res_idx2) not in found_matches['OR'] and \
                                    (res_idx2, res_idx) not in found_matches['OR']:
                                found_matches['OR'].append((res_idx, res_idx2))
                # 2. For each OR-Split, search for OR-Split with same next node => AND
                if 'Split' in extracted_ors:
                    for or_id in extracted_ors['Split']:
                        res_or_idx = result[1].index(or_id)
                        if res_or_idx == len(result[1]) - 1:
                            continue
                        for res_idx2, result2 in enumerate(sorted_ors):
                            # If same OR is in result2 present (and not as last node)
                            if res_idx != res_idx2 and or_id in result2[0]:
                                res2_or_idx = result2[1].index(or_id)
                                if res2_or_idx == len(result2[1]) - 1:
                                    continue
                                # Check that the next nodes are the same, but no orNode
                                # result[0] is list of orNodes indices
                                if result[1][res_or_idx + 1] == result2[1][res2_or_idx + 1] and \
                                        result[1][res_or_idx - 1] not in result[0] and \
                                        result2[1][res2_or_idx - 1] not in result2[0]:
                                    if (res_idx, res_idx2) not in found_matches['AND'] and \
                                            (res_idx2, res_idx) not in found_matches['AND']:
                                        found_matches['AND'].append((res_idx, res_idx2))
                                elif (res_idx, res_idx2) not in found_matches['OR'] and \
                                        (res_idx2, res_idx) not in found_matches['OR']:
                                    found_matches['OR'].append((res_idx, res_idx2))
                # 3. For each OR-Join, search for OR-Join with same previous node => AND
                if 'Join' in extracted_ors:
                    for or_id in extracted_ors['Join']:
                        res_or_idx = result[1].index(or_id)
                        if res_or_idx == 0:
                            continue
                        for res_idx2, result2 in enumerate(sorted_ors):
                            if res_idx != res_idx2 and or_id in result2[0]:
                                res2_or_idx = result2[1].index(or_id)
                                if res2_or_idx == 0:
                                    continue
                                # Check that the previous nodes are the same, but no orNode
                                if result[1][res_or_idx - 1] == result2[1][res2_or_idx - 1] and \
                                        result[1][res_or_idx - 1] not in result[0] and \
                                        result2[1][res2_or_idx - 1] not in result2[0]:
                                    if (res_idx, res_idx2) not in found_matches['AND'] and \
                                            (res_idx2, res_idx) not in found_matches['AND']:
                                        found_matches['AND'].append((res_idx, res_idx2))
                                elif (res_idx, res_idx2) not in found_matches['OR'] and \
                                        (res_idx2, res_idx) not in found_matches['OR']:
                                    found_matches['OR'].append((res_idx, res_idx2))
                # 4. If no case holds, OR with all paths with same OR-Node (id)
                # if not found_flag:

            for pair in found_matches['OR']:
                if pair in found_matches['AND']:
                    found_matches['AND'].remove(pair)

            combined_dict = {key: str(key) for key in range(len(sorted_ors))}
            for (idx1, idx2) in found_matches['AND']:
                or1 = sorted_ors[idx1]
                or2 = sorted_ors[idx2]
                or12 = list(set(or1[2]).intersection(set(or2[2])))
                or1[2] = or12
                or2[2] = or12
                new_saved_objects = merge_objects(or1[3], or2[3], or12)
                or1[3] = new_saved_objects
                or2[3] = new_saved_objects
                new_saved_edges = merge_objects(or1[4], or2[4], or12)
                or1[4] = new_saved_edges
                or2[4] = new_saved_edges
                curr_idx1 = combined_dict[idx1]
                combined_dict[idx1] += "," + combined_dict[idx2]
                combined_dict[idx2] += "," + curr_idx1

            for (idx1, idx2) in found_matches['OR']:
                or1 = sorted_ors[idx1]
                or2 = sorted_ors[idx2]
                or12 = list(set(or1[2]).union(set(or2[2])))
                or1[2] = or12
                or2[2] = or12
                new_saved_objects = merge_objects(or1[3], or2[3], or12)
                or1[3] = new_saved_objects
                or2[3] = new_saved_objects
                new_saved_edges = merge_objects(or1[4], or2[4], or12)
                or1[4] = new_saved_edges
                or2[4] = new_saved_edges
                curr_idx1 = combined_dict[idx1]
                combined_dict[idx1] += "," + combined_dict[idx2]
                combined_dict[idx2] += "," + curr_idx1

            sorted_combined_dict = dict(sorted(combined_dict.items(), key=lambda item: len(item[1].split(',')),
                                               reverse=True))
            visited = []
            or_result_idxs = list(range(0, len(self._ocel.process_executions)))
            or_result_objects = [(key, []) for key in or_result_idxs]
            or_result_edges = [(key, []) for key in or_result_idxs]
            for (key, value) in sorted_combined_dict.items():
                if key not in visited and value != str(key):
                    or_result_idxs = list(set(or_result_idxs).intersection(set(sorted_ors[key][2])))
                    or_result_objects = merge_objects(or_result_objects, sorted_ors[key][3], or_result_idxs)
                    or_result_edges = merge_objects(or_result_edges, sorted_ors[key][4], or_result_idxs)
                    visited.extend([int(x) for x in value.split(',')])

            query_graph.process_execution_indices = list(set(or_result_idxs).intersection(
                set(query_graph.process_execution_indices)))

            all_saved_objects.extend(or_result_objects)
            all_saved_edges.extend(or_result_edges)

        all_saved_objects = aggregate_tuples(all_saved_objects)
        all_saved_edges = aggregate_tuples(all_saved_edges)
        # print(len(query_graph.process_executions))
        # print(query_graph.process_execution_indices)
        resulting_objects = []
        resulting_edges = []
        for (p_idx, objs) in all_saved_objects:
            if p_idx in query_graph.process_execution_indices:
                resulting_objects.append((p_idx, objs))
        for (p_idx, egs) in all_saved_edges:
            if p_idx in query_graph.process_execution_indices:
                resulting_edges.append((p_idx, egs))
        print("--- %s seconds ---" % (time.time() - start_time))
        return query_graph.process_executions, query_graph.process_execution_indices, resulting_objects, resulting_edges

    def get_edge_query(self, graph, edge):
        edge_data = graph.get_edge_data(*edge)["data"]["query"]
        if edge_data["query"] == "OR-Split" or edge_data["query"] == "OR-Join":
            return edge_data
        if graph.nodes[edge_data["firstNodeId"]]["data"]["query"]["query"] != "orNode":
            edge_data["first_activity"] = graph.nodes[edge_data["firstNodeId"]]["data"]["query"][
                "event_activity"]
            edge_data["first_type"] = graph.nodes[edge_data["firstNodeId"]]["data"]["query"]["object_type"]
        else:
            current_query_id = graph.nodes[edge_data["firstNodeId"]]["data"]["query"]
            while current_query_id["query"] == "orNode":
                next_id = current_query_id["lastNodeId"]
                current_query_id = graph.nodes[next_id]["data"]["query"]
            edge_data["first_activity"] = current_query_id["event_activity"]
            edge_data["first_type"] = current_query_id["object_type"]
        if graph.nodes[edge_data["secondNodeId"]]["data"]["query"]["query"] != "orNode":
            edge_data["second_activity"] = graph.nodes[edge_data["secondNodeId"]]["data"]["query"][
                "event_activity"]
            edge_data["second_type"] = graph.nodes[edge_data["secondNodeId"]]["data"]["query"]["object_type"]
        else:
            current_query_id = graph.nodes[edge_data["secondNodeId"]]["data"]["query"]
            while current_query_id["query"] == "orNode":
                next_id = current_query_id["nextNodeId"]
                current_query_id = graph.nodes[next_id]["data"]["query"]
            edge_data["second_activity"] = current_query_id["event_activity"]
            edge_data["second_type"] = current_query_id["object_type"]

        return edge_data

    def execute_query_new(self, query, process_executions, process_execution_indices):
        self._query.process_executions = process_executions
        self._query.process_execution_indices = process_execution_indices
        nodes = query['nodes']
        edges = query['edges']

        graph_nodes = []
        for node in nodes:
            graph_nodes.append((node['id'], node))
            # print(node)

        graph_edges = []
        for edge in edges:
            graph_edges.append((edge['source'], edge['target'], edge))
            # print(edge)

        graph = nx.DiGraph()
        graph.add_nodes_from(graph_nodes)
        graph.add_edges_from(graph_edges)
        # print(list(graph.nodes))
        # print(list(graph.edges))

        start_nodes = []
        end_nodes = []
        unique_nodes = []
        for node, data in graph.nodes(data=True):
            if graph.out_degree(node) >= 1 and graph.in_degree(node) == 0:
                start_nodes.append(node)
            if graph.out_degree(node) == 0 and graph.in_degree(node) >= 1:
                end_nodes.append(node)
            if graph.out_degree(node) == 0 and graph.in_degree(node) == 0:
                unique_nodes.append((node, data))

        # all_paths = []
        # for start in start_nodes:
        #    for end in end_nodes:
        # For large graphs, might need to check if path even exists since all_simple_path does not check that
        # and that can result in very long runtimes O(n!)
        #        all_paths.extend(list(nx.all_simple_paths(graph, start, end)))

        # print(unique_nodes)
        start_time = time.time()
        # These are "atomic" queries which can be just executed
        # First "atomic" queries since they can hopefully filter many PEs with less time
        ocel = self._ocel
        query_graph = self._query
        all_saved_objects = []
        all_saved_edges = []

        queue = start_nodes
        finished_list = []

        all_paths = []

        query_elements = [[] for _ in all_paths]
        for path_idx, path in enumerate(all_paths):
            for idx, node in enumerate(path):
                node_data = graph.nodes[node]["data"]["query"]
                if node_data["query"] != "Event":
                    query_elements[path_idx].append(node_data)
                if idx != len(path) - 1:
                    edge_data = self.get_edge_query(graph, (node, path[idx + 1]))

                    # edge_data = graph.get_edge_data(node, path[idx + 1])["data"]["query"]
                    # edge_data["first_activity"] = graph.nodes[edge_data["firstNodeId"]]["data"]["query"][
                    #    "event_activity"]
                    # edge_data["first_type"] = graph.nodes[edge_data["firstNodeId"]]["data"]["query"]["object_type"]
                    # edge_data["second_activity"] = graph.nodes[edge_data["secondNodeId"]]["data"]["query"][
                    #    "event_activity"]
                    # edge_data["second_type"] = graph.nodes[edge_data["secondNodeId"]]["data"]["query"]["object_type"]
                    query_elements[path_idx].append(edge_data)
        # print(query_elements)

        for (id, node) in unique_nodes:
            node_data = node["data"]["query"]
            query_execution = QueryExecution([node_data])
            query_execution.query = query_graph

            pes, pes_idx, saved_objects, saved_edges = query_execution.execute(ocel)
            query_graph.process_executions = pes
            query_graph.process_execution_indices = pes_idx
            all_saved_objects.extend(saved_objects)
            all_saved_edges.extend(saved_edges)

        for element in query_elements:
            # print(element)
            query_execution = QueryExecution(element)
            query_execution.query = query_graph

            pes, pes_idx, saved_objects, saved_edges = query_execution.execute(ocel)
            # print(len(pes_idx))
            query_graph.process_executions = pes
            query_graph.process_execution_indices = pes_idx
            all_saved_objects.extend(saved_objects)
            all_saved_edges.extend(saved_edges)

        all_saved_objects = aggregate_tuples(all_saved_objects)
        all_saved_edges = aggregate_tuples(all_saved_edges)
        # print(len(query_graph.process_executions))
        # print(query_graph.process_execution_indices)
        resulting_objects = []
        resulting_edges = []
        for (p_idx, objs) in all_saved_objects:
            if p_idx in query_graph.process_execution_indices:
                resulting_objects.append((p_idx, objs))
        for (p_idx, egs) in all_saved_edges:
            if p_idx in query_graph.process_execution_indices:
                resulting_edges.append((p_idx, egs))
        # print(resulting_objects)
        # print(resulting_edges)
        # print(query_graph.process_executions[0])
        # print(query_graph.process_executions[2])
        print("--- %s seconds ---" % (time.time() - start_time))
        return query_graph.process_executions, query_graph.process_execution_indices, resulting_objects, resulting_edges

    def _execute(self, queue=None, process_executions=None, process_execution_indices=None, single=False):
        # TODO: propagate objects / edges as well!
        if queue is None:
            queue = [self]
        if process_executions is None or process_execution_indices is None:
            process_executions = self._query.process_executions
            process_execution_indices = self._query.process_execution_indices
        while queue:
            l = queue.pop(0)
            if l.data == "AND" and l.left is not None and l.right is not None:
                results_left, indices_left = self._execute([l.left], process_executions, process_execution_indices)
                results_right, indices_right = self._execute([l.right], results_left, indices_left)
                return results_right, indices_right
            elif l.data == "OR" and l.left is not None and l.right is not None:
                results_left, indices_left = self._execute([l.left], process_executions, process_execution_indices)
                # When the results from the left side are all process executions, we can skip
                # evaluating the right side and just return the results
                if len(results_left) == len(process_executions):
                    return results_left, indices_left
                # Since all PEs from left side will be in the final result either way,
                # we can skip the evaluation for them on the right side
                # TODO: test to check whether ordering is kept
                remaining_process_executions = [exe for exe in process_executions if exe not in results_left]
                remaining_indices = [idx for idx in process_execution_indices if idx not in indices_left]
                results_right, indices_right = self._execute([l.right], remaining_process_executions, remaining_indices)
                # return results_left + list(set(results_right) - set(results_left))
                return (results_left + results_right), (indices_left + indices_right)
            else:
                if single:
                    return self.execute_single_query(l.data, process_executions, process_execution_indices)
                else:
                    return self.execute_query(l.data, process_executions, process_execution_indices)

    def execute(self, ocel, single=False):
        if self._query is None:
            self._query = QueryGraph(ocel)
        self._ocel = ocel
        self._process_executions = self._query.process_executions
        self._process_indices = self._query.process_execution_indices
        pe_length = {}
        for pe in self._process_executions:
            len_pe = len(pe)
            if len_pe not in pe_length:
                pe_length[len_pe] = 0
            pe_length[len_pe] += 1
        # print(pe_length)
        reset_wildcards()
        reset_performance_flag()
        # Could also only return process_executions here
        executions, indices, res_objects, res_edges = self._execute(single=single)
        self._process_executions = executions
        self._process_indices = indices
        return executions, indices, res_objects, res_edges

    def _extract_objects(self, process_indices):
        objects = []
        for idx in process_indices:
            for obj in self._ocel.process_execution_objects[idx]:
                objects.append(obj[1])
        return objects

    def export(self, file_path: str):
        # From ocpa.objects.log.exporter.ocel.versions.export_ocel_json.apply
        cfg = JsonParseParameters(None)
        meta = self._ocel.obj.meta
        raw = self._ocel.obj.raw
        export = dict()
        export[cfg.log_params["meta"]] = dict()
        export["ocel:global-event"] = {"ocel:activity": "__INVALID__"}
        export["ocel:global-object"] = {"ocel:type": "__INVALID__"}
        export[cfg.log_params["meta"]][cfg.log_params["attr_names"]] = list(
            meta.attr_names)
        export[cfg.log_params["meta"]
        ][cfg.log_params["obj_types"]] = list(meta.obj_types)
        export[cfg.log_params["meta"]][cfg.log_params["version"]] = "1.0"
        export[cfg.log_params["meta"]][cfg.log_params["ordering"]] = "timestamp"
        events = {}
        flattened_process_executions = _flatten_process_executions(self._process_executions)
        # TODO: check if int/str problem can be resolved
        for event in raw.events.values():
            if event.id in flattened_process_executions or int(event.id) in flattened_process_executions:
                events[event.id] = {}
                events[event.id][cfg.event_params["act"]] = event.act
                events[event.id][cfg.event_params["time"]] = event.time.isoformat()
                events[event.id][cfg.event_params["omap"]] = event.omap
                events[event.id][cfg.event_params["vmap"]] = event.vmap

        objects = {}
        extracted_objects = self._extract_objects(self._process_indices)
        for obj in raw.objects.values():
            if obj.id in extracted_objects:
                objects[obj.id] = {}
                objects[obj.id][cfg.obj_params["type"]] = obj.type
                objects[obj.id][cfg.obj_params["ovmap"]] = obj.ovmap

        export[cfg.log_params["events"]] = events
        export[cfg.log_params["objects"]] = objects
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(export, f, ensure_ascii=False,
                      indent=4, default=str)
        return export

def execute_unique_node(node, query_graph, ocel):
    node_data = node["data"]["query"]
    query_execution = QueryExecution([node_data])
    query_execution.query = query_graph

    return query_execution.execute(ocel)

def print_info(log):
    print("Number of process executions: " + str(len(log.process_executions)))
    print("Events of the first process execution: " +
          str(log.process_executions[0]))
    print("Objects of the first process execution: " +
          str(log.process_execution_objects[0:2]))
    print("Process execution graph of the first execution:")
    print(log.get_process_execution_graph(0))
    print("Process execution of the first event with event id 0: " +
          str(log.process_execution_mappings[0]))
    print("Object types:" + str(log.object_types))


class TestResponseModel(BaseModel):
    model_config = {
        "json_schema_extra": {
            "example": 42
        }
    }
    
    def __iter__(self):
        return iter(self.model_fields)
    
    def __getitem__(self, item):
        return getattr(self, item)


# Legacy current_query removed
current_query_object: QueryGraph = None


def get_query(ocel):
    global current_query_object
    if current_query_object is None:
        query = QueryGraph(ocel)
        current_query_object = query
        return query
    else:
        return current_query_object


def reset_query():
    global current_query_object
    current_query_object = None


@router.put("/query_to_graph")
def execute_query(query_dict: dict):
    """
    Main query execution endpoint.
    Supports both legacy format and new GOProQ format.
    """
    # Log query for debugging
    with open('src/test/test1.json', 'w') as f:
        json.dump(query_dict, f, indent=4)

    # Get OCEL and initialize query graph
    ocel, new_flag = get_ocel(query_dict["file_path"], two_return_values=True)
    global current_query_object
    if current_query_object is None or new_flag:
        query_obj = QueryGraph(ocel)
        current_query_object = query_obj
    else:
        query_obj = current_query_object
        query_obj.reset_process_executions()

    # Determine if this is a graphical query (nodes/edges) or legacy query
    query = query_dict["query"]
    live_mode = query_dict.get("single", False)
    
    try:
        # Try new GOProQ execution first
        from .goproq_executor import execute_goproq_query
        
        # Handle different query input formats
        if "nodes" in query and "edges" in query:
            # Graphical query format
            query_input = (query["nodes"], query["edges"])
        elif isinstance(query.get("data"), dict) and "nodes" in query["data"]:
            # Graphical query wrapped in data
            query_input = (query["data"]["nodes"], query["data"].get("edges", []))
        else:
            # Legacy query format
            query_input = query
        
        print(f"DEBUG: Attempting GOProQ execution with query_input type: {type(query_input)}")
        print(f"DEBUG: query_input content: {query_input}")
        result = execute_goproq_query(ocel, query_obj, query_input, live_mode)
        print(f"DEBUG: GOProQ execution succeeded")
        
        # Add backward compatibility fields
        result.update({
            'objects': {},  # For frontend compatibility
            'edges': {},    # For frontend compatibility
            'wildcards': wildcards,
            'performance': performance_flag_global,
        })
        
        global current_query
        # Legacy current_query reset removed
        
        return result
        
    except Exception as e:
        # Return error instead of falling back to legacy
        print(f"ERROR: GOProQ execution failed: {e}")
        import traceback
        print(f"Full traceback: {traceback.format_exc()}")
        return {
            'error': str(e),
            'message': 'Query execution failed. Please check your query format.',
            'length': 0,
            'indices': [],
            'run': {
                'name': 'Failed execution',
                'time': '0.0s',
                'raw_time': 0.0,
            }
        }




@router.put("/goproq_query")
def execute_goproq_query_endpoint(query_dict: dict):
    """
    Dedicated endpoint for GOProQ queries.
    Supports the formal query language specification.
    """
    try:
        from .goproq_executor import execute_goproq_query, get_query_statistics
        
        # Get OCEL and initialize query graph
        ocel, new_flag = get_ocel(query_dict["file_path"], two_return_values=True)
        global current_query_object
        if current_query_object is None or new_flag:
            query_obj = QueryGraph(ocel)
            current_query_object = query_obj
        else:
            query_obj = current_query_object
            query_obj.reset_process_executions()
        
        # Extract query input
        query = query_dict["query"]
        live_mode = query_dict.get("live_mode", False)
        
        # Handle different query input formats
        if "nodes" in query and "edges" in query:
            # Graphical query format
            query_input = (query["nodes"], query["edges"])
        elif isinstance(query.get("data"), dict) and "nodes" in query["data"]:
            # Graphical query wrapped in data
            query_input = (query["data"]["nodes"], query["data"].get("edges", []))
        else:
            # Legacy query format (will be converted)
            query_input = query
        
        # Execute GOProQ query
        result = execute_goproq_query(ocel, query_obj, query_input, live_mode)
        
        # Add query statistics
        result['statistics'] = get_query_statistics(result)
        
        # Reset globals for consistency
        global current_query
        # Legacy current_query reset removed
        
        return result
        
    except Exception as e:
        return {
            'error': str(e),
            'message': 'GOProQ query execution failed',
            'fallback_available': True
        }


@router.put("/runtime_analysis")
def runtime_analysis(query_dict: dict):
    runtimes = []
    name = "one_path_element_5"
    # First run to initialize (will not be counted)
    execute_query(query_dict)
    for i in range(10):
        result = execute_query(query_dict)
        runtimes.append(result['run']['raw_time'])
    print(runtimes)
    file = open('runtimes/' + name + "_" + str(time.time()) + '.txt', 'w')
    file.write(str(runtimes))
    file.close()


@router.put("/runtime_analysis_generator")
def runtime_analysis(query_dict: dict):
    from src.endpoints.log_management import get_act_type_dict
    from src.query_creator import generate_random_query_structure
    runtimes = []
    runtimes_base = []
    result_lengths = []
    result_lengths_base = []
    file_path = query_dict["file_path"]
    name = "feasibility_" + file_path[5:]
    acts, objs, act_obj_dict = get_act_type_dict(file_path)
    # First run to initialize (will not be counted)
    # execute_query(query_dict)
    i = 0
    while len(runtimes) < 97:
        print(str(i) + ":")
        # query = generate_random_query_structure(random.randint(1, 10), acts, act_obj_dict)
        query = generate_random_query_structure([2, 2], acts, act_obj_dict, edge_probability=1)
        result = execute_query({"file_path": query_dict["file_path"], "query": {"data": {"exact": True, **query}}})
        # result_base = execute_query({"file_path": query_dict["file_path"], "query": {"data": {"exact": False, **query}}})
        if i != 0 and result["length"] != 0:
            print("reached: " + str(len(runtimes)))
            runtimes.append(result['run']['raw_time'])
            result_lengths.append(result["length"])
            # runtimes_base.append(result_base['run']['raw_time'])
            # result_lengths_base.append(result_base["length"])
            os.makedirs(name, exist_ok=True)
            with open(name + '/runtime' + str(time.time()) + '.json', 'w') as file:
                json.dump(query, file, indent=4)
        i += 1
    print(runtimes)
    file = open('runtimes/' + name + "_" + str(time.time()) + '.txt', 'w')
    file.write(str(runtimes))
    file.write("\n")
    file.write(str(result_lengths))
    file.write("\n")
    file.write(str(sum(runtimes) / len(runtimes)))
    file.write("\n")
    file.write(str(max(runtimes)))
    file.write("\n")
    file.write(str(min(runtimes)))
    print(runtimes_base)
    #file = open('runtimes/' + name + "_" + "base_" + str(time.time()) + '.txt', 'w')
    #file.write(str(runtimes_base))
    #file.write("\n")
    #file.write(str(result_lengths_base))
    #file.write("\n")
    # file.write(str(sum(runtimes_base) / len(runtimes_base)))
    #file.write("\n")
    #file.write(str(max(runtimes_base)))
    #file.write("\n")
    #file.write(str(min(runtimes_base)))
    #file.close()


@router.put("/runtime_analysis_generator_files")
def runtime_analysis_files(query_dict: dict):
    from src.endpoints.log_management import get_act_type_dict
    from src.query_creator import generate_random_query_structure
    runtimes = []
    runtimes_base = []
    result_lengths = []
    result_lengths_base = []
    file_path = query_dict["file_path"]
    name = "feasibility_" + file_path[5:]
    # First run to initialize (will not be counted)
    # execute_query(query_dict)

    for filename in os.listdir(name):
        if filename.endswith('.json'):
            file_path = os.path.join(name, filename)

            # Open and read the JSON file
            with open(file_path, 'r') as file:
                json_content = json.load(file)

                query = json_content
                result = execute_query(
                    {"file_path": query_dict["file_path"], "query": {"data": {"exact": True, **query}}})
                result_base = execute_query(
                    {"file_path": query_dict["file_path"], "query": {"data": {"exact": False, **query}}})

                runtimes.append(result['run']['raw_time'])
                result_lengths.append(result["length"])
                runtimes_base.append(result_base['run']['raw_time'])
                result_lengths_base.append(result_base["length"])
                os.makedirs(name, exist_ok=True)
                # with open(name + '/runtime' + str(time.time()) + '.json', 'w') as file:
                #    json.dump(query, file, indent=4)

    print(runtimes)
    file = open('runtimes/' + name + "_" + str(time.time()) + '.txt', 'w')
    file.write(str(runtimes))
    file.write("\n")
    file.write(str(result_lengths))
    file.write("\n")
    file.write(str(sum(runtimes) / len(runtimes)))
    file.write("\n")
    file.write(str(max(runtimes)))
    file.write("\n")
    file.write(str(min(runtimes)))
    print(runtimes_base)
    file = open('runtimes/' + name + "_" + "base_" + str(time.time()) + '.txt', 'w')
    file.write(str(runtimes_base))
    file.write("\n")
    file.write(str(result_lengths_base))
    file.write("\n")
    file.write(str(sum(runtimes_base) / len(runtimes_base)))
    file.write("\n")
    file.write(str(max(runtimes_base)))
    file.write("\n")
    file.write(str(min(runtimes_base)))
    file.close()


@router.get("/get_process_execution")
def get_process_execution(index: int, file_path: str):
    """
    Get a specific process execution by index.
    Returns nodes and edges for visualization.
    """
    try:
        # Load the OCEL
        ocel, new_flag = get_ocel(file_path, two_return_values=True)
        
        if not ocel:
            return {"error": "Failed to load OCEL file"}
        
        # Get the process execution graph
        exec_graph = ocel.get_process_execution_graph(index)
        
        # Get the process execution events for this index
        pe_events = list(ocel.process_executions[index])
        
        # Create a mapping from event IDs to event data
        event_data_map = {}
        for event_id in pe_events:
            if event_id in ocel.log.log.index:
                event_row = ocel.log.log.loc[event_id]
                event_data_map[event_id] = {
                    'activity': event_row['event_activity'],
                    'timestamp': event_row['event_timestamp'],
                    'start_timestamp': event_row['event_start_timestamp'],
                    'order': event_row['order'] if 'order' in event_row else [],
                    'item': event_row['item'] if 'item' in event_row else [],
                    'delivery': event_row['delivery'] if 'delivery' in event_row else []
                }
        
        # Convert to nodes and edges format
        nodes = []
        edges = []
        
        # Process nodes
        for node_id, node_data in exec_graph.nodes(data=True):
            # Get event data for this node
            event_data = event_data_map.get(node_id, {})
            
            # Collect all object types and objects for this event
            object_types = []
            all_objects = []
            
            # Check all object type columns
            for obj_type in ['order', 'item', 'delivery']:
                if event_data.get(obj_type):
                    obj_list = event_data[obj_type]
                    if isinstance(obj_list, list) and obj_list:
                        object_types.append(obj_type)
                        all_objects.extend(obj_list)
                    elif pd.notna(obj_list) and obj_list:  # Handle single values
                        object_types.append(obj_type)
                        all_objects.append(obj_list)
            
            # Use the first object type found, or 'mixed' if multiple types
            if len(object_types) == 0:
                object_type = 'unknown'
            elif len(object_types) == 1:
                object_type = object_types[0]
            else:
                object_type = 'mixed'  # Multiple object types
            
            objects = all_objects
            
            # Calculate duration if we have timestamps
            duration = 0
            if event_data.get('start_timestamp') and event_data.get('timestamp'):
                start_time = pd.to_datetime(event_data['start_timestamp'])
                end_time = pd.to_datetime(event_data['timestamp'])
                duration = (end_time - start_time).total_seconds()
            
            # Use single color scheme for all nodes
            node_info = {
                "id": str(node_id),
                "label": event_data.get('activity', f'Node {node_id}'),
                "color": '#2196f3',  # Single blue color for all nodes
                "object_type": object_type,
                "object_types": object_types,  # Include all object types
                "activity": event_data.get('activity', 'unknown'),
                "start_time": event_data.get('start_timestamp'),
                "end_time": event_data.get('timestamp'),
                "duration": duration,
                "events": [node_id],
                "objects": objects
            }
            nodes.append(node_info)
        
        # Process edges
        for source, target, edge_data in exec_graph.edges(data=True):
            # Get source and target event data for edge labeling
            source_data = event_data_map.get(source, {})
            target_data = event_data_map.get(target, {})
            
            # Determine edge type and color based on object flow
            edge_type = 'default'
            edge_color = '#666'
            edge_label = ''
            
            # Check if there's object flow between events
            source_objects = set()
            target_objects = set()
            
            # Collect all objects from source event
            for obj_type in ['order', 'item', 'delivery']:
                obj_list = source_data.get(obj_type, [])
                if isinstance(obj_list, list):
                    source_objects.update(obj_list)
                elif pd.notna(obj_list) and obj_list:
                    source_objects.add(obj_list)
            
            # Collect all objects from target event
            for obj_type in ['order', 'item', 'delivery']:
                obj_list = target_data.get(obj_type, [])
                if isinstance(obj_list, list):
                    target_objects.update(obj_list)
                elif pd.notna(obj_list) and obj_list:
                    target_objects.add(obj_list)
            
            # Find common objects
            common_objects = source_objects.intersection(target_objects)
            if common_objects:
                edge_type = 'object_flow'
                edge_color = '#666'  # Use same gray color for all edges
                edge_label = f"Objects: {', '.join(list(common_objects)[:3])}"  # Show first 3 objects
            
            edge_info = {
                "id": f"{source}-{target}",
                "source": str(source),
                "target": str(target),
                "label": edge_label,
                "color": edge_color,
                "type": edge_type,
                "start_time": source_data.get('timestamp'),
                "end_time": target_data.get('timestamp'),
                "duration": 0,  # Could calculate if needed
                "events": [source, target],
                "objects": list(common_objects)
            }
            edges.append(edge_info)
        
        return {
            "nodes": nodes,
            "edges": edges,
            "index": index
        }
        
    except Exception as e:
        return {"error": f"Failed to get process execution {index}: {str(e)}"}


@router.get("/export")
def export_ocel(file_path: str):
    # Legacy current_query export removed
    file = "No export available - legacy removed"
    return {
        'file': file,
        'path': os.path.abspath(file_path)
    }


@router.get("/filter")
def filter_ocel(file_path: str):
    # Legacy current_query export removed
    file = "No export available - legacy removed"
    return {
        'file': file,
        'path': os.path.abspath(file_path)
    }


def elements_to_query(elements):
    if len(elements) == 1:
        return {
            "data": elements[0],
            "left": None,
            "right": None
        }
    left_nodes, right_nodes = split_list(elements)
    return {
        "data": "AND",
        "left": elements_to_query(left_nodes),
        "right": elements_to_query(right_nodes)
    }


def unique_nodes_to_query(nodes):
    if len(nodes) == 1:
        return {
            "data": nodes[0][1]['data']['query'],
            "left": None,
            "right": None
        }
    left_nodes, right_nodes = split_list(nodes)
    return {
        "data": "AND",
        "left": unique_nodes_to_query(left_nodes),
        "right": unique_nodes_to_query(right_nodes)
    }


def split_list(a_list):
    half = len(a_list) // 2
    return a_list[:half], a_list[half:]
