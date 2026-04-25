import React from "react";
import ReactDOM from "react-dom/client";
import App from "./app/App.jsx";
import "./styles/base.css";
import "./styles/pos.css";

function shouldUseLowPerformanceMode() {
  if (typeof window === "undefined") return false;
  const ua = navigator?.userAgent || "";
  const isAndroid = /Android/i.test(ua);
  const isTouch = navigator?.maxTouchPoints > 0;
  const smallScreen = window.innerWidth <= 900;
  const lowMemory = typeof navigator?.deviceMemory === "number" && navigator.deviceMemory <= 4;
  const fewCores = typeof navigator?.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4;
  return (isAndroid && isTouch && smallScreen) || lowMemory || fewCores;
}

if (shouldUseLowPerformanceMode()) {
  document.documentElement.classList.add("low-performance");
  document.body.classList.add("low-performance");
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
