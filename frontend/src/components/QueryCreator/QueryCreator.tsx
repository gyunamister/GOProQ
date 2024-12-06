import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import "./QueryCreator.css";
import "../Session/Session.css";
import {CustomTooltip, QuerySelect} from "../Query/Query";
import ReactFlow, {
    ReactFlowProvider,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    Connection,
    Edge, Node, ReactFlowInstance, MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import {ActivityNode, ObjectNode, ObjectTypeNode, OrNode, SingleOrNode} from "./Nodes";
import {DirectlyFollowsEdge, EventuallyFollowsEdge, EdgeDialog, OrEdge} from "./Edges";
import Button from "@mui/material/Button";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
    faSave, faDownload, faBroom, faCopy, faTrash, faClose, faPaste, faTimes
} from "@fortawesome/free-solid-svg-icons";
import {
    IconButton,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
    Box,
    TextField,
    CircularProgress
} from "@mui/material";
import {
    extractBeforeContent,
    extractPContent,
    getURI,
    translateEdgeName,
    translateQueryName,
    extractPerfContent
} from "../utils";
import ReactDataGrid from "@inovua/reactdatagrid-community";
import { TypeDataSource } from '@inovua/reactdatagrid-community/types';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import ContentCopy from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ImportExportIcon from '@mui/icons-material/ImportExport';
import SpeedIcon from '@mui/icons-material/Speed';
import CytoscapeComponent from "react-cytoscapejs";
import SplitPane from "react-split-pane";
import Pane from "react-split-pane";
import cytoscape from "cytoscape";
import {Graph} from "../Graph/Graph";
import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import {faDiagramProject} from "@fortawesome/free-solid-svg-icons";
import VisibilityIcon from '@mui/icons-material/Visibility';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import PlayCircleFilledWhiteOutlinedIcon from '@mui/icons-material/PlayCircleFilledWhiteOutlined';
import Snackbar from '@mui/material/Snackbar';
import MuiAlert, { AlertProps } from '@mui/material/Alert';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import KeyboardDoubleArrowLeftIcon from '@mui/icons-material/KeyboardDoubleArrowLeft';
import KeyboardDoubleArrowRightIcon from '@mui/icons-material/KeyboardDoubleArrowRight';
import HorizontalAlignCenterIcon from "@mui/icons-material/VerticalAlignCenter";
import {Settings} from "../Settings/Settings";
import InfoIcon from "@mui/icons-material/Info";
import {PaperComponent} from "../Query/Query";
import {RuntimeLog, Run} from "../Settings/RuntimeLog";
import {Wildcards} from "../Settings/Wildcards";

const flowKey = 'query-flow';

const nodeTypes = {
    orNode: OrNode,
    singleOrNode: SingleOrNode,
    activityNode: ActivityNode,
    objectNode: ObjectNode,
    objectTypeNode: ObjectTypeNode,
};

const edgeTypes = {
    eventuallyFollowsEdge: EventuallyFollowsEdge,
    directlyFollowsEdge: DirectlyFollowsEdge,
    orEdge: OrEdge,
};

const defaultViewport = { x: 0, y: 0, zoom: 1.5 };

export type QueryType = {
    event_activity?: string,
    first_activity?: string,
    second_activity?: string,
    object_type?: string,
    first_type?: string,
    second_type?: string,
    p?: number,
    p_operator?: string,
    p_mode?: string,
    quantifier?: string,
    query?: string,
    n?: number,
    n_operator?: string,
    needed_objects?: string[],
    boolean_operator?: string,
    firstNodeId?: string,
    secondNodeId?: string,
    node_metric?: string,
    node_metric_value?: any,
    node_metric_operator?: string,
    edge_metric?: string,
    edge_metric_value?: any,
    edge_metric_operator?: string,
}

