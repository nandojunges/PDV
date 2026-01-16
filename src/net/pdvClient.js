function normalizeBaseUrl(baseUrl) {
  const raw = String(baseUrl || "").trim();
  if (!raw) {
    return { ok: false, error: "Informe o endereço do mestre (ex: http://192.168.0.10:8787)." };
  }

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "Endereço inválido. Use http://IP:PORTA." };
  }

  if (url.protocol !== "http:") {
    return { ok: false, error: "O endereço deve começar com http://" };
  }

  if (!url.hostname || !url.port) {
    return { ok: false, error: "Informe IP e porta (ex: http://192.168.0.10:8787)." };
  }

  return { ok: true, url: url.origin };
}

async function safeJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function pingMaster(baseUrl) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized.ok) {
    return { ok: false, error: normalized.error };
  }

  try {
    const response = await fetch(`${normalized.url}/handshake`);
    const data = await safeJson(response);

    if (!response.ok) {
      return {
        ok: false,
        error: data?.error || "Falha ao contatar o mestre.",
      };
    }

    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: "Não foi possível conectar. Verifique se estão na mesma rede.",
    };
  }
}

export async function fetchSnapshot(baseUrl, pin) {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized.ok) {
    return { ok: false, error: normalized.error };
  }

  const pinValue = String(pin || "").trim();
  if (!pinValue) {
    return { ok: false, error: "Informe o PIN do mestre." };
  }

  try {
    const response = await fetch(`${normalized.url}/snapshot`, {
      headers: {
        "x-pdv-pin": pinValue,
      },
    });
    const data = await safeJson(response);

    if (response.status === 401) {
      return { ok: false, error: "PIN inválido." };
    }

    if (!response.ok) {
      return {
        ok: false,
        error: data?.error || "Não foi possível baixar o snapshot.",
      };
    }

    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: "Erro de rede ao baixar o snapshot.",
    };
  }
}