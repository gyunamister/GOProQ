import React from 'react';
import './App.css';
import { Routes, Route } from "react-router-dom";
import { Session } from "./components/Session/Session";
import ModernGraph from "./components/Graph/ModernGraph";
import DataLens from "./components/DataLens/DataLens";
import { Help } from "./components/Help/Help";
import UnifiedQuery from "./components/UnifiedQuery/UnifiedQuery";

function App() {
  return (
      <React.Fragment>
          <Routes>
              <Route path={"/"} element={<DataLens allAllowed={true}/>}></Route>
              <Route path={"/query"} element={<UnifiedQuery filePath={localStorage.getItem('ocel') || 'data/order_fulfillment.jsonocel'} />}></Route>
              <Route path={"/session"} element={<Session/>}></Route>
              <Route path={"/process_execution_viewer"} element={<ModernGraph allAllowed={false}/>}></Route>
          </Routes>
      </React.Fragment>
  );
}

export default App;
