import React, {useEffect, useMemo, useRef, useState} from 'react';
import './Graph.css';
import CytoscapeComponent from 'react-cytoscapejs';
import {getObjectTypeColor, getURI, secondsToHumanReadableFormat} from "../utils";
import cytoscape, {EventObject} from 'cytoscape';
import {getPECount} from "../Query/Query";
import {Box, Pagination, Stack, TextField} from "@mui/material";
import {OCPQNavbar, IntegratedNavbar} from "../Navbar/Navbar";
import { SelectChangeEvent } from '@mui/material/Select';
import IconButton from "@mui/material/IconButton";
import Grid from '@mui/material/Grid';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import Switch from '@mui/material/Switch';
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import ExpandCircleDownIcon from '@mui/icons-material/ExpandCircleDown';
import {NavbarDropdown} from "../Navbar/NavbarDropdown";
import {faBrush, faDiagramProject} from "@fortawesome/free-solid-svg-icons";
import {faCircleXmark} from "@fortawesome/free-regular-svg-icons";
import {DropdownCheckbox} from "../Navbar/DropdownCheckbox";
import {ObjectSelection} from "../Navbar/ObjectSelection";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {IconProp} from "@fortawesome/fontawesome-svg-core";

const graphStylesheet: cytoscape.Stylesheet[] = [
    {
        "selector": 'node',  // For all nodes
        'style':
            {
                "opacity": 0.9,
                "label": "data(label)",  // Label of node to display
                "background-color": "data(color)",  // node color
                "color": "#FFFFFF",  // node label color
                "text-halign": "center",
                "text-valign": "center",
                'width': 'label',
                "shape": "round-rectangle",
                "padding-left": ".5em"
            }
    },
    {
        "selector": 'edge',  // For all edges
        "style":
            {
                "width": "3",
                "target-arrow-color": "data(color)",  // Arrow color
                "target-arrow-shape": "triangle",  // Arrow shape
                "line-color": "data(color)",  // edge color
                'arrow-scale': 2,  // Arrow size
                // Default curve-If it is style, the arrow will not be displayed, so specify it
                'curve-style': 'bezier',
                'label': 'data(label)',
                "line-style": "solid",
                'text-wrap': 'wrap',
                'color': 'black',
            }
    },
]

async function getPerformanceMetrics(index: number) {
    const ocel = localStorage.getItem('ocel');
    const uri = getURI("/performance/single_performance_metrics", {filepath: ocel? ocel : '', index: index});
    let results: any[] = []
    await fetch(uri)
        .then((response) => response.json())
        .then((result) => {
            console.log(results)
            results = result
        })
        .catch(err => console.log("Error in fetching:" + err))
    return results
}

async function getGraph(index: number) {
    const ocel = localStorage.getItem('ocel');
    const uri = getURI("/logs/graph", {ocel: ocel? ocel : '', index: index});
    let results: any[] = []
    await fetch(uri)
        .then((response) => response.json())
        .then((result) => {
            results = result
        })
        .catch(err => console.log("Error in fetching:" + err))
    return results
}

async function getObjectsOfExecution(index: number) {
    const ocel = localStorage.getItem('ocel');
    const uri = getURI("/logs/objects_of_index", {ocel: ocel? ocel : '', index: index});
    let results: any[] = []
    await fetch(uri)
        .then((response) => response.json())
        .then((result) => {
            results = result
        })
        .catch(err => console.log("Error in fetching:" + err))
    return results
}

async function getActivityMapping() {
    const ocel = localStorage.getItem('ocel');
    const uri = getURI("/logs/activity_mapping", {file_path: ocel? ocel : ''});
    let results: any[] = []
    await fetch(uri)
        .then((response) => response.json())
        .then((result) => {
            results = result
        })
        .catch(err => console.log("Error in fetching:" + err))
    return results
}

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
    PaperProps: {
        style: {
            maxHeight: ITEM_HEIGHT * 9 + ITEM_PADDING_TOP,
            width: 250,
        },
    },
};
// Sets the maximum grid size per page for the index selection.
const MAX_GRID_SIZE = 100;

function getEdgeMetricLabel(edgeMetrics: any){
    let label = ""
    Object.keys(edgeMetrics).forEach((objType: string) => {
        label += objType + ": " + secondsToHumanReadableFormat(edgeMetrics[objType], 2) + "\n"
    });
    return label;
}

const DEFAULT_NODE_METRIC = "activity";
const DEFAULT_EDGE_METRIC = "object";

type DropdownSettingsProps = {
    selectedNodeMetric: string,
    setSelectedNodeMetric: (metric: string) => void,
    selectedEdgeMetric: string,
    setSelectedEdgeMetric: (metric: string) => void,
    graphHorizontal: boolean,
    setGraphHorizontal: ((mode: boolean) => void) | ((mode: boolean) => Promise<void>),
    infoboxEnabled: boolean,
    setInfoboxEnabled: (enabled: boolean) => void,
    showNodeInfo: boolean,
    setShowNodeInfo: (enabled: boolean) => void,
    extendedMetrics?: boolean,
}

