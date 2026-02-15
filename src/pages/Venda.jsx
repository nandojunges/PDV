// src/pages/Venda.jsx
import React, { useEffect, useMemo, useState, useCallback } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { fmtBRL, uid } from "../domain/math";
import { ICONS } from "../domain/icons";
import { buildVenda, totalDoCarrinho } from "../domain/pos";
import { imprimirTexto, imprimirBitmap } from "../utils/sunmiPrinter";
import { buildTicketBitmapBase64 } from "../print/ticketBitmap";
import {
  getOrCreateDeviceId,
  persistSale,
} from "../state/pdvStore";

/* ===================== CONSTANTES ===================== */
const BARRIL_LITROS = [5, 10, 15, 20, 30, 50];
const DEFAULT_BARRIL_LITROS = 30;
const DELAY_BETWEEN_PRINTS = 200;
const MAX_RECENT_SALES = 5;

/* ===================== COMPONENTES AUXILIARES ===================== */
function IconImg({ iconKey, size = 36 }) {
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
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ===================== COMPONENTE PRINCIPAL ===================== */
export default function Venda({
  evento = {},
  produtos = [],
  vendas = [],
  setVendas = () => {},
  setTab = () => {},
  ajustes = {},
}) {

  // ==================== ESTADOS ====================
  const [carrinho, setCarrinho] = useState([]);
  const [pagamento, setPagamento] = useState("dinheiro");
  const [recebidoTxt, setRecebidoTxt] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [vendaDraft, setVendaDraft] = useState(null);
  const [pendingSale, setPendingSale] = useState(null);
  const [aviso, setAviso] = useState({ type: "", message: "" });
  const [isPrinting, setIsPrinting] = useState(false);
  const [maxUltimas, setMaxUltimas] = useState(MAX_RECENT_SALES);

  // ==================== MEMOIZED VALUES ====================
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const deviceName = useMemo(() => {
    if (typeof navigator === "undefined") return "Cliente";
    return navigator?.userAgent || "Cliente";
  }, []);

  const produtosAtivos = useMemo(() => {
    return Array.isArray(produtos) ? produtos.filter((p) => p?.ativo) : [];
  }, [produtos]);

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

  // ==================== EFFECTS ====================
  useEffect(() => {
    function onResize() {
      if (typeof window === "undefined") return;
      setMaxUltimas(window.innerWidth < 720 ? 3 : MAX_RECENT_SALES);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!confirmOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        handleCancelConfirm();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen]);

  useEffect(() => {
    if (aviso.message) {
      const timer = setTimeout(() => setAviso({ type: "", message: "" }), 3000);
      return () => clearTimeout(timer);
    }
  }, [aviso]);

  // ==================== VALIDAÇÕES ====================
  const precisaEventoAberto = useCallback(() => {
    return !String(evento?.nome || "").trim();
  }, [evento?.nome]);

  const isBarrilProduto = useCallback((produto) => {
    return (
      produto?.isBarril === true ||
      produto?.precoModo === "por_litro" ||
      /barril/i.test(produto?.nome || "")
    );
  }, []);

  // ==================== FUNÇÕES DO CARRINHO ====================
  const addProduto = useCallback((p) => {
    if (!p) return;
    setCarrinho((prev = []) => {
      const barril = isBarrilProduto(p);
      const barrilLitros = barril ? DEFAULT_BARRIL_LITROS : null;
      const unitarioPorLitro = barril ? Number(p.preco || 0) : 0;
      
      const isCombo = p.tipo === "combo" || p.comboQtd;
      const comboCount = isCombo ? Math.max(2, Number(p.comboQtd) || 2) : 1;
      const precoTotal = Number(p.preco || 0);
      const precoUnitario = isCombo ? precoTotal / comboCount : precoTotal;
      
      const cartKey = barril ? `${p.id}::${barrilLitros}` : isCombo ? `${p.id}::combo` : `${p.id}`;
      const idx = prev.findIndex((x) => x.cartKey === cartKey);

      if (idx >= 0) {
        const cp = [...prev];
        const novaQtd = cp[idx].qtd + 1;
        cp[idx] = { 
          ...cp[idx], 
          qtd: novaQtd, 
          subtotal: novaQtd * cp[idx].unitario * cp[idx].comboCount 
        };
        return cp;
      }

      return [
        ...prev,
        {
          cartKey,
          produtoId: p.id,
          nome: p.nome,
          preco: precoUnitario,
          unitario: precoUnitario,
          unitarioPorLitro: barril ? unitarioPorLitro : undefined,
          barrilLitros: barril ? barrilLitros : undefined,
          qtd: 1,
          comboCount: isCombo ? comboCount : 1,
          subtotal: isCombo ? precoTotal : precoUnitario,
          tipo: p.tipo || "simples",
          isCombo,
          img: p.img || "",
          iconKey: p.iconKey || "",
        },
      ];
    });
  }, [isBarrilProduto]);

  const alterarQtd = useCallback((cartKey, delta) => {
    setCarrinho((prev = []) => {
      const cp = prev.map((it) => ({ ...it }));
      const idx = cp.findIndex((x) => x.cartKey === cartKey);
      if (idx < 0) return prev;

      const nova = cp[idx].qtd + delta;
      if (nova <= 0) return cp.filter((x) => x.cartKey !== cartKey);

      cp[idx].qtd = nova;
      if (cp[idx].isCombo) {
        cp[idx].subtotal = nova * cp[idx].unitario * cp[idx].comboCount;
      } else {
        cp[idx].subtotal = nova * cp[idx].unitario;
      }
      return cp;
    });
  }, []);

  const alterarLitros = useCallback((cartKey, litros) => {
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
  }, []);

  const limparCarrinho = useCallback(() => {
    setCarrinho([]);
    setRecebidoTxt("");
    setPagamento("dinheiro");
    setAviso({ type: "info", message: "Carrinho limpo" });
  }, []);

  // ==================== FUNÇÕES DE IMPRESSÃO ====================
  const imprimirTicketsDaVenda = useCallback(async (venda) => {
    const itens = Array.isArray(venda?.itens) ? venda.itens : [];
    if (!itens.length) {
      return { ok: false, error: "Nenhum item na venda para imprimir." };
    }

    console.info(`[PRINT] Imprimindo ${itens.length} itens (bitmap por unidade)...`);

    for (let i = 0; i < itens.length; i += 1) {
      const it = itens[i];

      const qtd = Number(it?.qtd ?? it?.quantidade ?? 0) || 0;
      if (qtd <= 0) continue;

      const unitario = Number(it?.unitario ?? it?.preco ?? it?.valor ?? 0) || 0;
      const isCombo = it?.isCombo || false;
      const comboCount = it?.comboCount || 1;

      const totalFichas = isCombo ? qtd * comboCount : qtd;
      const valorPorFicha = isCombo ? unitario : unitario;

      console.log(`📦 Item: ${it.nome}, Combos: ${qtd}, Fichas por combo: ${comboCount}, Total fichas: ${totalFichas}, Valor/ficha: ${fmtBRL(valorPorFicha)}`);

      for (let ficha = 0; ficha < totalFichas; ficha += 1) {
        try {
          // 🔥 AGORA PASSA O TAMANHO DA IMAGEM DOS AJUSTES
          const base64 = await buildTicketBitmapBase64({
            venda,
            ajustes: {
              ...ajustes,
              // Garantir que o tamanho da imagem seja passado
              logoImgMm: ajustes?.logoImgMm || 20,
            },
            item: {
              nome: String(it?.nome || it?.produto || it?.name || "Item").trim(),
              qtd: 1,
              subtotal: valorPorFicha,
              iconKey: it?.iconKey || it?.icone || "ref_600",
            },
          });

          const imgResult = await imprimirBitmap(base64);
          if (!imgResult?.ok) {
            return { ok: false, error: imgResult?.error || "Falha ao imprimir bitmap." };
          }

          if (ficha < totalFichas - 1 || i < itens.length - 1) {
            await delay(DELAY_BETWEEN_PRINTS);
            await imprimirTexto("\n");
          }
        } catch (error) {
          return { ok: false, error: error.message };
        }
      }
    }

    return { ok: true };
  }, [ajustes]);

  const reimprimirVenda = useCallback(async (venda) => {
    if (!venda?.itens?.length || isPrinting) return;

    setAviso({ type: "info", message: "Reimprimindo..." });
    setIsPrinting(true);
    try {
      const resultado = await imprimirTicketsDaVenda(venda);
      if (!resultado?.ok) {
        setAviso({ type: "error", message: `Falha ao reimprimir: ${resultado.error}` });
      } else {
        setAviso({ type: "success", message: "Reimpresso com sucesso!" });
      }
    } catch (error) {
      setAviso({ type: "error", message: `Erro: ${error.message}` });
    } finally {
      setIsPrinting(false);
    }
  }, [isPrinting, imprimirTicketsDaVenda]);

  // ==================== FUNÇÕES DE FINALIZAÇÃO ====================
  const handleFinalizar = useCallback(() => {
    if (isPrinting) return;

    if (precisaEventoAberto()) {
      setAviso({ type: "warning", message: "Abra um evento primeiro." });
      return;
    }
    if (itensCarrinho.length === 0) {
      setAviso({ type: "warning", message: "Carrinho vazio." });
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

    setVendaDraft(draft);
    setConfirmOpen(true);
  }, [isPrinting, precisaEventoAberto, itensCarrinho, pagamento, valorRecebidoNum, troco, total, evento]);

  const handleCancelConfirm = useCallback(() => {
    setConfirmOpen(false);
    setVendaDraft(null);
    setPendingSale(null);
  }, []);

  const handleConfirmVenda = useCallback(async () => {
    if (!vendaDraft || isPrinting) return;

    setAviso({ type: "info", message: "Processando venda..." });
    setIsPrinting(true);
    try {
      let vendaFinal = pendingSale;

      if (!vendaFinal) {
        const itensVenda = [];
        
        vendaDraft.carrinho.forEach((item) => {
          if (item.isCombo) {
            itensVenda.push({
              ...item,
              totalFichas: item.qtd * item.comboCount,
              valorFicha: item.unitario,
            });
          } else {
            itensVenda.push(item);
          }
        });

        const vendaBase = buildVenda({ 
          id: uid(), 
          ...vendaDraft,
          itens: itensVenda,
        });
        
        const criadoEm = new Date().toISOString();

        vendaFinal = {
          ...vendaBase,
          id: vendaBase?.id || uid(),
          criadoEm,
          createdAt: criadoEm,
          data: criadoEm,
          eventoNome: String(vendaBase?.eventoNome || vendaDraft?.eventoNome || "").trim(),
          total: Number(vendaBase?.total ?? vendaDraft?.total ?? 0) || 0,
          pagamento: String(vendaBase?.pagamento || vendaDraft?.pagamento || "dinheiro"),
          itens: itensVenda,
          deviceId,
          deviceName,
        };

        setPendingSale(vendaFinal);
      }

      const resultado = await imprimirTicketsDaVenda(vendaFinal);
      if (!resultado?.ok) {
        setAviso({ type: "error", message: `Falha ao imprimir: ${resultado.error}` });
        return;
      }

      persistSale({ sale: vendaFinal, setVendas });

      limparCarrinho();
      setTab("venda");
      setConfirmOpen(false);
      setVendaDraft(null);
      setPendingSale(null);
      setAviso({ type: "success", message: "Venda finalizada com sucesso!" });
    } catch (error) {
      setAviso({ type: "error", message: `Erro: ${error.message}` });
    } finally {
      setIsPrinting(false);
    }
  }, [vendaDraft, isPrinting, pendingSale, deviceId, deviceName, imprimirTicketsDaVenda, limparCarrinho, setTab, setVendas]);

  // ==================== UTILITÁRIOS ====================
  const formatarDataHora = useCallback((venda) => {
    const iso = venda?.criadoEm || venda?.createdAt || venda?.data || new Date().toISOString();
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime())) return "--";
    return dt.toLocaleString("pt-BR");
  }, []);

  // ==================== ESTILOS ====================
  const styles = {
    produtoCard: {
      border: "2px solid #e5e7eb",
      borderRadius: 16,
      background: "#fff",
      padding: 12,
      cursor: "pointer",
      minHeight: 110,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: 6,
      transition: "all 0.2s ease",
      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
    },
    produtoNome: {
      fontWeight: 700,
      fontSize: 13,
      textAlign: "center",
      maxWidth: "100%",
      overflow: "hidden",
      textOverflow: "ellipsis",
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      whiteSpace: "normal",
      wordBreak: "break-word",
      color: "#2563eb",
      lineHeight: 1.3,
      height: 34,
    },
    overlay: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.6)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      padding: 16,
    },
    modalCard: {
      background: "#fff",
      borderRadius: 16,
      padding: 20,
      width: "100%",
      maxWidth: 600,
      maxHeight: "80vh",
      overflowY: "auto",
      boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
    },
    comboChip: {
      marginTop: 4,
      padding: "2px 6px",
      borderRadius: 999,
      fontSize: 9,
      fontWeight: 700,
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      color: "#1d4ed8",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
    },
    alert: {
      info: { background: "#e0f2fe", color: "#0369a1", border: "1px solid #7dd3fc" },
      success: { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" },
      warning: { background: "#fef9c3", color: "#854d0e", border: "1px solid #fde047" },
      error: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" },
    },
  };

  const itensConfirm = Array.isArray(vendaDraft?.carrinho) ? vendaDraft.carrinho : [];

  return (
    <div className="venda-container">
      <style>{`
        .venda-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 12px;
        }
        .venda-container input,
        .venda-container select,
        .venda-container textarea {
          font-size: 16px;
        }
        .grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        @media (max-width: 640px) {
          .grid-3 {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .product-button:hover {
          border-color: #2563eb !important;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.15) !important;
        }
        .product-button:active:not(:disabled) {
          transform: translateY(0);
        }
        .modal-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .modal-table th {
          text-align: left;
          padding: 8px 4px;
          font-weight: 600;
          color: #4b5563;
          border-bottom: 2px solid #e5e7eb;
        }
        .modal-table td {
          padding: 8px 4px;
          border-bottom: 1px solid #e5e7eb;
        }
        .cart-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: #f8fafc;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          transition: all 0.2s ease;
        }
        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 700;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          color: #4b5563;
        }
        .combo-info {
          font-size: 11px;
          color: #2563eb;
          background: #eff6ff;
          padding: 2px 8px;
          border-radius: 999px;
          display: inline-block;
          margin-top: 4px;
        }
      `}</style>

      {/* Alerta */}
      {aviso.message && (
        <div className="alert" style={styles.alert[aviso.type]}>
          {aviso.message}
        </div>
      )}

      {/* Card de Produtos */}
      <Card 
        title="Produtos" 
        subtitle="Selecione os itens"
        right={
          <span className="badge" style={{ background: "#2563eb", color: "white", borderColor: "#2563eb" }}>
            {produtosAtivos.length} disponíveis
          </span>
        }
      >
        {precisaEventoAberto() && (
          <div style={{ marginBottom: 16 }}>
            <span className="badge" style={{ background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }}>
              ⚠️ Abra um evento antes de vender
            </span>
          </div>
        )}

        <div className="grid-3">
          {produtosAtivos.map((p) => {
            const isCombo = p.tipo === "combo" || p.comboQtd;
            const comboCount = Math.max(2, Number(p.comboQtd) || 0);
            const precoTotal = Number(p.preco) || 0;
            const precoUnitario = comboCount ? precoTotal / comboCount : 0;

            return (
              <button
                key={p.id}
                className="product-button"
                style={styles.produtoCard}
                onClick={() => addProduto(p)}
                disabled={isPrinting}
                title={p.nome}
              >
                {p.img ? (
                  <img
                    src={p.img}
                    alt={p.nome}
                    style={{
                      width: 36,
                      height: 36,
                      objectFit: "contain",
                    }}
                  />
                ) : (
                  <IconImg iconKey={p.iconKey} size={36} />
                )}

                <div style={styles.produtoNome}>
                  {p.nome}
                </div>

                {isCombo && (
                  <div style={styles.comboChip}>
                    {comboCount} itens
                  </div>
                )}

                <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>
                  {fmtBRL(precoTotal)}
                </div>

                {isCombo && comboCount > 0 && (
                  <div style={{ fontSize: 9, color: "#6b7280" }}>
                    ({fmtBRL(precoUnitario)}/ficha)
                  </div>
                )}
              </button>
            );
          })}

          {produtosAtivos.length === 0 && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 32, color: "#6b7280" }}>
              Nenhum produto ativo. Vá em Produtos e cadastre.
            </div>
          )}
        </div>
      </Card>

      {/* Card do Carrinho */}
      <Card
        title="Carrinho"
        subtitle="Revise os itens"
        right={
          <span className="badge" style={{ background: "#2563eb", color: "white", borderColor: "#2563eb" }}>
            {itensCarrinho.length} {itensCarrinho.length === 1 ? 'item' : 'itens'}
          </span>
        }
        style={{ marginTop: 16 }}
      >
        {itensCarrinho.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "#6b7280" }}>
            🛒 Carrinho vazio. Adicione produtos para começar.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {itensCarrinho.map((it) => (
              <div key={it.cartKey || it.produtoId} className="cart-item">
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, marginBottom: 2, fontSize: 14 }}>{it.nome}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {fmtBRL(it.unitario)} {it.isCombo ? '/ficha' : 'cada'}
                  </div>
                  
                  {it.isCombo && (
                    <div className="combo-info">
                      {it.qtd} combo(s) × {it.comboCount} fichas = {it.qtd * it.comboCount} fichas
                    </div>
                  )}

                  {it.barrilLitros && (
                    <div style={{ marginTop: 6 }}>
                      <select
                        className="input"
                        value={it.barrilLitros}
                        disabled={isPrinting}
                        onChange={(e) => alterarLitros(it.cartKey, e.target.value)}
                        style={{ width: "auto", padding: "2px 6px", fontSize: 12 }}
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

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Button small onClick={() => alterarQtd(it.cartKey, -1)} disabled={isPrinting}>
                    −
                  </Button>
                  <span style={{ fontWeight: 700, minWidth: 24, textAlign: "center", fontSize: 14 }}>
                    {it.qtd}
                  </span>
                  <Button small onClick={() => alterarQtd(it.cartKey, +1)} disabled={isPrinting}>
                    +
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ height: 1, background: "#e5e7eb", margin: "16px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 16 }}>Total</span>
          <span style={{ fontWeight: 900, fontSize: 22, color: "#2563eb" }}>
            {fmtBRL(total)}
          </span>
        </div>

        <div style={{ height: 1, background: "#e5e7eb", margin: "16px 0" }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>
              Pagamento
            </div>
            <select
              className="input"
              value={pagamento}
              disabled={isPrinting}
              onChange={(e) => setPagamento(e.target.value)}
              style={{ width: "100%", padding: "8px" }}
            >
              <option value="dinheiro">💵 Dinheiro</option>
              <option value="pix">📱 Pix</option>
              <option value="cartao">💳 Cartão</option>
            </select>
          </div>

          {pagamento === "dinheiro" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>
                Recebido
              </div>
              <input
                className="input"
                placeholder="0,00"
                value={recebidoTxt}
                disabled={isPrinting}
                onChange={(e) => setRecebidoTxt(e.target.value)}
                inputMode="decimal"
                style={{ width: "100%", padding: "8px" }}
              />
              {troco !== null && (
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Troco:</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#059669" }}>{fmtBRL(troco)}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
          <Button onClick={limparCarrinho} disabled={isPrinting} variant="secondary" small>
            Limpar
          </Button>
          <Button 
            variant="primary" 
            onClick={handleFinalizar} 
            disabled={isPrinting || itensCarrinho.length === 0}
            style={{ minWidth: 100 }}
            small
          >
            {isPrinting ? "..." : "Finalizar"}
          </Button>
        </div>

        <div style={{ fontSize: 11, color: "#6b7280", marginTop: 12, textAlign: "center" }}>
          {pagamento === "dinheiro" 
            ? "💰 Informe o valor recebido"
            : "💳 Pix/Cartão não geram troco"}
        </div>
      </Card>

      {/* Últimas Vendas */}
      <Card title="Últimas vendas" subtitle="Reimprima se necessário" style={{ marginTop: 16 }}>
        {ultimasVendas.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, color: "#6b7280", fontSize: 14 }}>
            Nenhuma venda registrada.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ultimasVendas.map((venda, index) => (
              <div
                key={venda?.id || index}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 10,
                  background: "#f8fafc",
                  borderRadius: 8,
                  border: "1px solid #e5e7eb",
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{formatarDataHora(venda)}</div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    {fmtBRL(venda?.total || 0)} • {venda?.pagamento || "—"}
                  </div>
                </div>
                <Button 
                  small 
                  onClick={() => reimprimirVenda(venda)} 
                  disabled={isPrinting}
                  variant="secondary"
                  style={{ fontSize: 11, padding: "4px 8px" }}
                >
                  🔄 Reimprimir
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal de Confirmação */}
      {confirmOpen && vendaDraft && (
        <div style={styles.overlay} onClick={handleCancelConfirm}>
          <div
            style={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div>
                <h4 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Confirmar venda</h4>
                <p style={{ fontSize: 11, color: "#6b7280", margin: "2px 0 0" }}>
                  {new Date().toLocaleString("pt-BR")}
                </p>
              </div>
              <span className="badge" style={{ background: "#2563eb", color: "white", fontSize: 11 }}>
                {vendaDraft.eventoNome}
              </span>
            </div>

            <table className="modal-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th style={{ textAlign: "center", width: 45 }}>Qtd</th>
                  <th style={{ textAlign: "right", width: 70 }}>Unit.</th>
                  <th style={{ textAlign: "right", width: 70 }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {itensConfirm.map((it, idx) => {
                  const unitarioExibicao = it.isCombo ? it.unitario : it.preco;
                  const subtotalExibicao = it.isCombo ? it.qtd * it.unitario * it.comboCount : it.subtotal;
                  
                  return (
                    <tr key={idx}>
                      <td style={{ fontSize: 12, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {it.nome}
                        {it.isCombo && (
                          <span style={{ fontSize: 10, color: "#2563eb", marginLeft: 4 }}>
                            ({it.qtd} combo × {it.comboCount} fichas)
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: "center", fontSize: 12 }}>{it.qtd}</td>
                      <td style={{ textAlign: "right", fontSize: 12 }}>{fmtBRL(unitarioExibicao)}</td>
                      <td style={{ textAlign: "right", fontWeight: 600, fontSize: 12 }}>{fmtBRL(subtotalExibicao)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ height: 1, background: "#e5e7eb", margin: "12px 0" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Total</span>
              <span style={{ fontWeight: 900, fontSize: 18, color: "#2563eb" }}>
                {fmtBRL(totalDoCarrinho(itensConfirm))}
              </span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Pagamento</span>
              <span style={{ fontWeight: 600, fontSize: 12, textTransform: "capitalize" }}>
                {vendaDraft.pagamento === "dinheiro" && "💵 "}
                {vendaDraft.pagamento === "pix" && "📱 "}
                {vendaDraft.pagamento === "cartao" && "💳 "}
                {vendaDraft.pagamento}
              </span>
            </div>

            {vendaDraft.pagamento === "dinheiro" && vendaDraft.recebido > 0 && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Recebido</span>
                  <span style={{ fontSize: 12 }}>{fmtBRL(vendaDraft.recebido)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>Troco</span>
                  <span style={{ fontWeight: 600, fontSize: 12, color: "#059669" }}>{fmtBRL(vendaDraft.troco)}</span>
                </div>
              </>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 16, justifyContent: "flex-end" }}>
              <Button onClick={handleCancelConfirm} disabled={isPrinting} variant="secondary" small>
                Cancelar
              </Button>
              <Button 
                variant="primary" 
                onClick={handleConfirmVenda} 
                disabled={isPrinting}
                small
              >
                {isPrinting ? "Imprimindo..." : "Confirmar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}