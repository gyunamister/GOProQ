import './QueryCreator.css'
import {EdgeProps, getBezierPath} from "reactflow";
import CancelIcon from '@mui/icons-material/Cancel';
import IconButton from "@mui/material/IconButton";
import ChangeCircleIcon from '@mui/icons-material/ChangeCircle';
import React, {useEffect, useState} from "react";
import DialogTitle from "@mui/material/DialogTitle";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import {Box} from "@mui/material";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faClose} from "@fortawesome/free-solid-svg-icons";
import {getTooltip} from "./Nodes";
import {CustomTooltip, QueryComponentDialog} from "../Query/Query";
import InfoIcon from "@mui/icons-material/Info";
import List from "@mui/material/List";
import Stack from "@mui/material/Stack";
import ListItem from "@mui/material/ListItem";
import ListItemAvatar from "@mui/material/ListItemAvatar";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import KeyboardDoubleArrowRightOutlinedIcon from "@mui/icons-material/KeyboardDoubleArrowRightOutlined";
import ArrowForwardOutlinedIcon from "@mui/icons-material/ArrowForwardOutlined";

const foreignObjectSize = 40;

type EdgeDialogProps = {
    // TODO: add correct types
    onClose: any;
    open: boolean;
    setOpen: any;
}

const initialEdgeQuery = {
    n_operator: "gte",
    n: 1,
    p: 1,
    p_operator: "gte",
    p_mode: "absolute",
    quantifier: "ALL",
    boolean_operator: "",
    edge_metric: "",
    edge_metric_operator: "gte",
    edge_metric_value: 0,
}

export const EdgeDialog = (props: EdgeDialogProps) => {
    const { onClose, open, setOpen } = props;

    const [query, setQuery] = useState(initialEdgeQuery);

    const [type, setType] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);

    const handleClose = (query: any) => {
        setDialogOpen(false);
        setQuery(query);
        onClose(type, query);
    }

    const components: any[] = [
        ["Directly Follows", "directlyFollowsEdge", <KeyboardDoubleArrowRightOutlinedIcon />],
        ["Eventually Follows", "eventuallyFollowsEdge", <ArrowForwardOutlinedIcon />],
    ]

    const onClick = (type: string) => {
        setType(type);
        setDialogOpen(true);
    }

    return (
        <>
        <Dialog onClose={() => {}} open={open} maxWidth={'lg'} PaperProps={{style: {borderRadius: '1rem'}}}>
            <DialogTitle sx={{textAlign: "center"}}>
                <Box display="flex" alignItems="center">
                    <Box flexGrow={1} >Select edge type</Box>
                    <Box>
                        <IconButton onClick={() => setOpen(false)} sx={{right: 0}}>
                            <FontAwesomeIcon icon={faClose} />
                        </IconButton>
                    </Box>
                </Box>
            </DialogTitle>
            <List sx={{ pt: 0 }}>
                {components.map((component, index) => (
                    <>
                        <Stack direction={"row"} justifyContent={"space-between"} spacing={2} alignItems={"center"} sx={{mr: 2}}>
                            <ListItem button onClick={() => onClick(component[1])} key={index}>
                                <ListItemAvatar>
                                    {component[2]}
                                </ListItemAvatar>
                                <ListItemText primary={component[0]} />
                            </ListItem>
                            <CustomTooltip title={"test"} >
                                <InfoIcon
                                    onClick={() => console.log("click")}
                                    color={"action"}
                                    fontSize={"small"}
                                    sx={{cursor: 'pointer'}}
                                />
                            </CustomTooltip>

                        </Stack>
                        {index !== components.length-1 &&
                            <Divider orientation={"horizontal"} />
                        }
                    </>
                ))}
            </List>
            <Button onClick={() => {
                //props.onQueryChange(query);
                setOpen(false);
            }}>
                Close
            </Button>
        </Dialog>
            <QueryComponentDialog
                open={dialogOpen}
                selectedValue={""}
                componentLabel={type}
                onClose={() => setDialogOpen(false)}
                queryObject={query}
                onQueryChange={handleClose}
            />
        </>
    )
}

