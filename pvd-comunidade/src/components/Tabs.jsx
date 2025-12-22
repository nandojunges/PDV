import React, { useEffect, useMemo } from "react";
import { ROUTES } from "../app/routes";

function isTabVisible(key, step) {
  if (key === "produtos") return step === "produtos";
  if (key === "ajustes")
    return step === "sem_evento" || step === "ajustes" || step === "caixa" || step === "vendas";
  if (key === "caixa") return step === "caixa" || step === "vendas";
  if (key === "venda") return step === "vendas";
  return true;
}

function tabForStep(step) {
  if (step === "produtos") return "produtos";
  if (step === "ajustes") return "ajustes";
  if (step === "caixa") return "caixa";
  if (step === "vendas") return "venda";
  return "evento";
}

export default function Tabs({ tab, setTab, step }) {
  const routes = useMemo(
    () => ROUTES.filter((route) => isTabVisible(route.key, step)),
    [step]
  );

  useEffect(() => {
    if (!isTabVisible(tab, step)) {
      setTab(tabForStep(step));
    }
  }, [tab, step, setTab]);

  return (
    <div className="tabs">
      {routes.map((r) => (
        <button
          key={r.key}
          className={"tab " + (tab === r.key ? "active" : "")}
          onClick={() => {
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
