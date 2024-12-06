import React, {useEffect, useState} from "react";
import {getURI} from "../utils";
import ReactDataGrid from "@inovua/reactdatagrid-community";
import {EventLogMetadata} from "./Session";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import OutlinedInput from "@mui/material/OutlinedInput";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";

import './CSVSettings.css';

type CSVSettingProps = {
    selectedEventLog: EventLogMetadata | null,
    setCSVSettings: any
}

type Column = {
    name: string,
    header: string,
    defaultFlex: number
}

export type CSVState = {
    objects: string[],
    activity: string,
    timestamp: string,
    id: string,
    separator: string,
}

export type ExtractionState = {
    extraction_type: string,
    leading_type: string,
    variant_calculation: string,
    exact_calculation: boolean,
}

//TODO: check which separators are supported by OCPA
const availableSeparators = [
    ',',
    ';',
    '""',
    'TAB',
    '/',
    '{}'
]

/**
 * CSVSettings is used to control the storing/restoring of csv column mappings.
 * @param props
 * @constructor
 */
export const CSVSettings = (props: CSVSettingProps) => {
    const [lastEventLog, setLastEventLog] = useState<string | null>(null);

    const [columns, setColumns] = useState<Column[]>([]);

    const columnNames = columns.map((column) => column.name);

    const [objectTypes, setObjectTypes] = useState<string[]>([]);
    const [activityName, setActivityName] = useState<string | null>(null);
    const [timestampName, setTimestampName] = useState<string | null>(null);
    const [ocelID, setOcelID] = useState<string | null>(null);
    const [separator, setSeparator] = useState<string | null>(",");

    useEffect(() => {
        if (!props.selectedEventLog || !isCSV(props.selectedEventLog))
            return;

        let csvLog = props.selectedEventLog.name;
        if (lastEventLog !== csvLog) {
            setLastEventLog(csvLog);
            clearState();
            fetchColumns();
        }

    }, [props.selectedEventLog]);

    // Save the CSV settings on changes.
    useEffect(() => {
        if (!props.selectedEventLog)
            return;
        if (objectTypes.length === 0)
            return;
        if (!activityName || !columnNames.includes(activityName))
            return;
        if (!timestampName || !columnNames.includes(timestampName))
            return;
        if (!ocelID || !columnNames.includes(ocelID))
            return;
        if (!separator || !availableSeparators.includes(separator))
            return;
        storeCSV(props.selectedEventLog.full_path, {
            objects: objectTypes,
            activity: activityName,
            timestamp: timestampName,
            id: ocelID,
            separator
        });
    })

    if (!props.selectedEventLog || !isCSV(props.selectedEventLog))
        return null;

    let clearState = () => {
        setColumns([]);
        setObjectTypes([]);
        setActivityName(null);
        setTimestampName(null);
        setOcelID(null);
        setSeparator(",");
    }

    // Fetches the columns from the backend to display them when selecting a csv OCEL.
    async function fetchColumns() {
        if (!props.selectedEventLog)
            return;

        let columns: Column[] = [];
        try
        {
            const uri: string = getURI("/logs/csv_columns", {file_path: props.selectedEventLog.full_path});
            const data: string[] = await (await fetch(uri)).json();
            columns = data.map((columnName: string) => ({
                name: columnName,
                header: columnName,
                defaultFlex: 1
            }));
            setColumns(columns);
        }
        catch (e)
        {
            console.log("Error in fetching column data ...")
            console.error(e);
            return;
        }

        try {
            const uri = getURI("/logs/restore", {name: props.selectedEventLog.full_path});
            const response = await fetch(uri);
            if (response.status === 200) {
                const data: CSVState = await (await fetch(uri)).json();
                props.setCSVSettings(data);
                setObjectTypes(data.objects);
                setActivityName(data.activity);
                setTimestampName(data.timestamp);
                setOcelID(data.id);
                setSeparator(data.separator);
            }
            else if (response.status === 404) {
                // CSV Selection data does not exist yet, we use default values.
                setObjectTypes(findMultipleDefaultValues(columns, "type:"));
                setActivityName(findDefaultValue(columns, "activity"));
                setTimestampName(findDefaultValue(columns, "timestamp"));
                setOcelID(findDefaultValue(columns, "id"));
                setSeparator(",");
            }
            else
                console.log("got an unexpected response:", response.status, await response.json())
        }
        catch (e) {
            console.log("Got an unexpected error during loading CSV schema data");
            console.error(e);
        }
    }

    // Stores the csv column mappings to the backend.
    async function storeCSV(name: string, csv: CSVState) {
        const uri = getURI("/logs/save_csv", {});
        await fetch(uri, {
            method: 'PUT',
            headers: {
                "Content-type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                csv: csv,
            })
        })
            .then((response) => response.json())
            .then((result) => {
                if (result.status === "successful") {
                    console.log("Storing of csv " + name + " successful!");
                }
            })
            .catch(err => console.error("Error in uploading ...", err));
    }

    return (
        <div className="CSV-Settings-container">
            <ExtractionSettings selectedEventLog={props.selectedEventLog} columns={columnNames} />
            <h3>CSV Settings</h3>
            <CSVPreviewTable eventLog={props.selectedEventLog} columns={columns} />
            <SettingsDropdown label="Objects" values={columnNames} isMulti={true} selected={objectTypes} setSelected={setObjectTypes} />
            <SettingsDropdown label="Activity" values={columnNames} isMulti={false} selected={activityName} setSelected={setActivityName} />
            <SettingsDropdown label="Timestamp" values={columnNames} isMulti={false} selected={timestampName} setSelected={setTimestampName} />
            <SettingsDropdown label="Id" values={columnNames} isMulti={false} selected={ocelID} setSelected={setOcelID} />
            <SettingsDropdown label="Seperator" values={availableSeparators} isMulti={false} selected={separator} setSelected={setSeparator} />
        </div>
    );
}

