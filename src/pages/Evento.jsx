// src/pages/Evento.jsx
import React, { useMemo, useState, useEffect } from "react";
import { loadJSON, saveJSON } from "../storage/storage";
import { LS_KEYS } from "../storage/keys";
import { getFlowState } from "../domain/eventoFlow";
import { imprimirTexto } from "../utils/sunmiPrinter";
import {
  REPORT_LINE_WIDTH,
  REPORT_SEPARATOR,
  centerText,
  formatRow,
  formatSectionTitle,
  joinLines,
} from "../services/reportText";

const SENHA_EXCLUIR = "123456";

/* ===================== storage: status do evento ===================== */
function loadEventosMeta() {
  const arr = loadJSON(LS_KEYS.eventosMeta, []);
  return Array.isArray(arr) ? arr : [];
}
function saveEventosMeta(arr) {
  saveJSON(LS_KEYS.eventosMeta, Array.isArray(arr) ? arr : []);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}
function toBRDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function toBRDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}, ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}
function fmtBRL(value) {
  return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
}

const ITEM_LIST_KEYS = ["itens", "items", "produtos", "products", "carrinho", "cart"];
const ITEM_NAME_KEYS = ["nome", "name", "titulo", "title", "descricao"];
const ITEM_PRICE_KEYS = ["preco", "price", "valor", "unitPrice", "precoUnit"];
const ITEM_QTD_KEYS = ["qtd", "qty", "quantidade", "quantity"];
const ITEM_TOTAL_KEYS = ["total", "valorTotal", "subtotal"];

function pickField(obj, keys) {
  if (!obj) return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  }
  return undefined;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") {
    const raw = value.replace(/\s/g, "").replace(",", ".");
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeNameKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function extractItensFromVenda(venda) {
  if (!venda || typeof venda !== "object") return [];
  let itensRaw = null;
  for (const key of ITEM_LIST_KEYS) {
    if (Array.isArray(venda[key])) {
      itensRaw = venda[key];
      break;
    }
  }
  if (!Array.isArray(itensRaw)) return [];

  const itens = [];
  for (const item of itensRaw) {
    const nome = pickField(item, ITEM_NAME_KEYS);
    const nomeLimpo = String(nome || "").trim();
    if (!nomeLimpo) continue;

    const qtd = toNumber(pickField(item, ITEM_QTD_KEYS)) || 1;
    let preco = toNumber(pickField(item, ITEM_PRICE_KEYS));
    let total = toNumber(pickField(item, ITEM_TOTAL_KEYS));

    if (preco == null && total != null && qtd) preco = total / qtd;
    if (total == null && preco != null) total = preco * qtd;

    if (preco == null && total == null) continue;

    itens.push({
      nome: nomeLimpo,
      preco: preco == null ? null : preco,
      qtd,
      total: total == null ? 0 : total,
    });
  }
  return itens;
}

function extractProdutoInfo(produto) {
  if (!produto || typeof produto !== "object") return null;
  const nome = pickField(produto, ITEM_NAME_KEYS);
  const nomeLimpo = String(nome || "").trim();
  if (!nomeLimpo) return null;
  const preco = toNumber(
    pickField(produto, ["preco", "price", "valor", "valorUnitario", "unitPrice"])
  );
  return { nome: nomeLimpo, preco: preco == null ? null : preco };
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 9999,
};

const modalCard = {
  width: "100%",
  maxWidth: 420,
  background: "#fff",
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  overflow: "hidden",
};

const modalHead = {
  padding: "14px 14px 10px",
  borderBottom: "1px solid #e5e7eb",
  fontWeight: 900,
};

const modalBody = { padding: 14 };

const btn = (variant = "soft") => {
  const base = {
    height: 36,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "0 12px",
    fontWeight: 800,
    cursor: "pointer",
    background: "#fff",
  };
  if (variant === "primary") {
    return { ...base, borderColor: "#2563eb", background: "#2563eb", color: "#fff" };
  }
  if (variant === "danger") {
    return { ...base, borderColor: "#ef4444", background: "#ef4444", color: "#fff" };
  }
  if (variant === "dark") {
    return { ...base, borderColor: "#111827", background: "#111827", color: "#fff" };
  }
  return { ...base, background: "#f8fafc" };
};

