import React, {Dispatch, SetStateAction, useEffect, useMemo, useState} from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import InputLabel from '@mui/material/InputLabel';
import Alert from '@mui/material/Alert';
import Collapse from '@mui/material/Collapse';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import Select, { SelectChangeEvent } from '@mui/material/Select'
import Autocomplete from '@mui/material/Autocomplete';
import Slider from '@mui/material/Slider';
import Divider from '@mui/material/Divider';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import SaveIcon from '@mui/icons-material/Save';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import PlayCircleFilledWhiteOutlinedIcon from '@mui/icons-material/PlayCircleFilledWhiteOutlined';
import LastPageOutlinedIcon from '@mui/icons-material/LastPageOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import KeyboardDoubleArrowRightOutlinedIcon from '@mui/icons-material/KeyboardDoubleArrowRightOutlined';
import DragHandleOutlinedIcon from '@mui/icons-material/DragHandleOutlined';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import PostAddOutlinedIcon from '@mui/icons-material/PostAddOutlined';
import TypeSpecimenOutlinedIcon from '@mui/icons-material/TypeSpecimenOutlined';
import FontDownloadOutlinedIcon from '@mui/icons-material/FontDownloadOutlined';
import VisibilityIcon from '@mui/icons-material/Visibility';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemAvatar from '@mui/material/ListItemAvatar';
import ListItemText from '@mui/material/ListItemText';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import RadioGroup from '@mui/material/RadioGroup';
import {getURI} from "../utils";
import '../Session/Session.css';
import './Query.css';
import IconButton from "@mui/material/IconButton";
import {Box, Checkbox, Input, OutlinedInput, TextField} from "@mui/material";
import { QueryCreator } from "../QueryCreator/QueryCreator";
import {Edge, Node} from "reactflow";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {
    faAtom, faCircleCheck, faClose
} from "@fortawesome/free-solid-svg-icons";
import {Link} from "react-router-dom";
import InfoIcon from '@mui/icons-material/Info';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Tooltip, { TooltipProps, tooltipClasses } from '@mui/material/Tooltip';
import {styled} from "@mui/material/styles";
import Paper, { PaperProps } from '@mui/material/Paper';
import Draggable from 'react-draggable';
import {Export} from "../Settings/Export";
import Backdrop from '@mui/material/Backdrop';
import CircularProgress  from '@mui/material/CircularProgress';
import {usedObjectTypes} from "../QueryCreator/QueryCreator";
import {confirmationDialog} from "../QueryCreator/QueryCreator";
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import dayjs, { Dayjs } from 'dayjs';

export function PaperComponent(props: PaperProps) {
    return (
        <Draggable
            handle="#draggable-dialog-title"
            cancel={'[class*="MuiDialogContent-root"]'}
        >
            <Paper {...props} />
        </Draggable>
    );
}

export type QueryState = {
    data: string | object,
    left?: QueryState,
    right?: QueryState
}

