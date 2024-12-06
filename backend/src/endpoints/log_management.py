from __future__ import annotations

import json
from pathlib import PureWindowsPath, Path
from typing import List, Tuple

import networkx as nx
from fastapi import APIRouter, HTTPException, UploadFile
from pydantic import BaseModel
import pandas as pd
from pandas.api.types import is_integer_dtype
import os
import time

from starlette import status

from ocpa.objects.log.ocel import OCEL
from ocpa.objects.log.importer.ocel import factory as ocel_import_factory
from ocpa.objects.log.importer.csv import factory as ocel_import_factory_csv


router = APIRouter(prefix='/logs',
                   tags=['Log management'])

current_ocel = None
current_ocel_path = ""

QUERY_FOLDER = os.path.join("cache", "queries")
FLOW_FOLDER = os.path.join("cache", "flow")
CSV_FOLDER = os.path.join("cache", "csv_columns")
EXTRACTION_FOLDER = os.path.join("cache", "extraction_settings")
os.makedirs(QUERY_FOLDER, exist_ok=True)
os.makedirs(FLOW_FOLDER, exist_ok=True)
os.makedirs(CSV_FOLDER, exist_ok=True)
os.makedirs(EXTRACTION_FOLDER, exist_ok=True)

DEFAULT_EXTRACTION_PARAMETER = {
    "execution_extraction": "connected_components",
    "variant_calculation": "two_phase",
    "exact_variant_calculation": False
}


class JSONQuery(BaseModel):
    data: str | object
    left: JSONQuery | None
    right: JSONQuery | None


class QueryName(BaseModel):
    query: JSONQuery
    name: str


class FlowState(BaseModel):
    nodes: List[dict]
    edges: List[dict]
    name: str
    ocel: str


class AvailableLogsResponseModel(BaseModel):
    __root__: List[List[str | float]]

    class Config:
        schema_extra = {
            "example": [
                "uploaded/p2p-normal.jsonocel",
                "mounted/b2c-unfiltered.csv"
            ]
        }


class CSV(BaseModel):
    objects: List[str]
    activity: str
    timestamp: str
    id: str
    separator: str

    class Config:
        schema_extra = {
            "example": {
                "objects": [
                    "PURCHORD",
                    "PURCHREQ"
                ],
                "activity": "ocel:activity",
                "timestamp": "ocel:timestamp",
                "id": "ocel:id",
                "separator": ","
            }
        }


class Extraction(BaseModel):
    extraction_type: str
    leading_type: str
    variant_calculation: str
    exact_calculation: bool


class StoreCSVPayload(BaseModel):
    name: str
    csv: CSV


class StoreExtractionPayload(BaseModel):
    name: str
    extraction: Extraction


class ColumnListResponseModel(BaseModel):
    __root__: List[str]

    class Config:
        schema_extra = {
            "example": [
                "ORDER",
                "CONTAINER",
                "REQ"
            ]
        }


@router.get("/test")
def test():
    return {'status': 'successful'}


def get_act_type_dict(file_path: str):
    ocel = get_ocel(file_path)
    # print(ocel)
    activities = set()
    act_card = {}
    obj_types = ocel.object_types
    act_obj_dict = {}
    for event in ocel.log.log.iterrows():
        activity = event[1]["event_activity"]
        if activity not in activities:
            activities.add(activity)
        if activity not in act_obj_dict:
            act_obj_dict[activity] = []
        for obj_type in obj_types:
            if len(event[1][obj_type]) != 0 and obj_type not in act_obj_dict[activity]:
                act_obj_dict[activity].append(obj_type)
        if activity not in act_card:
            act_card[activity] = 0
        act_card[activity] += 1
    for (key, value) in act_obj_dict.items():
        if len(value) == 0:
            activities.remove(key)
    print(activities)
    print(act_obj_dict)
    print(act_card)
    return list(activities), obj_types, act_obj_dict


@router.get("/activities")
def get_activities(file_path: str):
    ocel = get_ocel(file_path)
    activities = set()
    act_card = {}
    for activity in ocel.log.log["event_activity"]:
        if activity not in activities:
            activities.add(activity)
        if activity not in act_card:
            act_card[activity] = 0
        act_card[activity] += 1
    print(act_card)
    return activities


