import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { LS_KEYS } from "../storage/keys";
import { loadJSON, saveJSON } from "../storage/storage";

const ConfigContext = createContext(null);

const DEFAULT_CONFIG = {
  permitirMultiDispositivo: false,
};

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(() =>
    loadJSON(LS_KEYS.config, DEFAULT_CONFIG)
  );

  useEffect(() => {
    saveJSON(LS_KEYS.config, config);
  }, [config]);

  const value = useMemo(
    () => ({
      ...config,
      setConfig,
      setPermitirMultiDispositivo: (next) =>
        setConfig((prev) => ({
          ...(prev || {}),
          permitirMultiDispositivo:
            typeof next === "function"
              ? Boolean(next(prev?.permitirMultiDispositivo ?? false))
              : Boolean(next),
        })),
    }),
    [config]
  );

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig deve ser usado dentro de ConfigProvider");
  }
  return context;
}