export function Query(){

    let ocel = localStorage.getItem('ocel');

    const [queryFile, setQueryFile] = useState('');
    // Currently, hard-coded file path (until ocel uploading works)
    const [filePath, setFilePath] = useState(ocel? ocel : 'data/order_process.jsonocel');

    const [timer, setTimer] = useState(0);

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);

    if (ocel === null){
        localStorage.setItem('ocel', 'data/order_process.jsonocel');
        ocel = 'data/order_process.jsonocel'
    }

    // TODO: add props.ocel dependency later on
    useEffect(() => {
        const fetchData = async () => {
            setBackgroundText("Initializing OCEL (Fetching activities)...");
            setBackdropStage(20);
            setBackdropOpen(true);
            const activities = await getActivities();
            setBackgroundText("Fetching object types...");
            setBackdropStage(40);
            const objectTypes = await getObjectTypes();
            setBackgroundText("Initializing query / process executions (Fetching objects)...");
            setBackdropStage(60);
            const objects: object = await getObjects();
            setBackgroundText("Fetching Process Executions...");
            setBackdropStage(80);
            const count: number = await getPECount();
            setBackgroundText("Finishing up...");
            setBackdropStage(100);
            Object.keys(objects).forEach((objectType: string) => {
                localStorage.setItem(objectType, JSON.stringify(objects[objectType as keyof typeof objects]));
                const arr = objects[objectType as keyof typeof objects];
                if (Array.isArray(arr))
                    { // @ts-ignore
                        console.log(objectType + ": " + arr.length)
                    }
            })
            localStorage.setItem('all_objects', JSON.stringify(objects));
            localStorage.setItem('activities', JSON.stringify(activities));
            localStorage.setItem('objectTypes', JSON.stringify(objectTypes));
            localStorage.setItem('count', JSON.stringify(count));
            setBackdropOpen(false);
        }
        fetchData().catch(console.error);
    }, [])

    const [query, setQuery] = useState({});
    const [queryCount, setQueryCount] = useState(-1);
    const [queryIndices, setQueryIndices] = useState<number[]>([]);
    const [queryExecution, setQueryExecution] = useState('');
    const [open, setOpen] = useState(false);
    const [backdropOpen, setBackdropOpen] = useState(false);
    const [backgroundText, setBackgroundText] = useState("test");
    const [backdropStage, setBackdropStage] = useState(0);

    const handleBackdropClose = () => {
        setBackdropOpen(false);
    }

    const onQueryStart = () => {
        setQueryExecution('start');
        const start = new Date().getTime();
        setTimer(0);
        return setInterval(() => {setTimer((new Date().getTime() - start) / 1000)}, 100);
    }

    const onQueryEnd = (countTimer: ReturnType<typeof setInterval> | null, result: string) => {
        countTimer && clearInterval(countTimer);
        if (result === "success"){
            setQueryExecution('finish');
        } else if (result === "saved") {
            setQueryExecution('saved');
        } else {
            setQueryExecution('fail');
        }
        setOpen(true);
        setTimeout(() => {
            setOpen(false);
        }, 3000)
    }

    // should be QueryState
    async function storeQuery(query: any) {
        const uri = getURI("/logs/save_query", {});
        await fetch(uri, {
            method: 'PUT',
            headers: {
                "Content-type": "application/json"
            },
            body: JSON.stringify({
                query: query,
                name: "test"
            })
        })
            .then((response) => response.json())
            .then((result) => {
                if (result.status === "successful") {
                    console.log("Storing of query " + result.name + " successful!");
                    onQueryEnd(null, "saved");
                    setQueryFile(result.name);
                }
            })
            .catch(err => {
                console.error("Error in uploading ...", err);
            });
    }

    async function executeDnDQuery() {
        const uri = getURI("/pq/query_to_graph", {});
        const timerInterval = onQueryStart();
        await fetch(uri, {
            method: 'PUT',
            headers: {
                "Content-type": "application/json"
            },
            body: JSON.stringify({
                query: query,
                file_path: filePath,
                exact: true,
            })
        })
            .then((response) => response.json())
            .then((result) => {
                setQueryIndices(result.indices);
                localStorage.setItem('indices', result.indices);
                setQueryCount(result.length);
                onQueryEnd(timerInterval, "success");
            })
            .catch(err => {
                console.log("Error in uploading ...", err);
                setQueryCount(NaN);
                onQueryEnd(timerInterval, "fail");
            });

    }

    console.log(query)

    const setNodesAndEdges = (nodes: Node[], edges: Edge[]) => {
        setNodes(nodes);
        setEdges(edges);
    }

    return (
        <div>
            <div className={"Content"}>
                <Backdrop
                    sx={{ color: '#fff', zIndex: (theme) => theme.zIndex.drawer + 1 }}
                    open={backdropOpen}
                    onClick={handleBackdropClose}
                >
                    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                        <Stack direction={"column"} justifyContent={"center"} alignItems={"center"}>
                            <CircularProgress color="inherit" />
                            <Box
                                sx={{
                                    top: 0,
                                    left: 0,
                                    bottom: 50,
                                    right: 0,
                                    position: 'absolute',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}
                            >
                                <Typography
                                    variant="caption"
                                    component="div"
                                    color="white"
                                >{`${backdropStage}%`}</Typography>
                            </Box>
                            <p style={{alignItems: "center"}}>
                                {backgroundText}
                            </p>
                        </Stack>
                    </Box>


                </Backdrop>
                <BooleanSelect
                    onChange={setQuery}
                    onDnDChange={setNodesAndEdges}
                    depth={0}
                    position={""}
                />
                {/* {(booleanOperator === "AND" || booleanOperator === "OR") && (
                    <React.Fragment>
                        {Array.from(Array(operatorCount)).map((x, index) =>
                            <BooleanSelect
                                style={{paddingLeft: '2rem'}}
                                onChange={setQuery}
                                key={index}
                                depth={1}
                                onCrossClick={() => setOperatorCount(operatorCount-1)}
                            />
                        )}
                    </React.Fragment>
                )} */}
            </div>
            <Stack direction={"column"} spacing={1} justifyContent={"center"}>
                <Stack direction={"row"} spacing={2} justifyContent={"center"}>
                    {/* <Button onClick={() => {storeQuery(query)}} variant={"outlined"} color={"primary"}>
                        Save query
                        <SaveIcon sx={{ml: 1}}/>
                    </Button>
                    <Button onClick={() => {executeDnDQuery()}} variant={"outlined"}>
                        Execute query
                        <PlayCircleOutlineIcon sx={{ml: 1}}/>
                    </Button> */}
                    <div className="EventLogList-SelectButton" onClick={() => {storeQuery(query)}}>
                        <SaveIcon sx={{ml: 1}}/>
                        Save query
                    </div>
                    <div className="EventLogList-SelectButton" onClick={() => {executeDnDQuery()}}>
                        <PlayCircleOutlineIcon sx={{ml: 1}}/>
                        Execute query
                    </div>
                </Stack>
                {queryExecution === "start" && (
                    <Alert variant={"outlined"} severity={"info"}>Query is being executed. Took {timer} seconds until now.</Alert>
                )}
                {queryExecution === "finish" && (
                    <Collapse in={open}>
                        <Alert
                            variant={"outlined"}
                            severity={"success"}
                            action={
                                <IconButton
                                    aria-label="close"
                                    color="inherit"
                                    size="small"
                                    onClick={() => {
                                        setOpen(false);
                                    }}
                                >
                                    <CloseIcon fontSize="inherit" />
                                </IconButton>
                            }
                        >Query executed. Took {timer} seconds.</Alert>
                    </Collapse>
                )}
                {queryExecution === "fail" && (
                    <Collapse in={open}>
                        <Alert
                            variant={"outlined"}
                            severity={"error"}
                            action={
                                <IconButton
                                    aria-label="close"
                                    color="inherit"
                                    size="small"
                                    onClick={() => {
                                        setOpen(false);
                                    }}
                                >
                                    <CloseIcon fontSize="inherit" />
                                </IconButton>
                            }
                        >Query failed. Took {timer} seconds.</Alert>
                    </Collapse>
                )}
                {queryExecution === "saved" && (
                    <Collapse in={open}>
                        <Alert
                            variant={"outlined"}
                            severity={"success"}
                            action={
                                <IconButton
                                    aria-label="close"
                                    color="inherit"
                                    size="small"
                                    onClick={() => {
                                        setOpen(false);
                                    }}
                                >
                                    <CloseIcon fontSize="inherit" />
                                </IconButton>
                            }
                        >Query saved.</Alert>
                    </Collapse>
                )}
                {queryCount >= 0 && (
                    <Stack direction={"row"} justifyContent={"center"}>
                        <Stack direction={"column"} justifyContent={"center"}>
                            <h3>
                                PEs: {queryCount} of {localStorage.getItem('count')}
                            </h3>
                            <div>
                                <h3>
                                    Indices: {queryIndices.join(", ")}
                                </h3>
                                {/* <IconButton
                                    component={Link}
                                    target={"_blank"}
                                    to={"/process_execution_viewer"}
                                    sx={{
                                        width: '10rem',
                                        height: '2rem',
                                        borderRadius: '1rem',
                                        border: '0.1rem solid',
                                    }}
                                    onClick={() => {}}
                                >
                                    <VisibilityIcon sx={{mr: '0.5rem'}} /> View PEs
                                </IconButton> */}
                                <Stack direction={"row"} justifyContent={"center"}>
                                    <Link to={"/process_execution_viewer"} target={"_blank"} style={{ textDecoration: 'none' }}>
                                        <div className="EventLogList-SelectButton" onClick={() => {}} style={{"width": "100%", "marginBottom": "1rem"}}>
                                            <VisibilityIcon sx={{mr: '0.5rem'}} />
                                            View PEs
                                        </div>
                                    </Link>
                                </Stack>
                            </div>
                            <Export />
                        </Stack>
                    </Stack>
                )}
            </Stack>
        </div>
    )
}

type BooleanSelectProps = {
    onChange: (value: object) => void;
    onDnDChange?: (nodes: Node[], edges: Edge[]) => void;
    style?: any;
    depth: number;
    position: string;
}

