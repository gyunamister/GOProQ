import React from 'react';
import './Home.css';
import { OCPQNavbar } from "../Navbar/Navbar";
import {Query} from "../Query/Query";

export function Home() {
    return (
        <div className="Home">
            <OCPQNavbar></OCPQNavbar>
            <Query></Query>
        </div>
    )
}