const graphStylesheet: cytoscape.Stylesheet[] = [
    {
        "selector": 'node',  // For all nodes
        'style':
            {
                "opacity": 0.9,
                "label": "data(label)",  // Label of node to display
                "background-color": "data(backgroundColor)",  // node color
                "color": "#FFFFFF",  // node label color
                "text-halign": "center",
                "text-valign": "center",
                'width': 'label',
                "shape": "round-rectangle",
                "padding-left": ".5em"
            }
    },
    {
        "selector": 'object',  // For all nodes
        'style':
            {
                "opacity": 0.9,
                "label": "data(label)",  // Label of node to display
                "background-color": "data(backgroundColor)",  // node color
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

type QueryCreatorProps = {
    onClose: any,
    onQueryChange: any,
    nodes: Node[],
    edges: Edge[],
    name: string,
    onNodesInit?: any,
    onEdgesInit?: any,
}
const clearCanvasText = (
    <React.Fragment>
        <p>
            This button clears the whole canvas including all nodes, edges and saved state data.
        </p>
        <p>
            Only press yes, if you know what you are doing.
        </p>
    </React.Fragment>
)

const clearCanvasTitle = "Do you really want to clear the whole canvas?";

export let usedObjectTypes: any[] = [];

type CytoscapeElement = {
    nodes: any[],
    edges: any[],
}

function getNodeLabel(label: string, query: QueryType){
    const prefix = query.query
    if (prefix === "isStart")
        return "Start: " + label
    if (prefix === "isEnd")
        return "End: " + label
    return label
}

function createObjects(objectType: string, query: QueryType){
    const numObjects = query.p_mode === "absolute"? query.p?? 1 : 1;
    let objects = [];
    for (let i = 0; i < numObjects; i++){
        objects.push(objectType + i);
    }
    return objects;
}

export function QueryCreator(props: QueryCreatorProps) {
    const [query, setQuery] = useState({});
    const [numKeys, setNumKeys] = useState(0);

    const [open, setOpen] = useState(false);
    const [clearCanvasOpen, setClearCanvasOpen] = useState(false);
    const [copyOpen, setCopyOpen] = useState(false);
    const [pasteOpen, setPasteOpen] = useState(false);

    const [params, setParams] = useState<Edge<any> | Connection>();

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [rfInstance, setRfInstance] = useState<ReactFlowInstance>();

    const [cytoscapeElement, setCytoscapeElements] = useState<CytoscapeElement>({nodes: [], edges: []});

    const [position, setPosition] = useState({x: 0, y: 0});
    const [clickedNode, setClickedNode] = useState<Node>();
    const [nodeContextMenuOpen, setNodeContextMenuOpen] = useState(false);
    const [navValue, setNavValue] = useState<string>("live");

    const [queryIndices, setQueryIndices] = useState<number[]>([-1]);
    const [snackBarOpen, setSnackBarOpen] = useState(false);
    const [snackBarAlert, setSnackBarAlert] = useState<any>(<></>);

    const [sizes, setSizes] = useState(['50%', '50%']);
    const [isInitialSize, setIsInitialSize] = useState(false);

    const [highlightObjects, setHighlightObjects] = useState<any[]>([]);
    const [highlightEdges, setHighlightEdges] = useState<any[]>([]);

    const [liveIndices, setLiveIndices] = useState<number[]>([-1]);
    const [liveHighlightObjects, setLiveHighlightObjects] = useState<any[]>([]);
    const [liveHighlightEdges, setLiveHighlightEdges] = useState<any[]>([]);
    const [liveReload, setLiveReload] = useState<boolean>(false);
    const [liveQueryingEnabled, setLiveQueryingEnabled] = useState<boolean>(true);
    const [isLiveQuerying, setIsLiveQuerying] = useState<boolean>(false);

    const [runs, setRuns] = useState<Run[]>([]);
    const [wildcards, setWildcards] = useState<any[]>([]);
    const [liveQueryMetrics, setLiveQueryMetrics] = useState<boolean>(false);

    const ocel = localStorage.getItem("ocel");

    const cytoscapeRef = useRef<cytoscape.Core | null>(null);

    useEffect(() => {
        if (liveReload && liveQueryingEnabled) {
            executeLiveQuery(true);
            setLiveReload(false);
        }
        setLiveReload(false);
    }, [liveReload])

    useEffect(() => {
        // TODO: implement some way to check whether nodes/edges really changed or only position
        props.onQueryChange(nodes, edges);
        if (nodes.length === 0){
            setSizes((currSizes) => ['100%', currSizes[1]]);
            setIsInitialSize(true);
        } else if (isInitialSize) {
            setIsInitialSize(false);
            setSizes((currSizes) => ['50%', currSizes[1]]);
        }
        // Nodes:
        // Need event_activity, id, label (== event_activity), name (== id), objects, value (== id as int?)
        const cytoscapeNodes = nodes.map((node) => {
            return {
                data: {
                    event_activity: node.data.label,
                    //label: getNodeLabel(node.data.label, node.data.query),
                    label: getNodeLabel(node.data.label, node.data.query) + " (" + createObjects(node.data.objectType, node.data.query) + ")",
                    id: node.id,
                    name: node.id,
                    value: parseInt(node.id),
                    objects: createObjects(node.data.objectType, node.data.query),
                    backgroundColor: node.data.query.boolean_operator? "red" : "rgb(25, 118, 210)",
                },
                classes: "node"
            }
        });
        // Edges:
        // Need id, label, objects (label == objects), source, target
        const cytoscapeEdges = edges.map((edge) => {
            return {
                data: {
                    id: edge.id,
                    label: edge.data.query.query,
                    color: edge.data.query.boolean_operator? "red": "",
                    objects: [""],
                    source: edge.source,
                    target: edge.target
                },
                classes: "edge"
            }
        });
        setCytoscapeElements({
            edges: cytoscapeEdges,
            nodes: cytoscapeNodes
        })
    }, []);

    useEffect(() => {
        let newUsedObjectTypes: any[] = []
        nodes.forEach((node) => {
            newUsedObjectTypes.push(node.data.objectType);
        })
        usedObjectTypes = newUsedObjectTypes;
    }, [nodes]);

    useEffect(() => {
        props.onQueryChange(nodes, edges);
    }, [nodes, edges]);

    //const { setViewport } = useReactFlow();

    // Disable automatic restore for development since it restores each time that code is reloaded
    useEffect(() => {
        if (nodes.length === 0 && edges.length === 0) {
            onRestore(props.name);
        }
    }, []);

    const onConnect = (params: Edge<any> | Connection) => {
        setParams(params);
        console.log(params)
        // This is only the case when connecting to an OR-Split or connecting away from an OR-Join
        // Since this edge does not contain any query information, we skip the selection
        if (params.targetHandle === "t"){
            // When executing the query later on, we need the source of the orEdge to execute
            // the right side of the orNode. Here, we set the event_activity to be used later on.
            let activity = "";
            let objType = "";
            nodes.forEach((node) => {
                if (node["id"] == params.source) {
                    activity = node["data"]["query"]["event_activity"];
                    objType = node["data"]["query"]["object_type"];
                }
            })
            setNodes((nds) => nds.map((node) => {
                if (node.id === params.target) {
                    node.data.query = {
                        ...node.data.query,
                        event_activity: activity,
                        object_type: objType,
                        type: "Split",
                        nextNodeId: params.target,
                        lastNodeId: params.source
                    };
                }
                return node;
            }))
            onManualAddEdge("orEdge",
                {
                    query: "OR-Split",
                    event_activity: activity,
                    object_type: objType,
                    firstNodeId: params.source,
                    secondNodeId: params.target
                }, params);
        }
        else if (params.sourceHandle === "s") {
            // When executing the query later on, we need the target of the orEdge to execute
            // the left side of the orNode. Here, we set the event_activity to be used later on.
            let activity = "";
            let objType = "";
            nodes.forEach((node) => {
                if (node["id"] == params.target) {
                    activity = node["data"]["query"]["event_activity"];
                    objType = node["data"]["query"]["object_type"];
                }
            })
            setNodes((nds) => nds.map((node) => {
                if (node.id === params.source) {
                    node.data.query = {
                        ...node.data.query,
                        event_activity: activity,
                        object_type: objType,
                        type: "Join",
                        nextNodeId: params.target,
                        lastNodeId: params.source
                    };
                }
                return node;
            }))
            onManualAddEdge("orEdge",
                {
                    query: "OR-Join",
                    event_activity: activity,
                    object_type: objType,
                    firstNodeId: params.source,
                    secondNodeId: params.target
                }, params);
        // When connecting to a single OR
        } else if(params.sourceHandle === "or1" || params.sourceHandle === "or2") {
            onManualAddEdge("orEdge", {query: "OR"}, params);
        } else {
            setOpen(true);
        }
    }

    const resetAll = () => {
        setNodes([]);
        setEdges([]);
        setNumKeys(0);
        setQuery({});
    }

    const clearCanvasDialog = useMemo(() => {
        return confirmationDialog(clearCanvasOpen, setClearCanvasOpen, clearCanvasText, clearCanvasTitle, resetAll);
    }, [clearCanvasOpen, clearCanvasText, clearCanvasTitle])

    function propagateNegationToNodes(params: any){
        setNodes((nds) => nds.map((node) => {
            if (node.id === params.target) {
                node.data = {
                    ...node.data,
                    negated: true,
                };
            }

            return node;
        }))
    }

    const onRestoreEdges = (edges: Edge[], idMapping: { [key: string]: string} = {}) => {
        let newEdges: any[];
        let orEdges: Edge[] = [];
        const idMappingFlag = Object.keys(idMapping).length !== 0;
        newEdges = edges.map((edge: Edge) => {
            let newID = edge.id;
            let newSource = edge.source;
            let newTarget = edge.target;
            if (idMappingFlag) {
                newSource = idMapping[edge.source];
                newTarget = idMapping[edge.target];
                newID = "edge" + newSource + "-" + newTarget;
            }
            if (edge.type === "orEdge") {
                orEdges.push({...edge, source: newSource, target: newTarget, id: newID})
                return;
            }
            if (edge.data.query.boolean_operator === "NOT"){
                propagateNegationToNodes(edge);
            }
            const newQuery = {
                ...edge.data.query,
                firstNodeId: newSource,
                secondNodeId: newTarget,
            }
            return {
                ...edge,
                id: newID,
                source: newSource,
                target: newTarget,
                sourceHandle: edge.sourceHandle?? '',
                targetHandle: edge.targetHandle?? '',
                data: {
                    onDelete: () => deleteEdgeById(newID),
                    onQueryChange: (query: QueryType) => {changeEdge(
                        query,
                        {source: newSource, target: newTarget, sourceHandle: edge.sourceHandle, targetHandle: edge.targetHandle},
                        edge.data.query.query,
                        newID)},
                    onAddOrNode: () => {onAddOrNode(numKeys)},
                    query: newQuery,
                    pContent: edge.data.pContent,
                    perfContent: edge.data.perfContent,
                    beforeContent: edge.data.beforeContent,
                }
            }
        }).filter((edge) => {
            return edge !== undefined;

        })
        setEdges(idMappingFlag? (egs) => egs.concat(newEdges) : newEdges);
        orEdges.forEach((edge) => {
            onConnect(edge);
        })
        !idMappingFlag && typeof props.onEdgesInit === 'function' && props.onEdgesInit(newEdges);
    }

    const onRestoreNodes = (nodes: Node[], newIDFlag: boolean = false) => {
        let newNodes: any[];
        let counts: number[] = [0];
        let idMapping: { [key: string]: string} = {};
        const rmX = getRightmostNodePosition();
        newNodes = nodes.map((node: Node, index: number) => {
            let newID = node.id;
            if (newIDFlag) {
                newID = '' + (numKeys + index);
                idMapping[node.id] = newID;
            }
            counts.push(parseInt(newID));
            return {
                ...node,
                id: newID,
                position: {
                    //x: newIDFlag? (numKeys + index)*300 : node.position.x,
                    x: newIDFlag? rmX+node.position.x : node.position.x,
                    y: node.position.y?? 300,
                },
                data: {
                    label: node.data.label,
                    beforeContent: node.data.beforeContent,
                    objectType: node.data.objectType,
                    pContent: node.data.pContent,
                    perfContent: node.data.perfContent,
                    onDelete: () => deleteNodeById(newID, false),
                    query: node.data.query,
                    onQueryChange: (query: QueryType) => {changeNode(query, node.id)},
                }
            }
        })
        setNodes(newIDFlag? (nds) => nds.concat(newNodes) : newNodes);
        !newIDFlag && typeof props.onNodesInit === 'function' && props.onNodesInit(newNodes);
        setNumKeys(Math.max(...counts)+1);
        return idMapping;
    }

    useEffect(() => {
        setEdges(egs => egs.map((edge) => {
            return {...edge, data: {...edge.data, onAddOrNode: () => {onAddOrNode(numKeys)}}}
        }));
    }, [numKeys]);

    const onManualAddEdge = (type: string, query: any,
                             params: {source: string | null, target: string | null, sourceHandle?: string | null, targetHandle?: string | null}) => {
        if (!params) return;
        const id = 'edge' + params.source + '-' + params.target;
        const color = query.boolean_operator === "NOT"? {color: "red"}: {}
        const newEdge = {
            id: id,
            source: params.source?? '',
            target: params.target?? '',
            sourceHandle: params.sourceHandle?? '',
            targetHandle: params.targetHandle?? '',
            type: type,
            markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20,
                ...color
            },
            data: {
                onDelete: () => deleteEdgeById(id),
                onQueryChange: (query: QueryType) => {changeEdge(query, params, translateQueryName(type), id)},
                onAddOrNode: () => {onAddOrNode(numKeys)},
                query: {query: translateQueryName(type), ...query, firstNodeId: params.source, secondNodeId: params.target},
                pContent: extractPContent(query.query?? "", query.p_operator ?? "gte", query.p ?? 1.0, query.p_mode?? "relative"),
                beforeContent: extractBeforeContent(query.query?? "", query.n_operator ?? "gte", query.n ?? 1),
                perfContent: extractPerfContent(query.edge_metric?? "", query.edge_metric_operator?? "gte", query.edge_metric_value?? 0),
            }
        }
        setEdges(egs => egs.concat(newEdge));
        setOpen(false);
        if (query.boolean_operator === "NOT"){
            propagateNegationToNodes(params);
        }
        setLiveReload(true);
    }

    const onSave = useCallback((name: string) => {
        if (rfInstance) {
            const flow = rfInstance.toObject();
            if (flow.nodes.length === 0 && flow.edges.length === 0) return;
            localStorage.setItem(flowKey + name, JSON.stringify(flow));
            const uri = getURI("/logs/save_state", {});
            fetch(uri, {
                method: 'PUT',
                headers: {
                    "Content-type": "application/json"
                },
                body: JSON.stringify({
                    ...flow,
                    name: flowKey + name,
                    ocel: ocel?.slice(5),
                })
            })
                .then((response) => response.json())
                .then((result) => {
                    if (result.status === "successful") {
                        console.log("Storing of flow state " + flowKey + name + " successful!");
                    }
                })
                .catch(err => console.error("Error in uploading ...", err));
        }
    }, [rfInstance, props.name, ocel]);

    const onRestore = useCallback((name: string) => {
        const restoreFlow = async (name: string) => {
            const flowName = flowKey + name;
            const flowStorage = localStorage.getItem(flowName);
            if (flowStorage) {
                const flow = JSON.parse(flowStorage);

                if (flow) {
                    const { x = 0, y = 0, zoom = 1 } = flow.viewport;
                    onRestoreNodes(flow.nodes || []);
                    onRestoreEdges(flow.edges || []);
                    setLiveReload(true);
                    //setViewport({ x, y, zoom });
                }
            } else {
                const potFlow = fetchFlowStateFromBackend(flowName);
                potFlow.then((result: any) => {
                    const flow = result;
                    localStorage.setItem(flowName, JSON.stringify(flow));
                    if (flow) {
                        onRestoreNodes(flow.nodes || []);
                        onRestoreEdges(flow.edges || []);
                        setLiveReload(true);
                    }
                })
            }
        };
        restoreFlow(name);
    }, []); // [setNodes, setViewport]

    const fetchFlowStateFromBackend = async (flowState: string) => {
        if (!ocel) return {};
        const uri = getURI("/logs/flow_state", {ocel: ocel.slice(5), name: flowState});
        let res: any;
        await fetch(uri)
            .then((response) => response.json())
            .then((result) => {
                console.log(result)
                console.log("Fetching of Flow State File " + flowState + " successful.");
                res = result;
            })
            .catch(err => console.log("Error in deleting ... " + err));
        return res;
    }

    function pastePostActions(){
        setLiveReload(true);
        setTimeout(() => {
            rfInstance?.fitView();
            setSnackBarAlert(PasteAlert);
            setSnackBarOpen(true);
        }, 500);
    }

    const onPasteRestore = useCallback((flowState: string) => {
        const restoreFlow = (flowState: string) => {
            const flowStorage = localStorage.getItem(flowState);
            let flow: any;
            if (flowStorage) {
                flow = JSON.parse(flowStorage);
                if (flow) {
                    const idMapping = onRestoreNodes(flow.nodes || [], true);
                    onRestoreEdges(flow.edges || [], idMapping);
                    pastePostActions();
                }
            } else {
                const potFlow = fetchFlowStateFromBackend(flowState);
                potFlow.then((result: any) => {
                    flow = result;
                    localStorage.setItem(flowState, JSON.stringify(flow));
                    if (flow) {
                        const idMapping = onRestoreNodes(flow.nodes || [], true);
                        onRestoreEdges(flow.edges || [], idMapping);
                        pastePostActions();
                    }
                })
            }
        };
        restoreFlow(flowState);
        setLiveReload(true);
    }, [numKeys]); // [setNodes, setViewport]

    const onAddNode = (node: Node) => {
        setNodes((nds) => nds.concat(node));
    }

    const deleteNodeById = (id: string, countDown: boolean = true) => {
        setNodes(nds => nds.filter(node => node.id !== id));
        deleteEdgeByNodeDeletion(id);
        if (countDown)
            setNumKeys(numKeys - 1);
        setLiveReload(true);
    };

    const deleteEdgeByNodeDeletion = (id: string) => {
        setEdges(egs => egs.filter(edge => (edge.source !== id && edge.target !== id)));
    }

    const deleteEdgeById = (id: string) => {
        setEdges(egs => egs.filter(edge => edge.id !== id));
        repairNodeFromNegation(id);
        setLiveReload(true);
    };

    function repairNodeFromNegation(id: string) {
        setNodes((nds) => nds.map((node) => {
            if (node.id === id.slice(-1)) {
                node.data = {
                    ...node.data,
                    negated: false,
                };
            }

            return node;
        }))
    }

    function addOrNode(numKeys: number) {
        return {
            id: '' + numKeys,
            type: 'orNode',
            data: {
                label: 'OR',
                query: {
                    query: "orNode"
                },
                onDelete: () => deleteNodeById('' + numKeys),
            },
            position: {
                //x: numKeys*300,
                x: getRightmostNodePosition()+300,
                y: 300
            }
        }
    }

    function addSingleOrNode(numKeys: number) {
        return {
            id: '' + numKeys,
            type: 'singleOrNode',
            data: {
                label: 'OR',
                query: {
                    query: "singleOrNode"
                },
                onDelete: () => deleteNodeById('' + numKeys),
            },
            position: {
                //x: numKeys*300,
                x: getRightmostNodePosition()+300,
                y: 300
            }
        }
    }

    function onAddSingleOrNode(numKeys: number) {
        const newNode = addSingleOrNode(numKeys);
        onAddNode(newNode);
        setNumKeys(numKeys+1);
    }

    function onAddOrNode(numKeys: number) {
        const newNode = addOrNode(numKeys);
        onAddNode(newNode);
        setNumKeys(numKeys+1);
    }

    function getRightmostNodePosition() {
        let posX = 0;
        nodes.forEach((node) => {
            if (node.position.x > posX)
                posX = node.position.x;
        })
        return posX;
    }

    const translateQueryToNode = (query: QueryType, numKeys: number, optionalKey: number = 1) => {
        // TODO: allow changing of INIT, END or Event
        return {
            id: '' + numKeys,
            type: query.query !== "containsObjects"?
                query.query !== "containsObjectsOfType"?
                    'activityNode' : 'objectTypeNode' : 'objectNode',
            data: {
                label: query.event_activity?
                    query.event_activity :
                    query.needed_objects?
                        query.needed_objects.toString() : query.query === "containsObjectsOfType"? query.object_type : '',
                beforeContent: extractBeforeContent(query.query?? "", query.n_operator ?? "gte", query.n ?? 1),
                objectType: query.object_type? query.object_type: "",
                pContent: extractPContent(query.query?? "", query.p_operator ?? "gte", query.p ?? 1.0, query.p_mode?? "relative"),
                perfContent: extractPerfContent(query.node_metric?? "", query.node_metric_operator?? "gte", query.node_metric_value?? 0),
                onDelete: () => deleteNodeById('' + numKeys, false),
                query: query,
                onQueryChange: (query: QueryType) => {changeNode(query, '' + numKeys)},
            },
            position: {
                //x: numKeys*300,
                x: getRightmostNodePosition()+(300*optionalKey),
                y: 300
            },
        }
    }

    const translateQueryToSequence = (query: QueryType, numKeys: number) => {
        //const node1 = translateQueryToNode({event_activity: query.first_activity, object_type: query.first_type, query: "Event"}, numKeys);
        const node1 = translateQueryToNode(
            {
                boolean_operator: "",
                event_activity: query.first_activity,
                n: 1,
                n_operator: "gte",
                object_type: query.first_type,
                p: 1,
                p_mode: "absolute",
                p_operator: "gte",
                node_metric: "",
                node_metric_value: 0,
                node_metric_operator: "gte",
                query: "isContainedEvent",
            }
            , numKeys, 1);
        onAddNode(node1);
        //const node2 = translateQueryToNode({event_activity: query.second_activity, object_type: query.second_type, query: "Event"}, numKeys+1);
        const node2 = translateQueryToNode(
            {
                boolean_operator: "",
                event_activity: query.second_activity,
                n: 1,
                n_operator: "gte",
                object_type: query.second_type,
                p: 1,
                p_mode: "absolute",
                p_operator: "gte",
                node_metric: "",
                node_metric_value: 0,
                node_metric_operator: "gte",
                query: "isContainedEvent",
            }
            , numKeys+1, 2);
        onAddNode(node2);
        setNumKeys(numKeys+2);
        onManualAddEdge(translateEdgeName(query.query?? ''), query, {source: numKeys.toString(), target: (numKeys+1).toString()});
    }

    const changeNode = (value: QueryType, id: string) => {
        const component = translateQueryToNode(value, parseInt(id));
        setNodes((nds) =>
            nds.map((node) => {
                if (node.id === id){
                    return {
                        ...node,
                        id: component.id,
                        type: component.type,
                        data: component.data,
                    };
                } else {
                    return node;
                }
            })
        )
        setLiveReload(true);
    }

    const changeEdge = (
        value: QueryType,
        params: {source: string | null, target: string | null, sourceHandle?: string | null, targetHandle?: string | null},
        type: string | undefined,
        id: string
    ) => {
        value = {
            ...value,
            query: type,
            firstNodeId: params.source?? '',
            secondNodeId: params.target?? '',
        }
        setEdges((egs) =>
            egs.map((edge) => {
                if (edge.id === id){
                    return {
                        ...edge,
                        data: {
                            ...edge.data,
                            query: value,
                            pContent: extractPContent(value.query?? "", value.p_operator ?? "gte", value.p ?? 1.0, value.p_mode?? "relative"),
                            beforeContent: extractBeforeContent(value.query?? "", value.n_operator ?? "gte", value.n ?? 1),
                            perfContent: extractPerfContent(value.edge_metric?? "", value.edge_metric_operator?? "gte", value.edge_metric_value?? 0),
                        }
                    };
                } else {
                    return edge;
                }
            })
        )
        setLiveReload(true);
    }

    const clearLocalStorage = () => {
        localStorage.clear();
        localStorage.setItem("ocel", ocel? ocel : "");
    }

    const handleClose = (value: QueryType) => {
        if (Object.keys(value).length === 0) {
            setQuery(value);
            return;
        }
        setQuery(value);
        if (value.query === "isEventuallyFollowed" || value.query === "isDirectlyFollowed"){
            translateQueryToSequence(value, numKeys);
        } else {
            const component = translateQueryToNode(value, numKeys);
            onAddNode(component);
            setNumKeys(numKeys + 1);
        }
        setLiveReload(true);
    }

    const handlePasteClick = (flowState: string) => {
        onPasteRestore(flowState);
    }

    const handleCopyClick = (name: string) => {
        onSave(name);
    }

    const onContextMenu = (e: any, node: Node) => {
        e.preventDefault();
        setClickedNode(node);
        // TODO: check why clientX/clientY are not correct here
        setPosition({x: e.clientX-25, y: e.clientY-25});
        setNodeContextMenuOpen(true);
    }

    //console.log(edges)
    //console.log(CytoscapeComponent.normalizeElements(cytoscapeElement))

    const layout = {
        name: 'elk',
        spacingFactor: 1,
        elk: {
            'algorithm': 'layered',
            'elk.direction': 'DOWN',
            'spacing.portsSurrounding': 20,
            "spacing.nodeNodeBetweenLayers": 100,
        }
    }

    const onInit = (reactFlowInstance: ReactFlowInstance) => {
        setRfInstance(reactFlowInstance);
        reactFlowInstance.fitView();
        setTimeout(() => reactFlowInstance.fitView(), 500)
    }

    function registerCytoscapeRef(cy: cytoscape.Core) {
        cytoscapeRef.current = cy;
    }

    const handleNavChange = (event: React.SyntheticEvent, newValue: string) => {
        setNavValue(newValue);
    };

    function filterOcel(){
        const uri = getURI("/pq/filter", {file_path: "filter.jsonocel"});
        fetch(uri)
            .then((response) => response.json())
            .then((result) => {
                console.log("Export to file successful.");
            })
            .catch(err => console.log("Error in exporting ..."));
    }

    const actions = [
        { icon: <PlayCircleFilledWhiteOutlinedIcon />, name: "Execute", onClick: () => executeDnDQuery()},
        { icon: <PlayCircleFilledWhiteOutlinedIcon />, name: "Live query", onClick: () => executeLiveQuery(true)},
        { icon: <RestartAltIcon />, name: "Reset indices", onClick: () => setQueryIndices([-1])},
        { icon: <ArrowBackIosNewIcon />, name: "Show right side (50/50)", onClick: () => setSizes((currSizes) => ['50%', currSizes[1]])},
        { icon: <SpeedIcon />, name: "Runtime analysis", onClick: () => executeRuntimeAnalysis()},
        //{ icon: <SpeedIcon />, name: "Runtime analysis (files)", onClick: () => executeRuntimeAnalysisFiles()},
        //{ icon: <SpeedIcon />, name: "Filter OCEL (0)", onClick: () => filterOcel()},
    ]

    const Alert = React.forwardRef<HTMLDivElement, AlertProps>(function Alert(
        props,
        ref,
    ) {
        return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
    });

    const handleSnackbarClose = (event?: React.SyntheticEvent | Event, reason?: string) => {
        if (reason === 'clickaway') {
            return;
        }

        setSnackBarOpen(false);
    };

    const SuccessAlert = (text: string = "") => (
        <Alert onClose={handleSnackbarClose} severity={"success"} sx={{width: "100%"}}>
            Query executed successfully! {text !== ""? "Satisfied by " + text + " executions." : ""}
        </Alert>
    );

    const FailAlert = (
        <Alert onClose={handleSnackbarClose} severity={"error"} sx={{width: "100%"}}>
            Query failed to execute!
        </Alert>
    );

    const ZeroAlert = (
        <Alert onClose={handleSnackbarClose} severity={"warning"} sx={{width: "100%"}}>
            Query executed, but 0 process executions satisfy the query!
        </Alert>
    );

    const PasteAlert = (
        <Alert onClose={handleSnackbarClose} severity={"success"} sx={{width: "100%"}}>
            Paste successful!
        </Alert>
    )

    async function executeDnDQuery() {
        const uri = getURI("/pq/query_to_graph", {});
        await fetch(uri, {
            method: 'PUT',
            headers: {
                "Content-type": "application/json"
            },
            body: JSON.stringify({
                query: {data: {nodes: nodes, edges: edges, exact: true}},
                file_path: ocel,
                exact: true,
            })
        })
            .then((response) => response.json())
            .then((result) => {
                console.log(result)
                if (result.indices.length === 0){
                    setSnackBarAlert(ZeroAlert);
                } else {
                    setQueryIndices(result.indices);
                    setHighlightObjects(result.objects);
                    setHighlightEdges(result.edges);
                    localStorage.setItem('indices', result.indices);
                    setSnackBarAlert(SuccessAlert(result.length));
                    setNavValue("graph");
                    setRuns(oldRuns => [result.run, ...oldRuns]);
                }
                setSnackBarOpen(true);
            })
            .catch(err => {
                console.log("Error in uploading ...", err);
                setSnackBarAlert(FailAlert);
                setSnackBarOpen(true);
            });
    }

    async function executeRuntimeAnalysis() {
        const uri = getURI("/pq/runtime_analysis_generator", {});
        await fetch(uri, {
            method: 'PUT',
            headers: {
                "Content-type": "application/json"
            },
            body: JSON.stringify({
                query: {data: {nodes: nodes, edges: edges}},
                file_path: ocel,
                exact: true,
            })
        })
            .then((response) => response.json())
            .then((result) => {
                console.log(result);
            })
            .catch(err => {
                console.log("Error in uploading ...", err);
            });
    }

    async function executeRuntimeAnalysisFiles() {
        const uri = getURI("/pq/runtime_analysis_generator_files", {});
        await fetch(uri, {
            method: 'PUT',
            headers: {
                "Content-type": "application/json"
            },
            body: JSON.stringify({
                query: {data: {nodes: nodes, edges: edges}},
                file_path: ocel,
                exact: true,
            })
        })
            .then((response) => response.json())
            .then((result) => {
                console.log(result);
            })
            .catch(err => {
                console.log("Error in uploading ...", err);
            });
    }

    async function executeLiveQuery(single = false) {
        setIsLiveQuerying(true);
        setSnackBarOpen(false);
        const uri = getURI("/pq/query_to_graph", {});
        await fetch(uri, {
            method: 'PUT',
            headers: {
                "Content-type": "application/json"
            },
            body: JSON.stringify({
                query: {data: {nodes: nodes, edges: edges}},
                file_path: ocel,
                exact: true,
                single: single,
            })
        })
            .then((response) => response.json())
            .then((result) => {
                if (result.indices.length === 0){
                    setLiveIndices([-1]);
                    setLiveHighlightObjects([]);
                    setLiveHighlightEdges([]);
                    setWildcards([]);
                    setLiveQueryMetrics(false);
                } else {
                    setLiveIndices(result.indices);
                    setLiveHighlightObjects(result.objects);
                    setLiveHighlightEdges(result.edges);
                    setNavValue("live");
                    setRuns(oldRuns => [result.run, ...oldRuns]);
                    setWildcards(result.wildcards);
                    setLiveQueryMetrics(result.performance);
                }
            })
            .catch(err => {
                console.log("Error in uploading ...", err);
                setSnackBarAlert(FailAlert);
                setSnackBarOpen(true);
            });
        setIsLiveQuerying(false);

    }

    function setSizeAndFitView(size: string){
        setSizes(() => [size, '1']);
        setTimeout(() => rfInstance?.fitView(), 100);
    }

    return (
        <React.Fragment>
            <IconButton sx={{position: "fixed", top: "3vh", left: "4vw"}}
                        onClick={() => setSizeAndFitView('100%')}>
                <KeyboardDoubleArrowRightIcon />
            </IconButton>
            <IconButton sx={{position: "fixed", top: "3vh", right: "4vw"}}
                        onClick={() => setSizes((currSizes) => ['0%', currSizes[1]])}>
                <KeyboardDoubleArrowLeftIcon />
            </IconButton>
            <IconButton sx={{position: "fixed", top: "3vh", right: "48.9vw"}}
                        onClick={() => setSizeAndFitView('50%')}>
                <HorizontalAlignCenterIcon sx={{transform: 'rotate(90deg)'}}/>
            </IconButton>
            <Settings
                anchor={"right"}
                style={{position: "absolute", top: "8vh", right: "0.65vw"}}
                onLiveQueryingChange={(value: boolean) => {
                    setLiveQueryingEnabled(value);
                    if (value)
                        setLiveReload(true);
                }}
            />
            <RuntimeLog
                style={{position: "absolute", top: "13vh", right: "0.65vw"}}
                runs={runs}
            />
            <Wildcards
                style={{position: "absolute", top: "18vh", right: "1vw"}}
                wildcards={wildcards}
            />
            <div className={"QueryContent QueryCreator"}>
                {/* @ts-ignore */}
                <SplitPane split={"vertical"} sizes={sizes} onChange={setSizes}>
                    {/* @ts-ignore */}
                    <Pane size={sizes[0]}>
                        <div className={"left_side"} style={{width: "100%", height: "100%"}}>
                            <ReactFlowProvider>
                                <ReactFlow
                                    nodes={nodes}
                                    edges={edges}
                                    onNodesChange={onNodesChange}
                                    onEdgesChange={onEdgesChange}
                                    onNodeContextMenu={onContextMenu}
                                    multiSelectionKeyCode={"Control"}
                                    //onNodeDrag={() => {}}
                                    //onNodeDragStop={() => {}}
                                    onConnect={onConnect}
                                    onInit={onInit}
                                    nodeTypes={nodeTypes}
                                    edgeTypes={edgeTypes}
                                    defaultViewport={defaultViewport}
                                    // This options hides the ReactFlow watermark in the bottom right corner
                                    proOptions={{hideAttribution: true}}
                                >
                                    <Controls />
                                    <Background gap={20} size={1} />
                                    <div className="save__controls">
                                        <IconButton
                                            onClick={() => clearLocalStorage()}
                                            edge="start"
                                            color="default"
                                            aria-label="menu"
                                            title={"Clears local storage"}
                                            sx={{ mr: 1 }}
                                        >
                                            <FontAwesomeIcon icon={faTimes} color={"red"}/>
                                        </IconButton>
                                        <IconButton
                                            onClick={() => setCopyOpen(true)}
                                            edge="start"
                                            color="default"
                                            aria-label="menu"
                                            title={"Save current query with name"}
                                            sx={{ mr: 1 }}
                                        >
                                            <FontAwesomeIcon icon={faCopy}/>
                                        </IconButton>
                                        <IconButton
                                            onClick={() => setPasteOpen(true)}
                                            edge="start"
                                            color="default"
                                            aria-label="menu"
                                            title={"Paste saved query"}
                                            sx={{ mr: 1 }}
                                        >
                                            <FontAwesomeIcon icon={faPaste}/>
                                        </IconButton>
                                        <IconButton
                                            onClick={() => setClearCanvasOpen(true)}
                                            edge="start"
                                            color="default"
                                            aria-label="menu"
                                            title={"Clear canvas"}
                                            sx={{ mr: 1 }}
                                        >
                                            <FontAwesomeIcon icon={faBroom}/>
                                        </IconButton>
                                        <IconButton
                                            onClick={() => onSave(props.name)}
                                            edge="start"
                                            color="default"
                                            aria-label="menu"
                                            title={"Save current query"}
                                            sx={{ mr: 1 }}
                                        >
                                            <FontAwesomeIcon icon={faSave}/>
                                        </IconButton>
                                        <IconButton
                                            onClick={() => onRestore(props.name)}
                                            edge="start"
                                            color="default"
                                            aria-label="menu"
                                            title={"Restore internally saved query"}
                                            sx={{ mr: 1 }}
                                        >
                                            <FontAwesomeIcon icon={faDownload}/>
                                        </IconButton>
                                        <QuerySelect onClose={handleClose} isDnD={true}/>
                                    </div>
                                </ReactFlow>
                            </ReactFlowProvider>
                            {clearCanvasDialog}
                            <NodeContextMenu
                                open={nodeContextMenuOpen}
                                position={position}
                                actions={
                                    [
                                        {
                                            label: 'Copy',
                                            onClick: () => {
                                                onRestoreNodes(clickedNode? [clickedNode]: [], true);
                                                setNodeContextMenuOpen(false);
                                            },
                                            icon: <ContentCopy fontSize="small" />
                                        },
                                        {
                                            label: 'Delete',
                                            onClick: () => {
                                                deleteNodeById(clickedNode? clickedNode.id: '');
                                                setNodeContextMenuOpen(false);
                                            },
                                            icon: <DeleteIcon fontSize="small" />
                                        },
                                        {
                                            label: 'Reset handles (WIP)',
                                            onClick: () => {
                                                setNodes(nds => nds.map((node) => {
                                                    if (node.id === clickedNode?.id){
                                                        node.data = {
                                                            ...node.data,
                                                            negated: false,
                                                        }
                                                    }
                                                    return node;
                                                }));
                                                setNodeContextMenuOpen(false);
                                            },
                                            icon: <RestartAltIcon />
                                        },
                                        {
                                            label: 'Create OR',
                                            onClick: () => {
                                                onAddOrNode(numKeys);
                                                setNodeContextMenuOpen(false);
                                            },
                                            icon: <ImportExportIcon/>
                                        },
                                        {
                                            label: 'Create Single OR',
                                            onClick: () => {
                                                onAddSingleOrNode(numKeys);
                                                setNodeContextMenuOpen(false);
                                            },
                                            icon: <ImportExportIcon/>
                                        }
                                    ]
                                }
                                onMouseLeave={() => setNodeContextMenuOpen(false)}
                            />
                        </div>
                    </Pane>
                    {/* @ts-ignore */}
                    <Pane size={sizes[1]}>
                        <div className={"right_side"} style={{ width: "100%", height: "87.8vh" }}>
                            {navValue === "viewer" &&
                                <CytoscapeComponent
                                    elements={CytoscapeComponent.normalizeElements(cytoscapeElement)}
                                    style={{ textAlign: "initial", height: "93.7%", width: "100%" }}
                                    wheelSensitivity={0.2}
                                    stylesheet={graphStylesheet}
                                    layout={layout}
                                />
                            }
                            {navValue === "graph" &&
                                <div style={{width: "100%", height: "93.7%"}}>
                                    {(queryIndices.length === 1 && queryIndices[0] === -1)?
                                        <Graph
                                            allAllowed={true}
                                            integrated={true}
                                        /> :
                                        <Graph
                                            allAllowed={false}
                                            integrated={true}
                                            indices={queryIndices}
                                            highlightObjects={highlightObjects}
                                            highlightEdges={highlightEdges}
                                        />
                                    }
                                </div>
                            }
                            {navValue === "live" &&
                                <div style={{width: "100%", height: "93.7%"}}>
                                    {!liveQueryingEnabled &&
                                        <div style={{position: 'absolute', right: '6.1rem', top: '5.3rem', zIndex: 5}}>
                                            <CustomTooltip title={"Live querying is currently disabled. The current view might be incorrect."}>
                                                <InfoIcon
                                                    onClick={() => console.log("click")}
                                                    color={"error"}
                                                    fontSize={"medium"}
                                                    sx={{cursor: 'pointer'}}
                                                />
                                            </CustomTooltip>
                                        </div>
                                    }
                                    {(liveIndices.length === 1 && liveIndices[0] === -1)?
                                        <div style={{width: '100%', height: '92.7%'}}>
                                            No process execution to show.
                                        </div> :
                                        <Graph
                                            allAllowed={false}
                                            integrated={true}
                                            showRightSide={false}
                                            showMetrics={liveQueryMetrics}
                                            indices={liveIndices}
                                            highlightObjects={liveHighlightObjects}
                                            highlightEdges={liveHighlightEdges}
                                        />
                                    }
                                    {isLiveQuerying &&
                                        <Box sx={{
                                            display: 'flex',
                                            position: 'relative',
                                            bottom: '50%',
                                            left: '122%',
                                            marginRight: '-50%',
                                            transform: 'translate(-50%, -50%)'
                                        }}>
                                            <CircularProgress size={"5rem"} />
                                        </Box>
                                    }
                                </div>
                            }
                            <Paper sx={{ position: 'relative', bottom: 0  }} elevation={3}>
                                <BottomNavigation sx={{ width: "100%" }} value={navValue} onChange={handleNavChange}>
                                    <BottomNavigationAction
                                        label="Live"
                                        value="live"
                                        icon={<PlayCircleFilledWhiteOutlinedIcon />}
                                    />
                                    <BottomNavigationAction
                                        label="Graph"
                                        value="graph"
                                        icon={<FontAwesomeIcon icon={faDiagramProject} />}
                                    />
                                    {/* <BottomNavigationAction
                                        label="Viewer"
                                        value="viewer"
                                        icon={<VisibilityIcon />}
                                    /> */}
                                </BottomNavigation>
                            </Paper>
                        </div>
                    </Pane>

                </SplitPane>
            </div>
            <Snackbar
                open={snackBarOpen}
                autoHideDuration={5000}
                onClose={handleSnackbarClose}
                anchorOrigin={{vertical: "bottom", horizontal: "left"}}
            >
                {snackBarAlert}
            </Snackbar>
            <Button onClick={() => {
                onSave(props.name);
                props.onClose(nodes, edges);
            }}>
                Done
            </Button>
            <Box sx={{ height: 0, transform: 'translateZ(0px)', flexGrow: 1 }}>
                <SpeedDial
                    ariaLabel="SpeedDial"
                    sx={{ position: 'absolute', bottom: '1vh', right: '0.5vw' }}
                    icon={<SpeedDialIcon />}
                >
                    {actions.map((action) => (
                        <SpeedDialAction
                            key={action.name}
                            icon={action.icon}
                            tooltipTitle={action.name}
                            onClick={action.onClick}
                        />
                    ))}
                </SpeedDial>
            </Box>
            <EdgeDialog onClose={(type: string, query: any) => {
                if (params)
                    onManualAddEdge(type, query, params);
            }} open={open} setOpen={setOpen}/>
            <PasteDialog open={pasteOpen} setOpen={setPasteOpen} onClick={handlePasteClick} />
            <CopyDialog open={copyOpen} setOpen={setCopyOpen} onClick={handleCopyClick} />
        </React.Fragment>
    );
}

export function confirmationDialog(open: boolean, setOpen: { (value: React.SetStateAction<boolean>): void}, text: any, title: any, onClick: any){
    return (
        <Dialog
            open={open}
            aria-labelledby="draggable-dialog-title"
            aria-describedby="alert-dialog-description"
            PaperProps={{style: {borderRadius: '1rem'}}}
            PaperComponent={PaperComponent}
        >
            <DialogTitle id="draggable-dialog-title" style={{cursor: "move"}}>
                <Box display="flex" alignItems="center">
                    <Box flexGrow={1} >{title}</Box>
                    <Box>
                        <IconButton onClick={() => setOpen(false)}>
                            <FontAwesomeIcon icon={faClose}/>
                        </IconButton>
                    </Box>
                </Box>
            </DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-description">
                    {text}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => {
                    onClick();
                    setOpen(false);
                }}>Yes</Button>
                <Button onClick={() => setOpen(false)} autoFocus>No</Button>
            </DialogActions>
        </Dialog>
    )
}

type PasteDialogProps = {
    open: boolean,
    setOpen: { (value: React.SetStateAction<boolean>): void},
    onClick: any
}

const PasteDialog = (props: PasteDialogProps) => {
    const { open, setOpen, onClick } = props;

    let initialDataSource: TypeDataSource = [];
    const [dataSource, setDataSource] = useState(initialDataSource);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [selected, setSelected] = useState(null);
    const [deletionName, setDeletionName] = useState("");

    const ocel = localStorage.getItem("ocel");

    const deleteFlowStateTitle = "Do you really want to delete the saved flow state?";
    const deleteFlowStateContent = (
        <>
            <p>
                If you decide to delete the flow state "{deletionName}", it can not be restored.
            </p>
            <p>
                Only press yes, if you know what you are doing.
            </p>
        </>
    );


    const deleteFlowStateDialog = useMemo(() => {
        return confirmationDialog(deleteOpen, setDeleteOpen, deleteFlowStateContent, deleteFlowStateTitle, () => onDelete(deletionName));
    }, [deleteOpen]);

    async function onDelete(name: string) {
        if (name && ocel){
            setDeleteOpen(false);
            const uri = getURI("/logs/delete_flow_state", {ocel: ocel.slice(5), name: name});
            await fetch(uri)
                .then((response) => response.json())
                .then((result) => {
                    refreshDataSource();
                    console.log("Flow State File " + name + " successfully deleted.")
                })
                .catch(err => console.log("Error in deleting ..."));
        }
    }

    // @ts-ignore
    let onSelection = useCallback(({ selected }) => {
        setSelected(selected);
    }, []);

    let compareDates = (a: { age_as_number: number; }, b: { age_as_number: number; }) => {
        if (a.age_as_number < b.age_as_number) {
            return 1;
        }
        if (a.age_as_number > b.age_as_number) {
            return -1;
        }
        return 0;
    }

    const formatCopyMetadata = (data: any) => {
        const age = new Date(data[1] * 1000).toLocaleString('en-US');
        // const name = data[0].slice(0,-5);
        const name = data[0];
        return {
            name_as_string: data[0],
            age_as_number: age,
            nodes_as_list: data[2],
            edges_as_list: data[3],
            name: <div title={name}>{name}</div>,
            age: <div title={age}>{age}</div>,
            nodes: <div title={""}>{data[2].length}</div>,
            edges: <div title={""}>{data[3].length}</div>,
            deleteButton:
                <button className="EventLogTable-DeleteButton"
                        onClick={(event) => {
                            setDeletionName(name);
                            setDeleteOpen(true);
                            event.stopPropagation();
                        }}
                        title={"Shows prompt for deletion of this saved flow state."}
                >
                    <FontAwesomeIcon icon={faTrash}/>
                </button>
        }
    }

    const refreshDataSource = () => {
        let availableURI = getURI("/logs/available_flow_states", {ocel: ocel? ocel.slice(5): ''});
        fetch(availableURI)
            .then((response) => response.json())
            .then((result) => {
                if (result !== undefined) {
                    const formattedData = result.map((flowState: any, index: number) => {
                        const flowStateMetadata = formatCopyMetadata(flowState);
                        return {
                            ...flowStateMetadata,
                            id: index
                        };
                    })

                    formattedData.sort(compareDates);

                    // Give items correct id for selection, we get a wrong id if we assign it in the data.map already
                    for (let i = 0; i < formattedData.length; i++){
                        formattedData[i].id = i;
                    }

                    setDataSource(formattedData);
                }
            })
            .catch(err => console.log("Error in fetching available flow states ... " + err))
    }

    useEffect(() => {
        if (!open) return;
        refreshDataSource();
    }, [open])

    const columns = [
        {name: 'name', header: 'Name', defaultFlex: 8},
        {name: 'age', header: 'Last change', defaultFlex: 4},
        {name: 'nodes', header: '#Nodes', defaultFlex: 1},
        {name: 'edges', header: '#Edges', defaultFlex: 1},
        {name: 'deleteButton', header: '', defaultFlex: .25},
    ];

    const gridStyle = { maxHeight: "70vh", maxWidth: "70vw" };

    return (
        <Dialog
            open={open}
            aria-labelledby="draggable-dialog-title"
            aria-describedby="alert-dialog-description"
            PaperProps={{style: {borderRadius: '1rem', minWidth: '70vw', height: '50vh'}}}
            PaperComponent={PaperComponent}
        >
            <DialogTitle id="draggable-dialog-title" style={{cursor: "move"}}>
                <Box display="flex" alignItems="center">
                    <Box flexGrow={1} textAlign={"center"}>Select Elements to Copy</Box>
                    <Box>
                        <IconButton onClick={() => setOpen(false)}>
                            <FontAwesomeIcon icon={faClose}/>
                        </IconButton>
                    </Box>
                </Box>
            </DialogTitle>
            <DialogContent>
                <ReactDataGrid
                    columns={columns}
                    dataSource={dataSource}
                    selected={selected}
                    //onReady={setGridRef}
                    onSelectionChange={onSelection}
                    style={{...gridStyle, height: "100%"}}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setOpen(false)} autoFocus>Close</Button>
                <Button onClick={() => {
                    const flowState = String(dataSource[Number(selected)].name_as_string);
                    onClick(flowState);
                    setOpen(false);
                }}>Select</Button>
            </DialogActions>
            {deleteFlowStateDialog}
        </Dialog>
    )
}

