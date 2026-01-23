import { Capacitor, registerPlugin } from "@capacitor/core";
import { wrapThermal58 } from "../services/receiptTemplate58";

export const AndroidPrinterPlugin = registerPlugin("AndroidPrinterPlugin");

const ensureAndroid = () => Capacitor.getPlatform() === "android";

export async function printText(text) {
  if (!ensureAndroid()) return;
  const payload = String(text ?? "");
  console.log("[PRINT] ticketLen", payload.length, "preview", payload.slice(0, 60));
  const result = await AndroidPrinterPlugin.printText({ text: payload });
  console.log("[PRINT] printText result", {
    ok: result?.ok,
    status: result?.status,
    error: result?.error,
  });
  return result;
}

export async function printHtml(html) {
  if (!ensureAndroid()) return;
  return AndroidPrinterPlugin.printHtml({ html });
}

export async function printTesteDireto() {
  if (!ensureAndroid()) return;
  return AndroidPrinterPlugin.printTesteDireto({});
}

export async function debugPrintA_JSPlugin() {
  if (!ensureAndroid()) return;
  const result = await AndroidPrinterPlugin.printText({ text: "JS->PLUGIN OK\n" });
  console.log("[PRINT][DIAG A] resultado", {
    ok: result?.ok,
    status: result?.status,
    error: result?.error,
  });
  return result;
}

export async function debugPrintB_Native() {
  if (!ensureAndroid()) return;
  const result = await AndroidPrinterPlugin.printDebugFromNative({});
  console.log("[PRINT][DIAG B] resultado", {
    ok: result?.ok,
    status: result?.status,
    error: result?.error,
  });
  return result;
}

export async function debugPrintC_TicketFixo() {
  const result = await imprimirVenda({
    ticketText: "TICKET REAL OK\nItem 1: Pastel 10,00\nTotal: 10,00\n",
  });
  console.log("[PRINT][DIAG C] resultado", {
    ok: result?.ok,
    status: result?.status,
    error: result?.error,
  });
  return result;
}

const listPluginKeys = (plugin) => {
  try {
    if (!plugin) return [];
    return Object.keys(plugin);
  } catch {
    return [];
  }
};

export const getPlatform = () => {
  try {
    if (typeof Capacitor !== "undefined" && Capacitor?.getPlatform) {
      return Capacitor.getPlatform();
    }
  } catch {}
  try {
    return /android/i.test(navigator?.userAgent || "") ? "android" : "web";
  } catch {
    return "web";
  }
};

export const getAndroidPrinterPlugin = () => AndroidPrinterPlugin;

export const isAndroidPrinterAvailable = () => {
  try {
    if (typeof Capacitor !== "undefined" && Capacitor?.isPluginAvailable) {
      return Capacitor.isPluginAvailable("AndroidPrinterPlugin");
    }
  } catch {}
  return false;
};

export const getAndroidPrinterDiagnostics = () => {
  const plugin = getAndroidPrinterPlugin();
  const pluginKeys = listPluginKeys(plugin);
  const isAvailable = isAndroidPrinterAvailable();

  return (
    `UA: ${navigator?.userAgent || "?"}\n` +
    `platform: ${getPlatform()}\n` +
    `Capacitor.isPluginAvailable: ${isAvailable}\n` +
    `AndroidPrinterPlugin typeof: ${typeof plugin}\n` +
    `AndroidPrinterPlugin keys: ${pluginKeys.length ? pluginKeys.join(", ") : "(vazio)"}\n` +
    `printText typeof: ${typeof plugin?.printText}\n` +
    `printHtml typeof: ${typeof plugin?.printHtml}\n` +
    `printTesteDireto typeof: ${typeof plugin?.printTesteDireto}\n` +
    `printDebugFromNative typeof: ${typeof plugin?.printDebugFromNative}\n`
  );
};

