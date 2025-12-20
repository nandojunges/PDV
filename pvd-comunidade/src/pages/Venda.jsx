// src/pages/Venda.jsx
import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { fmtBRL, uid } from "../domain/math";
import { buildVenda, totalDoCarrinho } from "../domain/pos";
import { loadJSON, saveJSON } from "../storage/storage";
import { LS_KEYS } from "../storage/keys";

/* ===================== ícones (imagens realistas) ===================== */
const ICONS = {
  agua: "/Icons/agua.png",
  ref_lata: "/Icons/refri-lata.png",
  ref_600: "/Icons/refri-600.png",
  ref_2l: "/Icons/refri-2l.png",
  cer_lata: "/Icons/cerveja-lata.png",
  cer_garrafa: "/Icons/cerveja-garrafa.png",
  chope: "/Icons/chope.png",
  barril: "/Icons/barril.png",
  lanche: "/Icons/lanche.png",
  sobremesa: "/Icons/sobremesa.png",
  sorvete: "/Icons/sorvete.png",
  fichas: "/Icons/fichas.png",
  suco: "/Icons/suco.png",
};

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

export default function Venda({
  evento = {},
  produtos = [],
  vendas = [],
  setVendas = () => {},
}) {
  const produtosAtivos = useMemo(() => {
    return Array.isArray(produtos) ? produtos.filter((p) => p?.ativo) : [];
  }, [produtos]);

  const [carrinho, setCarrinho] = useState([]);
  const [pagamento, setPagamento] = useState("dinheiro");
  const [recebidoTxt, setRecebidoTxt] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [vendaDraft, setVendaDraft] = useState(null);
  const [aviso, setAviso] = useState("");

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

  useEffect(() => {
    if (!confirmOpen) return undefined;
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setConfirmOpen(false);
        setVendaDraft(null);
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
          img: p.img || "",
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
      const existenteIdx = cp.findIndex(
        (x, i) => x.cartKey === novoCartKey && i !== idx,
      );
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

  function finalizar() {
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
    setConfirmOpen(false);
    setVendaDraft(null);
  }

  function confirmar() {
    if (!vendaDraft) return;
    const vendaFinal = buildVenda({ id: uid(), ...vendaDraft });
    const prevLS = loadJSON(LS_KEYS.vendas, []);
    const next = [vendaFinal, ...(Array.isArray(prevLS) ? prevLS : [])];
    saveJSON(LS_KEYS.vendas, next);
    setVendas((prev = []) => [vendaFinal, ...prev]);
    setConfirmOpen(false);
    setVendaDraft(null);
    limpar();
    setTimeout(() => window.print(), 50);
  }

  const itensConfirm = Array.isArray(vendaDraft?.carrinho)
    ? vendaDraft.carrinho
    : [];

  return (
    <div className="split">
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
            gap: 10,
          }}
        >
          {produtosAtivos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => addProduto(p)}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#fff",
                padding: 12,
                cursor: "pointer",
                minHeight: 86,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: 6,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              {p.img ? (
                <img
                  src={p.img}
                  alt={p.nome}
                  style={{
                    width: 46,
                    height: 46,
                    objectFit: "contain",
                    display: "block",
                  }}
                />
              ) : (
                <IconImg iconKey={p.iconKey} size={46} />
              )}

              <div
                style={{
                  fontWeight: 950,
                  fontSize: 13,
                  textAlign: "center",
                  lineHeight: 1.1,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "#2563eb",
                }}
                title={p.nome}
              >
                {p.nome}
              </div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 12,
                  color: "#111827",
                }}
              >
                {fmtBRL(p.preco)}
              </div>
            </button>
          ))}

          {produtosAtivos.length === 0 && (
            <div className="muted">
              Nenhum produto ativo. Vá em Produtos e cadastre.
            </div>
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
                  <Button small onClick={() => alterarQtd(it.cartKey, -1)}>
                    -
                  </Button>
                  <div className="cartQty">{it.qtd}</div>
                  <Button small onClick={() => alterarQtd(it.cartKey, +1)}>
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
          <div style={{ fontWeight: 900, fontSize: 18 }}>
            {fmtBRL(total)}
          </div>
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
                onChange={(e) => setRecebidoTxt(e.target.value)}
                inputMode="decimal"
              />
              <div className="row space" style={{ marginTop: 8 }}>
                <div className="muted">Troco</div>
                <div style={{ fontWeight: 900 }}>
                  {troco != null ? fmtBRL(troco) : "—"}
                </div>
              </div>
            </div>
          )}

          <div className="formActions">
            <Button onClick={limpar}>Limpar</Button>
            <Button variant="primary" onClick={finalizar}>
              Finalizar
            </Button>
          </div>
        </div>

        <div className="hr" />
        <div className="muted">
          Dica: Pix/Cartão não usa troco. Dinheiro pode informar recebido para
          calcular troco.
        </div>
      </Card>

      {confirmOpen && vendaDraft && (
        <div
          style={overlayStyle}
          onClick={cancelarConfirmacao}
          role="presentation"
        >
          <div
            style={modalCardStyle}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar pedido"
          >
            <div className="row space" style={{ marginBottom: 12 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>
                  Confirmar pedido
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {new Date().toLocaleString("pt-BR")}
                </div>
              </div>
              <span className="badge">{vendaDraft.eventoNome}</span>
            </div>

            <div style={{ marginBottom: 16 }}>
              <table
                className="table"
                style={{ width: "100%", borderCollapse: "collapse" }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", paddingBottom: 8 }}>
                      Item
                    </th>
                    <th style={{ textAlign: "center", paddingBottom: 8 }}>
                      Qtd
                    </th>
                    <th style={{ textAlign: "right", paddingBottom: 8 }}>
                      Unitário
                    </th>
                    <th style={{ textAlign: "right", paddingBottom: 8 }}>
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {itensConfirm.map((it, idx) => (
                    <tr key={`${it.cartKey ?? it.produtoId ?? it.id ?? idx}`}>
                      <td style={{ padding: "6px 0" }}>{it.nome}</td>
                      <td style={{ textAlign: "center" }}>{it.qtd}</td>
                      <td style={{ textAlign: "right" }}>
                        {fmtBRL(it.preco)}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {fmtBRL(it.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="hr" />

            <div className="row space" style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 900 }}>Total</div>
              <div style={{ fontWeight: 900 }}>
                {fmtBRL(totalDoCarrinho(itensConfirm))}
              </div>
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
                  <div>
                    {vendaDraft.recebido != null
                      ? fmtBRL(vendaDraft.recebido)
                      : "—"}
                  </div>
                </div>
                <div className="row space">
                  <div className="muted">Troco</div>
                  <div>
                    {vendaDraft.troco != null
                      ? fmtBRL(vendaDraft.troco)
                      : "—"}
                  </div>
                </div>
              </div>
            )}

            <div
              className="row"
              style={{ justifyContent: "flex-end", gap: 8, marginTop: 16 }}
            >
              <Button onClick={cancelarConfirmacao}>Cancelar</Button>
              <Button variant="primary" onClick={confirmar}>
                Confirmar + Imprimir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
