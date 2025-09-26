import pandas as pd
from ocpa.objects.log.importer.ocel import factory as ocel_import_factory
from ocpa.objects.log.ocel import OCEL
from pandas import DataFrame, Timedelta, Timestamp
from pandas.core.groupby import DataFrameGroupBy
from ocpa.objects.log.importer.csv.util import succint_mdl_to_exploded_mdl
from pm4py.objects.log.obj import EventLog
from ocpa.algo.util.util import project_log
from typing import Dict, Any, List, Tuple
import pm4py
from collections import namedtuple
from pydantic import BaseModel
import networkx as nx
import json
import time
from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel
import os

router = APIRouter(prefix='/performance',
                   tags=['Performance metrics'])

current_all_times = None


def get_current_all_times(ocel: OCEL):
    global current_all_times
    if current_all_times is None:
        start_time = time.time()
        all_times = {}
        for obj_type in ocel.object_types:
            all_times[obj_type] = align_projected_log_times_task(ocel, obj_type)
        print(f"Calculating times took {time.time() - start_time} seconds.")
        current_all_times = all_times
        return current_all_times
    return current_all_times


Node = str
ObjectType = str
OCELEventId = str
ProjectedEventTime = namedtuple("ProjectedEventTimes", ['aligned_time'])
AlignedEdgeTimes = namedtuple("AlignedEdgeTimes",
                              ['previous_activity', 'previous_id', 'activation_time', 'execution_time'])


class CollectedTimes(BaseModel):
    model_config = {"arbitrary_types_allowed": True}
    
    waiting_times: Dict[Node, List[int]]
    service_times: Dict[Node, List[int]]
    sojourn_times: Dict[Node, List[int]]
    pooling_times: Dict[Node, Dict[ObjectType, List[int]]]
    synchronization_times: Dict[Node, List[int]]
    lagging_times: Dict[Node, List[int]]
    flow_times: Dict[Node, List[int]]
    start_timestamps: Dict[Node, List[Timestamp]]
    timestamps: Dict[Node, List[Timestamp]]
    edge_pooling_times: Dict[Node, Dict[Node, Dict[ObjectType, List[int]]]]
    edge_waiting_times: Dict[Node, Dict[Node, Dict[ObjectType, List[int]]]]
    edge_elapsed_times: Dict[Node, Dict[Node, List[int]]]
    lead_times: Dict[Node, List[int]]


class NodePerformanceMetrics(BaseModel):
    model_config = {"arbitrary_types_allowed": True}
    
    service_time: int
    waiting_time: int | None
    sojourn_time: int | None
    synchronization_time: int | None
    lagging_time: int | None
    pooling_times: Dict[ObjectType, int]
    flow_time: int | None
    start_timestamp: Timestamp
    timestamp: Timestamp
    lead_time: int


class EdgePerformanceMetrics(BaseModel):
    pooling_time: int
    waiting_time: int
    elapsed_time: int


class FrontendFriendlyPerformanceMetrics(BaseModel):
    nodes: Dict[Node, NodePerformanceMetrics]
    edges: Dict[Node, Dict[Node, Dict[ObjectType, EdgePerformanceMetrics | int]]]


def get_current_times(ocel: OCEL):
    all_times = get_current_all_times(ocel)
    return aggregate_times_to_frontend_friendly(collect_times(ocel.log.log, all_times))


