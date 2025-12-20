// src/pages/Relatorio.jsx
import React, { useMemo } from "react";
import Card from "../components/Card";
import { fmtBRL } from "../domain/math";

/* ===================== helpers robustos ===================== */
function normNome(s) {
  return String(s || "").trim();
}

function pickItemNome(it) {
  // tenta cobrir vários formatos possíveis
  return normNome(
    it?.nome ||
      it?.produtoNome ||
      it?.descricao ||
      it?.label ||
      it?.item ||
      it?.title ||
      it?.produto?.nome ||
      it?.produto?.descricao
  );
}

function pickItemQtd(it) {
  const q = Number(it?.qtd ?? it?.quantidade ?? it?.count ?? it?.qty ?? it?.q ?? 1);
  return Number.isFinite(q) && q > 0 ? q : 1;
}

function pickItemValorUnit(it) {
  const v = Number(
    it?.preco ??
      it?.valor ??
      it?.precoUnit ??
      it?.preco_unitario ??
      it?.unitPrice ??
      it?.unitario ??
      it?.produto?.preco ??
      it?.produto?.valor ??
      0
  );
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function pickProdutoNome(p) {
  return normNome(p?.nome || p?.produtoNome || p?.descricao || p?.label || p?.item || p?.title);
}

function pickProdutoValorUnit(p) {
  const v = Number(
    p?.preco ??
      p?.valor ??
      p?.precoVenda ??
      p?.preco_unitario ??
      p?.unitPrice ??
      p?.unitario ??
      0
  );
  return Number.isFinite(v) && v > 0 ? v : 0;
}

function getProdutosDoEvento(evento, produtosFallback) {
  // lista de produtos “disponíveis à venda no evento”
  const candidates =
    (Array.isArray(evento?.produtos) && evento.produtos) ||
    (Array.isArray(evento?.itensVenda) && evento.itensVenda) ||
    (Array.isArray(evento?.produtosVenda) && evento.produtosVenda) ||
    (Array.isArray(evento?.catalogo) && evento.catalogo) ||
    null;

  if (candidates && candidates.length) return candidates;
  return Array.isArray(produtosFallback) ? produtosFallback : [];
}

/* ===================== tenta ler itens da venda em múltiplos formatos ===================== */
function getItensDaVenda(v) {
  // formatos comuns: v.itens, v.items, v.carrinho, v.cart
  if (Array.isArray(v?.itens)) return v.itens;
  if (Array.isArray(v?.items)) return v.items;
  if (Array.isArray(v?.carrinho)) return v.carrinho;
  if (Array.isArray(v?.cart)) return v.cart;

  // às vezes vem como objeto {nome: qtd} (raro)
  if (v?.itens && typeof v.itens === "object") {
    return Object.entries(v.itens).map(([nome, qtd]) => ({ nome, qtd }));
  }

  return [];
}

export default function Relatorio({ evento, vendas, produtos, caixa }) {
  const nomeEv = (evento?.nome || "").trim();

  const vendasEv = useMemo(() => {
    if (!nomeEv) return [];
    return (Array.isArray(vendas) ? vendas : []).filter((v) => v?.eventoNome === nomeEv);
  }, [vendas, nomeEv]);

  const abertura = Number(caixa?.abertura ?? 0) || 0;

  /* ===================== agregado vendido por produto ===================== */
  const vendidosMap = useMemo(() => {
    const map = new Map(); // nome -> { qtd, total, valorUnitDetectado }

    for (const v of vendasEv) {
      const itens = getItensDaVenda(v);
      for (const it of itens) {
        const nome = pickItemNome(it);
        if (!nome) continue;

        const qtd = pickItemQtd(it);
        const unit = pickItemValorUnit(it);

        // se existir total no item, usa; senão calcula
        const totalLinha = Number(it?.total ?? it?.subtotal ?? 0) || (unit > 0 ? unit * qtd : 0);

        const prev = map.get(nome) || { qtd: 0, total: 0, valorUnitDetectado: 0 };
        map.set(nome, {
          qtd: prev.qtd + qtd,
          total: prev.total + (Number.isFinite(totalLinha) ? totalLinha : 0),
          valorUnitDetectado: prev.valorUnitDetectado || unit || 0,
        });
      }
    }

    return map;
  }, [vendasEv]);

  /* ===================== tabela final: produtos do evento + vendidos ===================== */
  const tabelaProdutosEvento = useMemo(() => {
    const base = getProdutosDoEvento(evento, produtos);

    const baseNorm = base
      .map((p) => {
        const nome = pickProdutoNome(p);
        const unit = pickProdutoValorUnit(p);
        return nome ? { nome, unit } : null;
      })
      .filter(Boolean);

    // inclui vendidos que não estavam na base
    const extras = Array.from(vendidosMap.keys())
      .filter((nome) => !baseNorm.some((b) => b.nome === nome))
      .map((nome) => {
        const v = vendidosMap.get(nome);
        return { nome, unit: Number(v?.valorUnitDetectado || 0) || 0 };
      });

    const lista = [...baseNorm, ...extras];

    const out = lista.map((p) => {
      const v = vendidosMap.get(p.nome) || { qtd: 0, total: 0, valorUnitDetectado: 0 };
      const unit = Number(p.unit || 0) || Number(v.valorUnitDetectado || 0) || 0;
      const qtd = Number(v.qtd || 0) || 0;
      const total = Number(v.total || 0) || (unit > 0 ? unit * qtd : 0);
      return { nome: p.nome, qtd, unit, total };
    });

    // ordena por mais vendidos, depois nome
    out.sort((a, b) => (b.qtd !== a.qtd ? b.qtd - a.qtd : a.nome.localeCompare(b.nome)));

    return out;
  }, [evento, produtos, vendidosMap]);

  const totalVendidoProdutos = useMemo(() => {
    return tabelaProdutosEvento.reduce((s, it) => s + (Number(it.total) || 0), 0);
  }, [tabelaProdutosEvento]);

  const totalComAbertura = (Number(totalVendidoProdutos) || 0) + (Number(abertura) || 0);

  return (
    <Card
      title="Relatório"
      subtitle={nomeEv ? `Evento: ${nomeEv}` : "Abra um evento para visualizar"}
    >
      {!nomeEv ? (
        <div className="muted">Abra um evento em “Evento”.</div>
      ) : (
        <>
          <div className="hr" />

          {/* Resumo enxuto, só o que importa pro fechamento */}
          <div className="row" style={{ flexWrap: "wrap" }}>
            <div className="miniCard">
              <div className="muted">Abertura</div>
              <div className="big">{fmtBRL(abertura)}</div>
            </div>
            <div className="miniCard">
              <div className="muted">Total vendido</div>
              <div className="big">{fmtBRL(totalVendidoProdutos)}</div>
            </div>
            <div className="miniCard">
              <div className="muted">Total (abertura + vendas)</div>
              <div className="big">{fmtBRL(totalComAbertura)}</div>
            </div>
          </div>

          <div className="hr" />

          <div className="muted" style={{ fontWeight: 900, marginBottom: 8 }}>
            Produtos do evento (quantidade vendida)
          </div>

          {tabelaProdutosEvento.length === 0 ? (
            <div className="muted">Nenhum produto disponível no evento.</div>
          ) : (
            <div className="tableWrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th style={{ width: 110, textAlign: "right" }}>Qtd.</th>
                    <th style={{ width: 140, textAlign: "right" }}>Unitário</th>
                    <th style={{ width: 150, textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {tabelaProdutosEvento.map((it) => (
                    <tr key={it.nome}>
                      <td style={{ fontWeight: 900 }}>{it.nome}</td>
                      <td style={{ textAlign: "right" }}>{it.qtd}</td>
                      <td style={{ textAlign: "right" }}>{it.unit > 0 ? fmtBRL(it.unit) : "—"}</td>
                      <td style={{ textAlign: "right", fontWeight: 900 }}>{fmtBRL(it.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ fontWeight: 900 }}>TOTAL</td>
                    <td />
                    <td />
                    <td style={{ textAlign: "right", fontWeight: 900 }}>
                      {fmtBRL(totalVendidoProdutos)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
