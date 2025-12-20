// src/pages/Venda.jsx
import React, { useMemo, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { fmtBRL, toNumBR, uid } from "../domain/math";
import { buildVenda, totalDoCarrinho } from "../domain/pos";

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

  const total = useMemo(() => totalDoCarrinho(carrinho || []), [carrinho]);
  const recebido = useMemo(() => toNumBR(recebidoTxt), [recebidoTxt]);
  const troco = useMemo(() => Math.max(0, recebido - total), [recebido, total]);

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
    if (precisaEventoAberto()) return alert("Abra um evento primeiro.");
    if (!carrinho || carrinho.length === 0) return alert("Carrinho vazio.");

    if (pagamento === "dinheiro" && recebidoTxt.trim() && recebido < total) {
      return alert("Valor recebido menor que o total.");
    }

    const venda = buildVenda({
      id: uid(),
      eventoNome: evento.nome,
      carrinho,
      pagamento,
      recebido:
        pagamento === "dinheiro" && recebidoTxt.trim() ? recebido : null,
      troco:
        pagamento === "dinheiro" && recebidoTxt.trim() ? troco : null,
    });

    setVendas((prev = []) => [venda, ...prev]);
    limpar();
    alert("Venda finalizada!");
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
    </div>
  );
}