export const logAndroidPrinterStatus = () => {
  if (getPlatform() !== "android") return;
  const plugin = getAndroidPrinterPlugin();
  const isAvailable = isAndroidPrinterAvailable();
  const hasText = typeof plugin?.printText === "function";
  const hasHtml = typeof plugin?.printHtml === "function";
  const hasTest = typeof plugin?.printTesteDireto === "function";
  const hasDebug = typeof plugin?.printDebugFromNative === "function";

  console.info(
    "[AndroidPrinterPlugin] status",
    JSON.stringify(
      {
        available: isAvailable,
        hasText,
        hasHtml,
        hasTest,
        hasDebug,
      },
      null,
      2,
    ),
  );
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const REPORT_LINE_WIDTH = 32;
const REPORT_SEPARATOR = "-".repeat(REPORT_LINE_WIDTH);

const isAndroidRuntime = () => getPlatform() === "android";
const getAndroidPluginDiagnostics = () => getAndroidPrinterDiagnostics();

const normalizeAndroidResult = (value) => {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const cleaned = value.trim().toLowerCase();
    if (!cleaned) return false;
    if (["false", "0", "erro", "error", "fail", "failed"].includes(cleaned)) return false;
    return true;
  }

  if (value && typeof value === "object") {
    if (typeof value.ok === "boolean") return value.ok;
  }

  if (value == null) return false;
  return Boolean(value);
};

const toPlainText = (html) => {
  const cleaned = String(html || "")
    .replace(/<\s*br\s*\/?>/gi, "\n\n")
    .replace(/<\s*\/p\s*>/gi, "\n\n")
    .replace(/<\s*\/div\s*>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!cleaned) return "\n";
  return cleaned.endsWith("\n") ? cleaned : `${cleaned}\n`;
};

const isFullHtmlDocument = (html) =>
  /<!doctype\s+html/i.test(html) || /<\s*html[\s>]/i.test(html);

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const normalizeText = (text) =>
  String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+$/g, "");

const printViaAndroidPlugin = async ({ html, text, prefer = "text" }) => {
  const plugin = getAndroidPrinterPlugin();
  if (!plugin) return null;

  const htmlLen = String(html ?? "").length;
  const textLen = String(text ?? "").length;

  let first = "text";
  if (prefer === "html") first = "html";
  else if (prefer === "auto") first = htmlLen > textLen && htmlLen > 0 ? "html" : "text";

  const order = first === "html" ? ["html", "text"] : ["text", "html"];

  const hasTextFn = typeof plugin.printText === "function";
  const hasHtmlFn = typeof plugin.printHtml === "function";

  if (!hasTextFn && !hasHtmlFn) {
    return {
      ok: false,
      mode: "android",
      error:
        "AndroidPrinterPlugin existe, mas não expõe printText/printHtml.\n" +
        getAndroidPluginDiagnostics(),
    };
  }

  for (const kind of order) {
    try {
      if (kind === "text" && text && hasTextFn) {
        console.log("[PRINT] usando AndroidPrinterPlugin...");
        const res = await printText(text);
        const ok = normalizeAndroidResult(res);
        return { ok, mode: "android", status: res?.status, error: res?.error };
      }
      if (kind === "html" && html && hasHtmlFn) {
        console.log("[PRINT] usando AndroidPrinterPlugin...");
        const res = await printHtml(html);
        const ok = normalizeAndroidResult(res);
        return { ok, mode: "android", status: res?.status, error: res?.error };
      }
    } catch (e) {
      return { ok: false, mode: "android", error: e?.message || String(e) };
    }
  }

  return { ok: false, mode: "android", error: "Não foi possível imprimir (nenhum método aplicável)." };
};

const printViaBrowser = async (html) =>
  new Promise((resolve) => {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.style.opacity = "0";
    iframe.style.pointerEvents = "none";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const cleanup = () => {
      try {
        iframe.remove();
      } catch {}
    };

    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) {
      cleanup();
      resolve({ ok: false, mode: "browser", error: "Print iframe indisponível." });
      return;
    }

    doc.open();
    doc.write(html);
    doc.close();

    const triggerPrint = async () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch (error) {
        cleanup();
        resolve({ ok: false, mode: "browser", error: error?.message || String(error) });
        return;
      }

      await delay(350);
      cleanup();
      resolve({ ok: true, mode: "browser" });
    };

    iframe.onload = triggerPrint;
    setTimeout(triggerPrint, 250);
  });

export async function printAndroidSelfTest() {
  if (!isAndroidRuntime()) {
    return { ok: false, mode: "browser", error: "Auto-teste disponível apenas no Android." };
  }

  const plugin = getAndroidPrinterPlugin();
  if (!plugin || typeof plugin.printTesteDireto !== "function") {
    return {
      ok: false,
      mode: "android",
      error: "AndroidPrinterPlugin não expõe printTesteDireto.\n" + getAndroidPluginDiagnostics(),
    };
  }

  try {
    console.log("[PRINT] usando AndroidPrinterPlugin...");
    const res = await printTesteDireto();
    const ok = normalizeAndroidResult(res);
    return ok
      ? { ok: true, mode: "android", status: res?.status }
      : { ok: false, mode: "android", status: res?.status, error: res?.error || "Falha no auto-teste." };
  } catch (e) {
    return { ok: false, mode: "android", error: e?.message || String(e) };
  }
}

