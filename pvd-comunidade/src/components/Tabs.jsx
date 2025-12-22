import React, { useEffect, useMemo } from "react";
import { ROUTES } from "../app/routes";

function isTabVisible(key, step) {
  if (key === "produtos") return step === "produtos";
  if (key === "ajustes")
    return step === "ajustes" || step === "caixa" || step === "rodando" || step === "sem_evento";
  if (key === "caixa") return step === "caixa" || step === "rodando";
  if (key === "venda") return step === "rodando";
  if (key === "relatorio") return step === "rodando";
  return true;
}

function getDefaultTab(step) {
  if (step === "produtos") return "produtos";
  if (step === "ajustes") return "ajustes";
  if (step === "caixa") return "caixa";
  if (step === "rodando") return "venda";
  return "evento";
}

export default function Tabs({ tab, setTab, step }) {
  const routes = useMemo(
    () => ROUTES.filter((route) => isTabVisible(route.key, step)),
    [step]
  );

  useEffect(() => {
    if (!isTabVisible(tab, step)) {
      setTab(getDefaultTab(step));
    }
  }, [tab, step, setTab]);

  return (
    <div className="tabs">
      {routes.map((r) => (
        <button
          key={r.key}
          className={"tab " + (tab === r.key ? "active" : "")}
          onClick={() => {
            if (r.key === "caixa" && step !== "caixa" && step !== "rodando") {
              alert("Salve os ajustes do ticket antes de abrir o caixa.");
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
