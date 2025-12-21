import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "permitirMultiDispositivo";

const DEFAULT_CONFIG = {
  permitirMultiDispositivo: false,
};

function readPermitirMultiDispositivo() {
  if (typeof window === "undefined") return DEFAULT_CONFIG.permitirMultiDispositivo;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw === null) return DEFAULT_CONFIG.permitirMultiDispositivo;
  return raw === "true";
}

function persistPermitirMultiDispositivo(value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
}

function normalizeConfig(raw) {
  const permitir = raw?.permitirMultiDispositivo;
  return {
    ...DEFAULT_CONFIG,
    ...(raw && typeof raw === "object" ? raw : {}),
    permitirMultiDispositivo: Boolean(permitir),
  };
}

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [config, setConfigState] = useState(() =>
    normalizeConfig({
      permitirMultiDispositivo: readPermitirMultiDispositivo(),
    })
  );

  useEffect(() => {
    persistPermitirMultiDispositivo(Boolean(config.permitirMultiDispositivo));
  }, [config.permitirMultiDispositivo]);

  const value = useMemo(() => {
    const setConfig = (next) => {
      setConfigState((prev) =>
        normalizeConfig(typeof next === "function" ? next(prev) : next)
      );
    };

    const updateConfig = (patch) => {
      setConfigState((prev) => {
        const nextPatch = typeof patch === "function" ? patch(prev) : patch;
        return normalizeConfig({
          ...prev,
          ...(nextPatch && typeof nextPatch === "object" ? nextPatch : {}),
        });
      });
    };

    const setPermitirMultiDispositivo = (next) => {
      setConfigState((prev) => ({
        ...prev,
        permitirMultiDispositivo:
          typeof next === "function"
            ? Boolean(next(prev.permitirMultiDispositivo))
            : Boolean(next),
      }));
    };

    return {
      config,
      setConfig,
      updateConfig,
      permitirMultiDispositivo: config.permitirMultiDispositivo,
      setPermitirMultiDispositivo,
    };
  }, [config]);

  return <ConfigContext.Provider value={value}>{children}</ConfigContext.Provider>;
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) {
    console.warn("useConfig deve ser usado dentro de ConfigProvider");
    return {
      config: DEFAULT_CONFIG,
      setConfig: () => {},
      updateConfig: () => {},
      permitirMultiDispositivo: DEFAULT_CONFIG.permitirMultiDispositivo,
      setPermitirMultiDispositivo: () => {},
    };
  }
  return ctx;
}
