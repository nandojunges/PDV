import { PDV_PORT } from "./pdvNetConfig";

let activeServer = null;

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-pdv-pin",
  };
}

function normalizePath(path) {
  if (!path) return "/";
  if (path.startsWith("http")) {
    try {
      return new URL(path).pathname || "/";
    } catch {
      return "/";
    }
  }
  return path;
}

function readHeader(headers, key) {
  if (!headers) return "";
  const target = key.toLowerCase();
  if (Array.isArray(headers)) {
    const found = headers.find(([k]) => String(k || "").toLowerCase() === target);
    return found ? String(found[1] || "") : "";
  }
  if (typeof headers === "object") {
    const entries = Object.entries(headers);
    const found = entries.find(([k]) => String(k || "").toLowerCase() === target);
    return found ? String(found[1] || "") : "";
  }
  return "";
}

function createRequestHandler(getState) {
  return async ({ method, path, headers }) => {
    const normalizedMethod = String(method || "GET").toUpperCase();
    const normalizedPath = normalizePath(String(path || "/"));
    const corsHeaders = buildCorsHeaders();

    if (normalizedMethod === "OPTIONS") {
      return { status: 200, headers: corsHeaders, body: "" };
    }

    if (normalizedMethod !== "GET") {
      return {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Método não permitido." }),
      };
    }

    if (normalizedPath === "/health") {
      return {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: true }),
      };
    }

    if (normalizedPath === "/handshake") {
      return {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          app: "PDV Comunidade",
          version: "0.1",
          deviceRole: "master",
        }),
      };
    }

    if (normalizedPath === "/snapshot") {
      const state = typeof getState === "function" ? getState() : null;
      const pin = readHeader(headers, "x-pdv-pin");
      if (!state?.pin || pin !== state.pin) {
        return {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          body: JSON.stringify({ ok: false, error: "PIN inválido." }),
        };
      }

      return {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          caixaId: state.caixaId,
          pinMasked: "***",
          produtos: Array.isArray(state.produtos) ? state.produtos : [],
        }),
      };
    }

    return {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Rota não encontrada." }),
    };
  };
}

function resolveServerAdapter() {
  const customServer = window?.PDV_HTTP_SERVER;
  if (customServer?.start) {
    return {
      start: async (options, handler) => {
        await customServer.start({ ...options, onRequest: handler });
        return async () => {
          if (customServer.stop) {
            await customServer.stop();
          }
        };
      },
    };
  }

  const capacitorServer = window?.Capacitor?.Plugins?.HttpServer;
  if (capacitorServer?.start && capacitorServer?.addListener && capacitorServer?.sendResponse) {
    return {
      start: async (options, handler) => {
        await capacitorServer.start({
          port: options.port,
          hostname: options.hostname,
        });

        const listener = await capacitorServer.addListener("request", async (request) => {
          const response = await handler({
            method: request?.method,
            path: request?.path || request?.url,
            headers: request?.headers,
          });

          await capacitorServer.sendResponse({
            requestId: request?.requestId,
            status: response.status,
            headers: response.headers,
            body: response.body,
          });
        });

        return async () => {
          if (listener?.remove) {
            await listener.remove();
          }
          await capacitorServer.stop();
        };
      },
    };
  }

  return null;
}

export async function startPdvServer({ getState }) {
  if (activeServer) {
    return activeServer;
  }

  const adapter = resolveServerAdapter();
  if (!adapter) {
    throw new Error(
      "Servidor HTTP local indisponível. Registre window.PDV_HTTP_SERVER ou instale um plugin compatível."
    );
  }

  const handler = createRequestHandler(getState);
  const stop = await adapter.start({ port: PDV_PORT, hostname: "0.0.0.0" }, handler);

  activeServer = { stop };
  return activeServer;
}

export async function stopPdvServer() {
  if (!activeServer) return;
  const stop = activeServer.stop;
  activeServer = null;
  if (stop) {
    await stop();
  }
}