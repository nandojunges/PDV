import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";

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

function normalizeConfig(raw) {
  const permitir = raw?.permitirMultiDispositivo;
  return {
    ...DEFAULT_CONFIG,
    ...(raw && typeof raw === "object" ? raw : {}),
    permitirMultiDispositivo: Boolean(permitir),
    modoMulti: raw?.modoMulti === "client" ? "client" : "master",
    masterHost: typeof raw?.masterHost === "string" ? raw.masterHost : "",
    masterPort:
      typeof raw?.masterPort === "string" ? raw.masterPort : DEFAULT_CONFIG.masterPort,
    pinAtual: typeof raw?.pinAtual === "string" ? raw.pinAtual : "",
    eventIdAtual: typeof raw?.eventIdAtual === "string" ? raw.eventIdAtual : "",
    autoStartMasterOnOpen:
      typeof raw?.autoStartMasterOnOpen === "boolean"
        ? raw.autoStartMasterOnOpen
        : DEFAULT_CONFIG.autoStartMasterOnOpen,
  };
}

function readConfig() {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  const raw = window.localStorage.getItem(STORAGE_KEY);

  // se não existir config nova, migra do legado
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

// evita setState se o objeto final for igual (shallow)
function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

const ConfigContext = createContext(null);

export function ConfigProvider({ children }) {
  const [config, setConfigState] = useState(() => normalizeConfig(readConfig()));

  // persistência em localStorage
  useEffect(() => {
    persistConfig(config);
    persistPermitirMultiDispositivo(Boolean(config.permitirMultiDispositivo));
  }, [config]);

  // funções estáveis (não mudam a cada render)
  const setConfig = useCallback((next) => {
    setConfigState((prev) => {
      const candidate = typeof next === "function" ? next(prev) : next;
      const normalized = normalizeConfig(candidate);
      return shallowEqual(prev, normalized) ? prev : normalized;
    });
  }, []);

  const updateConfig = useCallback((patch) => {
    setConfigState((prev) => {
      const nextPatch = typeof patch === "function" ? patch(prev) : patch;
      const normalized = normalizeConfig({
        ...prev,
        ...(nextPatch && typeof nextPatch === "object" ? nextPatch : {}),
      });
      return shallowEqual(prev, normalized) ? prev : normalized;
    });
  }, []);

  const setPermitirMultiDispositivo = useCallback((next) => {
    setConfigState((prev) => {
      const permitir =
        typeof next === "function"
          ? Boolean(next(prev.permitirMultiDispositivo))
          : Boolean(next);

      if (prev.permitirMultiDispositivo === permitir) return prev;

      // mantém normalizeConfig para garantir consistência com o resto do schema
      const normalized = normalizeConfig({
        ...prev,
        permitirMultiDispositivo: permitir,
      });

      return shallowEqual(prev, normalized) ? prev : normalized;
    });
  }, []);

  // value memoizado, mas agora depende de funções estáveis
  const value = useMemo(
    () => ({
      config,
      setConfig,
      updateConfig,
      permitirMultiDispositivo: config.permitirMultiDispositivo,
      setPermitirMultiDispositivo,
    }),
    [config, setConfig, updateConfig, setPermitirMultiDispositivo]
  );

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
