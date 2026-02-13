// src/pages/Venda.jsx
import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { fmtBRL, uid } from "../domain/math";
import { ICONS } from "../domain/icons";
import { buildVenda, totalDoCarrinho } from "../domain/pos";
import { useConfig } from "../config/ConfigProvider";
import { postSaleToMaster } from "../net/connectivity";
import { printSunmiTest, printSunmiText } from "../utils/sunmiPrinter";
import { buildTicketText, buildTicketsPerItem } from "../print/ticketBuilder";
import {
  buildSaleSummaryFromSale,
  enqueuePendingSale,
  getOrCreateDeviceId,
  persistSale,
} from "../state/pdvStore";

/* ===================== ícones (imagens realistas) ===================== */

const BARRIL_LITROS = [5, 10, 15, 20, 30, 50];
const DEFAULT_BARRIL_LITROS = 30;

function IconImg({ iconKey, size = 42 }) {
  const src = ICONS[iconKey] || ICONS.ref_600;
  return (
    <img
      src={src}
      alt=""
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
      }}
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function Venda({
  evento = {},
  produtos = [],
  vendas = [],
  setVendas = () => {},
  setTab = () => {},
  ajustes = {},
}) {
  const { permitirMultiDispositivo, config } = useConfig();

  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const deviceName = useMemo(() => {
    if (typeof navigator === "undefined") return "Cliente";
    return navigator?.userAgent || "Cliente";
  }, []);

  const produtosAtivos = useMemo(() => {
    return Array.isArray(produtos) ? produtos.filter((p) => p?.ativo) : [];
  }, [produtos]);

  const [carrinho, setCarrinho] = useState([]);
  const [pagamento, setPagamento] = useState("dinheiro");
  const [recebidoTxt, setRecebidoTxt] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [vendaDraft, setVendaDraft] = useState(null);
  const [pendingSale, setPendingSale] = useState(null);
  const [aviso, setAviso] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [maxUltimas, setMaxUltimas] = useState(() => {
    if (typeof window === "undefined") return 5;
    return window.innerWidth < 720 ? 3 : 5;
  });

  const itensCarrinho = useMemo(
    () => (Array.isArray(carrinho) ? carrinho : []),
    [carrinho],
  );

  const total = useMemo(() => totalDoCarrinho(itensCarrinho), [itensCarrinho]);

  const valorRecebidoNum = useMemo(
    () => Number(String(recebidoTxt).replace(/\./g, "").replace(",", ".")) || 0,
    [recebidoTxt],
  );

  const troco = useMemo(() => {
    if (pagamento !== "dinheiro" || valorRecebidoNum <= 0) return null;
    return Math.max(0, valorRecebidoNum - total);
  }, [pagamento, valorRecebidoNum, total]);

  useEffect(() => {
    function onResize() {
      if (typeof window === "undefined") return;
      setMaxUltimas(window.innerWidth < 720 ? 3 : 5);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const vendasEvento = useMemo(() => {
    const nomeEvento = String(evento?.nome || "").trim();
    const eventoId = evento?.id ?? null;
    if (!nomeEvento && !eventoId) return [];

    const lista = Array.isArray(vendas) ? vendas : [];
    return lista.filter((v) => {
      const matchId = eventoId && v?.eventoId && v.eventoId === eventoId;
      const matchNome = nomeEvento && String(v?.eventoNome || "").trim() === nomeEvento;
      return matchId || matchNome;
    });
  }, [evento?.id, evento?.nome, vendas]);

  const ultimasVendas = useMemo(() => {
    const lista = [...vendasEvento];
    lista.sort((a, b) => {
      const da = new Date(a?.criadoEm || a?.createdAt || a?.data || 0).getTime();
      const db = new Date(b?.criadoEm || b?.createdAt || b?.data || 0).getTime();
      return db - da;
    });
    return lista.slice(0, maxUltimas);
  }, [vendasEvento, maxUltimas]);

  const overlayStyle = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16,
  };

  const modalCardStyle = {
    background: "#fff",
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 720,
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
  };

  const comboChipStyle = {
    marginTop: 6,
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 950,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    background: "#eff6ff",
    border: "1px solid #bfdbfe",
    color: "#1d4ed8",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  };

  useEffect(() => {
    if (!confirmOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setConfirmOpen(false);
        setVendaDraft(null);
        setPendingSale(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen]);

  function precisaEventoAberto() {
    return !String(evento?.nome || "").trim();
  }

  function isBarrilProduto(produto) {
    return (
      produto?.isBarril === true ||
      produto?.precoModo === "por_litro" ||
      /barril/i.test(produto?.nome || "")
    );
  }

  function addProduto(p) {
    if (!p) return;
    setCarrinho((prev = []) => {
      const barril = isBarrilProduto(p);
      const barrilLitros = barril ? DEFAULT_BARRIL_LITROS : null;
      const unitarioPorLitro = barril ? Number(p.preco || 0) : 0;
      const unitario = barril ? unitarioPorLitro * barrilLitros : Number(p.preco || 0);
      const cartKey = barril ? `${p.id}::${barrilLitros}` : `${p.id}`;
      const idx = prev.findIndex((x) => x.cartKey === cartKey);

      if (idx >= 0) {
        const cp = [...prev];
        const novaQtd = cp[idx].qtd + 1;
        const precoAtual = Number(cp[idx].unitario ?? cp[idx].preco ?? 0);
        cp[idx] = { ...cp[idx], qtd: novaQtd, subtotal: novaQtd * precoAtual };
        return cp;
      }

      return [
        ...prev,
        {
          cartKey,
          produtoId: p.id,
          nome: barril ? `Barril ${barrilLitros}L` : p.nome,
          preco: unitario,
          unitario,
          unitarioPorLitro: barril ? unitarioPorLitro : undefined,
          barrilLitros: barril ? barrilLitros : undefined,
          qtd: 1,
          subtotal: unitario,
          tipo: p.tipo || "simples",
          comboQtd: p?.tipo === "combo" ? Math.max(2, Number(p.comboQtd || 2)) : null,
          img: p.img || "",
          iconKey: p.iconKey || "",
        },
      ];
    });
  }

  function alterarQtd(cartKey, delta) {
    setCarrinho((prev = []) => {
      const cp = prev.map((it) => ({ ...it }));
      const idx = cp.findIndex((x) => x.cartKey === cartKey);
      if (idx < 0) return prev;

      const nova = cp[idx].qtd + delta;
      if (nova <= 0) return cp.filter((x) => x.cartKey !== cartKey);

      cp[idx].qtd = nova;
      const precoAtual = Number(cp[idx].unitario ?? cp[idx].preco ?? 0);
      cp[idx].subtotal = nova * precoAtual;
      return cp;
    });
  }

  function alterarLitros(cartKey, litros) {
    setCarrinho((prev = []) => {
      const cp = prev.map((it) => ({ ...it }));
      const idx = cp.findIndex((x) => x.cartKey === cartKey);
      if (idx < 0) return prev;

      const item = cp[idx];
      if (!item?.barrilLitros) return prev;

      const novoLitros = Number(litros);
      const unitarioPorLitro = Number(item.unitarioPorLitro || 0);
      const novoUnitario = unitarioPorLitro * novoLitros;
      const novoCartKey = `${item.produtoId}::${novoLitros}`;
      const nome = `Barril ${novoLitros}L`;

      const existenteIdx = cp.findIndex((x, i) => x.cartKey === novoCartKey && i !== idx);
      if (existenteIdx >= 0) {
        const existente = cp[existenteIdx];
        const novaQtd = existente.qtd + item.qtd;
        cp[existenteIdx] = {
          ...existente,
          nome,
          barrilLitros: novoLitros,
          unitarioPorLitro,
          unitario: novoUnitario,
          preco: novoUnitario,
          qtd: novaQtd,
          subtotal: novaQtd * novoUnitario,
        };
        cp.splice(idx, 1);
        return cp;
      }

      cp[idx] = {
        ...item,
        cartKey: novoCartKey,
        nome,
        barrilLitros: novoLitros,
        unitarioPorLitro,
        unitario: novoUnitario,
        preco: novoUnitario,
        subtotal: item.qtd * novoUnitario,
      };
      return cp;
    });
  }

  function limpar() {
    setCarrinho([]);
    setRecebidoTxt("");
    setPagamento("dinheiro");
  }

  function formatarDataHora(venda) {
    const iso =
      venda?.criadoEm || venda?.createdAt || venda?.data || new Date().toISOString();
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return "--";
    return dt.toLocaleString("pt-BR");
  }

  const buildDeviceInfo = (sale) => ({
    id: sale?.deviceId || deviceId,
    name: sale?.deviceName || deviceName,
  });

  const logTicketPreview = (ticketText) => {
    const text = String(ticketText ?? "");
    console.info(
      "[PRINT] sending ticketText chars=",
      text.length,
      "head=",
      text.slice(0, 120),
    );
  };

  const logPrintResult = (result, context = "printSunmiText") => {
    console.info(`[PRINT] resultado (${context})`, {
      ok: result?.ok,
      status: result?.status,
      error: result?.error,
    });
  };

  async function imprimirTicketsDaVenda(venda) {
    const device = buildDeviceInfo(venda);
    const fichaPorItem = Boolean(ajustes?.fichaPorItem);

    if (fichaPorItem) {
      const tickets = buildTicketsPerItem({ venda, ajustes, device });
      console.info("[PRINT] fichaPorItem ativo. Tickets:", tickets.length);
      if (!tickets.length) {
        return { ok: false, error: "Nenhum ticket gerado para impressão." };
      }
      let lastResult = { ok: true };
      for (let index = 0; index < tickets.length; index += 1) {
        const ticketText = tickets[index];
        if (!String(ticketText ?? "").trim()) {
          console.warn("[PRINT] ticketText vazio no modo fichaPorItem.", { index });
          return { ok: false, error: "Ticket vazio no modo fichaPorItem." };
        }
        logTicketPreview(ticketText);
        const result = await printSunmiText(ticketText);
        logPrintResult(result, `item ${index + 1}/${tickets.length}`);
        lastResult = result;
        if (!result?.ok) return result;
        if (index < tickets.length - 1) {
          await delay(120);
        }
      }
      return lastResult;
    }

    const ticketText = buildTicketText({ venda, ajustes, device });
    if (!String(ticketText ?? "").trim()) {
      console.warn("[PRINT] ticketText vazio para a venda.");
      return { ok: false, error: "Ticket vazio para impressão." };
    }
    logTicketPreview(ticketText);
    const result = await printSunmiText(ticketText);
    logPrintResult(result, "venda");
    return result;
  }

  async function reimprimirVenda(venda) {
    if (!venda?.itens?.length) return;
    if (isPrinting) return;

    setAviso("");
    setIsPrinting(true);
    try {
      const resultado = await imprimirTicketsDaVenda(venda);
      if (!resultado?.ok) {
        const erroMsg = resultado?.error ? ` (${resultado.error})` : "";
        setAviso(`Falha ao reimprimir venda.${erroMsg}`);
        return;
      }
    } finally {
      setIsPrinting(false);
    }
  }

  function finalizar() {
    if (isPrinting) return;

    if (precisaEventoAberto()) {
      setAviso("Abra um evento primeiro.");
      return;
    }
    if (itensCarrinho.length === 0) {
      setAviso("Carrinho vazio.");
      return;
    }

    const informouRecebido = pagamento === "dinheiro" && valorRecebidoNum > 0;

    const draft = {
      eventoId: evento?.id ?? null,
      eventoNome: evento.nome,
      carrinho: itensCarrinho,
      pagamento,
      recebido: informouRecebido ? valorRecebidoNum : null,
      troco: informouRecebido ? troco : null,
      total,
    };

    setAviso("");
    setVendaDraft(draft);
    setConfirmOpen(true);
  }

  function cancelarConfirmacao() {
    if (isPrinting) return;
    setConfirmOpen(false);
    setVendaDraft(null);
    setPendingSale(null);
  }

  async function confirmar() {
    if (!vendaDraft) return;
    if (isPrinting) return;

    setAviso("");
    setIsPrinting(true);
    try {
      let vendaFinal = pendingSale;

      if (!vendaFinal) {
        const vendaBase = buildVenda({ id: uid(), ...vendaDraft });
        const criadoEm =
          vendaBase?.criadoEm || vendaBase?.createdAt || new Date().toISOString();

        vendaFinal = {
          ...vendaBase,
          id: vendaBase?.id || uid(),
          criadoEm,
          createdAt: vendaBase?.createdAt || criadoEm,
          data: vendaBase?.data || criadoEm,
          eventoNome: String(vendaBase?.eventoNome || vendaDraft?.eventoNome || "").trim(),
          total: Number(vendaBase?.total ?? vendaDraft?.total ?? 0) || 0,
          pagamento: String(vendaBase?.pagamento || vendaDraft?.pagamento || "dinheiro"),
          itens: Array.isArray(vendaBase?.itens) ? vendaBase.itens : [],
          deviceId,
          deviceName,
        };

        setPendingSale(vendaFinal);
      }

      const resultado = await imprimirTicketsDaVenda(vendaFinal);
      if (!resultado?.ok) {
        const erroMsg = resultado?.error ? ` (${resultado.error})` : "";
        setAviso(`Falha ao imprimir venda.${erroMsg}`);
        return;
      }

      persistSale({ sale: vendaFinal, setVendas });

      limpar();
      setTab("venda");
      setConfirmOpen(false);
      setVendaDraft(null);
      setPendingSale(null);

      if (permitirMultiDispositivo && config?.modoMulti === "client") {
        const host = String(config?.masterHost || "").trim();
        const port = String(config?.masterPort || "").trim();
        const pin = String(config?.pinAtual || "").trim();
        const eventId = String(config?.eventIdAtual || "").trim();

        const summary = buildSaleSummaryFromSale({
          sale: vendaFinal,
          deviceId,
          deviceName,
        });

        if (host && port && pin && eventId) {
          try {
            await postSaleToMaster({
              host,
              port,
              pin,
              eventId,
              deviceId,
              deviceName,
              summary,
              sale: vendaFinal,
            });
          } catch {
            enqueuePendingSale({ summary, sale: vendaFinal });
          }
        } else {
          enqueuePendingSale({ summary, sale: vendaFinal });
        }
      }
    } finally {
      setIsPrinting(false);
    }
  }

  async function onTestarImpressora() {
    if (isPrinting) return;

    setAviso("");
    setIsPrinting(true);
    try {
      const resultado = await printSunmiTest();
      if (!resultado?.ok) {
        const erroMsg = resultado?.error ? ` (${resultado.error})` : "";
        setAviso(`Não foi possível imprimir o teste.${erroMsg}`);
        return;
      }
      setAviso("Impresso.");
    } finally {
      setIsPrinting(false);
    }
  }

  const itensConfirm = Array.isArray(vendaDraft?.carrinho) ? vendaDraft.carrinho : [];

  const produtoNomeClampStyle = {
    fontWeight: 950,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 1.15,
    maxWidth: "100%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    whiteSpace: "normal",
    wordBreak: "break-word",
    color: "#2563eb",
  };

  return (
    <div
      className="split vendaRoot"
      style={{ transform: "none", zoom: 1, WebkitTextSizeAdjust: "100%" }}
    >
      <style>{`
        .vendaRoot input,
        .vendaRoot select,
        .vendaRoot textarea {
          font-size: 16px;
        }
      `}</style>

      <Card title="Produtos" subtitle="Toque para adicionar">
        {precisaEventoAberto() && (
          <div style={{ marginBottom: 10 }}>
            <span className="badge">Abra um evento antes de vender</span>
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          {produtosAtivos.map((p) => {
            const isCombo = p.tipo === "combo" || p.comboQtd;
            const comboCount = Math.max(2, Number(p.comboQtd) || 0);
            const precoTotal = Number(p.preco) || 0;
            const precoUnitario = comboCount ? precoTotal / comboCount : 0;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => addProduto(p)}
                disabled={isPrinting}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 18,
                  background: "#fff",
                  padding: 8,
                  cursor: isPrinting ? "not-allowed" : "pointer",
                  opacity: isPrinting ? 0.7 : 1,
                  minHeight: 98,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 4,
                  WebkitTapHighlightColor: "transparent",
                }}
              >
                {p.img ? (
                  <img
                    src={p.img}
                    alt={p.nome}
                    style={{
                      width: 42,
                      height: 42,
                      objectFit: "contain",
                      display: "block",
                    }}
                  />
                ) : (
                  <IconImg iconKey={p.iconKey} size={42} />
                )}

                <div style={produtoNomeClampStyle} title={p.nome}>
                  {p.nome}
                </div>

                {isCombo && (
                  <div style={comboChipStyle}>
                    {`COMBO${p.comboQtd ? ` x${p.comboQtd}` : ""}`}
                  </div>
                )}

                <div style={{ fontWeight: 800, fontSize: 12, color: "#111827" }}>
                  {fmtBRL(precoTotal)}
                </div>

                {isCombo && comboCount > 0 && (
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#4b5563" }}>
                    {`(${fmtBRL(precoUnitario)} cada)`}
                  </div>
                )}
              </button>
            );
          })}

          {produtosAtivos.length === 0 && (
            <div className="muted">Nenhum produto ativo. Vá em Produtos e cadastre.</div>
          )}
        </div>
      </Card>

      <Card
        title="Carrinho"
        subtitle="Revise e finalize"
        right={<span className="badge">{itensCarrinho.length} itens</span>}
      >
        {aviso && (
          <div style={{ marginBottom: 12 }}>
            <span className="badge">{aviso}</span>
          </div>
        )}

        {itensCarrinho.length === 0 ? (
          <div className="muted">Adicione produtos para começar.</div>
        ) : (
          <div className="cartList">
            {itensCarrinho.map((it) => (
              <div key={it.cartKey || it.produtoId} className="cartRow">
                <div className="cartLeft">
                  <div className="cartName">{it.nome}</div>
                  <div className="muted">{fmtBRL(it.preco)} cada</div>

                  {it.barrilLitros && (
                    <div style={{ marginTop: 6 }}>
                      <select
                        className="input"
                        value={it.barrilLitros}
                        disabled={isPrinting}
                        onChange={(e) => alterarLitros(it.cartKey, e.target.value)}
                      >
                        {BARRIL_LITROS.map((litros) => (
                          <option key={litros} value={litros}>
                            {litros}L
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="cartRight">
                  <Button small onClick={() => alterarQtd(it.cartKey, -1)} disabled={isPrinting}>
                    -
                  </Button>
                  <div className="cartQty">{it.qtd}</div>
                  <Button small onClick={() => alterarQtd(it.cartKey, +1)} disabled={isPrinting}>
                    +
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="hr" />

        <div className="row space">
          <div style={{ fontWeight: 900, fontSize: 16 }}>Total</div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{fmtBRL(total)}</div>
        </div>

        <div className="hr" />

        <div className="formGrid">
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Forma de pagamento
            </div>
            <select
              className="input inputLarge"
              value={pagamento}
              disabled={isPrinting}
              onChange={(e) => setPagamento(e.target.value)}
            >
              <option value="dinheiro">Dinheiro</option>
              <option value="pix">Pix</option>
              <option value="cartao">Cartão</option>
            </select>
          </div>

          {pagamento === "dinheiro" && (
            <div>
              <div className="muted" style={{ marginBottom: 6 }}>
                Valor recebido
              </div>
              <input
                className="input"
                placeholder="Ex: 50,00"
                value={recebidoTxt}
                disabled={isPrinting}
                onChange={(e) => setRecebidoTxt(e.target.value)}
                inputMode="decimal"
              />
              <div className="row space" style={{ marginTop: 8 }}>
                <div className="muted">Troco</div>
                <div style={{ fontWeight: 900 }}>{troco != null ? fmtBRL(troco) : "—"}</div>
              </div>
            </div>
          )}

          <div className="formActions">
            <Button onClick={limpar} disabled={isPrinting}>
              Limpar
            </Button>
            <Button onClick={onTestarImpressora} disabled={isPrinting}>
              {isPrinting ? "Aguarde..." : "Teste Impressora"}
            </Button>
            <Button variant="primary" onClick={finalizar} disabled={isPrinting}>
              Finalizar
            </Button>
          </div>
        </div>

        <div className="hr" />
        <div className="muted">
          Dica: Pix/Cartão não usa troco. Dinheiro pode informar recebido para calcular troco.
        </div>
      </Card>

      <Card title="Últimas vendas" subtitle="Reimprima rapidamente se necessário.">
        {ultimasVendas.length === 0 ? (
          <div className="muted">Nenhuma venda ainda.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ultimasVendas.map((venda, index) => (
              <div
                key={venda?.id || `${venda?.createdAt}-${venda?.total}-${index}`}
                className="row space"
                style={{ paddingBottom: 10, borderBottom: "1px solid #e5e7eb" }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontWeight: 900 }}>{formatarDataHora(venda)}</div>
                  <div className="muted" style={{ textTransform: "capitalize" }}>
                    {fmtBRL(venda?.total || 0)} • {venda?.pagamento || "—"}
                  </div>
                </div>
                <Button small onClick={() => reimprimirVenda(venda)} disabled={isPrinting}>
                  Reimprimir
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {confirmOpen && vendaDraft && (
        <div style={overlayStyle} onClick={cancelarConfirmacao} role="presentation">
          <div
            style={modalCardStyle}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar pedido"
          >
            <div className="row space" style={{ marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>Confirmar pedido</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {new Date().toLocaleString("pt-BR")}
                </div>
              </div>
              <span className="badge">{vendaDraft.eventoNome}</span>
            </div>

            <div style={{ marginBottom: 16 }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", paddingBottom: 8 }}>Item</th>
                    <th style={{ textAlign: "center", paddingBottom: 8 }}>Qtd</th>
                    <th style={{ textAlign: "right", paddingBottom: 8 }}>Unitário</th>
                    <th style={{ textAlign: "right", paddingBottom: 8 }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {itensConfirm.map((it, idx) => (
                    <tr key={`${it.cartKey ?? it.produtoId ?? it.id ?? idx}`}>
                      <td style={{ padding: "6px 0" }}>{it.nome}</td>
                      <td style={{ textAlign: "center" }}>{it.qtd}</td>
                      <td style={{ textAlign: "right" }}>{fmtBRL(it.preco)}</td>
                      <td style={{ textAlign: "right" }}>{fmtBRL(it.subtotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hr" />

            <div className="row space" style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 900 }}>Total</div>
              <div style={{ fontWeight: 900 }}>{fmtBRL(totalDoCarrinho(itensConfirm))}</div>
            </div>

            <div className="row space" style={{ marginBottom: 6 }}>
              <div className="muted">Pagamento</div>
              <div style={{ fontWeight: 700, textTransform: "capitalize" }}>
                {vendaDraft.pagamento}
              </div>
            </div>

            {vendaDraft.pagamento === "dinheiro" && (
              <div style={{ marginBottom: 12 }}>
                <div className="row space">
                  <div className="muted">Valor recebido</div>
                  <div>{vendaDraft.recebido != null ? fmtBRL(vendaDraft.recebido) : "—"}</div>
                </div>
                <div className="row space">
                  <div className="muted">Troco</div>
                  <div>{vendaDraft.troco != null ? fmtBRL(vendaDraft.troco) : "—"}</div>
                </div>
              </div>
            )}

            <div className="row" style={{ justifyContent: "flex-end", gap: 8, marginTop: 16 }}>
              <Button onClick={cancelarConfirmacao} disabled={isPrinting}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={confirmar} disabled={isPrinting}>
                {isPrinting ? "Imprimindo..." : "Confirmar + Imprimir"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}