import { loadJSON, saveJSON } from "../storage/storage";
import { LS_KEYS } from "../storage/keys";
import { uid } from "../domain/math";

function isBrowser() {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function getOrCreateDeviceId() {
  if (!isBrowser()) return `web-${uid()}`;
  const existing = window.localStorage.getItem(LS_KEYS.deviceId);
  if (existing) return existing;
  const next = `device-${uid()}`;
  window.localStorage.setItem(LS_KEYS.deviceId, next);
  return next;
}

export function normalizeVendaForStorage(sale) {
  const createdAt =
    sale?.createdAt ||
    sale?.criadoEm ||
    sale?.data ||
    sale?.created ||
    new Date().toISOString();
  const id = sale?.id || uid();
  return {
    ...sale,
    id,
    criadoEm: sale?.criadoEm || createdAt,
    createdAt,
    data: sale?.data || createdAt,
    eventoNome: String(sale?.eventoNome || "").trim(),
    total: Number(sale?.total ?? sale?.valorTotal ?? 0) || 0,
    pagamento: String(sale?.pagamento || "dinheiro"),
    itens: Array.isArray(sale?.itens) ? sale.itens : [],
  };
}

export function persistSale({ sale, setVendas }) {
  const vendaFinal = normalizeVendaForStorage(sale);
  const prev = loadJSON(LS_KEYS.vendas, []);
  const lista = Array.isArray(prev) ? prev : [];
  const exists = lista.some((v) => String(v?.id || "") === String(vendaFinal.id));
  if (exists) {
    return { venda: vendaFinal, added: false };
  }
  const next = [vendaFinal, ...lista];
  saveJSON(LS_KEYS.vendas, next);
  if (typeof setVendas === "function") {
    setVendas((prevState = []) => [vendaFinal, ...(Array.isArray(prevState) ? prevState : [])]);
  }
  return { venda: vendaFinal, added: true };
}

export function getEventoSnapshot() {
  const evento = loadJSON(LS_KEYS.evento, null);
  const produtos = loadJSON(LS_KEYS.produtos, []);
  const ajustes = loadJSON(LS_KEYS.ajustes, {});
  const caixa = loadJSON(LS_KEYS.caixa, null);
  const vendas = loadJSON(LS_KEYS.vendas, []);
  const nomeEvento = String(evento?.nome || "").trim();
  const vendasEvento = Array.isArray(vendas)
    ? vendas.filter((v) => String(v?.eventoNome || "").trim() === nomeEvento)
    : [];

  return {
    evento: evento || null,
    itensEvento: Array.isArray(produtos) ? produtos : [],
    atalhos: [],
    config: ajustes || {},
    caixaState: caixa || null,
    relatorioState: {
      vendas: vendasEvento,
      totais: buildTotals(vendasEvento),
      updatedAt: new Date().toISOString(),
    },
    serverTime: new Date().toISOString(),
  };
}

export function getSnapshotDelta({ since }) {
  const vendas = loadJSON(LS_KEYS.vendas, []);
  const lista = Array.isArray(vendas) ? vendas : [];
  const sinceTime = since ? new Date(since).getTime() : 0;
  const deltaSales = lista.filter((v) => {
    const when = new Date(v?.createdAt || v?.criadoEm || v?.data || 0).getTime();
    return Number.isFinite(when) && when > sinceTime;
  });
  return {
    sales: deltaSales,
    totals: buildTotals(lista),
    updatedAt: new Date().toISOString(),
  };
}

export function buildTotals(vendas) {
  const lista = Array.isArray(vendas) ? vendas : [];
  const totalBRL = lista.reduce((acc, v) => acc + (Number(v?.total || 0) || 0), 0);
  return { vendas: lista.length, totalBRL };
}

export function readPendingSales() {
  const raw = loadJSON(LS_KEYS.pendingSales, []);
  return Array.isArray(raw) ? raw : [];
}

export function writePendingSales(next) {
  saveJSON(LS_KEYS.pendingSales, Array.isArray(next) ? next : []);
}

export function enqueuePendingSale(entry) {
  const lista = readPendingSales();
  const id = String(entry?.sale?.id || entry?.id || "");
  if (!id) return lista;
  if (lista.some((item) => String(item?.sale?.id || item?.id || "") === id)) {
    return lista;
  }
  const next = [
    {
      sale: entry.sale,
      queuedAt: new Date().toISOString(),
    },
    ...lista,
  ];
  writePendingSales(next);
  return next;
}

export function removePendingSaleById(id) {
  const target = String(id || "");
  const next = readPendingSales().filter(
    (item) => String(item?.sale?.id || item?.id || "") !== target
  );
  writePendingSales(next);
  return next;
}

export function countPendingSales() {
  return readPendingSales().length;
}
