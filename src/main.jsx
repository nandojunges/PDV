import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App.jsx";
import { ConfigProvider } from "./config/ConfigProvider.jsx";
import "./styles/base.css";
import "./styles/pos.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ConfigProvider>
      <App />
    </ConfigProvider>
  </React.StrictMode>
);