type ExtractionSettingsProps = {
    selectedEventLog: EventLogMetadata | null,
    columns?: string[],
}

export const ExtractionSettings = (props: ExtractionSettingsProps) => {
    const [leadType, setLeadType] = useState<string>("");
    const [extractionType, setExtractionType] = useState<string>("connected_components");
    const [varCalc, setVarCalc] = useState<string>("two_phase");
    const [exactCalc, setExactCalc] = useState<string>("false");
    const [columnNames, setColumnNames] = useState<string[]>([]);

    const extractionTechniques = ["connected_components", "leading_type"]
    const variants = ["one_phase", "two_phase"];
    const exactCalcValues = ["true", "false"];

    useEffect(() => {
        if (!props.selectedEventLog)
            return;
        if (!extractionType)
            return;
        if (extractionType === "leading_type" && !leadType)
            return;
        if (!varCalc)
            return;
        if (!exactCalc)
            return;
        storeExtractionSettings(props.selectedEventLog.full_path, {
            extraction_type: extractionType,
            leading_type: leadType,
            variant_calculation: varCalc,
            exact_calculation: exactCalc === "true",
        });
    })

    async function storeExtractionSettings(name: string, extraction: ExtractionState) {
        const uri = getURI("/logs/save_extraction", {});
        await fetch(uri, {
            method: 'PUT',
            headers: {
                "Content-type": "application/json"
            },
            body: JSON.stringify({
                name: name,
                extraction: extraction,
            })
        })
            .then((response) => response.json())
            .then((result) => {
                if (result.status === "successful") {
                    console.log("Storing of extraction " + name + " successful!");
                }
            })
            .catch(err => console.error("Error in uploading ...", err));
    }

    useEffect(() => {
        if (props.columns)
            setColumnNames(props.columns);
        else
            fetchColumns();
    }, [props.selectedEventLog, props.columns]);

    async function fetchColumns(){
        if (props.selectedEventLog) {
            const uri: string = getURI("/logs/object_types", {file_path: props.selectedEventLog.full_path});
            const data: string[] = await (await fetch(uri)).json();
            setColumnNames(data);
        }
    }

    return (
        <div className={"CSV-Settings-container"}>
            <h3>Extraction Settings</h3>
            <SettingsDropdown label="Extraction technique" values={extractionTechniques} isMulti={false} selected={extractionType} setSelected={setExtractionType} />
            {extractionType === "leading_type" &&
                <SettingsDropdown label="Leading type" values={columnNames} isMulti={false} selected={leadType} setSelected={setLeadType} />
            }
            <SettingsDropdown label="Variant calculation" values={variants} isMulti={false} selected={varCalc} setSelected={setVarCalc} />
            <SettingsDropdown label="Exact variant calculation" values={exactCalcValues} isMulti={false} selected={exactCalc} setSelected={setExactCalc} />
        </div>
    )
}