const BooleanSelect = (props: BooleanSelectProps) => {
    // TODO: remove cross button when only two remaining

    const [booleanOperator, setBooleanOperator] = useState('QUERY');
    const [operatorCount, setOperatorCount] = useState(0);
    const [query, setQuery] = useState({});
    const [leftQuery, setLeftQuery] = useState({});
    const [rightQuery, setRightQuery] = useState({});

    useEffect(() => {
        if ((booleanOperator === "AND" || booleanOperator === "OR") && operatorCount === 0){
            setOperatorCount(2);
        }
    }, [booleanOperator, operatorCount])

    const handleChange = (event: SelectChangeEvent) => {
        setBooleanOperator(event.target.value as string);
    };

    const handleClose = (value: object) => {
        setQuery(value);
        props.onChange(createQuery(value));
    }

    const handleDnDClose = (nodes: Node[], edges: Edge[]) => {
        if (props.onDnDChange)
            props.onDnDChange(nodes, edges);
        console.log(nodes)
        setQuery({nodes: nodes, edges: edges});
        props.onChange(createQuery({nodes: nodes, edges: edges}))
    }

    const handleLeftChange = (value: object) => {
        setLeftQuery(value);
        // Check if right query is set already, if yes, propagate to top
        if (Object.keys(value).length !== 0 && Object.keys(rightQuery).length !== 0){
            props.onChange(combineQueries(value, rightQuery));
        }
    }

    const handleRightChange = (value: object) => {
        setRightQuery(value);
        // Check if right query is set already, if yes, propagate to top
        if (Object.keys(value).length !== 0 && Object.keys(leftQuery).length !== 0){
            props.onChange(combineQueries(leftQuery, value));
        }
    }

    const combineQueries = (left: object, right: object) => {
        console.log(left)
        console.log(right)
        return {"data": booleanOperator, "left": createQuery(left), "right": createQuery(right)}
    }

    const createQuery = (query: object) => {
        if (booleanOperator === "NOT") {
            return {"data": {...query, "boolean_operator": "NOT"}}
        } else if (booleanOperator === "QUERY") {
            return {"data": query}
        } else {
            return query
        }
    }

    return (
        <React.Fragment>
            <Stack direction={"row"} spacing={2} justifyContent={"center"}>
                <QueryDnD onDone={handleDnDClose} name={props.depth + props.position}/>
            </Stack>
            <Stack
                sx={{ ...props.style,
                    maxWidth: (booleanOperator === "AND" || booleanOperator === "OR")? '14rem' : '30rem',
                    minWidth: props.depth === 0? '10rem': '12rem',
                    paddingTop: '1rem' }}
                direction={"row"}
                spacing={1}>
                    {/*<InputLabel id="demo-simple-select-label">Operator</InputLabel>
                    <Select
                        labelId="demo-simple-select-label"
                        id="demo-simple-select"
                        value={booleanOperator}
                        label="Operator"
                        onChange={handleChange}
                    >
                        <MenuItem value={'QUERY'}>QUERY</MenuItem>
                        <MenuItem value={'AND'}>AND</MenuItem>
                        <MenuItem value={'OR'}>OR</MenuItem>
                        <MenuItem value={'NOT'}>NOT</MenuItem>
                    </Select> */}
                {(booleanOperator === "AND" || booleanOperator === "OR") && (
                    <React.Fragment>
                        <IconButton onClick={() => {setOperatorCount(operatorCount+1)}}>
                            <AddCircleOutlineIcon></AddCircleOutlineIcon>
                        </IconButton>
                    </React.Fragment>
                )}
                {(booleanOperator === "_QUERY" || booleanOperator === "NOT") && (
                    <React.Fragment>
                        <QuerySelect onClose={handleClose} />
                        <QueryDnD onDone={handleDnDClose} name={props.depth + props.position}/>
                    </React.Fragment>
                )}
                {(props.depth !== undefined && props.depth > 0) && (
                    <IconButton onClick={() => {}}>
                        <CloseIcon></CloseIcon>
                    </IconButton>
                )}
            </Stack>
            {(booleanOperator === "AND" || booleanOperator === "OR") && (
                <React.Fragment>
                    {/* {Array.from(Array(operatorCount)).map((x, index) =>
                        <BooleanSelect
                            style={{paddingLeft: `${(props.depth+1)*2}rem`}}
                            onChange={setQuery}
                            key={index}
                            depth={props.depth+1}
                        />
                    )} */}
                    <BooleanSelect
                        onChange={handleLeftChange}
                        depth={props.depth+1}
                        style={{paddingLeft: `${(props.depth+1)*2}rem`}}
                        position={"left"}
                    />
                    <BooleanSelect
                        onChange={handleRightChange}
                        depth={props.depth+1}
                        style={{paddingLeft: `${(props.depth+1)*2}rem`}}
                        position={"right"}
                    />
                </React.Fragment>
            )}
        </React.Fragment>
    )
}

type QueryDndProps = {
    onDone: any;
    name: string;
}

const QueryDnD = (props: QueryDndProps) => {

    const [open, setOpen] = React.useState(false);

    const [closeDialogOpen, setCloseDialogOpen] = useState(false);

    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);

    const [initialNodes, setInitialNodes] = useState<Node[]>([]);
    const [initialEdges, setInitialEdges] = useState<Edge[]>([]);

    const handleClickOpen = () => {
        setOpen(true);
    };

    const closeDialog = useMemo(() => {
        const text = "The current query has changed and all changes will be lost if you decide to proceed.";
        const title = "Do you really want to close the Query DnD?";
        return confirmationDialog(closeDialogOpen, setCloseDialogOpen, text, title, () => setOpen(false));
    }, [closeDialogOpen]);

    const handleClose = () => {
        if ((nodes.length !== 0 || edges.length !== 0) && (
            JSON.stringify(initialNodes) !== JSON.stringify(nodes) ||
            JSON.stringify(initialEdges) !== JSON.stringify(edges))
        ) {
            setCloseDialogOpen(true);
        } else {
            setOpen(false);
        }
    };

    const onQueryDone = (nodes: Node[], edges: Edge[]) => {
        console.log(nodes)
        console.log(edges)
        setNodes(nodes);
        setEdges(edges);
        props.onDone(nodes, edges);
        // Iterate over edges and nodes and build a query
        // First: Change backend to be able to handle new types of connected queries
        // Idea: For each PE go through whole connected query?
        setOpen(false);
    }

    const onQueryChange = (nodes: Node[], edges: Edge[]) => {
        setNodes(nodes);
        setEdges(edges);
        props.onDone(nodes, edges);
    }

    return (
        <React.Fragment>
            <Button onClick={handleClickOpen} variant={"outlined"} color={"primary"} style={{"marginTop": "3rem"}}>
                Create Query
            </Button>
            <Dialog
                onClose={handleClose}
                open={open}
                PaperProps={{style: {borderRadius: '1rem', minWidth: '99vw', minHeight: '99vh'}}}
                id={"DnDDialog"}
            >
                <DialogTitle sx={{textAlign: "center", paddingTop: '0.2vh'}}>
                    <Box display="flex" alignItems="center">
                        <Box flexGrow={1} >Query DnD</Box>
                        <Box>
                            <IconButton onClick={handleClose}>
                                <FontAwesomeIcon icon={faClose}/>
                            </IconButton>
                        </Box>
                    </Box>
                </DialogTitle>
                <QueryCreator
                    onClose={onQueryDone}
                    nodes={nodes}
                    edges={edges}
                    name={props.name}
                    onQueryChange={onQueryChange}
                    onNodesInit={(nodes: Node[]) => setInitialNodes(nodes)}
                    onEdgesInit={(edges: Edge[]) => setInitialEdges(edges)}
                />
            </Dialog>
            {closeDialog}
        </React.Fragment>
    )
}

type QuerySelectProps = {
   onClose: (value: object) => void;
   isDnD?: boolean;
}

