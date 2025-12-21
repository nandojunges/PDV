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

function getVendasEvento(vendas, nome) {
  const nm = String(nome || "").trim().toLowerCase();
  if (!nm) return [];
  const arr = Array.isArray(vendas) ? vendas : [];
  return arr.filter(
    (v) => String(v?.eventoNome || "").trim().toLowerCase() === nm
  );
}

export function getFlowState({ evento, produtos, caixa, vendas }) {
  const nomeEvento = String(evento?.nome || "").trim();
  if (!nomeEvento) return "SEM_EVENTO";

  const produtosEvento = Array.isArray(produtos) ? produtos : [];
  const vendasEvento = getVendasEvento(vendas, nomeEvento);

  const encerradoMeta = getEncerradoMeta(nomeEvento);
  const encerradoEm = caixa?.encerradoEm || encerradoMeta?.encerradoEm;
  if (encerradoEm) return "ENCERRADO";

  if (produtosEvento.length === 0) return "EVENTO_ABERTO_SEM_PRODUTOS";

  const caixaAberto = caixa?.abertura != null;
  if (!caixaAberto && vendasEvento.length === 0) return "PRONTO_PARA_VENDER";

  return "VENDENDO";
}
