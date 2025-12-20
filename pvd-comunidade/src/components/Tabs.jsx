import React from "react";
import { ROUTES } from "../app/routes";

export default function Tabs({ tab, setTab }) {
  return (
    <div className="tabs">
      {ROUTES.map((r) => (
        <button
          key={r.key}
          className={"tab " + (tab === r.key ? "active" : "")}
          onClick={() => setTab(r.key)}
          type="button"
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
