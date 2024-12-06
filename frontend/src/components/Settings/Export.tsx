import React, {useEffect, useState} from 'react';
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import {Box, DialogContent, Stack, TextField} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faClose} from "@fortawesome/free-solid-svg-icons";
import {PaperComponent} from "../Query/Query";
import ArticleIcon from "@mui/icons-material/Article";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Button from "@mui/material/Button";
import {getURI} from "../utils";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";

type ExportProps = {
    style?: React.CSSProperties,
}

export function Export(props: ExportProps){

    const [open, setOpen] = useState<boolean>(false);
    const [name, setName] = useState<string>("");
    const [state, setState] = useState<boolean>(false);
    const [exportPath, setExportPath] = useState<string>("");
    const [file, setFile] = useState<any>("");
    const handleClose = () => {
        setOpen(false);
    }

    useEffect(() => {
        if (state)
            setState(false);
    }, [open, name]);

    function exportToOcel(){
        let potName = name;
        if (potName.split(".").at(-1) !== "jsonocel"){
            potName = potName + ".jsonocel";
            setName(potName);
        }
        const uri = getURI("/pq/export", {file_path: "data/" + potName});
        fetch(uri)
            .then((response) => response.json())
            .then((result) => {
                console.log("Export to file " + name + " successful.");
                setExportPath(result.path);
                setFile(result.file);
                setState(true);
            })
            .catch(err => console.log("Error in exporting ..."));
    }

    function downloadOCEL(){
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(file, null, 4));
        const anchor = window.document.createElement('a');
        anchor.setAttribute("href", dataStr);
        anchor.setAttribute("download", name);
        anchor.click();
    }

    return(
        <>
            {/* <Button onClick={() => setOpen(true)} variant={"outlined"} sx={{marginTop: 1}} style={props.style}>
                Export to OCEL
                <FileDownloadIcon sx={{ml: 1}}/>
            </Button> */}
            <Stack direction={"row"} justifyContent={"center"}>
                <div className="EventLogList-SelectButton" style={{marginTop: 1, width: "100%", ...props.style}} onClick={() => {setOpen(true)}}>
                    <FileDownloadIcon sx={{ml: 1}}/>
                    Export to OCEL
                </div>
            </Stack>
            <Dialog
                onClose={handleClose}
                open={open}
                fullWidth
                maxWidth={'lg'}
                PaperProps={{style: {borderRadius: '1rem'}}}
                PaperComponent={PaperComponent}
                aria-labelledby="draggable-dialog-title"
            >
                <DialogTitle sx={{textAlign: "center", cursor: "move"}} id={"draggable-dialog-title"}>
                    <Box display="flex" alignItems="center">
                        <Box flexGrow={1} >Export query result to OCEL (JSONOCEL)</Box>
                        <Box>
                            <IconButton onClick={() => setOpen(false)} sx={{right: 0}}>
                                <FontAwesomeIcon icon={faClose} />
                            </IconButton>
                        </Box>
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <TextField
                        label={"Name"}
                        variant={"outlined"}
                        value={name}
                        sx={{mt: 1}}
                        fullWidth
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                            setName(event.target.value);
                        }}
                    />
                    <Box textAlign={"center"}>
                        <Button onClick={() => exportToOcel()} variant={"outlined"} sx={{marginTop: 1}}>
                            Export to OCEL
                            <FileDownloadIcon sx={{ml: 1}}/>
                        </Button>
                        {state &&
                            <>
                                <p>
                                    Your file was successfully exported to {exportPath}!
                                </p>
                                <Button onClick={() => downloadOCEL()} variant={"outlined"} sx={{marginTop: 1}}>
                                    Click here to download!
                                    <FileDownloadIcon sx={{ml: 1}}/>
                                </Button>
                            </>
                        }
                    </Box>
                </DialogContent>
            </Dialog>
        </>
    )
}