export const QuerySelect = (props: QuerySelectProps) => {

    const [open, setOpen] = React.useState(false);
    const [selectedValue, setSelectedValue] = React.useState({});

    const handleClickOpen = () => {
        setOpen(true);
    };

    const handleClose = (value: object) => {
        setOpen(false);
        setSelectedValue(value);
        props.onClose(value);
    };

    return (
        <React.Fragment>
            <IconButton onClick={handleClickOpen} color={Object.keys(selectedValue).length !== 0 && !props.isDnD? 'success': 'default'}>
                <FontAwesomeIcon icon={faAtom} />
            </IconButton>
            <SelectDialog open={open} selectedValue={selectedValue} onClose={handleClose} />
        </React.Fragment>
    )
}

export const CustomTooltip = styled(({ className, ...props }: TooltipProps) => (
        <Tooltip {...props} arrow classes={{ popper: className }} placement={"right"} />
    ))(({ theme }) => ({
        [`& .${tooltipClasses.tooltip}`]: {
            backgroundColor: '#f5f5f9',
            color: 'rgba(0, 0, 0, 0.87)',
            maxWidth: 220,
            fontSize: theme.typography.pxToRem(20),
            border: '1px solid #dadde9',
        },
        [`& .${tooltipClasses.arrow}`]: {
            color: '#f5f5f9',
        },
}));

type SelectDialogProps = {
    open: boolean;
    selectedValue: object;
    onClose: (value: object) => void;
}

const SelectDialog = (props: SelectDialogProps) => {
    // const { onClose, selectedValue, open } = props;

    const [open, setOpen] = useState(false);
    const [selectedValue, setSelectedValue] = useState('');
    const [queryObject, setQueryObject] = useState({});
    const [label, setLabel] = useState('');

    const handleDialogClose = (value: object) => {
        setOpen(false);
        // Dirty fix?:
        // Uncommented because of Query DnD, might need later again
        props.onClose(value);
    };

    const handleClose = () => {
        props.onClose(queryObject);
    };

    const handleListItemClick = (value: string, label: string) => {
        // Get needed component
        const queryObject = getQueryObject(value);
        setQueryObject(queryObject);
        setLabel(label);
        setOpen(true);
    };

    const components: any[] = [
        ["Start Event", "isStart", <PlayCircleFilledWhiteOutlinedIcon />],
        ["End Event", "isEnd", <LastPageOutlinedIcon />],
        ["Contains Event", "isContainedEvent", <ArticleOutlinedIcon />],
        ["Contains Events", "areContainedEvents", <PostAddOutlinedIcon />],
        //"Event", "Event", <LastPageOutlinedIcon />],
        ["Directly Follows", "isDirectlyFollowed", <KeyboardDoubleArrowRightOutlinedIcon />],
        ["Eventually Follows", "isEventuallyFollowed", <ArrowForwardOutlinedIcon />],
        ["Contains Objects of Type", "containsObjectsOfType", <FontDownloadOutlinedIcon />],
        ["Contains Objects", "containsObjects", <TypeSpecimenOutlinedIcon/>],
        //["Parallel Events (TBD)", "isParallel", <DragHandleOutlinedIcon sx={{transform: 'rotate(90deg)'}}/>]
    ]

    return (
        <React.Fragment>
            <Dialog
                onClose={handleClose}
                open={props.open}
                PaperProps={{style: {borderRadius: '1rem'}}}
                PaperComponent={PaperComponent}
                aria-labelledby="draggable-dialog-title"
            >
                <DialogTitle sx={{textAlign: "center", cursor: "move"}} id={"draggable-dialog-title"}>
                    <Box display="flex" alignItems="center">
                        <Box flexGrow={1} >Choose query component</Box>
                        <Box>
                            <IconButton onClick={handleClose}>
                                <FontAwesomeIcon icon={faClose}/>
                            </IconButton>
                        </Box>
                    </Box>
                </DialogTitle>
                <List sx={{ pt: 0 }}>
                    {components.map((component, index) => (
                        <>
                            <Stack direction={"row"} justifyContent={"space-between"} spacing={2} alignItems={"center"} sx={{mr: 2}}>
                                <ListItem button onClick={() => handleListItemClick(component[1], component[0])} key={index}>
                                    <ListItemAvatar>
                                        {component[2]}
                                    </ListItemAvatar>
                                    <ListItemText primary={component[0]} />
                                </ListItem>
                                <CustomTooltip title={getHoverText(component[1])} >
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
            </Dialog>
            <QueryComponentDialog
                open={open}
                selectedValue={selectedValue}
                onClose={handleDialogClose}
                componentLabel={label}
                queryObject={queryObject}
                onQueryChange={setQueryObject}
            />
        </React.Fragment>
    )
}

function getHoverText(label: string){
    switch(label) {
        case "isStart": {
            return "Start Event";
        }
        case "isEnd": {
            return "End Event";
        }
        case "Event": {
            return "Event";
        }
        case "isDirectlyFollowed": {
            return "Directly Follows";
        }
        case "isEventuallyFollowed": {
            return "Eventually Follows";
        }
        case "isContainedEvent": {
            return "Contains Event";
        }
        case "areContainedEvents": {
            return "Contains Events";
        }
        case "containsObjectsOfType": {
            return "Contains Objects of Type";
        }
        case "containsObjects": {
            return "Contains Objects";
        }
        case "isParallel":
            return "TBD";
    }
}

type QueryDropdownProps = { label: string, values: string[] } & (
    {isMulti: false, selected: string | null, setSelected: Dispatch<SetStateAction<string | null>>} |
    {isMulti: true,  selected: string[],      setSelected: Dispatch<SetStateAction<string[]>>});

export function QueryDropdown(props: QueryDropdownProps) {
    //if (!props.selected)
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
                defaultValue={props.values[0]}
                onChange={handleChange}
                input={<OutlinedInput label={props.label}/>}
                renderValue={
                    (selected: string | string[]) => {
                        if (typeof selected === "string")
                            return selected
                        return selected.join(", ");
                    }
                }
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

type QueryAutocompleteProps = { label: string, values: string[], hideFilteredOptions: boolean } & (
    {isMulti: false, selected?: string | null, setSelected: Dispatch<SetStateAction<string | null>>} |
    {isMulti: true,  selected?: string[],      setSelected: Dispatch<SetStateAction<string[]>>});

export function QueryAutocomplete(props: QueryAutocompleteProps){
    // Needed for event_activity and object_type since there can be too many to scroll through
    // if (!props.selected)
    //   return null;

    const splitIndex = props.values.indexOf("ANY");

    const handleChange = (event: any, newValue: string | string[] | null) => {
        let valuesArray;
        if (newValue === null)
            return
        if (typeof newValue === "string") {
            if (newValue.slice(0,2) === "WC")
                newValue = newValue.split(" ")[0];
            valuesArray = [newValue];
        } else {
            valuesArray = newValue;
        }

        if (props.isMulti)
            props.setSelected(valuesArray);
        else
            props.setSelected(valuesArray[0]);
    }

    return (
        <FormControl size="small" sx={{width: '100%', marginTop: 2}}>
            <Autocomplete
                id={props.label}
                options={props.values}
                groupBy={(option) => {
                    if (props.isMulti)
                        return "";
                    if (props.values.indexOf(option) < splitIndex)
                        return "Object types";
                    else
                        return "Wildcards";
                }}
                multiple={props.isMulti}
                filterSelectedOptions={props.hideFilteredOptions}
                onChange={handleChange}
                value={props.selected && props.selected.length !== 0 && props.selected[0] !== '' ? props.selected : props.isMulti? [] : ""}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        variant={"standard"}
                        label={props.label}
                        placeholder={props.label}
                        required={true}
                    />
                )
                }
            />
        </FormControl>
    );
}

type QuerySliderProps = {
    onChange: any;
    selected?: any;
}

export function QuerySlider(props: QuerySliderProps){
    // Needed for p (0-1.0)
    const [value, setValue] = useState<number | string | Array<number | string>>(props.selected? props.selected : 1.0);

    const handleSliderChange = (event: Event, newValue: number | number[]) => {
        setValue(newValue);
        props.onChange(newValue);
    };

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value === '' ? '' : Number(event.target.value));
        props.onChange(event.target.value === '' ? '' : Number(event.target.value));
    };

    const handleBlur = () => {
        if (value < 0) {
            setValue(0);
            props.onChange(0);
        } else if (value > 1) {
            setValue(1);
            props.onChange(1);
        }
    }

    return (
        <Stack width={'100%'} direction={"row"} spacing={2} sx={{marginTop: '1rem'}}>
            <div>
                p
            </div>
            <Slider
                size="small"
                value={typeof value === "number"? value : 0}
                step={0.001}
                min={0}
                max={1.0}
                onChange={handleSliderChange}
                aria-label="Small"
                valueLabelDisplay="auto"
            />
            <Input
                value={value}
                size={"small"}
                onChange={handleInputChange}
                onBlur={handleBlur}
                inputProps={{
                    step: 0.001,
                    min: 0,
                    max: 1,
                    type: 'number'
                }}
            />
        </Stack>
    )
}

