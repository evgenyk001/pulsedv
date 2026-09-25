import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ControlCenterApp } from "./ControlCenterApp";
import "./control-center.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter><ControlCenterApp/></BrowserRouter>
  </React.StrictMode>
);