def get_query(ocel):
    from src.endpoints.pq import QueryGraph
    from src.endpoints.pq import current_query_object
    import src.endpoints.pq as pq
    if current_query_object is None or \
            len(ocel.process_executions) != len(current_query_object.ocel.process_executions) or \
            str(ocel.process_executions) != str(current_query_object.ocel.process_executions):
        query = QueryGraph(ocel)
        pq.current_query_object = query
    else:
        query = current_query_object
    return query


@router.get("/object_types")
def get_object_types(file_path: str):
    ocel = get_ocel(file_path)
    print(ocel.object_types)
    return ocel.object_types


@router.get("/objects")
def get_objects(file_path: str):
    ocel = get_ocel(file_path)
    query = get_query(ocel)
    pe_length = {}
    edge_count = {}
    for c, pe in enumerate(query.process_executions):
        exec_graph = ocel.get_process_execution_graph(c)
        edge_c = len(exec_graph.edges)
        len_pe = len(pe)
        if len_pe not in pe_length:
            pe_length[len_pe] = 0
        pe_length[len_pe] += 1
        if edge_c not in edge_count:
            edge_count[edge_c] = 0
        edge_count[edge_c] += 1
    print(pe_length)
    print(edge_count)
    return query.all_objects


@router.get("/process_execution_count")
def get_process_execution_count(file_path: str):
    ocel = get_ocel(file_path)
    return len(ocel.process_executions)


@router.get("/graph")
def query_to_graph(ocel: str, index: int):
    ocel = get_ocel(ocel)
    query = get_query(ocel)
    return nx.cytoscape_data(query.annotated_graphs[index])


@router.get("/objects_of_index")
def get_objects_of_index(ocel: str, index: int):
    ocel = get_ocel(ocel)
    query = get_query(ocel)
    return query.objects[index]


@router.get("/activity_mapping")
def get_id_activity_mapping(file_path: str):
    ocel = get_ocel(file_path)
    query = get_query(ocel)
    return query.id_activity_mapping


@router.put("/save_query")
def save_query(query: QueryName):
    print(query.query)
    print(query.name)

    # Create query folder per ocel
    query_folder = os.path.join(QUERY_FOLDER, query.name)
    os.makedirs(query_folder, exist_ok=True)
    # Name query with ocel name + "query" + count
    dir_count = count_files(query_folder)
    query_file = get_query_file(query_folder, query.name, dir_count)
    print(query_file)
    with open(query_file, 'w') as f:
        json.dump(query.query.dict(), f, indent=4)

    # Idea: Create folder per ocel, name query with ocel name + "query" + count
    # where count = len(queries) in folder
    return {'status': 'successful', 'name': query_file}


def count_files(directory):
    count = 0
    for path in os.listdir(directory):
        if os.path.isfile(os.path.join(directory, path)):
            count += 1
    return count


@router.put("/save_state")
def save_state(flow: FlowState):
    # Create flow state folder per ocel
    flow_folder = os.path.join(FLOW_FOLDER, flow.ocel)
    os.makedirs(flow_folder, exist_ok=True)
    # Name query with ocel name + "query" + count
    flow_file = get_flow_file(flow_folder, flow.name)
    print(flow_file)
    with open(flow_file, 'w') as f:
        json.dump(flow.dict(), f, indent=4)

    return {'status': 'successful', 'name': flow_file}


class AvailableFlowStatesResponseModel(BaseModel):
    __root__: List[Tuple[str, float, List[dict], List[dict]]]


@router.get('/available_flow_states', response_model=AvailableFlowStatesResponseModel)
def list_available_flow_states(ocel: str):
    """
    Lists all available Flow states and returns them as list of strings that can be used to access them using other
    API endpoints.
    :return: List of available flow states containing information like name, age, etc.
    """
    flow_folder = os.path.join(FLOW_FOLDER, ocel)

    if not os.path.isdir(flow_folder):
        return []

    result = []
    for file in os.listdir(flow_folder):
        if file.endswith(".json"):
            flow_name = file[:-5]
            last_change = os.path.getmtime(os.path.join(flow_folder, file))
            with open(os.path.join(flow_folder, file), 'r') as f:
                flow_state = FlowState(**json.load(f))
                result.append((flow_name, last_change, flow_state.nodes, flow_state.edges))
    print(result)
    return result


