// src/services/printService.js
import { wrapThermal58 } from "./receiptTemplate58";
import {
  getAndroidPrinterDiagnostics,
  getAndroidPrinterPlugin,
  getPlatform,
} from "../utils/androidPrinterPlugin";
import { printHtml, printTesteDireto, printText } from "../utils/androidPrinter";

/**
 * Plugin-first:
 * - Android: usa SOMENTE AndroidPrinterPlugin.
 * - Web/desktop: fallback browser.
 */

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const REPORT_LINE_WIDTH = 32;
const REPORT_SEPARATOR = "-".repeat(REPORT_LINE_WIDTH);

const isAndroidRuntime = () => getPlatform() === "android";
const getAndroidPluginDiagnostics = () => getAndroidPrinterDiagnostics();

/**
 * Normaliza retorno do plugin para boolean.
 */
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

const buildVendaPayload = (payload) => {
  const cabecalho = String(payload?.cabecalho || "").trim() || "Venda";
  const itens = Array.isArray(payload?.itens) ? payload.itens : [];

  const linhasTexto = [];
  linhasTexto.push(cabecalho.toUpperCase());
  linhasTexto.push("--------------------------------");

  const itensHtml = itens
    .map((item) => {
      const nome = String(item?.nome || "").trim();
      const qtd = Number(item?.qtd || 0) || 0;
      const preco = String(item?.preco ?? "").trim();
      if (!nome || qtd <= 0) return null;

      const linha = `${qtd}x ${nome}${preco ? ` - R$ ${preco}` : ""}`;
      linhasTexto.push(linha);

      return `
        <div class="itemBlock">
          <div class="itemTop">
            <span class="qty">${qtd}x</span>
            <span class="itemName">${escapeHtml(nome)}</span>
          </div>
          ${preco ? `<div class="itemBottom"><span class="price">R$ ${escapeHtml(preco)}</span></div>` : ""}
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  const total = String(payload?.total ?? "").trim();
  const pagamento = String(payload?.pagamento ?? "").trim();
  const recebido = String(payload?.recebido ?? "").trim();
  const troco = String(payload?.troco ?? "").trim();
  const mensagemRodape = String(payload?.mensagemRodape ?? "").trim();

  if (total) linhasTexto.push(`Total: R$ ${total}`);
  if (pagamento) linhasTexto.push(`Pagamento: ${pagamento}`);
  if (recebido) linhasTexto.push(`Recebido: R$ ${recebido}`);
  if (troco) linhasTexto.push(`Troco: R$ ${troco}`);
  if (mensagemRodape) linhasTexto.push(mensagemRodape);

  const html = `<!doctype html>
  <html>
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <style>
      @page { size: 58mm auto; margin: 0; }
      html, body { width: 58mm; margin: 0; padding: 0; }
      body { font-family: monospace, system-ui; font-size: 11px; line-height: 1.25; color: #000; }
      .paper { width: 58mm; padding: 6px 6px; box-sizing: border-box; }
      .center { text-align: center; }
      .sep { border-top: 1px dashed #000; margin: 6px 0; }
      .itemBlock { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
      .itemTop { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
      .qty { font-size: 11px; font-weight: 700; white-space: nowrap; }
      .itemName { font-size: 11px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .itemBottom { display: flex; justify-content: flex-end; }
      .price { font-size: 12px; font-weight: 700; white-space: nowrap; }
      .total { font-size: 12px; font-weight: 700; text-align: right; margin-top: 6px; }
      .meta { margin-top: 4px; }
      .thanks { text-align: center; font-size: 11px; font-weight: 700; margin-top: 4px; }
    </style>
  </head>
  <body>
    <div class="paper">
      <div class="center"><strong>${escapeHtml(cabecalho)}</strong></div>
      <div class="sep"></div>
      ${itensHtml}
      ${total ? `<div class="total">Total: R$ ${escapeHtml(total)}</div>` : ""}
      <div class="meta">
        ${pagamento ? `<div>Pagamento: ${escapeHtml(pagamento)}</div>` : ""}
        ${recebido ? `<div>Recebido: R$ ${escapeHtml(recebido)}</div>` : ""}
        ${troco ? `<div>Troco: R$ ${escapeHtml(troco)}</div>` : ""}
      </div>
      ${mensagemRodape ? `<div class="thanks">${escapeHtml(mensagemRodape)}</div>` : ""}
    </div>
  </body>
  </html>`;

  return {
    cabecalho,
    itens,
    html,
    text: `${linhasTexto.join("\n")}\n`,
  };
};

/**
 * Imprime via plugin (Android).
 * prefer: "text" | "html" | "auto"
 */
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
        const res = await printText(text);
        const ok = normalizeAndroidResult(res);
        return { ok, mode: "android", status: res?.status, error: res?.error };
      }
      if (kind === "html" && html && hasHtmlFn) {
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

/**
 * Fallback browser (somente fora do Android).
 */
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

/**
 * Auto-teste (Android)
 */
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
    const res = await printTesteDireto();
    const ok = normalizeAndroidResult(res);
    return ok
      ? { ok: true, mode: "android", status: res?.status }
      : { ok: false, mode: "android", status: res?.status, error: res?.error || "Falha no auto-teste." };
  } catch (e) {
    return { ok: false, mode: "android", error: e?.message || String(e) };
  }
}

/**
 * Imprime venda (Android).
 */
export async function imprimirVenda(payload) {
  if (!isAndroidRuntime()) {
    return { ok: false, mode: "browser", error: "Impressão disponível apenas no Android." };
  }

  const { itens, html, text } = buildVendaPayload(payload);
  if (!itens.length) {
    return { ok: false, mode: "android", error: "Venda sem itens para imprimir." };
  }

  const plugin = getAndroidPrinterPlugin();
  const hasTextFn = typeof plugin?.printText === "function";
  const hasHtmlFn = typeof plugin?.printHtml === "function";

  if (!hasTextFn && !hasHtmlFn) {
    return {
      ok: false,
      mode: "android",
      error:
        "AndroidPrinterPlugin existe, mas não expõe printText/printHtml.\n" +
        getAndroidPluginDiagnostics(),
    };
  }

  if (hasHtmlFn) {
    try {
      const htmlResult = await printHtml(html);
      const okHtml = normalizeAndroidResult(htmlResult);
      if (okHtml) return { ok: true, mode: "android", status: htmlResult?.status };
    } catch (error) {
      return { ok: false, mode: "android", error: error?.message || String(error) };
    }
  }

  if (hasTextFn) {
    try {
      const textResult = await printText(text);
      const okText = normalizeAndroidResult(textResult);
      return okText
        ? { ok: true, mode: "android", status: textResult?.status }
        : {
            ok: false,
            mode: "android",
            status: textResult?.status,
            error: textResult?.error || "Falha ao imprimir venda.",
          };
    } catch (error) {
      return { ok: false, mode: "android", error: error?.message || String(error) };
    }
  }

  return {
    ok: false,
    mode: "android",
    error: "AndroidPrinterPlugin não disponível.\n" + getAndroidPluginDiagnostics(),
  };
}

/**
 * Imprime texto simples (tickets).
 */
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

/**
 * Imprime relatório em texto (58mm), com separadores e paginação.
 */
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

/**
 * Imprime recibo HTML.
 */
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
export const imprimirHTML = printReceiptHtml;
export const testarImpressora = printAndroidSelfTest;