const DropdownSettings = (props: DropdownSettingsProps) => {

    function setNodeMetric(metric: 'activity' | 'waiting_time' | 'service_time' | 'sojourn_time' |
        'pooling_times' | 'synchronization_time' | 'lagging_time' | 'flow_time' | 'start_timestamp' |
        'timestamp' | 'lead_time') {
        props.setSelectedNodeMetric(metric);
    }

    function setEdgeMetric(metric: 'object' | 'pooling_time' | 'waiting_time' | 'elapsed_time') {
        props.setSelectedEdgeMetric(metric);
    }

    return (
        <React.Fragment>
            <NavbarDropdown buttonText={"Information"} buttonIcon={faDiagramProject} >
                <div className="VizSettings-Label" title={"Toggle for object info on nodes."}>Node info</div>
                <DropdownCheckbox
                    selected={props.showNodeInfo}
                    label={props.showNodeInfo ? "Enabled" : "Disabled"}
                    onClick={() => props.setShowNodeInfo(!props.showNodeInfo)}/>
                <div className="VizSettings-Label" title={"Select which metric to display for nodes."}>Node metrics</div>
                <DropdownCheckbox
                    selected={props.selectedNodeMetric === "activity"}
                    label={"Activity"}
                    onClick={() => setNodeMetric("activity")}
                />
                {props.extendedMetrics &&
                    <DropdownCheckbox
                        selected={props.selectedNodeMetric === "waiting_time"}
                        label={"Waiting time"}
                        onClick={() => setNodeMetric("waiting_time")}
                    />
                }
                {props.extendedMetrics &&
                    <DropdownCheckbox
                        selected={props.selectedNodeMetric === "service_time"}
                        label={"Service time"}
                        onClick={() => setNodeMetric("service_time")}
                    />
                }
                <DropdownCheckbox
                    selected={props.selectedNodeMetric === "sojourn_time"}
                    label={"Sojourn time"}
                    onClick={() => setNodeMetric("sojourn_time")}
                />
                {props.extendedMetrics &&
                    <DropdownCheckbox
                    selected={props.selectedNodeMetric === "pooling_times"}
                    label={"Pooling times"}
                    onClick={() => setNodeMetric("pooling_times")}
                    />
                }
                <DropdownCheckbox
                    selected={props.selectedNodeMetric === "synchronization_time"}
                    label={"Synchronization time"}
                    onClick={() => setNodeMetric("synchronization_time")}
                />
                {props.extendedMetrics &&
                    <DropdownCheckbox
                    selected={props.selectedNodeMetric === "lagging_time"}
                    label={"Lagging time"}
                    onClick={() => setNodeMetric("lagging_time")}
                    />
                }
                {props.extendedMetrics &&
                    <DropdownCheckbox
                    selected={props.selectedNodeMetric === "flow_time"}
                    label={"Flow time"}
                    onClick={() => setNodeMetric("flow_time")}
                    />
                }
                {props.extendedMetrics &&
                    <DropdownCheckbox
                    selected={props.selectedNodeMetric === "start_timestamp"}
                    label={"Start timestamp"}
                    onClick={() => setNodeMetric("start_timestamp")}
                    />
                }
                <DropdownCheckbox
                    selected={props.selectedNodeMetric === "timestamp"}
                    label={"Timestamp"}
                    onClick={() => setNodeMetric("timestamp")}
                />
                <DropdownCheckbox
                    selected={props.selectedNodeMetric === "lead_time"}
                    label={"Lead time"}
                    onClick={() => setNodeMetric("lead_time")}
                />
                <div className="VizSettings-Label" title={"Select which metric to display for edges."}>Edge metrics</div>
                <DropdownCheckbox
                    selected={props.selectedEdgeMetric === "object"}
                    label={"Objects"}
                    onClick={() => setEdgeMetric("object")}
                />
                {props.extendedMetrics &&
                    <DropdownCheckbox
                        selected={props.selectedEdgeMetric === "waiting_time"}
                        label={"Waiting time"}
                        onClick={() => setEdgeMetric("waiting_time")}
                    />
                }
                {props.extendedMetrics &&
                    <DropdownCheckbox
                        selected={props.selectedEdgeMetric === "pooling_time"}
                        label={"Pooling times"}
                        onClick={() => setEdgeMetric("pooling_time")}
                    />
                }
                <DropdownCheckbox
                    selected={props.selectedEdgeMetric === "elapsed_time"}
                    label={"Elapsed time"}
                    onClick={() => setEdgeMetric("elapsed_time")}
                />
            </NavbarDropdown>
            <NavbarDropdown buttonText={"Settings"} buttonIcon={faBrush} >
                <div className="VizSettings-Label" title={"Select the direction in which the graph is rendered."}>Graph direction</div>
                <DropdownCheckbox
                    selected={!props.graphHorizontal}
                    label="Top to down"
                    onClick={() => props.setGraphHorizontal(false)}/>
                <DropdownCheckbox
                    selected={props.graphHorizontal}
                    label="Left to right"
                    onClick={() => props.setGraphHorizontal(true)}/>
                <div className="VizSettings-Label" title={"Toggle for the infobox shown when clicking on edges or nodes."}>Infobox</div>
                <DropdownCheckbox
                    selected={props.infoboxEnabled}
                    label={props.infoboxEnabled ? "Enabled" : "Disabled"}
                    onClick={() => props.setInfoboxEnabled(!props.infoboxEnabled)}/>
            </NavbarDropdown>
        </React.Fragment>
    )
}

