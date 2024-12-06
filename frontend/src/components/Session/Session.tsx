import React, {ChangeEvent, MutableRefObject, ReactElement, useEffect, useMemo, useState} from 'react';
import "./Session.css";
import { OCPQNavbar } from "../Navbar/Navbar";
import ReactDataGrid from '@inovua/reactdatagrid-community';
import '@inovua/reactdatagrid-community/index.css';
import {getURI} from "../utils";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
    faCloudArrowUp,
    faHardDrive,
    faTrash,
    faEraser,
    faFileArrowUp,
    faCircleCheck
} from "@fortawesome/free-solid-svg-icons";
import {CircularProgress} from "@mui/material";
import {TypeComputedProps} from "@inovua/reactdatagrid-community/types";
import {useNavigate} from "react-router-dom";
import {CSVSettings, CSVState, ExtractionSettings} from "./CSVSettings";

type TableEventLog = {
    id: number,
    displayName: any,
    type: ReactElement,
    size: ReactElement,
    deleteButton: any
}

export function Session(){

    const [selected, setSelected] = useState<number | null>(null);
    const [gridRef, setGridRef] = useState<MutableRefObject<TypeComputedProps | null> | null>(null);
    const [eventLogs, setEventLogs] = useState<EventLogMetadata[]>([]);
    const [csvSelected, setCsvSelected] = useState<boolean>(false);
    const [csvSettings, setCSVSettings] = useState<CSVState | null>(null);

    let selectedEventLog = null;
    if (selected != null && selected < eventLogs.length)
        selectedEventLog = eventLogs[selected];

    const navigateTo = useNavigate();

    const tableLogs = useMemo(async () => {

        let newEventLogs: EventLogMetadata[];
        if (eventLogs.length === 0 || (selected !== null && typeof eventLogs[selected] === "undefined")){
            newEventLogs = await fetchEventLogs();
            setEventLogs(newEventLogs);
        } else {
            newEventLogs = eventLogs;
        }

        return newEventLogs.map((eventLog): TableEventLog => {
            const baseFolder = eventLog.full_path.split("/")[0];
            const isUploaded = baseFolder === "uploaded";
            const icon = isUploaded ?
                <FontAwesomeIcon icon={faCloudArrowUp} title="This OCEL was uploaded via the web interface"
                                 className="EventLogTable-LogSourceIcon"/> :
                <FontAwesomeIcon icon={faHardDrive} title="This OCEL was provided using a folder mount"
                                 className="EventLogTable-LogSourceIcon"/>;

            const displayName = <div title={eventLog.name}>
                {icon} {eventLog.name}
            </div>

            const deleteButton = (
                <button className="EventLogTable-DeleteButton"
                        onClick={(event) => {
                            //props.deleteLog(eventLog);
                            event.stopPropagation();
                        }}
                        title={"Shows prompt for deletion of this uploaded OCEL."}
                >
                    <FontAwesomeIcon icon={faTrash}/>
                </button>)

            const clearCacheButton = (
                <button className="EventLogTable-DeleteButton"
                        onClick={(event) => {
                            //props.deleteLog(eventLog);
                            event.stopPropagation();
                        }}
                        title={"Shows prompt for clearing cache of this mounted OCEL."}
                >
                    <FontAwesomeIcon icon={faEraser}/>
                </button>
            )

            return {
                id: eventLog.id!,
                displayName,
                type: <div title={eventLog.type}>{eventLog.type}</div>,
                size: <div title={eventLog.size}>{eventLog.size}</div>,
                deleteButton: isUploaded ? deleteButton : clearCacheButton
            }
        });
    }, [selected]);

    const columns = [
        {name: 'displayName', header: 'OCEL', defaultFlex: 8},
        {name: 'type', header: 'Type', defaultFlex: 1},
        {name: 'size', header: 'File size', defaultFlex: 1},
        {name: 'deleteButton', header: '', defaultFlex: .25},
    ]

    const onSelection = ({selected}: { selected: any }) => {
        setSelected(selected);
        if (eventLogs[selected].type === "csv")
            setCsvSelected(true);
        else
            setCsvSelected(false);
    };

    const onSelect = () => {
        if (selected !== null) {
            localStorage.clear();
            localStorage.setItem('ocel', "data/" + eventLogs[selected].full_path);
            navigateTo("/");
        }
    }

    const findLog = (eventLog: EventLogMetadata) => {
        for (let log of eventLogs){
            if (eventLog.full_path === log.full_path){
                return log.id
            }
        }
        return -1
    }

    console.log(selected !== null && eventLogs[selected])

    return (
        <React.Fragment>
            <OCPQNavbar></OCPQNavbar>
            <div className={"Content"}>
                <div className="EventLogList">
                    <div style={{'paddingTop': '1rem'}}>
                        <ReactDataGrid
                            columns={columns}
                            dataSource={tableLogs}
                            selected={selected}
                            onReady={setGridRef}
                            onSelectionChange={onSelection}
                            style={{'padding': '1rem'}}
                        />
                    </div>
                    <div className="EventLogList-Buttons">
                        <UploadLogButton onUpload={(eventLog) => {
                            if (eventLog.id !== undefined) {
                                setSelected(eventLog.id);
                                if (gridRef !== null) {
                                    gridRef.current?.scrollToId(eventLog.id)
                                }
                            }
                            else {
                                const id = findLog(eventLog)
                                if (id !== undefined) {
                                    setSelected(id);
                                    if (gridRef !== null)
                                    {
                                        gridRef.current?.scrollToId(id)
                                    }
                                }

                            }
                        }}/>
                        <div className="EventLogList-SelectButton" onClick={onSelect}>
                            <FontAwesomeIcon icon={faCircleCheck} />
                            Select
                        </div>
                    </div>
                </div>
                {csvSelected && <CSVSettings selectedEventLog={selectedEventLog} setCSVSettings={setCSVSettings}/>}
                {!csvSelected && selected && <ExtractionSettings selectedEventLog={selectedEventLog} />}
            </div>
        </React.Fragment>
    )
}