export const EventuallyFollowsEdge = (edge: EdgeProps) => {
    const [edgePath, labelX, labelY] = getPath(edge, 0);
    const [open, setOpen] = useState(false);

    const onDelete = () => {
        edge.data.onDelete();
    }

    const handleClose = (query: any) => {
        setOpen(false);
        edge.data.onQueryChange(query);
    }

    const isNegated = edge.data.query["boolean_operator"] === "NOT";

    return (
        <>
            <path
                id={edge.id}
                style={{...edge.style, strokeWidth: '0.1rem', stroke: isNegated? "red" : ""}}
                strokeDasharray={isNegated? "5,5": ""}
                className="react-flow__edge-path"
                d={edgePath}
                markerEnd={edge.markerEnd}
            />
            <text dy={-11}>
                <textPath href={`#${edge.id}`} startOffset={"25%"} textAnchor={"middle"}>
                    p {edge.data.pContent}
                </textPath>
            </text>
            <text dy={-11}>
                <textPath href={`#${edge.id}`} startOffset={"75%"} textAnchor={"middle"}>
                    n {edge.data.beforeContent}
                </textPath>
            </text>
            <text dy={25}>
                <textPath href={`#${edge.id}`} startOffset={"50%"} textAnchor={"middle"}>
                    {edge.data.perfContent}
                </textPath>
            </text>
            <foreignObject
                width={foreignObjectSize}
                height={foreignObjectSize}
                x={labelX - foreignObjectSize - foreignObjectSize / 2}
                y={labelY - foreignObjectSize / 2}
                className="edgebutton-foreignobject"
                requiredExtensions="http://www.w3.org/1999/xhtml"
            >
                <div>
                    <IconButton onClick={() => setOpen(true)}>
                        <ChangeCircleIcon />
                    </IconButton>
                </div>
            </foreignObject>
            <foreignObject
                width={foreignObjectSize}
                height={foreignObjectSize}
                color={"red"}
                x={labelX - foreignObjectSize / 2}
                y={labelY - foreignObjectSize / 2}
                className="edgebutton-foreignobject"
                requiredExtensions="http://www.w3.org/1999/xhtml"
            >
                <div>
                    <IconButton onClick={onDelete}>
                        <CancelIcon />
                    </IconButton>
                </div>
            </foreignObject>
            <foreignObject
                width={foreignObjectSize}
                height={foreignObjectSize}
                x={labelX + foreignObjectSize / 2}
                y={labelY - foreignObjectSize / 2}
                className="edgebutton-foreignobject"
                requiredExtensions="http://www.w3.org/1999/xhtml"
            >
                <div style={{position: 'relative'}}>
                    <CustomTooltip title={getTooltip(edge.data.query)}>
                        <InfoIcon
                            onClick={() => console.log("click")}
                            color={"action"}
                            sx={{cursor: 'pointer'}}
                        />
                    </CustomTooltip>
                </div>
            </foreignObject>
            {edge.data.query &&
                <QueryComponentDialog
                    open={open}
                    selectedValue={""}
                    componentLabel={edge.data.query.query}
                    onClose={() => setOpen(false)}
                    queryObject={edge.data.query}
                    onQueryChange={handleClose}
                />
            }
        </>
    )
}

