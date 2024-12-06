import {Handle, NodeProps, Position, useUpdateNodeInternals, getConnectedEdges,  useNodeId, useStore, Edge} from "reactflow";
import React, {useCallback, useState} from "react";
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import ChangeCircleIcon from '@mui/icons-material/ChangeCircle';
import IconButton from "@mui/material/IconButton";
import Switch from '@mui/material/Switch';
import {
    QueryComponentDialog
} from "../Query/Query";
import Stack from "@mui/material/Stack";
import {CustomTooltip} from "../Query/Query";
import InfoIcon from "@mui/icons-material/Info";
import {QueryType} from "./QueryCreator";

// Used to determine how often a node is copied when n >= 2
const MAX_NODE_COPIES = 5;

const translateComponentLabel = (label: string) => {
    if (label === "isStart") return "Start Event";
    if (label === "isEnd") return "End Event";
    if (label === "directlyFollowsEdge") return "Directly-Follows Edge";
    if (label === "eventuallyFollowsEdge") return "Eventually-Follows Edge";
    return label;
}

// From: https://reactflow.dev/docs/examples/nodes/connection-limit/
const selector =
    (nodeId: string | null, id: string, isConnectable = true, maxConnections = Infinity) =>
        (s: any) => {
            // If the user props say this handle is not connectable, we don't need to
            // bother checking anything else.
            if (!isConnectable) return false;

            const node = s.nodeInternals.get(nodeId);
            let connectedEdges = getConnectedEdges([node], s.edges);
            connectedEdges = connectedEdges.filter((edge) => {
                if (id === "s") {
                    return edge.targetHandle === "";
                } else if (id === "t") {
                    return edge.sourceHandle === "";
                }
                return false;
            })
            return connectedEdges.length < maxConnections;
        };

// @ts-ignore
const CustomHandle = ({ maxConnections, ...props }) => {
    const nodeId = useNodeId();
    const isConnectable = useStore(
        useCallback(selector(nodeId, props.id, props.isConnectable, maxConnections), [
            nodeId,
            props.isConnectable,
            maxConnections,
        ])
    );

    // The `isConnectable` prop is a part of React Flow, all we need to do is give
    // it the bool we calculated above and React Flow can handle the logic to disable
    // it for us.
    return <Handle {...props} position={props.position} type={props.type} isConnectable={isConnectable} />;
};

export const SingleOrNode = (node: NodeProps) => {
    return (
        <>
            <div className={"or_button"} data-content={node.data.label}>
                <div className={"or_content"}>
                    <div className={"or_text2"} style={{"marginTop": "1rem"}}>
                        {node.data.label}
                    </div>
                    <IconButton onClick={node.data.onDelete} >
                        <DeleteForeverIcon />
                    </IconButton>
                    <>
                        <Handle
                            type={"source"}
                            position={Position.Right}
                            id={"or1"}
                            isConnectable={true}
                            style={{ width: '15px', height: '15px', right: '11px', top: '-12px' }}
                        />
                        <Handle
                            type={"source"}
                            position={Position.Right}
                            id={"or2"}
                            isConnectable={true}
                            style={{ width: '15px', height: '15px', right: '11px', top: '87px' }}
                        />
                    </>
                </div>
            </div>
        </>
    )
}

