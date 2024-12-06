import React, {useEffect, useState} from 'react';
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import {Box} from "@mui/material";
import IconButton from "@mui/material/IconButton";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faClose} from "@fortawesome/free-solid-svg-icons";
import {PaperComponent} from "../Query/Query";
import ArticleIcon from '@mui/icons-material/Article';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';

type RuntimeLogProps = {
    style?: React.CSSProperties,
    runs: Run[],
}

export type Run = {
    name: string,
    time: string,
    start: string,
    end: string,
}

export function RuntimeLog(props: RuntimeLogProps){

    const [open, setOpen] = useState(false);
    const handleClose = () => {
        setOpen(false);
    }

    const [rows, setRows] = useState<Run[]>(props.runs);

    useEffect(() => {
        setRows(props.runs);
    }, [props.runs])

    return (
        <>
            <IconButton onClick={() => setOpen(true)} style={props.style}>
                <ArticleIcon fontSize={"large"} />
            </IconButton>
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
                        <Box flexGrow={1} >Runtime Log</Box>
                        <Box>
                            <IconButton onClick={() => setOpen(false)} sx={{right: 0}}>
                                <FontAwesomeIcon icon={faClose} />
                            </IconButton>
                        </Box>
                    </Box>
                </DialogTitle>
                <TableContainer component={Paper}>
                    <Table sx={{ minWidth: 650 }} aria-label="simple table">
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell align="right">Runtime</TableCell>
                                <TableCell align="right">Start</TableCell>
                                <TableCell align="right">End</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {rows.map((row) => (
                                <TableRow
                                    key={row.name}
                                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                >
                                    <TableCell component="th" scope="row">
                                        {row.name}
                                    </TableCell>
                                    <TableCell align="right">{row.time}</TableCell>
                                    <TableCell align="right">{row.start}</TableCell>
                                    <TableCell align="right">{row.end}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Dialog>
        </>
    )
}