@router.get('/delete_flow_state')
def delete_flow_state(ocel: str, name: str):
    """
    This function deletes a single flow state file.
    :param ocel: Name of the ocel for which the file should be deleted.
    :param name: Name of the flow state to be deleted.
    :return: Status successful
    """
    flow_state_file = get_flow_file(os.path.join(FLOW_FOLDER, ocel), name)
    print(flow_state_file)
    if not os.path.isfile(flow_state_file):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown flow state file.")

    os.remove(flow_state_file)

    return {
        "status": "successful"
    }


@router.get('/flow_state')
def get_flow_state(ocel: str, name: str):
    """
    This function returns a single flow state file.
    :param ocel: Name of the ocel for which the file should be returned.
    :param name: Name of the flow state to be returned.
    :return: JSON data in the file
    """
    flow_state_file = get_flow_file(os.path.join(FLOW_FOLDER, ocel), name)

    if not os.path.isfile(flow_state_file):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown flow state file.")

    with open(flow_state_file, 'r') as f:
        flow_state = FlowState(**json.load(f))
        return flow_state


def get_query_file(query_folder: str, ocel_name: str, count: int):
    """
    Determines the file to store the query data to. Prevents path traversals.
    :param query_folder: Name of the query folder to be stored to.
    :param ocel_name: Name of the OCEL.
    :param count: Count of currently present queries
    :return: Path to the query file.
    """
    query_file_unvalidated = os.path.join(query_folder, ocel_name + "_query_" + str(count) + ".json")

    # The backend might run on windows which results in a mixture of windows and posix paths
    # (as we simply use strings as path representations for now)
    # If the path is a posix path, then the following transformation has no effect. If the path
    # is a windows path, then afterwards it will be a posix path
    query_file_unvalidated = PureWindowsPath(query_file_unvalidated).as_posix()
    query_file = PureWindowsPath(os.path.abspath(query_file_unvalidated)).as_posix()

    if query_file[-len(query_file_unvalidated):] != query_file_unvalidated:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Path traversals are not allowed!")
    return query_file


def get_flow_file(flow_folder: str, name: str):
    """
    Determines the file to store the query data to. Prevents path traversals.
    :param flow_folder: Name of the query folder to be stored to.
    :param name: Name of the OCEL.
    :return: Path to the query file.
    """
    flow_file_unvalidated = os.path.join(flow_folder, name + ".json")

    # The backend might run on windows which results in a mixture of windows and posix paths
    # (as we simply use strings as path representations for now)
    # If the path is a posix path, then the following transformation has no effect. If the path
    # is a windows path, then afterwards it will be a posix path
    flow_file_unvalidated = PureWindowsPath(flow_file_unvalidated).as_posix()
    flow_file = PureWindowsPath(os.path.abspath(flow_file_unvalidated)).as_posix()

    if flow_file[-len(flow_file_unvalidated):] != flow_file_unvalidated:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Path traversals are not allowed!")
    return flow_file


@router.get('/available', response_model=AvailableLogsResponseModel)
def list_available_logs():
    """
    Lists all available OCELS and returns them as list of strings that can be used to access them using other
    API endpoints. Additionally, the file size is returned. OCELs that were uploaded by the user over the web
    interface will be prefixed by "uploaded/".
    :return: String list containing paths of available ocels
    """
    def find_available_logs(folder: str) -> List[str]:
        result = []
        for node in os.listdir(folder):
            complete_path = os.path.join(folder, node)
            if os.path.isfile(complete_path) and (node.endswith(".jsonocel") or node.endswith(".xmlocel") or node.endswith(".csv")):
                result.append(os.path.join(folder, node))
            elif os.path.isdir(complete_path):
                result.extend(find_available_logs(complete_path))
        return result

    # Cut of the data/ from the log names
    def cut_filename(filename: str):
        return filename[5:]

    def extend_result_by_filesize(log: List[str]):
        results = []
        for entry in log:
            results.append([cut_filename(entry), round(os.stat(entry).st_size / 1024, 0)])
        return results

    # Find all logs in the data folder.
    logs = find_available_logs("data")

    # Extend results by file size
    extended_logs = extend_result_by_filesize(logs)

    return extended_logs


