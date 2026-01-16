let activeServer = null;

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
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

function readBodyPayload(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (typeof body === "object") {
    return body;
  }
  return {};
}

function getRequestIp(request) {
  return (
    request?.ip ||
    request?.remoteAddress ||
    request?.remoteAddr ||
    request?.clientIp ||
    "unknown"
  );
}

function makeRateLimiter({ windowMs = 10000, max = 30 } = {}) {
  const hits = new Map();
  return function rateLimit(key) {
    const now = Date.now();
    const entry = hits.get(key) || { count: 0, start: now };
    if (now - entry.start > windowMs) {
      entry.count = 0;
      entry.start = now;
    }
    entry.count += 1;
    hits.set(key, entry);
    if (entry.count > max) {
      return { ok: false, retryAfter: Math.ceil(windowMs / 1000) };
    }
    return { ok: true };
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
            body: request?.body || request?.data || request?.postData,
            ip: request?.remoteAddress || request?.ip || request?.clientIp,
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

function isNativePlatform() {
  const cap = window?.Capacitor;
  if (!cap) return false;
  if (typeof cap.isNativePlatform === "function") {
    return cap.isNativePlatform();
  }
  return Boolean(cap?.getPlatform && cap.getPlatform() !== "web");
}

export async function getLocalIp() {
  const normalizeResult = (result) => {
    if (!result) return null;
    if (typeof result === "string") return result;
    return result?.ip || result?.address || null;
  };

  const callPluginMethod = async (target, methodName) => {
    const method = target?.[methodName];
    if (typeof method !== "function") return null;
    try {
      const response = method();
      if (response && typeof response.then === "function") {
        const result = await response;
        return normalizeResult(result);
      }
      if (response !== undefined) {
        return normalizeResult(response);
      }
    } catch {
      // ignore and try callback style
    }
    try {
      const result = await new Promise((resolve, reject) => {
        const response = method((res) => resolve(res), (err) => reject(err));
        if (response && typeof response.then === "function") {
          response.then(resolve).catch(reject);
        }
      });
      return normalizeResult(result);
    } catch {
      return null;
    }
  };

  const networkInterface =
    window?.networkinterface ||
    window?.NetworkInterface ||
    window?.Capacitor?.Plugins?.NetworkInterface;
  const networkMethods = ["getWiFiIPAddress", "getIPAddress", "getIpAddress"];
  for (const methodName of networkMethods) {
    const result = await callPluginMethod(networkInterface, methodName);
    if (result) return result;
  }

  const server = window?.Capacitor?.Plugins?.HttpServer;
  const serverMethods = ["getLocalIPAddress", "getIPAddress", "getIpAddress"];
  for (const methodName of serverMethods) {
    const result = await callPluginMethod(server, methodName);
    if (result) return result;
  }

  try {
    const hostname = window?.location?.hostname || "";
    if (hostname === "localhost") return null;
    const isIpv4 = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname);
    return isIpv4 ? hostname : null;
  } catch {
    return null;
  }
}

export async function startMasterServer({
  port,
  pin,
  eventId,
  onClientJoin,
  onSale,
  onSyncRequest,
}) {
  if (activeServer) return activeServer;

  const adapter = resolveServerAdapter();
  if (!adapter || !isNativePlatform()) {
    throw new Error("Servidor LAN indisponível.");
  }

  const rateLimit = makeRateLimiter();
  const clients = new Map();

  const handler = async (request) => {
    const method = String(request?.method || "POST").toUpperCase();
    const path = normalizePath(String(request?.path || "/"));
    const corsHeaders = buildCorsHeaders();

    if (method === "OPTIONS") {
      return { status: 200, headers: corsHeaders, body: "" };
    }

    if (method !== "POST") {
      return {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Método não permitido." }),
      };
    }

    const ip = getRequestIp(request);
    const limit = rateLimit(ip);
    if (!limit.ok) {
      return {
        status: 429,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Retry-After": String(limit.retryAfter || 10),
        },
        body: JSON.stringify({ ok: false, error: "Muitas requisições." }),
      };
    }

    const payload = readBodyPayload(request?.body);
    const reqPin = String(payload?.pin || "");
    const reqEventId = String(payload?.eventId || "");

    if (!reqPin || reqPin !== String(pin || "")) {
      return {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "PIN inválido." }),
      };
    }

    if (String(eventId || "") && reqEventId !== String(eventId || "")) {
      return {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Evento inválido." }),
      };
    }

    if (path === "/join") {
      const deviceId = String(payload?.deviceId || "");
      const deviceName = String(payload?.deviceName || "Cliente");
      const clientId = deviceId || `client-${Date.now()}`;
      clients.set(clientId, {
        deviceId,
        deviceName,
        ip,
        lastSeen: new Date().toISOString(),
      });

      const result =
        typeof onClientJoin === "function"
          ? await onClientJoin({ deviceId, deviceName, clientId, ip })
          : null;
      const snapshot = result?.snapshot || result || null;

      return {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          snapshot,
          ticketModel: result?.ticketModel || null,
          clientId,
          clientsConnected: clients.size,
        }),
      };
    }

    if (path === "/sale") {
      const sale = payload?.sale || null;
      const summary = payload?.saleSummary || payload?.summary || null;
      const deviceName = payload?.deviceName || "Cliente";
      const result =
        typeof onSale === "function"
          ? await onSale({
              sale,
              summary,
              deviceId: payload?.deviceId,
              deviceName,
              type: payload?.type,
              ip,
            })
          : null;
      const totals = result?.totals || null;
      const applied = result?.applied !== false;
      return {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          applied,
          totals,
          serverSaleId: result?.serverSaleId || sale?.id || null,
        }),
      };
    }

    if (path === "/sync") {
      const result =
        typeof onSyncRequest === "function"
          ? await onSyncRequest({
              deviceId: payload?.deviceId,
              since: payload?.since,
              type: payload?.type,
              ip,
            })
          : null;
      return {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: true,
          snapshotDelta:
            result?.snapshotDelta ||
            result ||
            { products: null, updatedAt: new Date().toISOString() },
          ticketModel: result?.ticketModel || null,
        }),
      };
    }

    return {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Rota não encontrada." }),
    };
  };

  const stop = await adapter.start({ port, hostname: "0.0.0.0" }, handler);
  activeServer = { stop, clients };
  return activeServer;
}

export async function stopMasterServer() {
  if (!activeServer) return;
  const stop = activeServer.stop;
  activeServer = null;
  if (stop) {
    await stop();
  }
}

async function postJson({ url, payload }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.error || `Erro ${response.status}`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

export async function joinAsClient({ host, port, pin, eventId, deviceId, deviceName }) {
  const url = `http://${host}:${port}/join`;
  return postJson({
    url,
    payload: { pin, eventId, deviceId, deviceName, type: "REQUEST_PRODUCTS" },
  });
}

export async function postSaleToMaster({
  host,
  port,
  pin,
  eventId,
  deviceId,
  deviceName,
  summary,
  sale,
}) {
  const url = `http://${host}:${port}/sale`;
  return postJson({
    url,
    payload: {
      pin,
      eventId,
      deviceId,
      deviceName,
      sale,
      saleSummary: summary || null,
      type: "SALE_SUMMARY",
    },
  });
}

export async function syncFromMaster({ host, port, pin, eventId, deviceId, since }) {
  const url = `http://${host}:${port}/sync`;
  return postJson({
    url,
    payload: { pin, eventId, deviceId, since, type: "SYNC_PRODUCTS" },
  });
}