interface SelectionState {
    selectedNode: [number, string] | null,
    selectedEdge: [string, number, number, string, string] | null
}

export type NodePerformanceMetrics = {
    service_time: number
    waiting_time: number | null
    sojourn_time: number | null
    synchronization_time: number | null
    lagging_time: number | null
    pooling_times: {[key:string]: number}
    flow_time: number | null
    lead_time: number | null
}

export type EdgePerformanceMetrics = {
    [key:string]: { pooling_time: number, waiting_time: number, elapsed_time: number }
}

function InfoboxPerformanceMetrics(props: {
    metrics: NodePerformanceMetrics | EdgePerformanceMetrics | null,
    selection: { selectedNode: any },
    availableObjectTypes: string[] }) {
    if (!props.metrics)
        return <React.Fragment/>

    function AggregatedMetricRow(props: { metric: number | null, title: any }) {
        if (!props.metric && props.metric !== 0)
            return <React.Fragment/>

        return (
            <React.Fragment>
                <div className="Infobox-Metrics-Cell">
                    {props.title}
                </div>
                <div className="Infobox-Metrics-Cell">
                    {secondsToHumanReadableFormat(props.metric, 2)}
                </div>
                <div className="Infobox-Metrics-Cell">
                    {secondsToHumanReadableFormat(props.metric, 5)}
                </div>
            </React.Fragment>
        )
    }

    let metrics: JSX.Element
    if (props.selection.selectedNode) {
        const nodeMetric = props.metrics as NodePerformanceMetrics;
        const hasWaitingTime = !!nodeMetric.waiting_time;
        metrics = (
            <React.Fragment>
                <React.Fragment>
                    <div className="Infobox-Metrics-Cell Infobox-Metrics-Header">
                        Metric
                    </div>
                    <div className="Infobox-Metrics-Cell Infobox-Metrics-Header">
                        Value
                    </div>
                    <div className="Infobox-Metrics-Cell Infobox-Metrics-Header">
                        Full
                    </div>
                </React.Fragment>
                {/* <AggregatedMetricRow metric={nodeMetric.service_time} title="Service time"/> */}
                {
                    hasWaitingTime && (
                        <React.Fragment>
                            {/* <AggregatedMetricRow metric={nodeMetric.waiting_time} title="Waiting time"/> */}
                            <AggregatedMetricRow metric={nodeMetric.sojourn_time} title="Sojourn time"/>
                            <AggregatedMetricRow metric={nodeMetric.lead_time} title="Lead time"/>
                            <div className="Infobox-Metrics-Divider"/>
                            {/* <AggregatedMetricRow metric={nodeMetric.lagging_time} title="Lagging time"/> */}
                            <AggregatedMetricRow metric={nodeMetric.synchronization_time} title="Sync time"/>
                            {/* <AggregatedMetricRow metric={nodeMetric.flow_time} title="Flow time"/> */}
                            <div className="Infobox-Metrics-Divider"/>
                            <React.Fragment>
                                <div className="Infobox-Metrics-Cell Infobox-Metrics-Divider">
                                    Pooling time
                                </div>
                                {
                                    props.availableObjectTypes.map((objectType, index) => {
                                        const metric = nodeMetric.pooling_times[objectType];
                                        if (!metric && metric !== 0)
                                            return <React.Fragment />

                                        const color = getObjectTypeColor(props.availableObjectTypes.length, index);
                                        const metricTitle = (
                                            <React.Fragment>
                                                <div className="Legend-Circle" style={{backgroundColor: color}}>
                                                </div>
                                                {objectType}
                                            </React.Fragment>
                                        )

                                        return <AggregatedMetricRow metric={metric} title={metricTitle} key={`pooling-time-${objectType}`} />;
                                    })
                                }
                            </React.Fragment>
                        </React.Fragment>
                    )
                }
            </React.Fragment>)
    }
    else {
        const edgeMetrics = props.metrics as EdgePerformanceMetrics;
        metrics = (
            <React.Fragment>
                <React.Fragment>
                    <div className="Infobox-Metrics-Cell Infobox-Metrics-Header">
                        Metric
                    </div>
                    <div className="Infobox-Metrics-Cell Infobox-Metrics-Header">
                        Value
                    </div>
                    <div className="Infobox-Metrics-Cell Infobox-Metrics-Header">
                        Full
                    </div>
                </React.Fragment>
                <React.Fragment>
                    <div className="Infobox-Metrics-Cell Infobox-Metrics-Divider">
                        Pooling time
                    </div>
                    {
                        props.availableObjectTypes.map((objectType, index) => {
                            if (!edgeMetrics[objectType])
                                return <React.Fragment />;
                            const metric = edgeMetrics[objectType]["pooling_time"];
                            if (!metric && metric !== 0)
                                return <React.Fragment />

                            const color = getObjectTypeColor(props.availableObjectTypes.length, index);
                            const metricTitle = (
                                <React.Fragment>
                                    <div className="Legend-Circle" style={{backgroundColor: color}}>
                                    </div>
                                    {objectType}
                                </React.Fragment>
                            )

                            return <AggregatedMetricRow metric={metric} title={metricTitle} key={`pooling-time-${objectType}`} />;
                        })
                    }
                </React.Fragment>
                <React.Fragment>
                    <div className="Infobox-Metrics-Cell Infobox-Metrics-Divider">
                        Waiting time
                    </div>
                    {
                        props.availableObjectTypes.map((objectType, index) => {
                            if (!edgeMetrics[objectType])
                                return <React.Fragment />;
                            const metric = edgeMetrics[objectType]["waiting_time"];
                            if (!metric && metric !== 0)
                                return <React.Fragment />

                            const color = getObjectTypeColor(props.availableObjectTypes.length, index);
                            const metricTitle = (
                                <React.Fragment>
                                    <div className="Legend-Circle" style={{backgroundColor: color}}>
                                    </div>
                                    {objectType}
                                </React.Fragment>
                            )

                            return <AggregatedMetricRow metric={metric} title={metricTitle} key={`waiting_time-${objectType}`} />;
                        })
                    }
                </React.Fragment>
            </React.Fragment>)
    }
    return (
        <div className="Infobox-Metrics-Grid">
            {metrics}
        </div>
    )
}

