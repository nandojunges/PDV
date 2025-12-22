import React, { useMemo } from "react";
import { ROUTES } from "../app/routes";

function isTabVisible(key, step) {
  if (key === "produtos") return step === "produtos";
  if (key === "ajustes")
    return step === "sem_evento" || step === "ajustes" || step === "caixa" || step === "vendas";
  if (key === "caixa") return step === "caixa" || step === "vendas";
  if (key === "venda") return step === "vendas";
  return true;
}

export default function Tabs({ tab, onTabClick, step }) {
  const routes = useMemo(
    () => ROUTES.filter((route) => isTabVisible(route.key, step)),
    [step]
  );

  return (
    <div className="tabs">
      {routes.map((r) => (
        <button
          key={r.key}
          className={"tab " + (tab === r.key ? "active" : "")}
          onClick={() => {
            onTabClick(r.key);
          }}
          type="button"
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