export const OrNode = (node: NodeProps) => {

    const [isSplit, setIsSplit] = useState(node.data.query["type"] === "Split");

    const updateNodeInternals = useUpdateNodeInternals();

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setIsSplit(event.target.checked);
        updateNodeInternals(node.id);
    };

    return (
        <>
            <div className={"or_text"}>
                {node.data.label} - {isSplit ? "Split" : "Join"}
            </div>
            <div className={"or_button"} data-content={node.data.label}>
                <div className={"or_content"}>
                    <Switch
                        checked={isSplit}
                        onChange={handleChange}
                        color="default"
                    />
                    <IconButton onClick={node.data.onDelete} >
                        <DeleteForeverIcon />
                    </IconButton>
                    {isSplit &&
                        <>
                            <CustomHandle
                                type={"target"}
                                position={Position.Left}
                                maxConnections={1}
                                id={"t"}
                                style={{ width: '15px', height: '15px', left: '-20px' }}
                            />
                            <Handle
                                type={"source"}
                                position={Position.Right}
                                id={"s1"}
                                isConnectable={true}
                                style={{ width: '15px', height: '15px', right: '2px', top: '10px' }}
                            />
                            <Handle
                                type={"source"}
                                position={Position.Right}
                                id={"s2"}
                                isConnectable={true}
                                style={{ width: '15px', height: '15px', right: '2px', top: '65px' }}
                            />
                        </>
                    }
                    {!isSplit &&
                        <>
                            <Handle
                                type={"target"}
                                position={Position.Left}
                                id={"t1"}
                                isConnectable={true}
                                style={{ width: '15px', height: '15px', left: '2px', top: '10px' }}
                            />
                            <Handle
                                type={"target"}
                                position={Position.Left}
                                id={"t2"}
                                isConnectable={true}
                                style={{ width: '15px', height: '15px', left: '2px', top: '65px' }}
                            />
                            <CustomHandle
                                type={"source"}
                                position={Position.Right}
                                maxConnections={1}
                                id={"s"}
                                style={{ width: '15px', height: '15px', right: '-20px' }}
                            />
                        </>
                    }
                </div>
            </div>
        </>
    )
}

function translateOperator(pOperator: string){
    switch(pOperator) {
        case "gte":
            return "at least"
        case "lte":
            return "at most"
        case "exactly":
            return "exactly"
    }
    return pOperator
}

function translateP(p: number, pMode: string){
    if (pMode === "absolute")
        return p;
    else
        return p*100 + "% of"
}

function translateQuantifierEvent(events: string | string[], quantifier: string){
    if (quantifier === "None"){
        return `a "${events}" activity`
    } else if (quantifier === "ANY") {
        return `any activity of "${typeof events !== "string" ? events.join("\" or \"") : events}"`
    } else {
        return `all activities of "${typeof events !== "string" ? events.join("\" and \"") : events}"`
    }
}

export function getTooltip(query: QueryType){
    switch (query.query) {
        case "isContainedEvent":
            return `For ${translateOperator(query.p_operator?? "")} ${translateP(query.p?? -1, query.p_mode?? "")} 
                    object${query.p && query.p > 1? "s": query.p_mode === "relative"? "s": ""} of type ${query.object_type}, 
                    each ${query.object_type} object must contain ${translateOperator(query.n_operator?? "")} ${query.n} 
                    "${query.event_activity}" activit${query.n && query.n > 1? "ies": "y"}.`
        case "areContainedEvents":
            return `For ${translateOperator(query.p_operator?? "")} ${translateP(query.p?? -1, query.p_mode?? "")} 
                    object${query.p && query.p > 1? "s": query.p_mode === "relative"? "s": ""} of type ${query.object_type}, 
                    each ${query.object_type} object must contain ${translateOperator(query.n_operator?? "")} ${query.n} of
                    ${translateQuantifierEvent(query.event_activity?? "", query.quantifier?? "")}.`
        case "isStart":
        case "isEnd":
            return `For ${translateOperator(query.p_operator?? "")} ${translateP(query.p?? -1, query.p_mode?? "")} 
                    object${query.p && query.p > 1? "s": query.p_mode === "relative"? "s": ""} of type ${query.object_type}, 
                    each ${query.object_type} object must ${query.query === "isStart"? "start": "end"} with 
                    ${translateQuantifierEvent(query.event_activity?? "", query.quantifier?? "")}.`
        case "containsObjects":
            return `Process execution must contain ${query.quantifier === "ALL"? "all" : "any"} of following objects:
                    "${query.needed_objects?.join("\", \"")}".`
        case "containsObjectsOfType":
            return `Process execution must contain ${translateOperator(query.n_operator?? "")} ${query.n} objects of 
                    type ${query.object_type}.`
        /* case "isDirectlyFollowed":
        case "isEventuallyFollowed":
            return `For ${translateOperator(query.p_operator?? "")} ${translateP(query.p?? -1, query.p_mode?? "")} 
                    object${query.p && query.p > 1? "s": query.p_mode === "relative"? "s": ""} of type ${query.first_type}, 
                    each ${query.first_type} object must be ${query.query === "isDirectlyFollowed"? "directly followed": "eventually followed"}
                    by ${translateOperator(query.n_operator?? "")} ${query.n} object${query.p && query.p > 1? "s": ""} of type
                    ${query.second_type}.` */
        case "isDirectlyFollowed":
        case "isEventuallyFollowed":
            return `STC: For ${translateOperator(query.p_operator?? "")} ${translateP(query.p?? -1, query.p_mode?? "")} 
                    object${query.p && query.p > 1? "s": query.p_mode === "relative"? "s": ""} which 
                    satisf${query.p === 1 && query.p_mode === "absolute"? "ies": "y"} the left side, 
                    each object must be ${query.query === "isDirectlyFollowed"? "directly followed": "eventually followed"}
                    by ${translateOperator(query.n_operator?? "")} ${query.n} object${query.n && query.n > 1? "s": ""} 
                    which satisf${query.n === 1 ? "ies": "y"} the right side.`
    }
    return ""
}