type SettingDropdownProps = { label: string, values: string[] } & (
    {isMulti: false, selected: string | null, setSelected: any} |
    {isMulti: true,  selected: string[],      setSelected: any});

function SettingsDropdown(props: SettingDropdownProps) {
    // if (!props.selected)
    //    return null;

    const handleChange = (event: { target: {value: string | string[]}}) => {
        const value = event.target.value;
        let valuesArray;
        if (typeof value === "string") {
            valuesArray = [value]
        } else {
            valuesArray = value
        }

        if (props.isMulti)
            props.setSelected(valuesArray)
        else
            props.setSelected(valuesArray[0])
    }

    return (
        <FormControl size="small" sx={{width: '100%', marginTop: 2}}>
            <InputLabel id={props.label + "_InputLabel"}>{props.label}</InputLabel>
            <Select
                labelId={props.label}
                id={props.label}
                multiple={props.isMulti}
                value={props.selected ? props.selected : ""}
                onChange={handleChange}
                input={<OutlinedInput label={props.label}/>}
                renderValue={
                    (selected: string | string[]) => {
                        if (typeof selected === "string")
                            return selected
                        return selected.join(", ");
                    }
                }
                //MenuProps={MenuProps}
            >
                {props.values.map((value) => (
                    <MenuItem
                        key={value}
                        value={value}
                    >
                        {props.isMulti && (
                            <Checkbox checked={props.selected.includes(value)}/>
                        )}
                        {value}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
}

/**
 * CSVPreviewTable is used to give the user a short preview of the data in the csv OCEL for an easier decision
 * to set the column mappings.
 * @param props
 * @constructor
 */
function CSVPreviewTable(props: { eventLog: EventLogMetadata | null, columns: Column[] }) {
    const [data, setData] = useState<any[]>([]);

    useEffect(() => {
        if (!props.eventLog || !isCSV(props.eventLog)) {
            if (data.length > 0)
                setData([]);
            return;
        }

        const uri: string = getURI("/logs/csv_data", {file_path: props.eventLog.full_path, n_columns: 10});
        fetch(uri)
            .then(res => res.json())
            .then(data => {
                if (data !== undefined) {
                    setData(Object.values(JSON.parse(data)))
                }
            })
            .catch(err => {
                console.log("Error in fetching csv data ...")
            })
    }, [props.eventLog]);

    return <ReactDataGrid
        idProperty={"id"}
        columns={props.columns}
        dataSource={data}
        style={{width: "100%"}}/>
}

function isCSV(eventLog: EventLogMetadata): boolean {
    return eventLog.type === "csv";
}

/**
 * Used to determine a default value to show in the column mapping dropdowns.
 * @param columns
 * @param value
 */
function findDefaultValue(columns: Column[], value: string): string | null {
    const val = columns.map((column) => column.name).find((name) => name.search(value) >= 0);
    // Convert undefined to null.
    return val ? val : null;
}

function findMultipleDefaultValues(colums: Column[], filter: string): string[] {
    return colums.map((column) => column.name).filter((name) => name.search(filter) >= 0);
}