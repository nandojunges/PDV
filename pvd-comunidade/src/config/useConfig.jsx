import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { LS_KEYS } from "../storage/keys";
import { loadJSON, saveJSON } from "../storage/storage";

const ConfigContext = createContext(null);

const DEFAULT_CONFIG = {
  permitirMultiDispositivo: false,
};

function normalizeConfig(raw) {
  return {
    ...DEFAULT_CONFIG,
    ...(raw && typeof raw === "object" ? raw : {}),
    permitirMultiDispositivo: Boolean(raw?.permitirMultiDispositivo),
  };
}

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(() =>
    normalizeConfig(loadJSON(LS_KEYS.config, DEFAULT_CONFIG))
  );

  useEffect(() => {
    saveJSON(LS_KEYS.config, config);
  }, [config]);

  const value = useMemo(() => ({
    ...config,
    setConfig: (next) =>
      setConfig((prev) =>
        normalizeConfig(typeof next === "function" ? next(prev) : next)
      ),
    setPermitirMultiDispositivo: (next) =>
      setConfig((prev) => ({
        ...prev,
        permitirMultiDispositivo:
          typeof next === "function"
            ? Boolean(next(prev.permitirMultiDispositivo))
            : Boolean(next),
      })),
  }), [config]);

  return (
    <ConfigContext.Provider value={value}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    throw new Error("useConfig deve ser usado dentro de ConfigProvider");
  }
  return ctx;
}
