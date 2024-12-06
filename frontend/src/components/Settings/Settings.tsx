import React, {useState} from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import TextField from '@mui/material/TextField';
import SettingsIcon from '@mui/icons-material/Settings';
import IconButton from "@mui/material/IconButton";
import CloseIcon from '@mui/icons-material/Close';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import {getURI} from "../utils";

type Anchor = 'top' | 'left' | 'bottom' | 'right';

type SettingsProps = {
    anchor: Anchor,
    style?: React.CSSProperties,
    onLiveQueryingChange?: any,
}



export function Settings(props: SettingsProps){
    const {anchor} = props;

    const [open, setOpen] = useState(false);

    const [nodeLimit, setNodeLimit] = useState(localStorage.getItem("node-limit")? parseInt(localStorage.getItem("node-limit")?? ""): 100);
    const [edgeLimit, setEdgeLimit] = useState(localStorage.getItem("node-limit")? parseInt(localStorage.getItem("node-limit")?? ""): 100);
    const [enableLiveQuerying, setEnableLiveQuerying] = useState(localStorage.getItem("live-querying")?? "enabled");
    const [liveTimeout, setLiveTimeout] = useState<string>(localStorage.getItem("live-timeout")?? "30");
    const [wildcardAmount, setWildcardAmount] = useState(localStorage.getItem("wildcard-amount")? parseInt(localStorage.getItem("wildcard-amount")?? ""): 50);

    const toggleDrawer =
        (open: boolean) =>
            (event: React.KeyboardEvent | React.MouseEvent) => {
                if (
                    event.type === 'keydown' &&
                    ((event as React.KeyboardEvent).key === 'Tab' ||
                        (event as React.KeyboardEvent).key === 'Shift')
                ) {
                    return;
                }

                setOpen(open);
            };

    const handleChange = (
        event: React.MouseEvent<HTMLElement>,
        newValue: string,
    ) => {
        setEnableLiveQuerying(newValue);
        localStorage.setItem("live-querying", newValue);
        if (props.onLiveQueryingChange)
            props.onLiveQueryingChange(newValue === "enabled");
    };

    const handleLiveTimeoutChange = (timeout: number) => {
        const uri = getURI("/pq/live_timeout", {new_timeout: timeout});
        fetch(uri)
            .then((response) => response.json())
            .then(() => {
                console.log("Changing of timeout to " + timeout + " seconds successful.");
            })
            .catch(err => console.log("Error in changing timeout ..."));
    }

    return (
        <>
            <IconButton onClick={toggleDrawer(true)} style={props.style}>
                <SettingsIcon fontSize={"large"} />
            </IconButton>
            <Drawer
                anchor={anchor}
                open={open}
                container={() => document.getElementById('DnDDialog')}
                onClose={toggleDrawer(false)}
            >
                <Box
                    sx={{ width: anchor === 'top' || anchor === 'bottom' ? 'auto' : 250 }}
                    role="presentation"
                    //onClick={toggleDrawer(false)}
                    //onKeyDown={toggleDrawer(false)}
                >
                    <Typography variant={"h5"} style={{textAlign: "center"}} sx={{mt: 1}}>
                        Settings
                    </Typography>
                    <IconButton sx={{position: "absolute", left: "13rem", top: "0.3rem"}} onClick={toggleDrawer(false)}>
                        <CloseIcon />
                    </IconButton>
                    <List>
                        <Accordion>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                            >
                                <Typography>Graph Display</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <TextField
                                    label={"Node Count Limit"}
                                    value={nodeLimit}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                        setNodeLimit(parseInt(event.target.value));
                                        localStorage.setItem('node-limit', event.target.value);
                                    }}
                                    sx={{mb: 2}}
                                />
                                <TextField
                                    label={"Edge Count Limit"}
                                    value={edgeLimit}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                        setEdgeLimit(parseInt(event.target.value));
                                        localStorage.setItem('edge-limit', event.target.value);
                                    }}
                                />
                            </AccordionDetails>
                        </Accordion>
                        <Accordion>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                            >
                                <Typography>Live Querying</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <ToggleButtonGroup
                                    color="primary"
                                    value={enableLiveQuerying}
                                    exclusive
                                    onChange={handleChange}
                                    aria-label="Platform"
                                >
                                    <ToggleButton value="enabled">Enabled</ToggleButton>
                                    <ToggleButton value="disabled">Disabled</ToggleButton>
                                </ToggleButtonGroup>
                                <TextField
                                    label={"Live Querying Timeout"}
                                    value={liveTimeout}
                                    sx={{mt: 2}}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                        setLiveTimeout(event.target.value);
                                        localStorage.setItem('live-timeout', event.target.value);
                                        handleLiveTimeoutChange(parseFloat(event.target.value));
                                    }}
                                />
                            </AccordionDetails>
                        </Accordion>
                        <Accordion>
                            <AccordionSummary
                                expandIcon={<ExpandMoreIcon />}
                            >
                                <Typography>Wildcards</Typography>
                            </AccordionSummary>
                            <AccordionDetails>
                                <TextField
                                    label={"Wildcard amount"}
                                    value={wildcardAmount}
                                    sx={{mt: 2}}
                                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                                        setWildcardAmount(parseInt(event.target.value));
                                        localStorage.setItem('wildcard-amount', event.target.value);
                                    }}
                                />
                            </AccordionDetails>
                        </Accordion>
                    </List>
                </Box>
            </Drawer>
        </>
    )
}