type GraphProps = {
    ocel?: string,
    indices?: number[],
    integrated?: boolean,
    allAllowed: boolean,
    highlightObjects?: any,
    highlightEdges?: any,
    showRightSide?: boolean,
    showMetrics?: boolean,
}

const CollectedTimesNodes = [
    //'waiting_time',
    //'service_time',
    'sojourn_time',
    //'pooling_times',
    'synchronization_time',
    //'lagging_time',
    //'flow_time',
    //'start_timestamp',
    'timestamp',
    'lead_time'
]

const CollectedTimesEdges = [
    //'pooling_time',
    //'waiting_time',
    'elapsed_time'
]

export const Graph = (props: GraphProps) => {

    // TODO: change layouting algorithm if number of nodes/edges get too big, might even let user decide threshold?

    const possibleIndices = !props.allAllowed? localStorage.getItem('indices')?.split(",").map(value => Number(value)) : undefined;

    const {integrated = false, showRightSide = true} = props;

    const [elements, setElements] = useState<any[]>([]);
    const [objects, setObjects] = useState<any>({});
    const [metrics, setMetrics] = useState<any>({});
    const [selectedObjects, setSelectedObjects] = useState<string[]>([]);
    const [totalCount, setTotalCount] = useState<number>(0);
    const [showNodeInfo, setShowNodeInfo] = useState<boolean>(false);
    const [enableMetrics, setEnableMetrics] = useState<boolean>(props.showMetrics?? false);
    const [idActivityMapping, setIdActivityMapping] = useState<any>({});

    const [newElements, setNewElements] = useState<any[]>([]);
    const cytoscapeRef = useRef<cytoscape.Core | null>(null);

    const previousHighlightObjects = useRef({});
    const previousHighlightEdges = useRef({});

    //const allowedIndices: number[] = props.indices?? Array.from(Array(totalCount).keys());
    const allowedIndices: number[] = possibleIndices?? Array.from(Array(totalCount).keys());
    const numPages = Math.ceil(allowedIndices.length / MAX_GRID_SIZE);

    const [index, setIndex] = useState(allowedIndices.length !== 0? allowedIndices[0]: 0);
    const [userIndex, setUserIndex] = useState(allowedIndices.length !== 0? allowedIndices[0]: 0);

    const [allowRenderingOnce, setAllowRenderingOnce] = useState(false);
    const [toggleRightSide, setToggleRightSide] = useState(showRightSide);

    const [selectedNodeMetric, setSelectedNodeMetric] = useState("activity");
    const [selectedEdgeMetric, setSelectedEdgeMetric] = useState("object");

    const [infoboxEnabled, setInfoboxEnabled] = useState(true);
    const [graphHorizontal, setGraphHorizontal] = useState(false);

    const [currentGridPage, setCurrentGridPage] = useState(1);
    const [gridIndices, setGridIndices] = useState<number[]>(allowedIndices.slice(0,MAX_GRID_SIZE));

    useEffect(() => {
        if (gridIndices.length === 0 && currentGridPage === 1) {
            setGridIndices(allowedIndices.slice(0,MAX_GRID_SIZE));
        }
    }, [allowedIndices]);

    const setPage = (event: any, value: number) => {
        if (value >= 1 && numPages && value <= numPages){
            setCurrentGridPage(value);
            for (let i = 0; i < allowedIndices.length; i += MAX_GRID_SIZE) {
                if (((i / MAX_GRID_SIZE)+1) === value) {
                    const chunk = allowedIndices.slice(i, i + MAX_GRID_SIZE);
                    setGridIndices(chunk);
                    break;
                }
            }
        }
    }

    // The currently selected node or edge for the infobox.
    const [selection, setSelection] = useState<SelectionState>({
        selectedNode: null,
        selectedEdge: null
    });

    function onNodeTap(event: EventObject) {
        setSelection({
            selectedNode: [event.target.data().numberId, event.target.data().event_activity],
            selectedEdge: null
        });
    }

    function onEdgeTap(event: EventObject) {
        const edgeData: { objectType: string, sourceId: number, targetId: number } = event.target.data();
        setSelection({
            selectedNode: null,
            selectedEdge: [
                edgeData.objectType,
                edgeData.sourceId,
                edgeData.targetId,
                idActivityMapping[edgeData.sourceId],
                idActivityMapping[edgeData.targetId]
            ]
        });
    }

    function registerCytoscapeRef(cy: cytoscape.Core) {
        cytoscapeRef.current = cy;

        cy.on('tap', "node", (event: EventObject) => onNodeTap(event));
        cy.on('tap', 'edge', (event: EventObject) => onEdgeTap(event));
    }

    const hasSelectedObject = selection.selectedNode !== null || selection.selectedEdge !== null;

    useEffect(() => {
        // This is true when the indices given changed but the currently selected index is not part anymore
        if (props.indices?.indexOf(index) === -1){
            setUserIndex(props.indices[0]);
        } else if (props.indices?.length === 0){
            setUserIndex(-1);
            setObjects([]);
        }
    }, [props])

    const handleNodeInfoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setShowNodeInfo(event.target.checked);
    };

    const handleEnableMetricsChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setEnableMetrics(event.target.checked);
    };

    function changeNumber(number: string){
        if (!isNaN(Number(number))){
            const num = Number(number);
            if (checkIndex(num))
                setUserIndex(Number(number));
        }
    }

    function checkIndex(number: number){
        //if (totalCount === 0 && number !== 0)
        //    updateTotalCount();
        return number >= 0 && number <= totalCount - 1 && allowedIndices.indexOf(number) > -1;
    }

    function getNextIndex(number: number){
        const index = allowedIndices.indexOf(number);
        if (index < allowedIndices.length-1)
            return allowedIndices[index+1];
        else
            return number;
    }

    function getLastIndex(number: number){
        const index = allowedIndices.indexOf(number);
        if (index > 0)
            return allowedIndices[index-1];
        else
            return number;
    }

    useEffect(() => {
        const timeout = setTimeout(() => {
            setIndex(userIndex);
        }, 500);
        return () => {
            clearTimeout(timeout);
        };
    }, [userIndex]);

    function updateTotalCount(){
        // if (props.indices) return;
        const newTotalCount = getPECount();
        newTotalCount.then((result) => {
            setTotalCount(result);
        })
    }

    useEffect(() => {
        updateTotalCount();
    }, [props.ocel]);

    useEffect(() => {
        if ((props.indices && props.indices.indexOf(index) === -1))
            return;
        const newElements = getGraph(index);
        newElements.then((results) => {
            setElements([results]);
            const newObjects = getObjectsOfExecution(index);
            newObjects.then((results) => {
                if ("ANY" in results) {
                    setObjects({"ANY": results["ANY"]});
                } else
                    setObjects(results);
                if (enableMetrics) {
                    const performanceMetrics = getPerformanceMetrics(index);
                    performanceMetrics.then((results) => {
                        setMetrics(results);
                    })
                } else {
                    setMetrics({});
                }
                const activityMapping = getActivityMapping();
                activityMapping.then((results) => {
                    setIdActivityMapping(results);
                })
            });
            setAllowRenderingOnce(false);
        });
    }, [index]);

    // Initialize selected objects whenever objects changes
    useEffect(() => {
        setSelectedObjects(flattenObjects(objects));
    }, [objects])

    const layout = {
        name: 'elk',
        spacingFactor: 1,
        elk: {
            'algorithm': 'layered',
            'elk.direction': graphHorizontal? 'RIGHT' : 'DOWN',
            'spacing.portsSurrounding': 20,
            "spacing.nodeNodeBetweenLayers": 100,
        }
    }

    const handleObjectChange = (event: SelectChangeEvent<typeof selectedObjects>) => {
        const {
            target: {value}
        } = event;
        setSelectedObjects(typeof value === 'string' ? value.split(",") : value);
    }

    const handleDblClick = (name: string) => {
        setSelectedObjects([name]);
    }

    const nodeLimit = localStorage.getItem("node-limit")? parseInt(localStorage.getItem("node-limit")?? "") : 100;
    const edgeLimit = localStorage.getItem("edge-limit")? parseInt(localStorage.getItem("edge-limit")?? "") : 100;

    function updateElements(){
        let highlightedObjects = new Set();
        let highlightedEdges = new Set();
        if (props.highlightObjects && index in props.highlightObjects){
            props.highlightObjects[index].forEach((objects: any) => {
                objects.forEach((obj: any) => {
                    if (typeof obj === "string") return;
                    obj[1].forEach((item: any) => highlightedObjects.add(item));
                })
            })
        }
        if (props.highlightEdges && index in props.highlightEdges){
            props.highlightEdges[index].forEach((objects: any) => {
                objects.forEach((obj: any) => {
                    obj[1].forEach((item: any) => highlightedEdges.add(item.toString()));
                })
            })
        }
        if (elements.length === 0 || !elements[0].elements) return;
        const nodes: any[] = elements[0]["elements"]["nodes"];
        const edges: any[] = elements[0]["elements"]["edges"];
        let filteredNodes: any[] = [];
        let filteredEdges: any[] = [];
        const currentSelectedObjects = selectedObjects;
        nodes.forEach((initElement: any) => {
            let element = JSON.parse(JSON.stringify(initElement));
            const nodeId = element["data"]["id"];
            const filteredObjects = element["data"]["objects"].filter((obj: string) => {
                return currentSelectedObjects.indexOf(obj) >= 0;
            })
            if (filteredObjects.length !== 0) {
                element["data"]["objects"] = filteredObjects;
                if (highlightedObjects.has(element["data"]["value"]))
                    element["data"]["color"] = "orange";
                else
                    element["data"]["color"] = "rgb(25, 118, 210)";
                let currentLabel;
                if (element["data"]["label"].lastIndexOf("(") !== -1)
                    currentLabel = element["data"]["label"].substring(0, element["data"]["label"].lastIndexOf("(")-1);
                else {
                    currentLabel = element["data"]["label"];
                }
                if (showNodeInfo) {
                    element["data"]["label"] = currentLabel +  " (" + filteredObjects + ")";
                } else {
                    element["data"]["label"] = currentLabel;
                }
                if (enableMetrics && Object.keys(metrics).length !== 0 && "nodes" in metrics) {
                    if (nodeId in metrics["nodes"]) {
                        CollectedTimesNodes.forEach((metric) => {
                            element["data"][metric] = metrics["nodes"][nodeId][metric];
                        })
                        element["data"]["objectType"] = Object.keys(metrics["nodes"][nodeId]["pooling_times"]);
                    }
                    if (selectedNodeMetric !== DEFAULT_NODE_METRIC) {
                        element["data"]["label"] = currentLabel +  " (" + secondsToHumanReadableFormat(element["data"][selectedNodeMetric], 2) + ")";
                    }
                }
                filteredNodes.push(Object.assign({}, element));
            }
        })
        edges.forEach((initElement: any) => {
            let element = JSON.parse(JSON.stringify(initElement));
            const edgeSource = element["data"]["source"];
            const edgeTarget = element["data"]["target"];
            if (highlightedEdges.has(edgeSource + "," + edgeTarget))
                element["data"]["color"] = "orange";
            else
                element["data"]["color"] = "grey";
            const filteredObjects = element["data"]["objects"].filter((obj: string) => {
                return currentSelectedObjects.indexOf(obj) >= 0;
            })
            if (filteredObjects.length !== 0) {
                element["data"]["objects"] = filteredObjects;
                element["data"]["label"] = filteredObjects;
                if (enableMetrics && Object.keys(metrics).length !== 0 && "edges" in metrics) {
                    if (edgeSource in metrics["edges"] && edgeTarget in metrics["edges"][edgeSource]) {
                        CollectedTimesEdges.forEach((metric) => {
                                let edgeMetrics = metrics["edges"][edgeSource][edgeTarget];
                                let objTypes = Object.keys(edgeMetrics);
                                let etIndex = objTypes.indexOf("elapsed_time", 0);
                                if (etIndex > -1)
                                    objTypes.splice(etIndex, 1);
                                let newMetric: { [id: string]: number} = {}
                                objTypes.forEach((type: string) => {
                                    newMetric[type] = edgeMetrics[type][metric]
                                })
                                element["data"][metric] = newMetric;
                                element["data"]["objectType"] = objTypes;
                        })
                    }
                    if (selectedEdgeMetric !== DEFAULT_EDGE_METRIC && element["data"][selectedEdgeMetric] !== undefined) {
                        element["data"]["label"] = getEdgeMetricLabel(element["data"][selectedEdgeMetric]);
                    }
                }
                filteredEdges.push(element);
            }
        })
        let newElement = JSON.parse(JSON.stringify(elements));
        newElement[0]["elements"]["nodes"] = filteredNodes;
        newElement[0]["elements"]["edges"] = filteredEdges;
        setNewElements(CytoscapeComponent.normalizeElements({nodes: newElement[0]["elements"]["nodes"], edges: newElement[0]["elements"]["edges"]}))
    }

    useEffect(() => {
        setPage(null,1);
    }, [props.indices])

    useEffect(() => {
        if (JSON.stringify(previousHighlightObjects.current) === JSON.stringify(props.highlightObjects) &&
            JSON.stringify(previousHighlightEdges.current) === JSON.stringify(props.highlightEdges) &&
            newElements.length !== 0 && elements[0]["elements"]["nodes"].length + elements[0]["elements"]["edges"].length === newElements.length){
            return;
        } else {
            previousHighlightEdges.current = props.highlightEdges;
            previousHighlightObjects.current = props.highlightObjects;
        }
        updateElements();
    }, [props, elements]);

    useEffect(() => {
        setEnableMetrics(props.showMetrics?? false);
    }, [props.showMetrics]);

    useEffect(() => {
        if (enableMetrics && Object.keys(metrics).length === 0) {
            const performanceMetrics = getPerformanceMetrics(index);
            performanceMetrics.then((results) => {
                setMetrics(results);
                updateElements();
            })
        } else {
            updateElements();
        }
    }, [selectedObjects, showNodeInfo, enableMetrics, metrics, selectedNodeMetric, selectedEdgeMetric]);

    const selectedPerformanceMetrics: NodePerformanceMetrics | EdgePerformanceMetrics | null = useMemo(() => {
        let performanceMetrics: EdgePerformanceMetrics | NodePerformanceMetrics | null = null;
        if (Object.keys(metrics).length !== 0) {
            if (selection.selectedNode) {
                performanceMetrics = metrics["nodes"][selection.selectedNode[0]];
            } else if (selection.selectedEdge) {
                performanceMetrics = metrics["edges"][selection.selectedEdge[1]][selection.selectedEdge[2]]
            }
        }
        return performanceMetrics;
    }, [metrics, selection]);

    const integratedNavbarItems = (
        <React.Fragment>
            <DropdownSettings
                selectedNodeMetric={selectedNodeMetric}
                setSelectedNodeMetric={setSelectedNodeMetric}
                selectedEdgeMetric={selectedEdgeMetric}
                setSelectedEdgeMetric={setSelectedEdgeMetric}
                graphHorizontal={graphHorizontal}
                setGraphHorizontal={setGraphHorizontal}
                infoboxEnabled={infoboxEnabled}
                setInfoboxEnabled={setInfoboxEnabled}
                showNodeInfo={showNodeInfo}
                setShowNodeInfo={setShowNodeInfo}
            />
            <ObjectSelection
                availableObjectTypes={flattenObjects(objects).sort()}
                selectedObjectTypes={selectedObjects}
                setSelectedObjectTypes={setSelectedObjects}
                selectAllObjectTypesInitially={true}
                alreadySelectedAllObjectTypesInitially={true}
            />
        </React.Fragment>
    )

    const navbarItems = (
        <React.Fragment>
            <Stack direction={"row"} spacing={5} sx={{mr: 50}}>
                <div>
                    Selected Node Label: {selectedNodeMetric}
                </div>
                <div>
                    Selected Edge Label: {selectedEdgeMetric}
                </div>
            </Stack>
            {integratedNavbarItems}
        </React.Fragment>
    )

    return (
        <>
            {!integrated && <OCPQNavbar lowerRowSlot={navbarItems}></OCPQNavbar>}
            {integrated &&
                <IntegratedNavbar lowerRowSlot={integratedNavbarItems} />
            }
            {elements.length !== 0 && elements[0].elements &&
                <>
                    {(elements[0].elements.edges.length <= edgeLimit && elements[0].elements.nodes.length <= nodeLimit && newElements.length <= edgeLimit + nodeLimit) || allowRenderingOnce?
                        <CytoscapeComponent
                            elements={[...newElements]}
                            style={ { width:
                                    !integrated? (showRightSide && toggleRightSide)? '80vw' : '100vw' :
                                        !(showRightSide && toggleRightSide)? '100%' : '66%',
                                    height: !integrated? '88.5vh' : '100%', textAlign: "initial" } }
                            stylesheet={graphStylesheet}
                            wheelSensitivity={0.2}
                            layout={layout}
                            cy={registerCytoscapeRef}
                        /> :
                        <div style={ { width:
                                !integrated? (showRightSide && toggleRightSide)? '78vw' : '97vw':
                                    !(showRightSide && toggleRightSide)? '100%' : '66%',
                                    height: !integrated? '88.5vh' : '100%' } }>
                            <Typography variant={"h5"} sx={{textAlign: "center", alignItems: "center"}}>
                                Your current node/edge limit settings do not allow this process execution to be rendered.
                                Either increase the limits in the settings or allow the rendering for this process execution once.
                            </Typography>
                            <Button onClick={() => setAllowRenderingOnce(true)}>
                                Allow once
                            </Button>
                        </div>
                    }
                </>
            }
            {infoboxEnabled && hasSelectedObject && enableMetrics &&
                <div className="Overlay Infobox">
                    <div className="Infobox-Header">
                        {
                            selection.selectedNode !== null &&
                            <h3>
                                Activity: {selection.selectedNode[1]}
                            </h3>
                        }
                        {
                            selection.selectedEdge !== null &&
                            <h3 className="Infobox-Header">
                                Edge: {selection.selectedEdge[3]} to {selection.selectedEdge[4]}
                            </h3>
                        }
                        <div className="Infobox-Header-Close"
                             onClick={() => setSelection({selectedNode: null, selectedEdge: null})}>
                            <FontAwesomeIcon icon={faCircleXmark as IconProp}/>
                        </div>
                    </div>

                    <InfoboxPerformanceMetrics metrics={selectedPerformanceMetrics}
                                               selection={selection}
                                               availableObjectTypes={["item", "order", "delivery"]}/>

                </div>
            }
            {showRightSide &&
                <>
                    <IconButton sx={integrated?
                                    {position: "relative", left: "47%", bottom: "100%"} :
                                    (showRightSide && toggleRightSide)?
                                        {position: "absolute", left: "78%", bottom: "49rem"} :
                                        {position: "absolute", left: "98%", bottom: "49rem"}}
                                onClick={() => setToggleRightSide(!toggleRightSide)}>
                        <ExpandCircleDownIcon sx={{transform: `rotate(${!toggleRightSide? "90": "270"}deg)`}}/>
                    </IconButton>
                    {toggleRightSide &&
                        <div style={!integrated ? {position: 'absolute', left: '80vw', top: '10vh', width: '19%'} : {
                            position: "relative",
                            left: "68%",
                            bottom: "48rem",
                            width: "30%"
                        }}>
                            <TextField
                                label={"Index"}
                                value={userIndex}
                                size={"small"}
                                sx={{marginTop: '1rem', width: "50%"}}
                                onChange={(evt: React.ChangeEvent<HTMLInputElement>) => {
                                    changeNumber(evt.target.value);
                                }}
                            />
                            <IconButton onClick={() => {
                                changeNumber('' + getNextIndex(userIndex))
                            }} sx={{marginTop: '0.9rem'}}>
                                <AddCircleOutlineIcon/>
                            </IconButton>
                            <IconButton onClick={() => {
                                changeNumber('' + getLastIndex(userIndex))
                            }} sx={{marginTop: '0.9rem'}}>
                                <RemoveCircleOutlineIcon/>
                            </IconButton>
                            <div>
                                Maximum: {totalCount - 1}
                            </div>
                            <div>
                                Enable performance metrics:
                                <Switch
                                    checked={enableMetrics}
                                    onChange={handleEnableMetricsChange}
                                />
                            </div>
                            <Box sx={{flexGrow: 1, marginTop: '1rem', maxHeight: integrated? "40vh": "51vh", overflow: 'auto'}}>
                                <Grid
                                    container
                                    spacing={{xs: 1, md: 1}}
                                    columns={{xs: 4, sm: 8, md: 30}}
                                >
                                    {gridIndices.map((value, idx) => (
                                        <Grid item xs>
                                            <IconButton
                                                onClick={() => {
                                                    setIndex(Number(value));
                                                    setUserIndex(Number(value));
                                                }}
                                                sx={{
                                                    width: "2.5rem",
                                                    height: "2.5rem",
                                                    border: "0.1rem solid",
                                                    borderRadius: "1rem",
                                                    backgroundColor: index === value? "green": "",
                                                    color: index === value? "white": "",
                                                    //fontSize: `${200 / (value.toString().length)}%`
                                                    fontSize: `1vw`
                                                }}
                                            >
                                                {value}
                                            </IconButton>
                                        </Grid>
                                    ))}
                                </Grid>
                            </Box>
                            {allowedIndices.length > MAX_GRID_SIZE &&
                                <Box sx={{flexGrow: 1, marginTop: '1rem', overflow: 'auto'}}>
                                    <Stack direction="row" justifyContent="center">
                                        Page
                                        <TextField
                                            variant={"standard"}
                                            size={"small"}
                                            sx={{width: "15%", bottom: '0.2rem', marginLeft: '0.5rem', marginRight: '0.5rem'}}
                                            value={currentGridPage}
                                            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                                let num = parseInt(event.target.value);
                                                if (isNaN(num)) {
                                                    num = 1;
                                                }
                                                setPage(event, num);
                                            }}
                                        />
                                        of {numPages}.
                                    </Stack>
                                    <Stack direction="row" justifyContent="center">
                                        <Pagination
                                            count={numPages}
                                            page={currentGridPage}
                                            onChange={setPage}
                                        />
                                    </Stack>
                                </Box>
                            }
                        </div>
                    }
                </>

            }
        </>
    );
}

const flattenObjects = (objects: any) => {
    let allObjects: any[] = [];
    let key: keyof typeof objects;
    for (key in objects) {
        const value = objects[key];
        allObjects.push(...value);
    }
    return allObjects
}