def aggregate_times_to_frontend_friendly(collected_times: CollectedTimes) -> FrontendFriendlyPerformanceMetrics:

    def flatten(times: List[int]) -> int:
        # We assume that only one value exists per node
        # If more than one exists, we assume them to be equal values
        if len(times) == 0:
            raise ValueError()
        return times[0]

    def get_node_metric_if_available(metrics: Dict[Node, List[int]], node: Node) -> int | None:
        if node in metrics:
            return flatten(metrics[node])
        return None

    service_times = collected_times.service_times
    waiting_times = collected_times.waiting_times
    sojourn_times = collected_times.sojourn_times
    lagging_times = collected_times.lagging_times
    synchronization_times = collected_times.synchronization_times
    flow_times = collected_times.flow_times
    pooling_times = collected_times.pooling_times
    start_timestamps = collected_times.start_timestamps
    end_timestamps = collected_times.timestamps
    edge_pooling_times = collected_times.edge_pooling_times
    edge_waiting_times = collected_times.edge_waiting_times
    edge_elapsed_times = collected_times.edge_elapsed_times
    lead_times = collected_times.lead_times

    node_metrics: Dict[Node, NodePerformanceMetrics] = {}
    for node in service_times:
        service_time: int = flatten(service_times[node])
        start_timestamp: Timestamp = start_timestamps[node][0]
        end_timestamp: Timestamp = end_timestamps[node][0]
        lead_time: int = flatten(lead_times[node])

        waiting_time: int | None = get_node_metric_if_available(waiting_times, node)
        sojourn_time: int | None = get_node_metric_if_available(sojourn_times, node)
        lagging_time: int | None = get_node_metric_if_available(lagging_times, node)
        synchronization_time: int | None = get_node_metric_if_available(synchronization_times, node)
        flow_time: int | None = get_node_metric_if_available(flow_times, node)
        node_pooling_times: Dict[ObjectType, int] = {}
        if node in pooling_times:
            node_pooling_times = {object_type: flatten(times) for (object_type, times) in pooling_times[node].items()}

        node_metrics[node] = NodePerformanceMetrics(service_time=service_time,
                                                    waiting_time=waiting_time,
                                                    sojourn_time=sojourn_time,
                                                    lagging_time=lagging_time,
                                                    synchronization_time=synchronization_time,
                                                    flow_time=flow_time,
                                                    pooling_times=node_pooling_times,
                                                    start_timestamp=start_timestamp,
                                                    timestamp=end_timestamp,
                                                    lead_time=lead_time)

    edge_metrics: Dict[Node, Dict[Node, Dict[ObjectType, EdgePerformanceMetrics | int]]] = {}
    for source in edge_pooling_times:
        for target in edge_pooling_times[source]:
            for object_type in edge_pooling_times[source][target]:
                edge_metrics.setdefault(source, {}).setdefault(target, {})[object_type] = EdgePerformanceMetrics(
                    pooling_time=flatten(edge_pooling_times[source][target][object_type]),
                    waiting_time=flatten(edge_waiting_times[source][target][object_type]),
                    elapsed_time=flatten(edge_elapsed_times[source][target])
                )
            edge_metrics.setdefault(source, {}).setdefault(target, {})["elapsed_time"] = \
                flatten(edge_elapsed_times[source][target])

    return FrontendFriendlyPerformanceMetrics(nodes=node_metrics, edges=edge_metrics)


def align_projected_log_times_task(base_ocel: OCEL, object_type: str):
    projected_event_log: EventLog = get_projected_event_log(base_ocel, object_type)
    projected_event_log: DataFrame = pm4py.convert_to_dataframe(projected_event_log)
    projected_event_log: DataFrameGroupBy = projected_event_log.groupby('case:concept:name')

    # alignments_dict = preprocess_alignments(alignments)
    aligned_times: Dict[OCELEventId, Dict[str, ProjectedEventTime]] = {}

    result = {}
    last_activity = None
    last_id = None
    finish_time_of_previous_activity = None

    for object_id, case in projected_event_log:
        case: DataFrame = case

        for index, event in case.iterrows():
            ocel_event_id = event['event_id']
            start_timestamp = event['event_start_timestamp']
            finish_timestamp = event['time:timestamp']

            result[ocel_event_id] = AlignedEdgeTimes(previous_activity=last_activity,
                                                     activation_time=finish_time_of_previous_activity,
                                                     execution_time=ProjectedEventTime(start_timestamp),
                                                     previous_id=last_id)

            last_activity = event['concept:name']
            last_id = ocel_event_id
            finish_time_of_previous_activity = ProjectedEventTime(finish_timestamp)

        for (ocel_event_id, time) in result.items():
            aligned_times.setdefault(str(ocel_event_id), {})[object_id] = time

    return aligned_times


def get_projected_event_log(ocel: OCEL, object_type: str,
                            project_if_non_existent: bool = True) -> EventLog | None:
    projected_logs = project_ocel(ocel)
    if object_type not in projected_logs:
        raise ValueError(f"Object type {object_type} does not exist in current OCEL!")
    return projected_logs[object_type]


def get_ocel(ocel_filename: str) -> OCEL:
    return ocel_import_factory.apply(ocel_filename)


def project_ocel(ocel: OCEL, build_metadata: bool = True) -> Dict[str, EventLog]:
    # ocel: OCEL = get_ocel(ocel_filename)

    # Prepare event log for projection to object types.
    df: DataFrame = ocel.log.log
    exploded_df = succint_mdl_to_exploded_mdl(df)

    result = {}
    for object_type in ocel.object_types:
        result[object_type] = project_log(exploded_df, object_type)
    return result


