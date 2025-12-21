import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "config";
const LEGACY_KEY = "permitirMultiDispositivo";

const DEFAULT_CONFIG = {
  permitirMultiDispositivo: false,
  modoMulti: "master",
  masterHost: "",
  masterPort: "5179",
  pinAtual: "",
  eventIdAtual: "",
  autoStartMasterOnOpen: true,
};

function readPermitirMultiDispositivo() {
  if (typeof window === "undefined") return DEFAULT_CONFIG.permitirMultiDispositivo;
  const raw = window.localStorage.getItem(LEGACY_KEY);
  if (raw === null) return DEFAULT_CONFIG.permitirMultiDispositivo;
  return raw === "true";
}

function persistPermitirMultiDispositivo(value) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LEGACY_KEY, value ? "true" : "false");
}

function readConfig() {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return normalizeConfig({
      permitirMultiDispositivo: readPermitirMultiDispositivo(),
    });
  }

  try {
    return normalizeConfig(JSON.parse(raw));
  } catch {
    return normalizeConfig({
      permitirMultiDispositivo: readPermitirMultiDispositivo(),
    });
  }
}

function persistConfig(config) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function normalizeConfig(raw) {
  const permitir = raw?.permitirMultiDispositivo;
  return {
    ...DEFAULT_CONFIG,
    ...(raw && typeof raw === "object" ? raw : {}),
    permitirMultiDispositivo: Boolean(permitir),
    modoMulti: raw?.modoMulti === "client" ? "client" : "master",
    masterHost: typeof raw?.masterHost === "string" ? raw.masterHost : "",
    masterPort: typeof raw?.masterPort === "string" ? raw.masterPort : DEFAULT_CONFIG.masterPort,
    pinAtual: typeof raw?.pinAtual === "string" ? raw.pinAtual : "",
    eventIdAtual: typeof raw?.eventIdAtual === "string" ? raw.eventIdAtual : "",
    autoStartMasterOnOpen:
      typeof raw?.autoStartMasterOnOpen === "boolean"
        ? raw.autoStartMasterOnOpen
        : DEFAULT_CONFIG.autoStartMasterOnOpen,
  };
}

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [config, setConfigState] = useState(() =>
    normalizeConfig(readConfig())
  );

  useEffect(() => {
    persistConfig(config);
    persistPermitirMultiDispositivo(Boolean(config.permitirMultiDispositivo));
  }, [config]);

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
