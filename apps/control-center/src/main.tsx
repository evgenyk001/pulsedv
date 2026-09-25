import { configureRuntime } from "../../../packages/pulse-data/runtime";
import { RuntimeShell } from "./RuntimeShell";
import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import "./styles.css";

configureRuntime({enabled:import.meta.env.VITE_PULSE_MODE==="api",base:import.meta.env.VITE_API_BASE_URL,role:"control"});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter><RuntimeShell><App/></RuntimeShell></HashRouter>
  </React.StrictMode>
);