export const ActivityNode = (node: NodeProps) => {
    const [open, setOpen] = useState(false);
    const onDelete = () => {
        node.data.onDelete();
    }

    const handleClose = (query: any) => {
        setOpen(false);
        node.data.onQueryChange(query);
    }

    const isNegated = node.data.query["boolean_operator"] === "NOT";
    const isSameEvent = node.data.query["same_event"]? node.data.query["same_event"] === "true" : false;

    return (
        <>
            <div
                className={"curved-message"}
                data-content={node.data.beforeContent}

                style={{ ...node.data.styles, borderColor: isNegated? "red": "" }}
            >
                <div style={{position: 'absolute', right: '0.3rem', top: '0.3rem'}}>
                    <CustomTooltip title={getTooltip(node.data.query)}>
                        <InfoIcon
                            onClick={() => console.log("click")}
                            color={"action"}
                            fontSize={"small"}
                            sx={{cursor: 'pointer'}}
                        />
                    </CustomTooltip>
                </div>
                {node.data.pContent === "None" && (
                    <div className={"vertical-line"} style={{borderColor: isNegated? "red": ""}}/>
                )}
                {node.data.pContent !== "None" && (
                    <div className={isNegated? "vertical-line-red" : "vertical-line"} style={{borderColor: isNegated? "red": ""}}>
                        <span style={{color: isSameEvent? "green": ""}}>{node.data.pContent}</span>
                        <p>
                            {node.data.perfContent}
                        </p>
                    </div>
                )}
                <div className={"circle"} data-content={node.data.objectType} style={{borderColor: isNegated? "red": ""}}></div>
                <IconButton onClick={() => setOpen(true)} >
                    <ChangeCircleIcon />
                </IconButton>
                <div>
                    {node.data.query.quantifier? node.data.query.quantifier !== "None"? node.data.query.quantifier +  ": " : "": ""}
                    {node.data.label.join(', ')}
                </div>
                <IconButton onClick={onDelete} >
                    <DeleteForeverIcon />
                </IconButton>
            </div>
            <Handle
                type={"target"}
                position={Position.Left}
                style={{ width: '15px', height: '15px', left: '-7.5px' }}
            />
            {!isNegated && !node.data.negated &&
                <Handle
                    type={"source"}
                    position={Position.Right}
                    style={{ width: '15px', height: '15px', right: '-7.5px' }}
                />
            }
            {node.data.query &&
                <QueryComponentDialog
                    open={open}
                    selectedValue={""}
                    componentLabel={translateComponentLabel(node.data.query.query)}
                    onClose={() => setOpen(false)}
                    queryObject={node.data.query}
                    onQueryChange={handleClose}
                />
            }
            {node.data.query["n"] && Array(Math.min(node.data.query.n-1, MAX_NODE_COPIES-1)).fill(undefined).map((_, index) => (
                <div
                    className={"curved-message"}
                    data-content={node.data.beforeContent}

                    style={{ ...node.data.styles, borderColor: isNegated? "red": "",
                        position: "absolute", top: 0.2*(index+1) + "rem", left: 0.2*(index+1) + "rem", zIndex: -1*(index+1) }}
                >
                </div>
            ))}
        </>
    )
}