type QueryInputProps = {
    onChange: any;
    selected: any;
    label?: string;
}

export function QueryInput(props: QueryInputProps){
    // Needed for n (any number)
    // TODO: maybe set maximum to max number of objects in PE?
    const [value, setValue] = useState<number | string | Array<number | string>>(props.selected);

    const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setValue(event.target.value === '' ? '' : Number(event.target.value));
        props.onChange(event.target.value === '' ? '' : Number(event.target.value));
    };

    const handleBlur = () => {
        if (value < 0) {
            setValue(0);
        }
        if (typeof value === "number") {
            setValue(Math.round(value));
        }
    }

    return (
        <Stack width={'100%'} sx={{marginTop: '1rem'}} spacing={1} direction={"row"}>
            <div>
                {props.label?? "n"}
            </div>
            <Input
                value={value}
                size={"small"}
                onChange={handleInputChange}
                onBlur={handleBlur}
                inputProps={{
                    step: 1,
                    min: 0,
                    type: 'number'
                }}
            />
        </Stack>
    )
}

type QueryRadioButtonProps = {
    onChange: any;
    selected: string;
}

export function QueryRadioButton(props: QueryRadioButtonProps){
    const [value, setValue] = useState<string>(props.selected);

    const handleChange = (value: string) => {
        setValue(value);
        props.onChange(value);
    }

    return (
        <FormControl>
            <RadioGroup
                row
                aria-labelledby="demo-controlled-radio-buttons-group"
                name="controlled-radio-buttons-group"
                value={value}
                sx={{mt: 1, mb: 1}}
            >
                <Button
                    color={"success"}
                    variant={value? "outlined" : "contained"}
                    sx={{borderRadius: "0.2rem 0 0 0.2rem", mr: "-1px"}}
                    onClick={() => handleChange("")}
                >
                    Positive
                </Button>
                <Button
                    color={"error"}
                    variant={value? "contained" : "outlined"}
                    sx={{borderRadius: "0 0.2rem 0.2rem 0"}}
                    onClick={() => handleChange("NOT")}
                >
                    Negative
                </Button>
            </RadioGroup>
        </FormControl>
    )
}

function getInfoIconButton(title: string, type: string){
    let divStyle = {};
    switch(type) {
        case "boolean_operator":
            divStyle = {top: '1rem'};
            break;
        case "event_activity":
        case "object_type":
        case "first_activity":
        case "second_activity":
        case "first_type":
        case "second_type":
        case "needed_objects":
            divStyle = {top: '2.5rem'}
            break;
        case "quantifier":
        case "p_operator":
        case "n_operator":
        case "node_metric":
        case "node_metric_value":
        case "node_metric_operator":
        case "edge_metric":
        case "edge_metric_value":
        case "edge_metric_operator":
            divStyle = {top: '1.6rem'};
            break;
        case "p_mode":
            divStyle = {top: '0.5rem'};
            break;
        case "p":
            divStyle = {top: '4.5rem'};
            break;
        case "n":
            divStyle = {top: '1.6rem'};
            break;
    }
    return (
        <div style={{...divStyle, position: 'relative', left: '0.3rem'}}>
            <CustomTooltip title={title}>
                <InfoIcon
                    onClick={() => console.log("click")}
                    color={"action"}
                    fontSize={"small"}
                    sx={{cursor: 'pointer'}}
                />
            </CustomTooltip>
        </div>
    )
}

const durationToSeconds = (duration: Duration) => {
    return duration.days * 86400 + duration.hours * 3600 + duration.minutes * 60 + duration.seconds
}

const secondsToDuration = (seconds: number): Duration => {
    const days = Math.floor(seconds / 86400);
    seconds -= days * 86400;
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    return {days: days, hours: hours, minutes: minutes, seconds: seconds}
}

type QueryDurationPickerProps = {
    onChange: any;
    selected: number;
}

export const QueryDurationPicker = (props: QueryDurationPickerProps) => {

    const [value, setValue] = useState<Dayjs | null>(dayjs.unix(props.selected));

    const handleChange = (value: Dayjs | null) => {
        setValue(value);
        props.onChange(value?.unix());
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <DateTimePicker
                viewRenderers={{
                    hours: renderTimeViewClock,
                    minutes: renderTimeViewClock,
                    seconds: renderTimeViewClock,
                }}
                slotProps={{ textField: {size: "small"}}}
                sx={{mt: 1}}
                value={value}
                onChange={(newValue) => {handleChange(newValue)}}
            />
        </LocalizationProvider>
    )
}

type QueryComponentDialogProps = {
    open: boolean;
    selectedValue: string;
    onClose: (value: object) => void;
    componentLabel: string;
    queryObject: any;
    onQueryChange: any;
}