export async function imprimirVenda(payload = {}) {
  const ticketText =
    typeof payload === "string" || typeof payload === "number"
      ? String(payload)
      : typeof payload?.ticketText === "string"
        ? payload.ticketText
        : "";

  if (!ticketText || !ticketText.trim()) {
    return { ok: false, mode: isAndroidRuntime() ? "android" : "browser", error: "Texto do ticket vazio." };
  }

  if (!isAndroidRuntime()) {
    return { ok: false, mode: "browser", error: "Impressão disponível apenas no Android." };
  }

  const plugin = getAndroidPrinterPlugin();
  if (typeof plugin?.printText !== "function") {
    return {
      ok: false,
      mode: "android",
      error: "AndroidPrinterPlugin não expõe printText.\n" + getAndroidPluginDiagnostics(),
    };
  }

  try {
    console.log("[PRINT] usando AndroidPrinterPlugin...");
    return await printText(ticketText);
  } catch (error) {
    return { ok: false, mode: "android", error: error?.message || String(error) };
  }
}

export async function printTicketText(text, opts = {}) {
  const shouldNormalize = opts?.normalize ?? true;
  const payload = shouldNormalize ? normalizeText(text) : String(text ?? "");

  if (!payload || !String(payload).trim()) {
    return { ok: false, mode: isAndroidRuntime() ? "android" : "browser", error: "Texto do ticket vazio." };
  }

  const html = wrapThermal58(
    `<pre style="white-space: pre-wrap; font-family: 'Courier New', monospace; font-size: 12px;">${escapeHtml(
      payload,
    )}</pre>`,
  );

  if (isAndroidRuntime()) {
    const res = await printViaAndroidPlugin({ text: payload, html, prefer: "text" });
    if (!res) {
      return {
        ok: false,
        mode: "android",
        error: "AndroidPrinterPlugin não disponível.\n" + getAndroidPluginDiagnostics(),
      };
    }
    if (!res.ok) return { ...res, error: res.error || "Falha ao imprimir via plugin Android." };
    return res;
  }

  return await printViaBrowser(html);
}

export async function printReportText(text, opts = {}) {
  const linesPerBlock = Number(opts.linesPerBlock || 42) || 42;
  const delayMs = Number(opts.delayMs || 250) || 250;
  const separator = String(opts.separator || REPORT_SEPARATOR);

  const normalized = normalizeText(text);
  if (!normalized || !normalized.trim()) {
    return { ok: false, mode: isAndroidRuntime() ? "android" : "browser", error: "Texto do relatório vazio." };
  }

  const lines = String(normalized).split("\n");
  const blocks = [];
  for (let i = 0; i < lines.length; i += linesPerBlock) blocks.push(lines.slice(i, i + linesPerBlock));

  let lastResult = { ok: true, mode: isAndroidRuntime() ? "android" : "browser" };
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const isLast = index === blocks.length - 1;
    const blockText = `${block.join("\n")}${isLast ? "" : `\n${separator}\n`}`;

    const result = await printTicketText(blockText, { normalize: false });
    lastResult = result;
    if (!result?.ok) return result;
    if (!isLast) await delay(delayMs);
  }

  return lastResult;
}

export const REPORT_SEPARATOR_58 = REPORT_SEPARATOR;

export async function printReceiptHtml(htmlString) {
  const rawHtml = String(htmlString || "");
  const html = isFullHtmlDocument(rawHtml) ? rawHtml : wrapThermal58(rawHtml);
  const text = toPlainText(html);

  if (isAndroidRuntime()) {
    const res = await printViaAndroidPlugin({ html, text, prefer: "html" });
    if (!res) {
      return {
        ok: false,
        mode: "android",
        error: "AndroidPrinterPlugin não disponível.\n" + getAndroidPluginDiagnostics(),
      };
    }
    if (!res.ok) return { ...res, error: res.error || "Falha ao imprimir via plugin Android." };
    return res;
  }

  return await printViaBrowser(html);
}

export const imprimirTexto = printTicketText;
export const imprimirHtml = printReceiptHtml;
export const testarImpressora = printAndroidSelfTest;
