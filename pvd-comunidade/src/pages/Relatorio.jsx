// src/pages/Relatorio.jsx
import React from "react";
import Card from "../components/Card";
import { fmtBRL } from "../domain/math";
import { loadJSON } from "../storage/storage";
import { LS_KEYS } from "../storage/keys";

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function extrairItensVenda(v) {
  const itens = v?.itens ?? v?.items ?? v?.carrinho ?? v?.produtos ?? [];
  if (!Array.isArray(itens)) return [];

  return itens.map((i) => ({
    nome: i?.nome ?? i?.produto ?? i?.name ?? "",
    qtd: Number(i?.qtd ?? i?.quantidade ?? i?.qty ?? 0) || 0,
    unitario: Number(i?.unitario ?? i?.preco ?? i?.valor ?? 0) || 0,
  }));
}

export default function Relatorio() {
  const evento = loadJSON(LS_KEYS.evento, null);
  const vendas = loadJSON(LS_KEYS.vendas, []);
  const caixa = loadJSON(LS_KEYS.caixa, null);

  const vendasEvento = vendas.filter((v) => {
    if (evento?.id && v?.eventoId) return v.eventoId === evento.id;
    return norm(v?.eventoNome) === norm(evento?.nome);
  });

  const mapa = new Map();

  vendasEvento.forEach((v) => {
    extrairItensVenda(v).forEach((it) => {
      if (!it.nome) return;
      const cur = mapa.get(it.nome) || { nome: it.nome, qtd: 0, unitario: it.unitario, total: 0 };
      cur.qtd += it.qtd;
      cur.total += it.qtd * it.unitario;
      cur.unitario = it.unitario || cur.unitario;
      mapa.set(it.nome, cur);
    });
  });

  const linhas = Array.from(mapa.values());
  const totalVendido = linhas.reduce((s, l) => s + l.total, 0);
  const abertura = Number(caixa?.abertura ?? 0);
  const totalGeral = abertura + totalVendido;

  return (
    <Card
      title="Relatório"
      subtitle={evento?.nome ? `Evento: ${evento?.nome}` : "Abra um evento para visualizar"}
    >
      {!evento?.nome ? (
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
              <div className="big">{fmtBRL(totalVendido)}</div>
            </div>
            <div className="miniCard">
              <div className="muted">Total (abertura + vendas)</div>
              <div className="big">{fmtBRL(totalGeral)}</div>
            </div>
          </div>

          <div className="hr" />

          <div className="muted" style={{ fontWeight: 900, marginBottom: 8 }}>
            Produtos do evento (quantidade vendida)
          </div>

          {linhas.length === 0 ? (
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
                  {linhas.map((it) => (
                    <tr key={it.nome}>
                      <td style={{ fontWeight: 900 }}>{it.nome}</td>
                      <td style={{ textAlign: "right" }}>{it.qtd}</td>
                      <td style={{ textAlign: "right" }}>
                        {it.unitario > 0 ? fmtBRL(it.unitario) : "—"}
                      </td>
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
                      {fmtBRL(totalVendido)}
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