export const QueryComponentDialog = (props: QueryComponentDialogProps) => {
    // TODO: Check if all values filled and okay when clicking DONE (e.g. quantifier !== None when multiple selected)
    const { onClose, selectedValue, open } = props;

    const [component, setComponent] = useState<string[]>([]);
    const [query, setQuery] = useState(props.queryObject);
    const [pMode, setPMode] = useState(props.queryObject.p_mode?? "absolute");
    const [pChecked, setPChecked] = useState(props.queryObject.p_checked?? false);

    const [hasP, setHasP] = useState(false);
    const [hasN, setHasN] = useState(false);
    const [hasMetric, setHasMetric] = useState(false);
    const [metricType, setMetricType] = useState("");
    const [nodeMetric, setNodeMetric] = useState("");
    const [edgeMetric, setEdgeMetric] = useState("");
    const [duration, setDuration] = useState<Duration>(
        props.queryObject.node_metric_value?
            secondsToDuration(props.queryObject.node_metric_value) :
            {days: 0, hours: 0, minutes: 0, seconds: 0});
    const [edgeDuration, setEdgeDuration] = useState<Duration>(
        props.queryObject.edge_metric_value?
                secondsToDuration(props.queryObject.edge_metric_value) :
                {days: 0, hours: 0, minutes: 0, seconds: 0})

    useEffect(() => {
        if (component.indexOf("p") > -1)
            setHasP(true);
        else
            setHasP(false);
        if (component.indexOf("n") > -1)
            setHasN(true);
        else
            setHasN(false);
        if (component.indexOf("edge_metric") > -1) {
            setHasMetric(true);
            setEdgeMetric(props.queryObject["edge_metric"]);
            setMetricType("edge_metric");
        } else if (component.indexOf("node_metric") > -1) {
            setHasMetric(true);
            setNodeMetric(props.queryObject["node_metric"]);
            setMetricType("node_metric");
        } else
            setHasMetric(false);
    }, [component]);

    const handlePModeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const value = (event.target as HTMLInputElement).value;
        setPMode(value);
        changeQueryState(value, "p_mode");
    };

    useEffect(() => {
        let newComponent: string[] = []
        for (let key in props.queryObject){
            if (key !== "query")
                newComponent.push(key);
        }
        setComponent(newComponent);
        setQuery(props.queryObject);
    }, [props.queryObject])

    const handleClose = () => {
        onClose(query);
    };

    const changeQueryState = (value: SetStateAction<string | null> | number, label: string) => {
        setQuery({...query, [label]: value});
    }

    function getComponent(comp: string, index: number){
        switch(comp){
            case "p":
                return (
                    <FormControl fullWidth>
                        <RadioGroup
                            row
                            aria-labelledby="demo-controlled-radio-buttons-group"
                            name="controlled-radio-buttons-group"
                            value={pMode}
                            sx={{mt: 1, mb: 1}}
                        >
                            <Button
                                color={"primary"}
                                variant={pMode === "absolute"? "outlined" : "contained"}
                                sx={{borderRadius: "0.2rem 0 0 0.2rem", mr: "-1px"}}
                                onClick={() => {
                                    setPMode("relative");
                                    changeQueryState("relative", "p_mode");
                                }}
                            >
                                Relative
                            </Button>
                            <Button
                                color={"primary"}
                                variant={pMode === "absolute"? "contained" : "outlined"}
                                sx={{borderRadius: "0 0.2rem 0.2rem 0"}}
                                onClick={() => {
                                    setPMode("absolute");
                                    changeQueryState("absolute", "p_mode");
                                }}
                            >
                                Absolute
                            </Button>
                            {getInfoIconButton("p_mode", "p_mode")}
                        </RadioGroup>
                        {pMode === "relative" &&
                            <QuerySlider
                                onChange={(value: React.SetStateAction<string | null>) => {changeQueryState(value, comp)}}
                                selected={query[comp]}
                                key={index}
                            />
                        }
                        {pMode === "absolute" &&
                            <QueryInput
                                onChange={(value: React.SetStateAction<string | null>) => {changeQueryState(value, comp)}}
                                selected={query[comp]}
                                label={"p"}
                                key={index}
                            />
                        }
                        <Stack direction={"row"}>
                            <div style={{marginTop: '1rem'}}>
                                Must be same event:
                            </div>
                            <Checkbox
                                sx={{mt: 0.8, ml: 1}}
                                checked={pChecked}
                                onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                    setPChecked(event.target.checked);
                                    changeQueryState("" + event.target.checked, "same_event")
                                }}
                            />
                        </Stack>
                    </FormControl>
                )
            case "node_metric":
                return (
                    <FormControl fullWidth>
                        <QueryDropdown
                            label={comp}
                            values={getValues(comp, props.componentLabel)}
                            isMulti={false}
                            selected={query[comp]}
                            setSelected={(value) => {
                                setNodeMetric(value as string);
                                changeQueryState(value, comp);
                            }}
                            key={index}
                        />
                        {nodeMetric !== "timestamp" && nodeMetric !== "" && nodeMetric !== "node_metric" &&
                            <div style={{marginTop: '1rem'}}>
                                <DurationPicker
                                    value={duration}
                                    onDurationChange={(duration: Duration) => {
                                        setDuration(duration);
                                        changeQueryState(durationToSeconds(duration), "node_metric_value");
                                    }}
                                />
                            </div>
                        }
                        {nodeMetric === "timestamp" &&
                            <QueryDurationPicker
                                onChange={(value: React.SetStateAction<string | null>) => {
                                    changeQueryState(value, "node_metric_value");
                                }}
                                selected={query["node_metric_value"]}
                            />
                        }
                    </FormControl>
                )
            case "edge_metric":
                return (
                    <FormControl fullWidth>
                        <QueryDropdown
                            label={comp}
                            values={getValues(comp, props.componentLabel)}
                            isMulti={false}
                            selected={query[comp]}
                            setSelected={(value) => {
                                setEdgeMetric(value as string);
                                changeQueryState(value, comp);
                            }}
                            key={index}
                        />
                        {edgeMetric !== "" &&
                            <div style={{marginTop: '1rem'}}>
                                <DurationPicker
                                    value={edgeDuration}
                                    onDurationChange={(duration: Duration) => {
                                        setEdgeDuration(duration);
                                        changeQueryState(durationToSeconds(duration), "edge_metric_value");
                                    }}
                                />
                            </div>
                        }
                    </FormControl>
                )
            case "n":
                return (
                    <QueryInput
                        onChange={(value: React.SetStateAction<string | null>) => {changeQueryState(value, comp)}}
                        selected={query[comp]}
                        key={index}
                    />
                )
            case "event_activity":
            case "first_activity":
            case "second_activity":
                return (
                    <QueryAutocomplete
                        label={comp}
                        values={getValues(comp, props.componentLabel)}
                        isMulti={true}
                        hideFilteredOptions={true}
                        selected={query[comp]}
                        setSelected={(value) => { // @ts-ignore
                            changeQueryState(value, comp)}}
                        key={index}
                    />
                )
            case "object_type":
            case "first_type":
            case "second_type":
                return (
                    <QueryAutocomplete
                        label={comp}
                        values={getValues(comp, props.componentLabel)}
                        isMulti={false}
                        hideFilteredOptions={false}
                        selected={query[comp]}
                        setSelected={(value) => {changeQueryState(value, comp)}}
                        key={index}
                    />
                )
            case "needed_objects":
                return (
                    <QueryAutocomplete
                        label={comp}
                        values={getValues(comp, props.componentLabel, query['object_type'])}
                        hideFilteredOptions={true}
                        isMulti={true}
                        selected={query[comp]}
                        setSelected={(value) => { // @ts-ignore
                            changeQueryState(value, comp)}}
                        key={index}
                    />
                )
            case "boolean_operator":
                return (
                    <QueryRadioButton
                        onChange={(value: React.SetStateAction<string | null>) => {changeQueryState(value, comp)}}
                        selected={query[comp]}
                        key={index}
                    />
                )
            case "p_mode":
            case "firstNodeId":
            case "secondNodeId":
            case "node_metric_value":
            case "edge_metric_value":
                return (<></>)
            default:
                return (
                    <QueryDropdown
                        label={comp}
                        values={getValues(comp, props.componentLabel)}
                        isMulti={false}
                        selected={query[comp]}
                        setSelected={(value) => {changeQueryState(value, comp)}}
                        key={index}
                    />
                )
        }
    }

    return (
        <Dialog
            open={open}
            fullWidth
            maxWidth={'lg'}
            PaperProps={{style: {borderRadius: '1rem'}}}
            PaperComponent={PaperComponent}
            aria-labelledby="draggable-dialog-title"
        >
            <DialogTitle sx={{textAlign: "center", cursor: "move"}} id={"draggable-dialog-title"}>
                <Box display="flex" alignItems="center">
                    <Box flexGrow={1} >Select properties for {props.componentLabel}</Box>
                    <Box>
                        <IconButton onClick={() => onClose({})} sx={{right: 0}}>
                            <FontAwesomeIcon icon={faClose} />
                        </IconButton>
                    </Box>
                </Box>
            </DialogTitle>
            <div className={"Content"}>
                <List sx={{ pt: 0, marginRight: '1rem', marginLeft: '1rem', minWidth: '50rem' }}>
                    {component.map((comp, index) => (
                        <>
                            {comp !== "p" && comp !== "p_operator" && comp !== "n" && comp !== "n_operator" && comp !== "p_mode" &&
                                comp !== "firstNodeId" && comp !== "secondNodeId" && comp !== "node_metric" && comp !== "node_metric_operator" &&
                                comp !== "node_metric_value" && comp !== "edge_metric" && comp !== "edge_metric_operator" &&
                                comp !== "edge_metric_value" && comp !== "same_event" &&
                                <Stack direction={"row"} >
                                    {getComponent(comp, index)}
                                    {getInfoIconButton(comp, comp)}
                                </Stack>
                            }
                        </>
                    ))}
                    {hasP &&
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>p</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Stack direction={"row"}>
                                    {getComponent("p", component.indexOf("p"))}
                                    {getInfoIconButton("p", "p")}
                                </Stack>
                                <Stack direction={"row"}>
                                    {getComponent("p_operator", component.indexOf("p_operator"))}
                                    {getInfoIconButton("p_operator", "p_operator")}
                                </Stack>
                            </AccordionDetails>
                        </Accordion>
                    }
                    {hasN &&
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>n</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Stack direction={"row"}>
                                    {getComponent("n", component.indexOf("n"))}
                                    {getInfoIconButton("n", "n")}
                                </Stack>
                                <Stack direction={"row"}>
                                    {getComponent("n_operator", component.indexOf("n_operator"))}
                                    {getInfoIconButton("n_operator", "n_operator")}
                                </Stack>
                            </AccordionDetails>
                        </Accordion>
                    }
                    {hasMetric &&
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography>Metric</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Stack direction={"row"}>
                                    {getComponent(metricType, component.indexOf(metricType))}
                                    {getInfoIconButton(metricType, metricType)}
                                </Stack>
                                <Stack direction={"row"}>
                                    {getComponent(metricType + "_operator", component.indexOf(metricType + "_operator"))}
                                    {getInfoIconButton(metricType + "_operator", metricType + "_operator")}
                                </Stack>
                            </AccordionDetails>
                        </Accordion>
                    }
                </List>
            </div>
            <Button onClick={() => {
                props.onQueryChange(query);
                props.onClose(query);
            }}>
                Done
            </Button>
        </Dialog>
    )
}

