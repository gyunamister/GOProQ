import React from 'react';
import { OCPQNavbar } from "../Navbar/Navbar";
import {QueryCreator} from "../QueryCreator/QueryCreator";

export function ExperimentalPage() {
    return (
        <div className="Home">
            <OCPQNavbar></OCPQNavbar>
            <QueryCreator
                onClose={() => {}}
                onQueryChange={() => {}}
                nodes={[]}
                edges={[]}
                name={""}
            />
        </div>
    )
}