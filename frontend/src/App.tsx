import React from 'react';
import './App.css';
import { Routes, Route } from "react-router-dom";
import { Home } from "./components/Home/Home";
import { Session } from "./components/Session/Session";
import { Graph } from "./components/Graph/Graph";
import { ExperimentalPage } from "./components/Experimental/Experimental";
import { Help } from "./components/Help/Help";

function App() {
  return (
      <React.Fragment>
          <Routes>
              <Route path={"/"} element={<Home/>}></Route>
              <Route path={"/session"} element={<Session/>}></Route>
              <Route path={"/graph"} element={<Graph allAllowed={true}/>}></Route>
              <Route path={"/process_execution_viewer"} element={<Graph allAllowed={false}/>}></Route>
              <Route path={"/experimental"} element={<ExperimentalPage />}></Route>
              <Route path={"/help"} element={<Help />}></Route>
          </Routes>
      </React.Fragment>
  );
}

export default App;