export function getValues(parameter: string, queryLabel: string, selectedObjectType: string = ""){
    switch(parameter){
        case "event_activity":
        case "first_activity":
        case "second_activity": {
            const activities = localStorage.getItem('activities');
            if (activities)
                return JSON.parse(activities).sort();
            return [];
        }
        case "object_type":
        case "first_type":
        case "second_type": {
            const objectTypes = localStorage.getItem('objectTypes');
            const wildcardAmount = localStorage.getItem('wildcard-amount');
            if (objectTypes) {
                let types = JSON.parse(objectTypes).sort();
                types.push("ANY");
                types = types.concat(Array(wildcardAmount? parseInt(wildcardAmount) : 50).fill(null).map((_,i) => {
                    const possibleName = "WC_" + (i + 1);
                    if (usedObjectTypes.indexOf(possibleName) !== -1)
                        return possibleName + " (used)"
                    return possibleName;
                }));
                return types;
            }

            return [];
        }
        case "quantifier": {
            // for start and end, only ANY allowed
            // for DF, EF two quantifiers? but both allowed
            // areContainedEvents, containsObjects both
            // TODO: change this to other format? (isStart)
            if (queryLabel === "Start Event" || queryLabel === "End Event")
                return ["None", "ANY"];
            else
                return ["ALL", "ANY"];
        }
        case "p_operator":
        case "n_operator":
        case "node_metric_operator":
        case "edge_metric_operator": {
            return ["gte", "eq", "lte"];
        }
        case "needed_objects": {
            const objects = localStorage.getItem(selectedObjectType);
            if (objects)
                return JSON.parse(objects).sort();
            return [];
        }
        case "Type": {
            return ["INIT", "END", "Event"]
        }
        case "edge_metric":
            return ["elapsed_time"];
        case "node_metric":
            return ["sojourn_time", "synchronization_time", "lead_time", "timestamp"];
    }
    return []
}

interface DurationPickerProps {
    value?: Duration;
    onDurationChange: (duration: Duration) => void;
}

interface Duration {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
}