def collect_times(ocel: DataFrame, aligned_times: Dict[ObjectType, Dict[str, Dict[str, ProjectedEventTime]]]):
    """Calculates all occurring node waiting times, service times, sourjourn times, node pooling times,
    synchronization times, lagging times, flow times, edge pooling times and edge waiting times.
    The calculated times are returned without any aggregation, that why they are 'collected'."""
    # print(aligned_times)
    waiting_times: Dict[Node, List[int]] = {}
    service_times: Dict[Node, List[int]] = {}
    sojourn_times: Dict[Node, List[int]] = {}
    pooling_times: Dict[Node, Dict[ObjectType, List[int]]] = {}
    synchronization_times: Dict[Node, List[int]] = {}
    lagging_times: Dict[Node, List[int]] = {}
    flow_times: Dict[Node, List[int]] = {}
    start_timestamps: Dict[Node, List[Timestamp]] = {}
    end_timestamps: Dict[Node, List[Timestamp]] = {}
    edge_pooling_times: Dict[Node, Dict[Node, Dict[ObjectType, List[int]]]] = {}
    edge_waiting_times: Dict[Node, Dict[Node, Dict[ObjectType, List[int]]]] = {}
    edge_elapsed_times: Dict[Node, Dict[Node, List[int]]] = {}
    lead_times: Dict[Node, List[int]] = {}

    smallest_timestamp: Timestamp | None = None

    for _, event in ocel.iterrows():
        event_id = str(event['event_id'])
        event_activity = event['event_activity']
        # event_name = event_activity + "-" + event_id
        event_name = event_id

        event_start_timestamp: Timestamp = event['event_start_timestamp']
        if not isinstance(event_start_timestamp, Timestamp):
            event_start_timestamp = Timestamp(ts_input=event_start_timestamp)

        event_end_timestamp: Timestamp = event['event_timestamp']
        if not isinstance(event_end_timestamp, Timestamp):
            event_end_timestamp = Timestamp(ts_input=event_end_timestamp)
        if smallest_timestamp is None:
            smallest_timestamp = event_end_timestamp
        elif smallest_timestamp > event_end_timestamp:
            smallest_timestamp = event_end_timestamp

        service_time: Timedelta = event_end_timestamp - event_start_timestamp

        event_first_activation: Timestamp | None = None
        ot_activation_times: List[Timestamp] = []

        for (object_type, ot_times) in aligned_times.items():
            first_activation_time: Timestamp | None = None
            last_activation_time: Timestamp | None = None

            first_activation_time_by_previous_activity: Dict[str, tuple[Timestamp, str]] = {}
            last_activation_time_by_previous_activity: Dict[str, tuple[Timestamp, str]] = {}

            # Determine the first and the last activation time for the object type.
            for object_id in event[object_type]:
                if event_id not in aligned_times[object_type] or object_id not in aligned_times[object_type][event_id]:
                    continue  # This event is log move for this object.

                aligned_time = AlignedEdgeTimes(*aligned_times[object_type][event_id][object_id])
                execution_time = ProjectedEventTime(*aligned_time.execution_time)
                execution_timestamp = Timestamp(ts_input=execution_time.aligned_time)

                previous_id = str(aligned_time.previous_id)
                if previous_id in aligned_times[object_type] and object_id in aligned_times[object_type][previous_id]:
                    previous_timestamp = AlignedEdgeTimes(*aligned_times[object_type][previous_id][object_id])
                    previous_execution_time = ProjectedEventTime(*previous_timestamp.execution_time)
                    edge_elapsed_times \
                        .setdefault(previous_id, {}) \
                        .setdefault(event_name, []) \
                        .append(round((event_start_timestamp - previous_execution_time.aligned_time).total_seconds()))

                assert execution_timestamp == event_start_timestamp

                if aligned_time.activation_time and aligned_time.previous_activity:
                    activation_time = ProjectedEventTime(*aligned_time.activation_time)
                    activation_timestamp = Timestamp(ts_input=activation_time.aligned_time)

                    if first_activation_time is None or activation_timestamp < first_activation_time:
                        first_activation_time = activation_timestamp
                    if last_activation_time is None or activation_timestamp > last_activation_time:
                        last_activation_time = activation_timestamp

                    if aligned_time.previous_activity not in first_activation_time_by_previous_activity or \
                            activation_timestamp < first_activation_time_by_previous_activity[
                            aligned_time.previous_activity][0]:
                        first_activation_time_by_previous_activity[
                            aligned_time.previous_activity] = (activation_timestamp, str(aligned_time.previous_id))
                    if aligned_time.previous_activity not in last_activation_time_by_previous_activity or \
                            activation_timestamp > last_activation_time_by_previous_activity[
                            aligned_time.previous_activity][0]:
                        last_activation_time_by_previous_activity[aligned_time.previous_activity] = \
                            (activation_timestamp, str(aligned_time.previous_id))

                    if event_first_activation is None or activation_timestamp < event_first_activation:
                        event_first_activation = activation_timestamp

            if first_activation_time is not None and last_activation_time is not None:
                pooling_time = last_activation_time - first_activation_time
                pooling_times.setdefault(event_name, {}).setdefault(object_type, []).append(
                    round(pooling_time.total_seconds()))

                # Calculate and store the edge times.
                for previous_activity in first_activation_time_by_previous_activity:
                    edge_pooling_time = last_activation_time_by_previous_activity[previous_activity][0] - \
                                        first_activation_time_by_previous_activity[previous_activity][0]
                    edge_pooling_times \
                        .setdefault(first_activation_time_by_previous_activity[previous_activity][1], {}) \
                        .setdefault(event_name, {}) \
                        .setdefault(object_type, []) \
                        .append(round(edge_pooling_time.total_seconds()))

                    edge_waiting_time = event_start_timestamp - last_activation_time_by_previous_activity[
                        previous_activity][0]
                    edge_waiting_times \
                        .setdefault(first_activation_time_by_previous_activity[previous_activity][1], {}) \
                        .setdefault(event_name, {}) \
                        .setdefault(object_type, []) \
                        .append(round(edge_waiting_time.total_seconds()))

                ot_activation_times.append(last_activation_time)

        if len(ot_activation_times) > 0:
            first_ot_activation_time = min(ot_activation_times)
            last_ot_activation_time = max(ot_activation_times)

            waiting_time = event_start_timestamp - last_ot_activation_time
            sojourn_time = waiting_time + service_time
            lagging_time = last_ot_activation_time - first_ot_activation_time
            synchronization_time = last_ot_activation_time - event_first_activation
            # Changed from synchronization_time + service_time
            flow_time = synchronization_time + sojourn_time

            waiting_times.setdefault(event_name, []).append(round(waiting_time.total_seconds()))
            sojourn_times.setdefault(event_name, []).append(round(sojourn_time.total_seconds()))
            lagging_times.setdefault(event_name, []).append(round(lagging_time.total_seconds()))
            synchronization_times.setdefault(event_name, []).append(round(synchronization_time.total_seconds()))
            flow_times.setdefault(event_name, []).append(round(flow_time.total_seconds()))

        service_times.setdefault(event_name, []).append(round(service_time.total_seconds()))
        start_timestamps.setdefault(event_name, []).append(event_start_timestamp)
        end_timestamps.setdefault(event_name, []).append(event_end_timestamp)

    for _, event in ocel.iterrows():
        event_id = str(event['event_id'])
        event_end_timestamp: Timestamp = event['event_timestamp']
        if not isinstance(event_end_timestamp, Timestamp):
            event_end_timestamp = Timestamp(ts_input=event_end_timestamp)
        lead_times.setdefault(event_id, []).append(round((event_end_timestamp - smallest_timestamp).total_seconds()))

    return CollectedTimes(
        waiting_times=waiting_times,
        service_times=service_times,
        sojourn_times=sojourn_times,
        pooling_times=pooling_times,
        synchronization_times=synchronization_times,
        lagging_times=lagging_times,
        flow_times=flow_times,
        start_timestamps=start_timestamps,
        timestamps=end_timestamps,
        edge_pooling_times=edge_pooling_times,
        edge_waiting_times=edge_waiting_times,
        lead_times=lead_times,
        edge_elapsed_times=edge_elapsed_times
    )


def translate_process_execution_to_ocel(process_execution, ocel):
    ocel = ocel.log.log
    result_ocel = []
    for event_id in process_execution:
        result_ocel.append(ocel.iloc[event_id])
    return pd.DataFrame(result_ocel)


@router.get("/single_performance_metrics")
def calculate_single_performance_metrics(filepath: str, index: int):
    ocel = get_ocel(filepath)
    all_times = get_current_all_times(ocel)

    start_time = time.time()
    pe_ocel = translate_process_execution_to_ocel(ocel.process_executions[index], ocel)
    collected_times = collect_times(pe_ocel, all_times)
    print(f"Collecting times took {time.time() - start_time} seconds.")
    return aggregate_times_to_frontend_friendly(collected_times).__dict__


@router.get("/performance_metrics")
def calculate_performance_metrics(filepath: str):
    ocel = get_ocel(filepath)
    all_times = get_current_all_times(filepath)

    start_time = time.time()
    full_coll_times = collect_times(ocel.log.log, all_times)
    print(f"Collecting times took {time.time() - start_time} seconds.")
    return aggregate_times_to_frontend_friendly(full_coll_times).__dict__
