/* =========================================================
 * ANDROID PRINTER – BRIDGE OFICIAL
 * Compatível com AndroidPrinterBridge.java
 * ========================================================= */

import { printReceiptHtml, printTicketText } from "../services/printService";

/* ---------------------------------------------------------
 * TESTE DA IMPRESSORA (TEXTO SIMPLES)
 * --------------------------------------------------------- */

export async function testarImpressora() {
  try {
    const texto = `TESTE IMPRESSORA\nOK\n${new Date().toLocaleString(
      "pt-BR",
    )}\n\n`;
    const resultado = await printTicketText(texto);
    if (!resultado?.ok) {
      throw new Error(resultado?.error || "Falha ao imprimir teste.");
    }
    return { ok: true };
  } catch (err) {
    console.error("Erro ao testar impressora:", err);
    return { ok: false, error: err.message };
  }
}

/* ---------------------------------------------------------
 * IMPRESSÃO DE TEXTO SIMPLES
 * --------------------------------------------------------- */

export async function imprimirTexto(texto) {
  try {
    if (typeof texto !== "string" || !texto.trim()) {
      throw new Error("Texto inválido para impressão");
    }

    const resultado = await printTicketText(texto);
    if (!resultado?.ok) {
      throw new Error(resultado?.error || "Falha ao imprimir texto.");
    }
    return resultado;
  } catch (err) {
    console.error("Erro ao imprimir texto:", err);
    return { ok: false, error: err.message };
  }
}

/* ---------------------------------------------------------
 * IMPRESSÃO DE HTML
 * --------------------------------------------------------- */

export async function imprimirHtml(html) {
  try {
    const payload = String(html ?? "").trim();
    if (!payload) {
      throw new Error("HTML inválido para impressão");
    }

    const resultado = await printReceiptHtml(payload);
    if (!resultado?.ok) {
      throw new Error(resultado?.error || "Falha ao imprimir HTML.");
    }
    return resultado;
  } catch (err) {
    console.error("Erro ao imprimir HTML:", err);
    return { ok: false, error: err.message };
  }
}

/* ---------------------------------------------------------
 * IMPRESSÃO DE VENDA (HTML → TEXTO)
 * --------------------------------------------------------- */

export async function imprimirVenda({
  cabecalho,
  itens,
  total,
  pagamento,
  recebido,
  troco,
}) {
  try {
    /* ----------- monta HTML LIMPO ----------- */

    let html = "";

    if (cabecalho) {
      html += `<b>${cabecalho}</b><br/>`;
    }

    html += "------------------------<br/>";

    (Array.isArray(itens) ? itens : []).forEach((item) => {
      html += `${item.nome}  x${item.qtd}  R$ ${item.preco}<br/>`;
    });

    html += "------------------------<br/>";
    html += `<b>TOTAL: R$ ${total}</b><br/>`;

    if (pagamento) {
      html += `<br/>Pagamento: ${pagamento}<br/>`;
    }

    if (recebido) {
      html += `Recebido: R$ ${recebido}<br/>`;
    }

    if (troco) {
      html += `Troco: R$ ${troco}<br/>`;
    }

    html += "<br/>Obrigado pela preferência!<br/>";

    const resultado = await imprimirHtml(html);
    if (!resultado?.ok) {
      throw new Error(resultado?.error || "Falha ao imprimir venda.");
    }

    // Garante que 'fichas' imprimem uma por vez (ex.: 5 fichas => 5 tickets)
    const lista = Array.isArray(itens) ? itens : [];
    for (const item of lista) {
      const nome = String(item?.nome || "").toLowerCase();
      const qtd = Number(item?.qtd || 0) || 0;
      const isFicha = /ficha/.test(nome);
      if (!isFicha || qtd <= 0) continue;

      for (let i = 0; i < qtd; i += 1) {
        const textoFicha = `FICHA\n${item.nome}\n${new Date().toLocaleString("pt-BR")}\n`;
        try {
          const r = await printTicketText(textoFicha, { normalize: true });
          if (!r?.ok) {
            console.warn("Falha ao imprimir ficha", { item: item.nome, idx: i + 1 });
          }
        } catch (e) {
          console.warn("Erro ao imprimir ficha", e);
        }
        // pequeno delay para n�o congestionar o servi�o AIDL
        await new Promise((res) => setTimeout(res, 200));
      }
    }
    return resultado;
  } catch (err) {
    console.error("Erro ao imprimir venda:", err);
    return { ok: false, error: err.message };
  }
}