@router.put('/upload')
async def upload_event_logs(file: UploadFile):
    """
    This function handles the uploading of OCELs. It also ensures that .jsonocel and .xmlocel OCELs
    have the correct Event ID format since OCPA does not like string event IDs (at least v1.2).
    :param file: File to be uploaded as fastapi UploadFile
    :return: Returns successful status and file path + file size
    """
    upload_folder_location = "." + os.sep + "data" + os.sep + "uploaded"
    Path(upload_folder_location).mkdir(parents=True, exist_ok=True)

    file_location = upload_folder_location + os.sep + file.filename
    file_content = await file.read()
    with open(file_location, "wb") as f:
        f.write(file_content)

    # Since we do not know which column is used as id in csv files and we do not want to assume that,
    # changing type of the id column is done when we select the csv file and chose the id column

    return {
        "status": "successful",
        "data": [
            "uploaded/" + file.filename,
            round(os.stat(file_location).st_size / 1024, 0)
        ]
    }


@router.get('/csv_columns', response_model=ColumnListResponseModel)
def get_csv_columns(file_path: str):
    """
    Returns the columns of the OCEL.
    :param file_path: Path to the csv OCEL for which the columns should be returned.
    :return: Columns of the OCEL
    """
    file_path_extended = "data" + os.sep + file_path

    if not os.path.isfile(file_path_extended):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not a file.")

    dataframe = pd.read_csv(file_path_extended, sep=',')
    return list(dataframe.columns.values)


@router.get('/csv_data')
def get_csv_columns(file_path: str, n_columns: int):
    """
    Allows to fetch a certain number of rows in the csv OCEL to display them.
    :param file_path: Path to the csv OCEL for which the columns should be fetched.
    :param n_columns: Number of columns to fetch.
    :return: First n_columns rows of the csv OCEL.
    """
    file_path_extended = "data" + os.sep + file_path

    if not os.path.isfile(file_path_extended):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not a file.")

    dataframe = pd.read_csv(file_path_extended, sep=',')
    return dataframe.head(n_columns).to_json(orient="index")


def reset_file_path():
    global current_ocel_path
    current_ocel_path = ""


@router.put('/save_csv')
def save_csv_columns(payload: StoreCSVPayload):
    """
    This function saves the csv column mappings chosen in the frontend to a .json file.
    It also replaces the id column by a numeric values if that is not already the case.
    :param payload: The payload as StoreCSVPayload which should be stored.
    :return: Status successful
    """
    file_path_extended = "data" + os.sep + payload.name

    folder = CSV_FOLDER
    csv_file = get_csv_file(payload.name.split(os.sep)[-1])

    df = pd.read_csv(file_path_extended)
    print(df.dtypes)

    # We need "id" as id column, else import of csv fails
    # Right now, we manually change the id column to "id"
    # We only do this process if no csv mappings exist already (so only once)
    if not os.path.isfile(csv_file):
        df = pd.read_csv(file_path_extended)
        df.rename(columns={payload.csv.id: "id"}, inplace=True)
        # When id column does not have needed numeric format, we change it (random order)
        if not is_integer_dtype(df["id"]):
            # df['id'] = df.id.astype('category').cat.rename_categories(range(0, df.shape[0]))
            df['id'] = range(0, df.shape[0])
        df.to_csv(file_path_extended, index=None)

    with open(csv_file, 'w') as f:
        json.dump(payload.csv.dict(), f)

    reset_file_path()

    return {'status': 'successful'}


@router.put('/save_extraction')
def save_extraction(payload: StoreExtractionPayload):
    """
    This function saves the extraction mappings chosen in the frontend to a .json file.
    :param payload: The payload as StoreExtractionPayload which should be stored.
    :return: Status successful
    """
    extraction_file = get_extraction_file(payload.name.split(os.sep)[-1])
    with open(extraction_file, 'w') as f:
        json.dump(payload.extraction.dict(), f)

    reset_file_path()

    return {'status': 'successful'}