export const DirectlyFollowsEdge = (edge: EdgeProps) => {
    const [edgePath, labelX, labelY] = getPath(edge, 0);
    const [topEdgePath, topLabelX, topLabelY] = getPath(edge, 5);
    const [bottomEdgePath, bottomLabelX, bottomLabelY] = getPath(edge, -5);
    const [open, setOpen] = useState(false);

    const onDelete = () => {
        edge.data.onDelete();
    }

    const handleClose = (query: any) => {
        setOpen(false);
        edge.data.onQueryChange(query);
    }

    const isNegated = edge.data.query["boolean_operator"] === "NOT";

    return (
        <>
            <path
                id={edge.id}
                style={{...edge.style, strokeWidth: '0.1rem', stroke: isNegated? "red" : ""}}
                strokeDasharray={isNegated? "5,5": ""}
                className="react-flow__edge-path"
                d={edgePath}
                markerEnd={edge.markerEnd}
            />
            <path
                id={edge.id}
                style={{...edge.style, strokeWidth: '0.1rem', stroke: isNegated? "red" : ""}}
                strokeDasharray={isNegated? "5,5": ""}
                className="react-flow__edge-path"
                d={topEdgePath}
            />
            <path
                id={edge.id}
                style={{...edge.style, strokeWidth: '0.1rem', stroke: isNegated? "red" : ""}}
                strokeDasharray={isNegated? "5,5": ""}
                className="react-flow__edge-path"
                d={bottomEdgePath}
            />
            <text dy={-11}>
                <textPath href={`#${edge.id}`} startOffset={"25%"} textAnchor={"middle"}>
                    p {edge.data.pContent}
                </textPath>
            </text>
            <text dy={-11}>
                <textPath href={`#${edge.id}`} startOffset={"75%"} textAnchor={"middle"}>
                    n {edge.data.beforeContent}
                </textPath>
            </text>
            <text dy={25}>
                <textPath href={`#${edge.id}`} startOffset={"50%"} textAnchor={"middle"}>
                    {edge.data.perfContent}
                </textPath>
            </text>
            <foreignObject
                width={foreignObjectSize}
                height={foreignObjectSize}
                x={labelX - foreignObjectSize - foreignObjectSize / 2}
                y={labelY - foreignObjectSize / 2}
                className="edgebutton-foreignobject"
                requiredExtensions="http://www.w3.org/1999/xhtml"
            >
                <div>
                    <IconButton onClick={() => setOpen(true)}>
                        <ChangeCircleIcon />
                    </IconButton>
                </div>
            </foreignObject>
            <foreignObject
                width={foreignObjectSize}
                height={foreignObjectSize}
                x={labelX - foreignObjectSize / 2}
                y={labelY - foreignObjectSize / 2}
                className="edgebutton-foreignobject"
                requiredExtensions="http://www.w3.org/1999/xhtml"
            >
                <div>
                    <IconButton onClick={onDelete}>
                        <CancelIcon />
                    </IconButton>
                </div>
            </foreignObject>
            <foreignObject
                width={foreignObjectSize}
                height={foreignObjectSize}
                x={labelX + foreignObjectSize / 2}
                y={labelY - foreignObjectSize / 2}
                className="edgebutton-foreignobject"
                requiredExtensions="http://www.w3.org/1999/xhtml"
            >
                <div style={{position: 'relative' }}>
                    <CustomTooltip title={getTooltip(edge.data.query)}>
                        <InfoIcon
                            onClick={() => console.log("click")}
                            color={"action"}
                            sx={{cursor: 'pointer'}}
                        />
                    </CustomTooltip>
                </div>
            </foreignObject>
            {edge.data.query &&
                <QueryComponentDialog
                    open={open}
                    selectedValue={""}
                    componentLabel={edge.data.query.query}
                    onClose={() => setOpen(false)}
                    queryObject={edge.data.query}
                    onQueryChange={handleClose}
                />
            }
        </>
    )
}

export const OrEdge = (edge: EdgeProps) => {
    const [edgePath, labelX, labelY] = getPath(edge, 0);
    const onDelete = () => {
        edge.data.onDelete();
    }
    return (
        <>
            <path
                id={edge.id}
                style={{...edge.style, strokeWidth: '0.1rem', strokeDasharray: 5}}
                className="react-flow__edge-path"
                d={edgePath}
            />
            <foreignObject
                width={foreignObjectSize}
                height={foreignObjectSize}
                x={labelX - foreignObjectSize / 2}
                y={labelY - foreignObjectSize / 2}
                className="edgebutton-foreignobject"
                requiredExtensions="http://www.w3.org/1999/xhtml"
            >
                <div>
                    <IconButton onClick={onDelete}>
                        <CancelIcon />
                    </IconButton>
                </div>
            </foreignObject>
        </>
    )
}

const getPath = (edge: EdgeProps, offset: number): [string, number, number] => {
    const offsetX = offset !== 0? -6 : 0
    const [edgePath, labelX, labelY] = getBezierPath({
        sourceX: edge.sourceX-2,
        sourceY: edge.sourceY+offset,
        sourcePosition: edge.sourcePosition,
        targetX: edge.targetX+offsetX,
        targetY: edge.targetY+offset,
        targetPosition: edge.targetPosition,
    });
    return [edgePath, labelX, labelY];
}