export default function Evento({
  evento,
  abrirEvento,
  vendas = [],
  caixa,
  flowState,
  readOnly = false,
  setEvento,
  setCaixa,
  setVendas,
  setProdutos,
  ajustes = {},
  setAjustes,
}) {
  const [nome, setNome] = useState(evento?.nome || "");

  // ✅ se mudar o evento ativo (abrir/zerar), reflete no input
  useEffect(() => {
    setNome(evento?.nome || "");
  }, [evento?.nome]);

  // modal resumo
  const [evResumo, setEvResumo] = useState(null);


  // modal excluir
  const [evExcluir, setEvExcluir] = useState(null);
  const [senha, setSenha] = useState("");
  const [erroSenha, setErroSenha] = useState("");

  // ✅ mapa de encerrados (cache)
  const encerradosMap = useMemo(() => {
    const meta = loadEventosMeta();
    const map = new Map();
    for (const m of meta) {
      const nm = String(m?.nome || "").trim();
      if (!nm) continue;
      map.set(nm, m);
    }
    return map;
  }, [vendas, evento?.nome]); // re-render quando algo muda no app

  const historico = useMemo(() => {
    const vs = Array.isArray(vendas) ? vendas : [];
    const map = new Map();

    for (const v of vs) {
      const nomeEv = String(v?.eventoNome || "").trim();
      if (!nomeEv) continue;

      const criadoEm = v?.criadoEm || v?.createdAt || v?.data || v?.quando || null;
      const total = Number(v?.total ?? v?.valorTotal ?? 0) || 0;
      const pagamento = String(v?.pagamento || "").toLowerCase();

      if (!map.has(nomeEv)) {
        map.set(nomeEv, {
          nome: nomeEv,
          primeiraData: criadoEm,
          ultimaData: criadoEm,
          vendas: 0,
          total: 0,
          porPagamento: { dinheiro: 0, pix: 0, cartao: 0 },
        });
      }

      const it = map.get(nomeEv);
      it.vendas += 1;
      it.total += total;

      if (pagamento === "dinheiro") it.porPagamento.dinheiro += total;
      else if (pagamento === "pix") it.porPagamento.pix += total;
      else if (pagamento === "cartao" || pagamento === "cartão") it.porPagamento.cartao += total;

      if (criadoEm) {
        if (!it.primeiraData || new Date(criadoEm) < new Date(it.primeiraData)) it.primeiraData = criadoEm;
        if (!it.ultimaData || new Date(criadoEm) > new Date(it.ultimaData)) it.ultimaData = criadoEm;
      }
    }

    // inclui evento atual mesmo sem vendas
    const atual = String(evento?.nome || "").trim();
    if (atual && !map.has(atual)) {
      map.set(atual, {
        nome: atual,
        primeiraData: evento?.abertoEm || null,
        ultimaData: evento?.abertoEm || null,
        vendas: 0,
        total: 0,
        porPagamento: { dinheiro: 0, pix: 0, cartao: 0 },
      });
    }

    // inclui eventos encerrados no histórico, mesmo sem vendas no array "vendas"
    for (const [nm] of encerradosMap.entries()) {
      if (!map.has(nm)) {
        const meta = encerradosMap.get(nm);
        map.set(nm, {
          nome: nm,
          primeiraData: meta?.fechamento?.abertoEm || meta?.abertoEm || meta?.encerradoEm || null,
          ultimaData: meta?.encerradoEm || null,
          vendas: 0,
          total: 0,
          porPagamento: { dinheiro: 0, pix: 0, cartao: 0 },
        });
      }
    }

    const arr = Array.from(map.values()).sort((a, b) => {
      const da = a.ultimaData ? new Date(a.ultimaData).getTime() : 0;
      const db = b.ultimaData ? new Date(b.ultimaData).getTime() : 0;
      return db - da;
    });

    // garante o atual em cima
    if (atual) {
      const idx = arr.findIndex((x) => x.nome === atual);
      if (idx > 0) {
        const [item] = arr.splice(idx, 1);
        arr.unshift(item);
      }
    }

    return arr;
  }, [vendas, evento, encerradosMap]);

  const eventoAberto = Boolean(String(evento?.nome || "").trim());
  const produtosEvento = Array.isArray(evento?.produtos) ? evento.produtos : [];
  const estadoFluxo =
    flowState || getFlowState({ evento, produtos: produtosEvento, caixa, vendas });
  const eventoBloqueado = readOnly;
  const bloqueioStyle = eventoBloqueado ? { opacity: 0.5, cursor: "not-allowed" } : {};

  function alertEventoBloqueado() {
    alert("Evento em andamento. Finalize o caixa para editar/excluir.");
  }

  function abrirLocal() {
    const nm = String(nome || "").trim();
    if (!nm) return alert("Informe o nome do evento.");
    abrirEvento(nm, { modo: "local", rede: null });
    setNome("");
  }

  function calcularCaixaDoEvento(nomeEv) {
    const nomeEvLimpo = String(nomeEv || "").trim();
    const vs = Array.isArray(vendas) ? vendas : [];

    const evVendas = vs.filter(
      (v) => String(v?.eventoNome || "").trim() === nomeEvLimpo
    );

    const resumo = {
      vendas: evVendas.length,
      total: 0,
      porPagamento: { dinheiro: 0, pix: 0, cartao: 0 },
      primeira: null,
      ultima: null,
    };

    for (const v of evVendas) {
      const total = Number(v?.total ?? v?.valorTotal ?? 0) || 0;
      resumo.total += total;

      const pagamento = String(v?.pagamento || "").toLowerCase();
      if (pagamento === "dinheiro") resumo.porPagamento.dinheiro += total;
      else if (pagamento === "pix") resumo.porPagamento.pix += total;
      else if (pagamento === "cartao" || pagamento === "cartão") resumo.porPagamento.cartao += total;

      const criadoEm = v?.criadoEm || v?.createdAt || v?.data || v?.quando || null;
      if (criadoEm) {
        if (!resumo.primeira || new Date(criadoEm) < new Date(resumo.primeira)) resumo.primeira = criadoEm;
        if (!resumo.ultima || new Date(criadoEm) > new Date(resumo.ultima)) resumo.ultima = criadoEm;
      }
    }

    // ✅ caixaAtual só para evento ativo
    const nmAtual = String(evento?.nome || "").trim();
    const caixaAtual =
      nmAtual &&
      nmAtual === nomeEvLimpo &&
      caixa &&
      typeof caixa === "object"
        ? caixa
        : null;

    let abertura = Number(caixaAtual?.abertura ?? 0) || 0;
    const movimentos = Array.isArray(caixaAtual?.movimentos) ? caixaAtual.movimentos : [];
    const reforcos = movimentos
      .filter((m) => m?.tipo === "reforco")
      .reduce((s, m) => s + (Number(m?.valor) || 0), 0);
    const sangrias = movimentos
      .filter((m) => m?.tipo === "sangria")
      .reduce((s, m) => s + (Number(m?.valor) || 0), 0);

    const saldoDinheiroEsperado = abertura + resumo.porPagamento.dinheiro + reforcos - sangrias;

    // ===== Itens: vendas + produtos snapshot do evento (ATUAL ou ENCERRADO) =====
    const itensMap = new Map();
    const itensPorNome = new Map();

    const registrarItem = (item) => {
      if (!item) return;
      const nome = String(item.nome || "").trim();
      if (!nome) return;

      const precoNum = Number.isFinite(item.preco) ? Number(item.preco) : null;
      const precoKey = precoNum == null ? "sem-preco" : precoNum.toFixed(2);
      const chave = `${normalizeNameKey(nome)}__${precoKey}`;

      if (!itensMap.has(chave)) {
        itensMap.set(chave, { nome, preco: precoNum, qtd: 0, total: 0 });
      }

      const registro = itensMap.get(chave);
      registro.qtd += Number(item.qtd || 0) || 0;
      registro.total += Number(item.total || 0) || 0;

      const nomeKey = normalizeNameKey(nome);
      if (!itensPorNome.has(nomeKey)) itensPorNome.set(nomeKey, new Set());
      itensPorNome.get(nomeKey).add(chave);
    };

    for (const venda of evVendas) {
      const itensVenda = extractItensFromVenda(venda);
      for (const item of itensVenda) {
        registrarItem(item);
      }
    }

    // ✅ Se for evento encerrado, tenta puxar produtos do cache (eventosMeta)
    const metaEncerrado = encerradosMap.get(nomeEvLimpo);

    const produtosLista =
      nomeEvLimpo === String(evento?.nome || "").trim()
        ? produtosEvento
        : Array.isArray(metaEncerrado?.produtos)
          ? metaEncerrado.produtos
          : Array.isArray(metaEncerrado?.fechamento?.produtos)
            ? metaEncerrado.fechamento.produtos
            : [];

    for (const produto of produtosLista) {
      const info = extractProdutoInfo(produto);
      if (!info) continue;
      const nomeKey = normalizeNameKey(info.nome);
      const precoKey = info.preco == null ? "sem-preco" : info.preco.toFixed(2);
      const chave = `${nomeKey}__${precoKey}`;

      // se não tem preço e já existe algum com mesmo nome, não duplica
      if (info.preco == null) {
        const existentes = itensPorNome.get(nomeKey);
        if (existentes && existentes.size > 0) continue;
      }

      if (!itensMap.has(chave)) {
        itensMap.set(chave, { nome: info.nome, preco: info.preco, qtd: 0, total: 0 });
      }
    }

    const itensResumo = Array.from(itensMap.values()).sort((a, b) => {
      const totalDiff = (Number(b.total || 0) || 0) - (Number(a.total || 0) || 0);
      if (totalDiff !== 0) return totalDiff;
      const qtdDiff = (Number(b.qtd || 0) || 0) - (Number(a.qtd || 0) || 0);
      if (qtdDiff !== 0) return qtdDiff;
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });

    const itensComVenda = itensResumo.filter((it) => (Number(it.qtd || 0) || 0) > 0).length;
    const itensSemVenda = itensResumo.length - itensComVenda;
    const totalItensCalculado = itensResumo.reduce((s, it) => s + (Number(it.total || 0) || 0), 0);
    const totalItens = Number(resumo.total || 0) || totalItensCalculado;

    return {
      nome: nomeEvLimpo,
      resumo,
      caixaAtual: !!caixaAtual,
      abertura,
      reforcos,
      sangrias,
      saldoDinheiroEsperado,
      itensResumo,
      itensTotais: {
        totalItens,
        itensComVenda,
        itensSemVenda,
      },
      encerradoEm: metaEncerrado?.encerradoEm || metaEncerrado?.fechamento?.encerradoEm || null,
      abertoEm: metaEncerrado?.abertoEm || metaEncerrado?.fechamento?.abertoEm || null,
    };
  }

  async function imprimirResumoCaixa(resumoCaixa) {
    if (!resumoCaixa) return;

    const periodo = resumoCaixa.resumo.primeira
      ? `${toBRDateTime(resumoCaixa.resumo.primeira)} → ${toBRDateTime(resumoCaixa.resumo.ultima)}`
      : resumoCaixa.abertoEm || resumoCaixa.encerradoEm
        ? `${toBRDateTime(resumoCaixa.abertoEm || resumoCaixa.encerradoEm)} → ${toBRDateTime(resumoCaixa.encerradoEm || resumoCaixa.abertoEm)}`
        : "Sem vendas registradas.";

    const impressoEm = toBRDateTime(new Date().toISOString());
    const lines = [];

    lines.push(centerText(String(resumoCaixa.nome || "").trim(), REPORT_LINE_WIDTH));
    lines.push(periodo);
    if (resumoCaixa.encerradoEm) {
      lines.push(`Encerrado em: ${toBRDateTime(resumoCaixa.encerradoEm)}`);
    }
    lines.push(REPORT_SEPARATOR);

    lines.push(formatSectionTitle("Totais"));
    lines.push(...formatRow("Total vendido", fmtBRL(resumoCaixa.resumo.total || 0)));
    lines.push(...formatRow("Dinheiro", fmtBRL(resumoCaixa.resumo.porPagamento.dinheiro || 0)));
    lines.push(...formatRow("Pix", fmtBRL(resumoCaixa.resumo.porPagamento.pix || 0)));
    lines.push(...formatRow("Cartão", fmtBRL(resumoCaixa.resumo.porPagamento.cartao || 0)));

    if (resumoCaixa.caixaAtual) {
      lines.push(...formatRow("Abertura", fmtBRL(resumoCaixa.abertura || 0)));
      lines.push(
        ...formatRow(
          "Saldo esperado (dinheiro)",
          fmtBRL(resumoCaixa.saldoDinheiroEsperado || 0)
        )
      );
    } else {
      lines.push(...formatRow("Abertura", "-"));
      lines.push(...formatRow("Saldo esperado (dinheiro)", "-"));
    }

    lines.push(REPORT_SEPARATOR);

    lines.push(formatSectionTitle("Itens do evento"));
    if (resumoCaixa.itensResumo && resumoCaixa.itensResumo.length > 0) {
      resumoCaixa.itensResumo.forEach((item) => {
        const precoTexto = item.preco == null ? "" : ` @ ${fmtBRL(item.preco)}`;
        const label = `${item.nome}${precoTexto} x${Number(item.qtd || 0)}`;
        lines.push(...formatRow(label, fmtBRL(item.total || 0)));
      });
    } else {
      lines.push("Nenhum item registrado.");
    }

    lines.push(
      ...formatRow("Total geral (itens)", fmtBRL(resumoCaixa.itensTotais?.totalItens || 0))
    );
    lines.push(REPORT_SEPARATOR);
    lines.push(`Impresso em: ${impressoEm}`);
    lines.push(centerText("FIM DO RELATÓRIO", REPORT_LINE_WIDTH));

    const texto = joinLines(lines);

    try {
      // ✅ CORRETO: imprime pelo driver Sunmi
      await imprimirTexto(texto);
    } catch (error) {
      alert(`Não foi possível imprimir o relatório. (${error?.message || "erro desconhecido"})`);
    }
  }

  function pedirExcluir(ev) {
    setEvExcluir(ev);
    setSenha("");
    setErroSenha("");
  }

  function confirmarExcluir() {
    if (!evExcluir) return;
    if (senha !== SENHA_EXCLUIR) {
      setErroSenha("Senha incorreta.");
      return;
    }

    const nomeEv = String(evExcluir.nome || "").trim();

    // remove vendas do evento
    if (typeof setVendas === "function") {
      setVendas((prev) =>
        (Array.isArray(prev) ? prev : []).filter(
          (v) => String(v?.eventoNome || "").trim() !== nomeEv
        )
      );
    }

    // se estava ativo, limpa caixa
    const atual = String(evento?.nome || "").trim();
    if (atual && atual === nomeEv && typeof setCaixa === "function") {
      setCaixa((prev) => ({
        ...(prev && typeof prev === "object" ? prev : {}),
        abertura: null,
        movimentos: [],
      }));
    }

    // remove também o status ENCERRADO no cache
    const meta = loadEventosMeta();
    const novo = meta.filter((m) => String(m?.nome || "").trim() !== nomeEv);
    saveEventosMeta(novo);

    setEvExcluir(null);
  }

  const inputStyle = {
    width: "100%",
    height: 44,
    fontSize: 16,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    outline: "none",
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", paddingBottom: 12 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 14,
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 950, marginBottom: 10 }}>Evento</div>

        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#6b7280", marginBottom: 6 }}>
              Nome do evento
            </div>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Almoço dos Sócios"
              style={inputStyle}
              disabled={eventoBloqueado}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={{ ...btn("primary"), ...bloqueioStyle }}
              onClick={() => {
                if (eventoBloqueado) {
                  alertEventoBloqueado();
                  return;
                }
                abrirLocal();
              }}
            >
              Abrir evento
            </button>

            {eventoAberto && (
              <button
                style={btn("soft")}
                onClick={() => setEvResumo(calcularCaixaDoEvento(evento.nome))}
              >
                Ver caixa do evento
              </button>
            )}
          </div>

          <div style={{ marginTop: 2 }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>Status</div>
            <div style={{ color: "#6b7280", fontSize: 14 }}>
              {eventoAberto ? (
                <>
                  Evento aberto:{" "}
                  <strong style={{ color: "#111827" }}>{evento.nome}</strong>{" "}
                  <span style={{ color: "#9ca3af" }}>
                    • Aberto em {evento?.abertoEm ? toBRDateTime(evento.abertoEm) : "-"}
                  </span>
                </>
              ) : (
                "Nenhum evento aberto"
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 950, marginBottom: 10, color: "#111827" }}>
          Histórico de eventos
        </div>

        {historico.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 14 }}>
            Nenhum histórico ainda. Depois das primeiras vendas, o resumo aparece aqui.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {historico.map((ev) => {
              const dt = ev.primeiraData || ev.ultimaData || null;
              const nomeEv = String(ev.nome || "").trim();
              const isAtual = String(evento?.nome || "").trim() === nomeEv;

              const meta = encerradosMap.get(nomeEv);
              const encerrado = Boolean(meta?.encerradoEm || meta?.fechamento?.encerradoEm);

              return (
                <div
                  key={ev.nome}
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: 12,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div
                          style={{
                            fontWeight: 950,
                            fontSize: 16,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {ev.nome}
                        </div>

                        {isAtual && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              padding: "3px 8px",
                              borderRadius: 999,
                              background: "#111827",
                              color: "#fff",
                            }}
                          >
                            ATIVO
                          </span>
                        )}

                        {!isAtual && encerrado && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              padding: "3px 8px",
                              borderRadius: 999,
                              background: "#e5e7eb",
                              color: "#111827",
                            }}
                          >
                            ENCERRADO
                          </span>
                        )}
                      </div>

                      <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
                        {dt ? `Data: ${toBRDate(dt)}` : "Data: -"}
                        {encerrado && (meta?.encerradoEm || meta?.fechamento?.encerradoEm) ? (
                          <>
                            <span style={{ color: "#9ca3af" }}> • </span>
                            Encerrado em:{" "}
                            {toBRDateTime(meta?.encerradoEm || meta?.fechamento?.encerradoEm)}
                          </>
                        ) : null}
                        <span style={{ color: "#9ca3af" }}> • </span>
                        Vendas: {ev.vendas}
                        <span style={{ color: "#9ca3af" }}> • </span>
                        Total:{" "}
                        <strong style={{ color: "#111827" }}>
                          R$ {Number(ev.total || 0).toFixed(2).replace(".", ",")}
                        </strong>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        style={{ ...btn("soft"), padding: "0 10px", height: 34 }}
                        onClick={() => setEvResumo(calcularCaixaDoEvento(ev.nome))}
                      >
                        Caixa
                      </button>

                      <button
                        style={{ ...btn("danger"), padding: "0 10px", height: 34, ...bloqueioStyle }}
                        onClick={() => {
                          if (eventoBloqueado) {
                            alertEventoBloqueado();
                            return;
                          }
                          pedirExcluir(ev);
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {evResumo && (
        <div style={overlay} onClick={() => setEvResumo(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>Caixa • {evResumo.nome}</div>
            <div style={modalBody}>
              <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>
                {evResumo.resumo.primeira
                  ? `Período: ${toBRDateTime(evResumo.resumo.primeira)} → ${toBRDateTime(evResumo.resumo.ultima)}`
                  : evResumo.abertoEm || evResumo.encerradoEm
                    ? `Período: ${toBRDateTime(evResumo.abertoEm || evResumo.encerradoEm)} → ${toBRDateTime(evResumo.encerradoEm || evResumo.abertoEm)}`
                    : "Sem vendas registradas."}
                {evResumo.encerradoEm ? (
                  <div style={{ marginTop: 6 }}>
                    <strong>Encerrado em:</strong> {toBRDateTime(evResumo.encerradoEm)}
                  </div>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 900 }}>Total vendido</div>
                  <div style={{ fontWeight: 950 }}>{fmtBRL(evResumo.resumo.total || 0)}</div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ color: "#6b7280" }}>Dinheiro</div>
                  <div style={{ fontWeight: 900 }}>{fmtBRL(evResumo.resumo.porPagamento.dinheiro || 0)}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ color: "#6b7280" }}>Pix</div>
                  <div style={{ fontWeight: 900 }}>{fmtBRL(evResumo.resumo.porPagamento.pix || 0)}</div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ color: "#6b7280" }}>Cartão</div>
                  <div style={{ fontWeight: 900 }}>{fmtBRL(evResumo.resumo.porPagamento.cartao || 0)}</div>
                </div>

                <div style={{ height: 1, background: "#e5e7eb", margin: "10px 0" }} />

                {evResumo.caixaAtual ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ color: "#6b7280" }}>Abertura</div>
                      <div style={{ fontWeight: 900 }}>{fmtBRL(evResumo.abertura || 0)}</div>
                    </div>

                    <div style={{ height: 1, background: "#e5e7eb", margin: "10px 0" }} />

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 900 }}>Saldo esperado (dinheiro)</div>
                      <div style={{ fontWeight: 950 }}>{fmtBRL(evResumo.saldoDinheiroEsperado || 0)}</div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#9ca3af", fontSize: 13 }}>
                    Observação: abertura/saldo só ficam no evento atual.
                  </div>
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Itens do evento</div>
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 70px 100px",
                      gap: 6,
                      padding: "8px 10px",
                      fontSize: 12,
                      fontWeight: 800,
                      background: "#f8fafc",
                    }}
                  >
                    <div>Item</div>
                    <div style={{ textAlign: "right" }}>Preço</div>
                    <div style={{ textAlign: "right" }}>Qtd</div>
                    <div style={{ textAlign: "right" }}>Total (R$)</div>
                  </div>
                  <div style={{ maxHeight: 260, overflowY: "auto" }}>
                    {(evResumo.itensResumo || []).map((item, idx) => (
                      <div
                        key={`${item.nome}-${item.preco ?? "sem-preco"}-${idx}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 90px 70px 100px",
                          gap: 6,
                          padding: "8px 10px",
                          fontSize: 13,
                          borderTop: "1px solid #e5e7eb",
                        }}
                      >
                        <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.nome}
                        </div>
                        <div style={{ textAlign: "right", color: "#6b7280" }}>
                          {item.preco == null ? "-" : fmtBRL(item.preco)}
                        </div>
                        <div style={{ textAlign: "right" }}>{Number(item.qtd || 0)}</div>
                        <div style={{ textAlign: "right", fontWeight: 800 }}>
                          {fmtBRL(item.total || 0)}
                        </div>
                      </div>
                    ))}
                    {(!evResumo.itensResumo || evResumo.itensResumo.length === 0) && (
                      <div
                        style={{
                          padding: "10px",
                          fontSize: 13,
                          color: "#9ca3af",
                          borderTop: "1px solid #e5e7eb",
                        }}
                      >
                        Nenhum item encontrado.
                      </div>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 8,
                    fontWeight: 900,
                  }}
                >
                  <div>Total geral (itens)</div>
                  <div>{fmtBRL(evResumo.itensTotais?.totalItens || 0)}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button style={btn("soft")} onClick={() => imprimirResumoCaixa(evResumo)}>
                  Imprimir
                </button>
                <button style={btn("soft")} onClick={() => setEvResumo(null)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {evExcluir && (
        <div style={overlay} onClick={() => setEvExcluir(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>Excluir evento</div>
            <div style={modalBody}>
              <div style={{ fontSize: 14, marginBottom: 10 }}>
                Confirme a senha para excluir:
                <div style={{ fontWeight: 950, marginTop: 6 }}>{evExcluir.nome}</div>
              </div>

              <input
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                  setErroSenha("");
                }}
                placeholder="Digite a senha"
                style={inputStyle}
                inputMode="numeric"
              />

              {erroSenha && (
                <div style={{ color: "#ef4444", fontSize: 13, marginTop: 8, fontWeight: 800 }}>
                  {erroSenha}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button style={btn("soft")} onClick={() => setEvExcluir(null)}>
                  Cancelar
                </button>
                <button style={btn("danger")} onClick={confirmarExcluir}>
                  Excluir
                </button>
              </div>

              <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 10 }}>
                Senha padrão: {SENHA_EXCLUIR}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