const DurationPicker: React.FC<DurationPickerProps> = ({ value, onDurationChange }) => {
    const [duration, setDuration] = useState<Duration>(value?? {
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>, key: keyof Duration) => {
        const value = parseInt(e.target.value);
        setDuration((prevDuration) => ({ ...prevDuration, [key]: isNaN(value) ? 0 : value }));
    };

    const handleDurationChange = () => {
        onDurationChange(duration);
    };

    return (
        <div>
            <Stack direction={"row"} spacing={1}>
                <TextField
                    label={"Days"}
                    id={"outlined"}
                    size="small"
                    value={duration.days}
                    onChange={(e) => handleInputChange(e, 'days')}
                    onBlur={handleDurationChange}
                />
                <TextField
                    label={"Hours"}
                    id={"outlined"}
                    size="small"
                    value={duration.hours}
                    onChange={(e) => handleInputChange(e, 'hours')}
                    onBlur={handleDurationChange}
                />
                <TextField
                    label={"Minutes"}
                    id={"outlined"}
                    size="small"
                    value={duration.minutes}
                    onChange={(e) => handleInputChange(e, 'minutes')}
                    onBlur={handleDurationChange}
                />
                <TextField
                    label={"Seconds"}
                    id={"outlined"}
                    size="small"
                    value={duration.seconds}
                    onChange={(e) => handleInputChange(e, 'seconds')}
                    onBlur={handleDurationChange}
                />
            </Stack>
        </div>
    );
};

async function getActivities() {
    const potFilePath = localStorage.getItem('ocel');
    const filePath = potFilePath? potFilePath : "";
    const uri = getURI("/logs/activities", {file_path: filePath});
    let results: string[] = []
    await fetch(uri)
        .then((response) => response.json())
        .then((result: string[]) => {
            results = result
        })
        .catch(err => console.log("Error in fetching:" + err))
    return results
}

export async function getObjectTypes() {
    const potFilePath = localStorage.getItem('ocel');
    const filePath = potFilePath? potFilePath : "";
    const uri = getURI("/logs/object_types", {file_path: filePath});
    let results: string[] = []
    await fetch(uri)
        .then((response) => response.json())
        .then((result: string[]) => {
            results = result;
        })
        .catch(err => console.log("Error in fetching:" + err))
    return results
}

export async function getObjects() {
    const potFilePath = localStorage.getItem('ocel');
    const filePath = potFilePath? potFilePath : "";
    const uri = getURI("/logs/objects", {file_path: filePath});
    let results: string[] = []
    await fetch(uri)
        .then((response) => response.json())
        .then((result: string[]) => {
            results = result
        })
        .catch(err => console.log("Error in fetching:" + err))
    return results
}

export async function getPECount() {
    const potFilePath = localStorage.getItem('ocel');
    const filePath = potFilePath? potFilePath : "";
    const uri = getURI("/logs/process_execution_count", {file_path: filePath});
    let results: number = -1
    await fetch(uri)
        .then((response) => response.json())
        .then((result: number) => {
            results = result
        })
        .catch(err => console.log("Error in fetching:" + err))
    return results
}

const getQueryObject = (queryLabel: string) => {
    switch(queryLabel) {
        case "isStart": {
            return translateStartEvent();
        }
        case "isEnd": {
            return translateEndEvent();
        }
        case "Event": {
            return translateEvent();
        }
        case "isDirectlyFollowed": {
            return translateDirectlyFollowed();
        }
        case "isEventuallyFollowed": {
            return translateEventuallyFollowed();
        }
        case "isContainedEvent": {
            return translateContainedEvent();
        }
        case "areContainedEvents": {
            return translateContainedEvents();
        }
        case "containsObjectsOfType": {
            return translateContainsObjectsOfType();
        }
        case "containsObjects": {
            return translateContainsObjects();
        }
        case "isParallel":
            break;
    }
    return {};
}

const translateEvent = (eventActivity: string = "", objectType: string = "") => {
    return {
        "query": "Event",
        "event_activity": eventActivity,
        "object_type": objectType
    }
}

const translateStartEvent = (eventActivity: string = "", objectType: string = "", quantifier= "ANY", p= 1, pOperator= "gte", pMode = "absolute") => {
    return {
        "query": "isStart",
        "event_activity": eventActivity,
        "object_type": objectType,
        "quantifier": quantifier,
        "p": p,
        "p_operator": pOperator,
        "p_mode": pMode,
        "boolean_operator": "",
        "node_metric": "",
        "node_metric_operator": "gte",
        "node_metric_value": 0
    }
}

const translateEndEvent = (eventActivity: string = "", objectType: string = "", quantifier= "ANY", p= 1, pOperator= "gte", pMode = "absolute") => {
    return {
        "query": "isEnd",
        "event_activity": eventActivity,
        "object_type": objectType,
        "quantifier": quantifier,
        "p": p,
        "p_operator": pOperator,
        "p_mode": pMode,
        "boolean_operator": "",
        "node_metric": "",
        "node_metric_operator": "gte",
        "node_metric_value": 0
    }
}

const translateDirectlyFollowed = (firstActivity: string = "", firstType: string = "", secondActivity: string = "", secondType: string = "",
                                   nOperator = "gte", n= 1, p= 1, pOperator= "gte", pMode = "absolute",
                                   quantifier= "ALL") => {
    return {
        "query": "isDirectlyFollowed",
        "first_activity": firstActivity,
        "first_type": firstType,
        "second_activity": secondActivity,
        "second_type": secondType,
        "n_operator": nOperator,
        "n": n,
        "p": p,
        "p_operator": pOperator,
        "p_mode": pMode,
        "quantifier": quantifier,
        "boolean_operator": "",
        "edge_metric": "",
        "edge_metric_operator": "gte",
        "edge_metric_value": 0
    }
}

const translateEventuallyFollowed = (firstActivity: string = "", firstType: string = "", secondActivity: string = "", secondType: string = "",
                                     nOperator = "gte", n= 1, p= 1, pOperator= "gte", pMode = "absolute",
                                     quantifier= "ALL") => {
    return {
        "query": "isEventuallyFollowed",
        "first_activity": firstActivity,
        "first_type": firstType,
        "second_activity": secondActivity,
        "second_type": secondType,
        "n_operator": nOperator,
        "n": n,
        "p": p,
        "p_operator": pOperator,
        "p_mode": pMode,
        "quantifier": quantifier,
        "boolean_operator": "",
        "edge_metric": "",
        "edge_metric_operator": "gte",
        "edge_metric_value": 0
    }
}

const translateContainedEvent = (eventActivity: string = "", objectType: string = "", nOperator= "gte", n= 1,
                                 p= 1, pOperator= "gte", pMode = "absolute") => {
    return {
        "query": "isContainedEvent",
        "event_activity": eventActivity,
        "object_type": objectType,
        "n_operator": nOperator,
        "n": n,
        "p": p,
        "p_operator": pOperator,
        "p_mode": pMode,
        "boolean_operator": "",
        "node_metric": "",
        "node_metric_operator": "gte",
        "node_metric_value": 0
    }
}

const translateContainedEvents = (eventActivity: string[] = [""], objectType: string = "", nOperator= "gte", n= 1,
                                  p= 1, pOperator= "gte", pMode = "absolute",
                                  quantifier = "ALL") => {
    return {
        "query": "areContainedEvents",
        "event_activity": eventActivity,
        "object_type": objectType,
        "n_operator": nOperator,
        "n": n,
        "p": p,
        "p_operator": pOperator,
        "p_mode": pMode,
        "quantifier": quantifier,
        "boolean_operator": "",
        "node_metric": "",
        "node_metric_operator": "gte",
        "node_metric_value": 0
    }
}

const translateContainsObjectsOfType = (objectType: string = "", nOperator= "gte", n= 1) => {
    return {
        "query": "containsObjectsOfType",
        "object_type": objectType,
        "n_operator": nOperator,
        "n": n,
        "boolean_operator": "",
    }
}

const translateContainsObjects = (objectType: string = "", neededObjects: string[] = [""], quantifier = "ALL") => {
    return {
        "query": "containsObjects",
        "object_type": objectType,
        "needed_objects": neededObjects,
        "quantifier": quantifier,
        "boolean_operator": "",
    }
}