type CopyDialogProps = {
    open: boolean,
    setOpen: { (value: React.SetStateAction<boolean>): void},
    onClick: any
}

const CopyDialog = (props: CopyDialogProps) => {
    const {open, setOpen, onClick} = props;
    const [name, setName] = useState("");
    return (
        <Dialog
            open={open}
            aria-labelledby="draggable-dialog-title"
            aria-describedby="alert-dialog-description"
            PaperProps={{style: {borderRadius: '1rem', minWidth: '30vw', height: '20vh'}}}
            PaperComponent={PaperComponent}
        >
            <DialogTitle id="draggable-dialog-title" style={{cursor: "move"}}>
                <Box display="flex" alignItems="center">
                    <Box flexGrow={1} textAlign={"center"}>Choose name to save flow state to</Box>
                    <Box>
                        <IconButton onClick={() => setOpen(false)}>
                            <FontAwesomeIcon icon={faClose}/>
                        </IconButton>
                    </Box>
                </Box>
            </DialogTitle>
            <DialogContent>
                <TextField
                    label={"Name"}
                    variant={"outlined"}
                    value={name}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                        setName(event.target.value);
                    }}
                />
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setOpen(false)} autoFocus>Close</Button>
                <Button onClick={() => {
                    onClick(name);
                    setOpen(false);
                }}>Save</Button>
            </DialogActions>
        </Dialog>
    )
}

