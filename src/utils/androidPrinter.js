import { Capacitor, registerPlugin } from "@capacitor/core";

export const AndroidPrinterPlugin = registerPlugin("AndroidPrinterPlugin");

function ensureAndroid() {
  return Capacitor.getPlatform() === "android";
}

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeResult = (value) => {
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

export async function printText(text) {
  if (!ensureAndroid()) return;
  return AndroidPrinterPlugin.printText({ text });
}

export async function printHtml(html) {
  if (!ensureAndroid()) return;
  return AndroidPrinterPlugin.printHtml({ html });
}

export async function printTesteDireto() {
  if (!ensureAndroid()) return;
  return AndroidPrinterPlugin.printTesteDireto({});
}

export async function imprimirVenda(payload) {
  if (!ensureAndroid()) {
    return { ok: false, mode: "browser", error: "Impressão disponível apenas no Android." };
  }

  const cabecalho = String(payload?.cabecalho || "").trim() || "Venda";
  const itens = Array.isArray(payload?.itens) ? payload.itens : [];
  if (!itens.length) {
    return { ok: false, mode: "android", error: "Venda sem itens para imprimir." };
  }

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

  const text = `${linhasTexto.join("\n")}\n`;

  try {
    const htmlResult = await printHtml(html);
    const okHtml = normalizeResult(htmlResult);
    if (okHtml) return { ok: true, mode: "android", status: htmlResult?.status };
  } catch (error) {
    return { ok: false, mode: "android", error: error?.message || String(error) };
  }

  try {
    const textResult = await printText(text);
    const okText = normalizeResult(textResult);
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

export const imprimirTexto = printText;
export const imprimirHTML = printHtml;
export const testarImpressora = printTesteDireto;
