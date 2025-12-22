import React, { useEffect, useMemo } from "react";
import { ROUTES } from "../app/routes";

function isTabVisible(key, flowState) {
  if (key === "produtos") return flowState === "ITENS_NAO_FINALIZADOS";
  if (key === "ajustes")
    return flowState === "SEM_EVENTO" || flowState === "ITENS_NAO_FINALIZADOS";
  return true;
}

export default function Tabs({ tab, setTab, flowState }) {
  const routes = useMemo(
    () => ROUTES.filter((route) => isTabVisible(route.key, flowState)),
    [flowState]
  );

  useEffect(() => {
    if (!isTabVisible(tab, flowState)) {
      setTab("caixa");
    }
  }, [tab, flowState, setTab]);

  return (
    <div className="tabs">
      {routes.map((r) => (
        <button
          key={r.key}
          className={"tab " + (tab === r.key ? "active" : "")}
          onClick={() => {
            if (r.key === "caixa" && flowState === "ITENS_NAO_FINALIZADOS") {
              alert("Finalize os itens do evento antes de abrir o caixa.");
              return;
            }
            setTab(r.key);
          }}
          type="button"
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
