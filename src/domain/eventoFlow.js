import { loadJSON } from "../storage/storage";
import { LS_KEYS } from "../storage/keys";

function getEventosMeta() {
  const meta = loadJSON(LS_KEYS.eventosMeta, []);
  return Array.isArray(meta) ? meta : [];
}

function getEncerradoMeta(nome) {
  const nm = String(nome || "").trim();
  if (!nm) return null;
  return getEventosMeta().find((m) => String(m?.nome || "").trim() === nm) || null;
}

export function getFlowState({ evento, produtos, caixa, vendas }) {
  const nomeEvento = String(evento?.nome || "").trim();
  if (!nomeEvento) return "SEM_EVENTO";

  const produtosEvento = Array.isArray(produtos) ? produtos : [];
  const itensFinalizados = Boolean(evento?.itensFinalizados);
  const ajustesConfirmados = Boolean(evento?.ajustesConfirmados);

  const encerradoMeta = getEncerradoMeta(nomeEvento);
  const encerradoEm = caixa?.encerradoEm || encerradoMeta?.encerradoEm;
  if (encerradoEm) return "ENCERRADO";

  if (!itensFinalizados) return "ITENS_NAO_FINALIZADOS";

  if (produtosEvento.length === 0) return "EVENTO_ABERTO_SEM_PRODUTOS";

  if (!ajustesConfirmados) return "PRODUTOS_FINALIZADOS";

  const caixaAberto = caixa?.abertura != null || evento?.caixaAberto;
  if (!caixaAberto) return "AJUSTES_CONFIRMADOS";

  return "CAIXA_ABERTO";
}

export function getAllowedTabs(flowState, evento, hasEventoAberto) {
  const baseTabs = ["evento", "produtos", "venda", "caixa", "relatorio", "ajustes"];
  if (!hasEventoAberto) return baseTabs;
  if (flowState === "SEM_EVENTO" || flowState === "ENCERRADO") return baseTabs;

  if (flowState === "ITENS_NAO_FINALIZADOS" || flowState === "EVENTO_ABERTO_SEM_PRODUTOS") {
    return ["evento", "produtos", "relatorio"];
  }
  if (flowState === "PRODUTOS_FINALIZADOS") {
    return ["evento", "ajustes", "relatorio"];
  }
  if (flowState === "AJUSTES_CONFIRMADOS") {
    return ["evento", "ajustes", "caixa", "relatorio"];
  }
  if (flowState === "CAIXA_ABERTO") {
    return ["evento", "ajustes", "caixa", "venda", "relatorio"];
  }
  if (!String(evento?.nome || "").trim()) return baseTabs;
  return baseTabs;
}