import React, { useMemo } from "react";
import { ROUTES } from "../app/routes";

export default function Tabs({ tab, onTabClick, allowedTabs = [], notice }) {
  const routes = useMemo(() => ROUTES, []);

  return (
    <div className="tabsWrap">
      <div className="tabs">
        {routes.map((r) => (
          <button
            key={r.key}
            className={
              "tab " +
              (tab === r.key ? "active " : "") +
              (!allowedTabs.includes(r.key) ? "blocked" : "")
            }
            onClick={() => {
              onTabClick(r.key);
            }}
            type="button"
            aria-disabled={!allowedTabs.includes(r.key)}
          >
            {r.label}
          </button>
        ))}
      </div>
      {notice ? <div className="tabNotice">{notice}</div> : null}
    </div>
  );
}