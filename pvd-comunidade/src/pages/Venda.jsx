// src/pages/Venda.jsx
import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { fmtBRL, toNumBR, uid } from "../domain/math";
import { buildVenda, totalDoCarrinho } from "../domain/pos";
import { loadJSON, saveJSON } from "../storage/storage";
import { LS_KEYS } from "../storage/keys";

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
  const [pendingVenda, setPendingVenda] = useState(null);
  const [aviso, setAviso] = useState("");

  const total = useMemo(() => totalDoCarrinho(carrinho || []), [carrinho]);
  const recebido = useMemo(() => toNumBR(recebidoTxt), [recebidoTxt]);
  const troco = useMemo(() => Math.max(0, recebido - total), [recebido, total]);

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
        setPendingVenda(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmOpen]);

  function precisaEventoAberto() {
    return !String(evento?.nome || "").trim();
  }

  function addProduto(p) {
    if (!p) return;
    setCarrinho((prev = []) => {
      const idx = prev.findIndex((x) => x.produtoId === p.id);
      if (idx >= 0) {
        const cp = [...prev];
        const novaQtd = cp[idx].qtd + 1;
        cp[idx] = { ...cp[idx], qtd: novaQtd, subtotal: novaQtd * cp[idx].preco };
        return cp;
      }
      return [
        ...prev,
        {
          produtoId: p.id,
          nome: p.nome,
          preco: p.preco,
          qtd: 1,
          subtotal: p.preco,
          tipo: p.tipo || "simples",
          img: p.img || "",
        },
      ];
    });
  }

  function alterarQtd(produtoId, delta) {
    setCarrinho((prev = []) => {
      const cp = prev.map((it) => ({ ...it }));
      const idx = cp.findIndex((x) => x.produtoId === produtoId);
      if (idx < 0) return prev;
      const nova = cp[idx].qtd + delta;
      if (nova <= 0) return cp.filter((x) => x.produtoId !== produtoId);
      cp[idx].qtd = nova;
      cp[idx].subtotal = nova * cp[idx].preco;
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
    if (!carrinho || carrinho.length === 0) {
      setAviso("Carrinho vazio.");
      return;
    }

    if (pagamento === "dinheiro" && recebidoTxt.trim() && recebido < total) {
      setAviso("Valor recebido menor que o total.");
      return;
    }

    const venda = buildVenda({
      id: uid(),
      eventoId: evento?.id ?? null,
      eventoNome: evento.nome,
      carrinho,
      pagamento,
      recebido:
        pagamento === "dinheiro" && recebidoTxt.trim() ? recebido : null,
      troco:
        pagamento === "dinheiro" && recebidoTxt.trim() ? troco : null,
    });

    setAviso("");
    setPendingVenda(venda);
    setConfirmOpen(true);
  }

  function cancelarConfirmacao() {
    setConfirmOpen(false);
    setPendingVenda(null);
  }

  function confirmar(imprimir) {
    if (!pendingVenda) return;
    const prevLS = loadJSON(LS_KEYS.vendas, []);
    const next = [pendingVenda, ...(Array.isArray(prevLS) ? prevLS : [])];
    saveJSON(LS_KEYS.vendas, next);
    setVendas((prev = []) => [pendingVenda, ...prev]);
    setConfirmOpen(false);
    setPendingVenda(null);
    limpar();
    if (imprimir) {
      setTimeout(() => window.print(), 50);
    }
  }

  return (
    <div className="split">
      <Card title="Produtos" subtitle="Toque para adicionar">
        {precisaEventoAberto() && (
          <div style={{ marginBottom: 10 }}>
            <span className="badge">Abra um evento antes de vender</span>
          </div>
        )}

        <div className="grid">
          {produtosAtivos.map((p) => (
            <button
              key={p.id}
              className="btn productBtn"
              onClick={() => addProduto(p)}
              type="button"
            >
              <div className="productInner">
                <div className="productThumb">
                  {p.img ? (
                    <img src={p.img} alt="" />
                  ) : (
                    <div className="thumbPlaceholder">+</div>
                  )}
                </div>
                <div className="productInfo">
                  <div className="productName">{p.nome}</div>
                  <div className="muted">{fmtBRL(p.preco)}</div>
                  {(p.tipo === "combo" || p.tipo === "caucao") && (
                    <div className="badge">
                      {p.tipo === "combo" ? "Combo" : "Caução"}
                    </div>
                  )}
                </div>
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
        right={<span className="badge">{carrinho.length} itens</span>}
      >
        {aviso && (
          <div style={{ marginBottom: 12 }}>
            <span className="badge">{aviso}</span>
          </div>
        )}

        {carrinho.length === 0 ? (
          <div className="muted">Adicione produtos para começar.</div>
        ) : (
          <div className="cartList">
            {carrinho.map((it) => (
              <div key={it.produtoId} className="cartRow">
                <div className="cartLeft">
                  <div className="cartName">{it.nome}</div>
                  <div className="muted">{fmtBRL(it.preco)} cada</div>
                </div>
                <div className="cartRight">
                  <Button small onClick={() => alterarQtd(it.produtoId, -1)}>
                    -
                  </Button>
                  <div className="cartQty">{it.qtd}</div>
                  <Button small onClick={() => alterarQtd(it.produtoId, +1)}>
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
              className="input"
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
                Valor recebido (opcional)
              </div>
              <input
                className="input"
                placeholder="Ex: 50,00"
                value={recebidoTxt}
                onChange={(e) => setRecebidoTxt(e.target.value)}
                inputMode="decimal"
              />
              {recebidoTxt.trim() && (
                <div className="row space" style={{ marginTop: 8 }}>
                  <div className="muted">Troco</div>
                  <div style={{ fontWeight: 900 }}>
                    {fmtBRL(troco)}
                  </div>
                </div>
              )}
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
          Dica: Pix/Cartão não usa troco. Dinheiro pode informar recebido.
        </div>
      </Card>

      {confirmOpen && pendingVenda && (
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
              <span className="badge">{pendingVenda.eventoNome}</span>
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
                  {pendingVenda.carrinho.map((it) => (
                    <tr key={it.produtoId}>
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
                {fmtBRL(totalDoCarrinho(pendingVenda.carrinho))}
              </div>
            </div>

            <div className="row space" style={{ marginBottom: 6 }}>
              <div className="muted">Pagamento</div>
              <div style={{ fontWeight: 700, textTransform: "capitalize" }}>
                {pendingVenda.pagamento}
              </div>
            </div>

            {pendingVenda.pagamento === "dinheiro" && (
              <div style={{ marginBottom: 12 }}>
                <div className="row space">
                  <div className="muted">Valor recebido</div>
                  <div>
                    {pendingVenda.recebido != null
                      ? fmtBRL(pendingVenda.recebido)
                      : "—"}
                  </div>
                </div>
                <div className="row space">
                  <div className="muted">Troco</div>
                  <div>
                    {pendingVenda.troco != null
                      ? fmtBRL(pendingVenda.troco)
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
              <Button onClick={() => confirmar(true)}>
                Confirmar e Imprimir
              </Button>
              <Button variant="primary" onClick={() => confirmar(false)}>
                Confirmar sem imprimir
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
