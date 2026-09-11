import React from "react";
import ReactDOM from "react-dom/client";
import { PenguinConsole } from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("terminal-root") as HTMLElement).render(
  <React.StrictMode>
    <PenguinConsole />
  </React.StrictMode>
);
