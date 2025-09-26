import React from 'react';
import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import MenuIcon from '@mui/icons-material/Menu';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import "./Navbar.css"
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'
import {
    faDiagramProject,
    faArrowRightArrowLeft,
    faFileUpload,
    faAtom,
    faDatabase,
    faSearch
} from "@fortawesome/free-solid-svg-icons";
import {IconDefinition} from "@fortawesome/free-regular-svg-icons";
import {Link, useLocation} from "react-router-dom";
import {IconProp} from "@fortawesome/fontawesome-svg-core";

export function Navbar() {
    return(
        <Box sx={{ flexGrow: 1 }}>
            <AppBar position="static" color="default">
                <Toolbar>
                    <IconButton
                        size="large"
                        edge="start"
                        color="inherit"
                        aria-label="menu"
                        sx={{ mr: 2 }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography
                        variant="h6"
                        component={Link}
                        sx={{ flexGrow: 1, textDecoration: "none" }}
                        color={"textPrimary"}
                        to={"/"}
                    >
                        OCPQ - v0.1
                    </Typography>
                    <IconButton
                        component={Link}
                        to={"/"}
                        size="large"
                        edge="start"
                        color="inherit"
                        aria-label="upload"
                        sx={{ mr: 1 }}
                    >
                        <FontAwesomeIcon icon={faDiagramProject} size={"xs"}/>
                    </IconButton>
                    <IconButton
                        component={Link}
                        to={"/session"}
                        size="large"
                        edge="start"
                        color="inherit"
                        aria-label="upload"
                        sx={{ mr: -1 }}
                    >
                        <UploadFileIcon />
                    </IconButton>
                </Toolbar>
            </AppBar>
        </Box>
    )
}

function NavbarLink(props: { icon: IconDefinition, display: string, route: string, title? : string }) {
    const location = useLocation();
    const active = location.pathname === props.route;

    return (
        <Link to={props.route} className={`ENAV-link ${active ? 'ENAV-link--active' : ''}`} title={props.title}>
            <FontAwesomeIcon icon={props.icon as IconProp} />
            {props.display}
        </Link>
    )
}

export interface NavbarProps  {
    lowerRowSlot?: any
}

export function OCPQNavbar(props: NavbarProps) {
    return(
        <div className="ENAV-outer">
            <div className="ENAV-Row ENAV-Row1">
                <div className="ENAV-logo">
                    <img src="/GoProQ.png" alt="" />
                    <span>GOProQ</span>
                </div>
                <div>
                    <Link to="/session" className="ENAV-new-session ENAV-help" title={"Start a new session by selecting a new OCEL."}>
                        <FontAwesomeIcon icon={faFileUpload as IconProp} />
                    </Link>
                </div>
            </div>
            <div className="ENAV-Row ENAV-Row2">
                <div className="ENAV-links">
                    <NavbarLink icon={faDatabase} display="Data Lens" route="/" title={""}/>
                    <NavbarLink icon={faSearch} display="Query System" route="/query" title={""}/>
                </div>
                <div className="ENAV-props">
                    {props.lowerRowSlot !== undefined ? props.lowerRowSlot : undefined }
                </div>
            </div>
        </div>
    )
}

export function IntegratedNavbar(props: NavbarProps) {
    return (
        <div className="ENAV-props ENAV-integrated-props">
            {props.lowerRowSlot !== undefined ? props.lowerRowSlot : undefined }
        </div>
    )
}