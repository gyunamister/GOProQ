import {OCPQNavbar} from "../Navbar/Navbar";
import "./Help.css";
import React, {useState} from "react";
import {Button, Stack, Pagination} from "@mui/material";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import Dialog from "@mui/material/Dialog";
// @ts-ignore
import { Document, Page } from "react-pdf";
import 'react-pdf/dist/esm/pdf.worker.entry.js';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
// @ts-ignore
import Pdf from '../Help/User_manual.pdf'
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";
import {faUndo, faFileArchive, faBiohazard, faEye, faEyeSlash} from "@fortawesome/free-solid-svg-icons";

export function Help() {

    const [panicButtonOpen, setPanicButtonOpen] = useState(false);
    const [localStorageOpen, setLocalStorageOpen] = useState(false);
    const [resetQueryOpen, setResetQueryOpen] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const [numPages, setNumPages] = useState(0);
    const [pageNumber, setPageNumber] = useState(1);

    // @ts-ignore
    const onDocumentLoadSuccess = ({numPages}) => {
        setNumPages(numPages);
    }

    const setPage = (event: React.ChangeEvent<unknown>, value: number) => {
        if (value >= 1 && numPages && value <= numPages){
            setPageNumber(value);
        }
    }

    const toggleShowAll = () =>
        setShowAll(!showAll);

    const panicButtonText = (
        <React.Fragment>
            <p>
                This button completely clears the long term cache (on your drive) and also the redis cache containing tasks. Once deleted, they can't be restored
                and for each OCEL all computations need to be redone. The purpose of this button is to try to trouble-shoot if something has gone seriously wrong.
            </p>
            <p>
                Only press yes, if you know what you are doing.
            </p>
        </React.Fragment>
    )

    const panicButtonTitle = "Do you really want to clear the whole cache?"

    const panicButtonDialog = helpDialog(panicButtonOpen, setPanicButtonOpen, panicButtonText, panicButtonTitle, () => {})

    return (
        <div className="DefaultLayout-Container">
            <OCPQNavbar />
            <div className="DefaultLayout-Content Help-Card">
                <div className="Help-Card-Title-Container">
                    <h2 className="Help-Card-Title">
                        Trouble-shoot & Docs
                    </h2>
                    <div className={'PanicButton NavbarButton'}
                         onClick={() => setPanicButtonOpen(true)}
                         title={"Clear the whole cache."}>
                        <FontAwesomeIcon icon={faBiohazard} className="NavbarButton-Icon"/>
                        Panic button
                    </div>
                    {panicButtonDialog}
                    <div className={'NavbarButton'}
                         title={"Opens the backend swagger interface in a new tab."}>
                        <FontAwesomeIcon icon={faFileArchive} className="NavbarButton-Icon"/>
                        <a className={"Help-a"} href="http://localhost:8080/docs" target="_blank" rel="noreferrer">
                            Backend Docs
                        </a>
                    </div>
                </div>
                <div style={{ width: "80%", height: "80%" }} className={"Help-Card-Docs-Container"}>
                    <nav>
                        <Stack spacing={0.1} direction="column" justifyContent="center">
                            <Stack direction="row" justifyContent="center">
                                <Pagination
                                    count={numPages}
                                    page={pageNumber}
                                    onChange={setPage}
                                    showFirstButton
                                    showLastButton
                                />
                            </Stack>
                            <Stack spacing={2} direction="row" justifyContent="center">
                                <div className={'NavbarButton'}
                                     onClick={toggleShowAll}
                                     title={"Toggles the page view."}>
                                    <FontAwesomeIcon icon={showAll? faEyeSlash: faEye} className="NavbarButton-Icon"/>
                                    {!showAll? "Show all pages": "Hide all pages"}
                                </div>
                            </Stack>
                        </Stack>
                    </nav>
                    <Document file={Pdf} onLoadSuccess={onDocumentLoadSuccess} onLoadError={console.error}>
                        {!showAll &&
                            <Page pageNumber={pageNumber} scale={1.7}></Page>
                        }
                        {showAll &&
                            <React.Fragment>
                                <div>
                                    {Array.from(new Array(numPages), (el, index) => (
                                        <Page key={`page_${index + 1}`} pageNumber={index + 1} scale={1.7}/>
                                    ))}
                                </div>
                            </React.Fragment>
                        }
                    </Document>
                    {showAll &&
                        <Stack spacing={2} direction="row" justifyContent="center">
                            <div className={'NavbarButton'}
                                 onClick={toggleShowAll}
                                 title={"Toggles the page view."}>
                                <FontAwesomeIcon icon={showAll? faEyeSlash: faEye} className="NavbarButton-Icon"/>
                                {!showAll? "Show all pages": "Hide all pages"}
                            </div>
                        </Stack>
                    }
                </div>
            </div>
        </div>
    );
}

/**
 * Used to modularize the dialog which is shown when one of the trouble-shoot buttons is pressed.
 * @param open - Boolean which decides if the dialog is shown (open)
 * @param setOpen - Sets the "open" variable (state)
 * @param text - The text to be displayed in the dialog
 * @param title - The title of the dialog
 * @param onClick - Function which determines what happens when "Yes" is clicked in the dialog.
 */
function helpDialog(open: boolean, setOpen: { (value: React.SetStateAction<boolean>): void; }, text: any, title: any, onClick: any){
    return (
        <Dialog
            open={open}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
        >
            <DialogTitle id="alert-dialog-title">
                {title}
            </DialogTitle>
            <DialogContent>
                <DialogContentText id="alert-dialog-description">
                    {text}
                </DialogContentText>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setOpen(false)} autoFocus>No</Button>
                <Button onClick={() => {
                    onClick();
                    setOpen(false);
                }}>Yes</Button>
            </DialogActions>
        </Dialog>
    )
}