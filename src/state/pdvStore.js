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
    deviceId: sale?.deviceId ?? sale?.device_id ?? sale?.deviceID ?? null,
    deviceName: sale?.deviceName ?? sale?.device_name ?? null,
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

export function getProdutosSnapshot() {
  const evento = loadJSON(LS_KEYS.evento, null);
  const produtos = loadJSON(LS_KEYS.produtos, []);
  const updatedAt =
    loadJSON(LS_KEYS.produtosUpdatedAt, null) || new Date().toISOString();
  return {
    eventName: String(evento?.nome || "").trim(),
    products: Array.isArray(produtos) ? produtos : [],
    updatedAt,
  };
}

export function getProdutosSnapshotDelta({ since }) {
  const snapshot = getProdutosSnapshot();
  if (!since) return snapshot;
  const sinceTime = new Date(since).getTime();
  const updatedTime = new Date(snapshot.updatedAt).getTime();
  if (!Number.isFinite(updatedTime) || updatedTime > sinceTime) {
    return snapshot;
  }
  return { products: null, updatedAt: snapshot.updatedAt };
}

export function buildTotals(vendas) {
  const lista = Array.isArray(vendas) ? vendas : [];
  const totalBRL = lista.reduce((acc, v) => acc + (Number(v?.total || 0) || 0), 0);
  return { vendas: lista.length, totalBRL };
}

function normalizeItensResumo(itens) {
  if (!Array.isArray(itens)) return [];
  return itens.map((item) => {
    const qtd = Number(item?.qtd ?? item?.quantidade ?? item?.qty ?? 0) || 0;
    const unitario = Number(item?.unitario ?? item?.preco ?? item?.valor ?? 0) || 0;
    const subtotal = Number(item?.subtotal ?? qtd * unitario) || 0;
    return {
      produtoId: item?.produtoId ?? item?.id ?? null,
      nome: item?.nome ?? item?.produto ?? item?.name ?? "",
      qtd,
      unitario,
      subtotal,
      barrilLitros: item?.barrilLitros ?? null,
      unitarioPorLitro: item?.unitarioPorLitro ?? null,
    };
  });
}

export function buildSaleSummaryFromSale({ sale, deviceId, deviceName }) {
  if (!sale) return null;
  const createdAt =
    sale?.createdAt || sale?.criadoEm || sale?.data || new Date().toISOString();
  const saleId = sale?.id || uid();
  const itens = normalizeItensResumo(
    sale?.itens ?? sale?.carrinho ?? sale?.items ?? sale?.produtos ?? []
  );
  const total = Number(sale?.total ?? sale?.valorTotal ?? 0) || 0;
  return {
    id: `${deviceId || "device"}:${saleId}`,
    saleId,
    deviceId: deviceId || null,
    deviceName: deviceName || sale?.deviceName || "Cliente",
    eventoId: sale?.eventoId ?? null,
    eventoNome: String(sale?.eventoNome || "").trim(),
    total,
    itens,
    criadoEm: sale?.criadoEm || createdAt,
    enviadoEm: new Date().toISOString(),
  };
}

export function readSaleSummaries() {
  const raw = loadJSON(LS_KEYS.saleSummaries, []);
  return Array.isArray(raw) ? raw : [];
}

export function writeSaleSummaries(next) {
  saveJSON(LS_KEYS.saleSummaries, Array.isArray(next) ? next : []);
}

export function persistSaleSummary(summary) {
  if (!summary) return { summary: null, added: false };
  const id = String(summary?.id || summary?.saleId || "");
  if (!id) return { summary, added: false };
  const lista = readSaleSummaries();
  if (lista.some((item) => String(item?.id || item?.saleId || "") === id)) {
    return { summary, added: false };
  }
  const next = [summary, ...lista];
  writeSaleSummaries(next);
  return { summary, added: true };
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
  const id = String(entry?.summary?.id || entry?.sale?.id || entry?.id || "");
  if (!id) return lista;
  if (lista.some((item) => String(item?.summary?.id || item?.sale?.id || item?.id || "") === id)) {
    return lista;
  }
  const next = [
    {
      summary: entry.summary || null,
      sale: entry.sale || null,
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
    (item) => {
      const summaryId = String(item?.summary?.id || "");
      const saleId = String(item?.summary?.saleId || item?.sale?.id || item?.id || "");
      if (!target) return true;
      if (summaryId === target || saleId === target) return false;
      if (summaryId && saleId && summaryId.endsWith(`:${target}`)) return false;
      return true;
    }
  );
  writePendingSales(next);
  return next;
}

export function countPendingSales() {
  return readPendingSales().length;
}