@router.get('/restore', response_model=CSV)
def restore_csv_data(name: str) -> CSV:
    """
    This function is used to restore the stored csv column mapping.
    :param name: File path of the csv OCEL.
    :return: Returns csv column mappings in the form of CSV.
    """
    # file_path_extended = "data" + os.sep + name

    csv_file = get_csv_file(name.split(os.sep)[-1])
    if not os.path.isfile(csv_file):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown column mappings file.")

    with open(csv_file, 'r') as f:
        return CSV(**json.load(f))


def get_csv_file(ocel_name: str):
    """
    Determines the file to store the csv data to. Prevents path traversals.
    :param ocel_name: Name of the csv OCEL.
    :return: Path to the csv file.
    """
    csv_file_unvalidated = os.path.join(CSV_FOLDER, ocel_name + ".json")

    # The backend might run on Windows which results in a mixture of windows and posix paths
    # (as we simply use strings as path representations for now)
    # If the path is a posix path, then the following transformation has no effect.
    # If the path is a Windows path, then afterwards it will be a posix path
    csv_file_unvalidated = PureWindowsPath(csv_file_unvalidated).as_posix()
    csv_file = PureWindowsPath(os.path.abspath(csv_file_unvalidated)).as_posix()

    if csv_file[-len(csv_file_unvalidated):] != csv_file_unvalidated:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Path traversals are not allowed!")
    return csv_file


def get_extraction_file(ocel_name: str):
    """
    Determines the file to store the extraction data to. Prevents path traversals.
    :param ocel_name: Name of the OCEL.
    :return: Path to the extraction file.
    """
    csv_file_unvalidated = os.path.join(EXTRACTION_FOLDER, ocel_name + ".json")

    # The backend might run on Windows which results in a mixture of windows and posix paths
    # (as we simply use strings as path representations for now)
    # If the path is a posix path, then the following transformation has no effect.
    # If the path is a Windows path, then afterwards it will be a posix path
    csv_file_unvalidated = PureWindowsPath(csv_file_unvalidated).as_posix()
    csv_file = PureWindowsPath(os.path.abspath(csv_file_unvalidated)).as_posix()

    if csv_file[-len(csv_file_unvalidated):] != csv_file_unvalidated:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Path traversals are not allowed!")
    return csv_file


def get_ocel(file_path: str, two_return_values=False):
    global current_ocel
    global current_ocel_path
    new_flag = False
    # Check if file path is correct, else add prefix
    file_path = check_path(file_path)
    if current_ocel is None or file_path != current_ocel_path:
        current_ocel = init_ocel(file_path)
        current_ocel_path = file_path
        new_flag = True
    if two_return_values:
        return current_ocel, new_flag
    return current_ocel


def check_path(file_path: str):
    if file_path[0:4] != "data":
        return "data" + os.sep + file_path
    return file_path


def init_ocel(ocel_filename: str) -> OCEL:
    """
    This function returns the OCEL for the given ocel file name.
    If a csv OCEL is selected, fetches the csv column mappings to import it.
    :param ocel_filename: File name of the OCEL to import.
    :return: Imported OCEL.
    """
    # Use saved extraction settings to properly import OCEL
    extraction_path = get_extraction_file(ocel_filename.split(os.sep)[-1])
    extraction_parameters = {}
    if os.path.isfile(extraction_path):
        with open(extraction_path, 'r') as f:
            extraction = Extraction(**json.load(f))
            extraction_parameters = {
                "execution_extraction": extraction.extraction_type,
                "leading_type": extraction.leading_type,
                "variant_calculation": extraction.variant_calculation,
                "exact_variant_calculation": extraction.exact_calculation,
            }

    # Use saved csv column data to properly import OCEL
    if ocel_filename.split(".")[-1] == "csv":
        csv_path = get_csv_file(ocel_filename.split(os.sep)[-1])
        if not os.path.isfile(csv_path):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown csv columns mapping.")

        with open(csv_path, 'r') as f:
            csv = CSV(**json.load(f))
            parameters = {"obj_names": csv.objects,
                          "val_names": [],
                          "act_name": csv.activity,
                          "time_name": csv.timestamp,
                          "sep": csv.separator}
            parameters = {**parameters, **extraction_parameters}
            return ocel_import_factory_csv.apply(file_path=ocel_filename, parameters=parameters)
    else:
        return ocel_import_factory.apply(ocel_filename, parameters=extraction_parameters)