export interface EventLogMetadata {
    id?: number,
    full_path: string
    name: string
    size: string
    dir_type: string
    extra: any
    type: string
}

export let compare = (a: { dir_type: string; }, b: { dir_type: string; }) => {
    if (a.dir_type < b.dir_type) {
        return 1;
    }
    if (a.dir_type > b.dir_type) {
        return -1;
    }
    return 0;
}

export const formatEventLogMetadata = (data: any): EventLogMetadata => {
    return {
        full_path: data[0],
        name: data[0].split("/").pop().split(".").slice(0, -1),
        size: data[1] + " KB",
        dir_type: data[0].split("/")[0],
        extra: data[0].split("/")[0],
        type: data[0].split(".").pop()
    }
}

export const fetchEventLogs = async (): Promise<EventLogMetadata[]> => {

    const uri = getURI("/logs/available", {});
    const data = await (await fetch(uri)).json()
    if (data) {
        const formattedData = data.map((eventLog: any, index: number) => {
            const eventLogMetadata = formatEventLogMetadata(eventLog)
            return {
                ...eventLogMetadata,
                id: index
            }
        })

        formattedData.sort(compare)

        // Give items correct id for selection, we get a wrong id if we assign it in the data.map already
        for (let i = 0; i < formattedData.length; i++) {
            formattedData[i].id = i;
        }

        return formattedData
    }
    else
        return []
}

type LogUploaderProps = {
    onUpload?: (eventLog: EventLogMetadata) => void
}

export const UploadLogButton = (props: LogUploaderProps) => {
    const [loading, setLoading] = useState<boolean>(false);

    const uploadFile = (event: ChangeEvent<HTMLInputElement>) => {
        if (!event.target || !event.target.files)
            return;

        if (event.target.files.length === 0)
            return;

        const formData = new FormData()
        formData.append('file', event.target.files[0])

        const uploadFileUrl: string = getURI('/logs/upload', {})

        setLoading(true);
        fetch(uploadFileUrl, {
            method: 'PUT',
            body: formData
        })
            .then((response) => response.json())
            .then((result) => {
                if (result.status === "successful") {
                    const eventLogMetadata = formatEventLogMetadata(result.data)
                    //props.addEventLog(eventLogMetadata);
                    if (props.onUpload)
                        props.onUpload(eventLogMetadata);
                }
                setLoading(false);
            })
            .catch(err => console.log("Error in uploading ...", err))
    }

    return (
        <div className="LogUploader-FileSelect">
            <label  htmlFor="uploadEventLog">
                <FontAwesomeIcon icon={faFileArrowUp} />
                Upload OCEL
            </label>
            <input type="file" accept=".jsonocel, .xmlocel, .csv" id="uploadEventLog" hidden onChange={uploadFile}/>
            {loading && (
                <CircularProgress
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        marginTop: '-12px',
                        marginLeft: '-12px',
                    }}
                />
            )}

        </div>
    )
}