type NodeContextMenuProps = {
    open: boolean,
    position: {x: number, y: number},
    actions: any[],
    specialActions?: any[],
    onMouseLeave: any,
}

function NodeContextMenu(props: NodeContextMenuProps){
    return props.open? (
            <Paper
                sx={{
                    width: 220,
                    maxWidth: '100%',
                    position: 'absolute',
                    left: props.position.x,
                    top: props.position.y,
                    zIndex: 1000,
                    border: '0.1rem solid #ccc',
                    borderRadius: '1rem',
                    backgroundColor: 'white',
                    padding: 1,
                }}
                onMouseLeave={props.onMouseLeave}
            >
                <MenuList>
                    {props.actions.map((action: any) => (
                        <MenuItem key={action.label} onClick={action.onClick}>
                            <ListItemIcon>
                                {action.icon}
                            </ListItemIcon>
                            <ListItemText>{action.label}</ListItemText>
                            <Typography variant="body2" color="text.secondary">
                                {action.keyInfo}
                            </Typography>
                        </MenuItem>
                    ))}
                    {props.specialActions && (
                        <>
                            <Divider />
                            {props.specialActions.map((action: any) => (
                                <MenuItem key={action.label}>
                                    <ListItemIcon>
                                        {action.icon}
                                    </ListItemIcon>
                                    <ListItemText>{action.label}</ListItemText>
                                </MenuItem>
                            ))}
                        </>
                    )}
                </MenuList>
            </Paper>
    ) : null
}