export const ObjectNode = (node: NodeProps) => {
    const [open, setOpen] = useState(false);
    const onDelete = () => {
        node.data.onDelete();
    }

    const handleClose = (query: any) => {
        setOpen(false);
        node.data.onQueryChange(query);
    }

    const isNegated = node.data.query["boolean_operator"] === "NOT";

    return (
        <>
            <div className={"rectangle"} style={{borderColor: isNegated? "red": ""}}>
                <div style={{position: 'absolute', right: '0.3rem', top: '0.3rem'}}>
                    <CustomTooltip title={getTooltip(node.data.query)}>
                        <InfoIcon
                            onClick={() => console.log("click")}
                            color={"action"}
                            fontSize={"small"}
                            sx={{cursor: 'pointer'}}
                        />
                    </CustomTooltip>
                </div>
                <Stack spacing={2.5}>
                    <IconButton onClick={() => setOpen(true)} >
                        <ChangeCircleIcon />
                    </IconButton>
                    <div>
                        {node.data.label.toString()}
                    </div>
                    <IconButton onClick={onDelete} >
                        <DeleteForeverIcon />
                    </IconButton>
                </Stack>
            </div>
            {node.data.query &&
                <QueryComponentDialog
                    open={open}
                    selectedValue={""}
                    componentLabel={translateComponentLabel(node.data.query.query)}
                    onClose={() => setOpen(false)}
                    queryObject={node.data.query}
                    onQueryChange={handleClose}
                />
            }
        </>
    )
}

export const ObjectTypeNode = (node: NodeProps) => {
    const [open, setOpen] = useState(false);
    const onDelete = () => {
        node.data.onDelete();
    }

    const handleClose = (query: any) => {
        setOpen(false);
        node.data.onQueryChange(query);
    }

    const isNegated = node.data.query["boolean_operator"] === "NOT";

    return (
        <>
            <div
                className={"oval"}
                style={{borderColor: isNegated? "red": ""}}
                data-content={node.data.beforeContent}
            >
                <div style={{position: 'absolute', right: '0.3rem', top: '3.3rem'}}>
                    <CustomTooltip title={getTooltip(node.data.query)}>
                        <InfoIcon
                            onClick={() => console.log("click")}
                            color={"action"}
                            fontSize={"small"}
                            sx={{cursor: 'pointer'}}
                        />
                    </CustomTooltip>
                </div>
                <IconButton onClick={() => setOpen(true)} >
                    <ChangeCircleIcon />
                </IconButton>
                <div>
                    {node.data.label.toString()}
                </div>
                <IconButton onClick={onDelete} >
                    <DeleteForeverIcon />
                </IconButton>
            </div>
            {node.data.query &&
                <QueryComponentDialog
                    open={open}
                    selectedValue={""}
                    componentLabel={translateComponentLabel(node.data.query.query)}
                    onClose={() => setOpen(false)}
                    queryObject={node.data.query}
                    onQueryChange={handleClose}
                />
            }
        </>
    )
}