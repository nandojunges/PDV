// src/pages/Relatorio.jsx
import React, { useMemo } from "react";
import Card from "../components/Card";
import { fmtBRL } from "../domain/math";
import { loadJSON } from "../storage/storage";
import { LS_KEYS } from "../storage/keys";
import { useConfig } from "../config/ConfigProvider";

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function extrairItensVenda(v) {
  const itens = v?.itens ?? v?.carrinho ?? v?.items ?? v?.produtos ?? [];
  if (!Array.isArray(itens)) return [];

  return itens.map((i) => {
    const qtd = Number(i?.qtd ?? i?.quantidade ?? i?.qty ?? 0) || 0;
    const unitario = Number(i?.unitario ?? i?.preco ?? i?.valor ?? 0) || 0;
    const subtotal = Number(i?.subtotal ?? qtd * unitario) || 0;
    return {
      nome: i?.nome ?? i?.produto ?? i?.name ?? "",
      qtd,
      unitario,
      subtotal,
      barrilLitros: i?.barrilLitros ?? null,
      unitarioPorLitro: i?.unitarioPorLitro ?? null,
    };
  });
}

function extrairItensResumo(summary) {
  if (!summary) return [];
  return extrairItensVenda(summary);
}

export default function Relatorio({ evento: eventoProp, vendas: vendasProp, caixa: caixaProp }) {
  const { permitirMultiDispositivo, config } = useConfig();
  const evento = eventoProp ?? loadJSON(LS_KEYS.evento, null);
  const vendas = Array.isArray(vendasProp) ? vendasProp : loadJSON(LS_KEYS.vendas, []);
  const caixa = caixaProp ?? loadJSON(LS_KEYS.caixa, null);

  const vendasEvento = vendas.filter((v) => {
    const matchId = evento?.id && v?.eventoId && v.eventoId === evento.id;
    const matchNome =
      norm(v?.eventoNome) && norm(evento?.nome) && norm(v.eventoNome) === norm(evento.nome);
    return matchId || matchNome;
  });

  const isMaster = permitirMultiDispositivo && config?.modoMulti === "master";
  const saleSummaries = useMemo(() => {
    if (!isMaster) return [];
    const raw = loadJSON(LS_KEYS.saleSummaries, []);
    return Array.isArray(raw) ? raw : [];
  }, [isMaster]);

  const mapa = new Map();

  vendasEvento.forEach((v) => {
    extrairItensVenda(v).forEach((it) => {
      if (!it.nome) return;
      const nomeBase = it.nome;
      const key = it.barrilLitros ? `${nomeBase}::${it.barrilLitros}` : nomeBase;
      const cur = mapa.get(key) || {
        nome: nomeBase,
        qtd: 0,
        unitario: it.unitario,
        total: 0,
        barrilLitros: it.barrilLitros,
      };
      cur.qtd += it.qtd;
      cur.total += it.subtotal;
      cur.unitario = it.unitario || cur.unitario;
      mapa.set(key, cur);
    });
  });

  if (isMaster) {
    const nomeAtual = String(evento?.nome || "").trim();
    saleSummaries
      .filter((summary) => {
        const matchId = evento?.id && summary?.eventoId && summary.eventoId === evento.id;
        const matchNome =
          norm(summary?.eventoNome) &&
          norm(evento?.nome) &&
          norm(summary.eventoNome) === norm(evento.nome);
        return (matchId || matchNome) && (!nomeAtual || norm(summary?.eventoNome) === norm(nomeAtual));
      })
      .forEach((summary) => {
        extrairItensResumo(summary).forEach((it) => {
          if (!it.nome) return;
          const nomeBase = it.nome;
          const key = it.barrilLitros ? `${nomeBase}::${it.barrilLitros}` : nomeBase;
          const cur = mapa.get(key) || {
            nome: nomeBase,
            qtd: 0,
            unitario: it.unitario,
            total: 0,
            barrilLitros: it.barrilLitros,
          };
          cur.qtd += it.qtd;
          cur.total += it.subtotal;
          cur.unitario = it.unitario || cur.unitario;
          mapa.set(key, cur);
        });
      });
  }

  const linhas = Array.from(mapa.values()).map((it) => {
    if (!it.barrilLitros) return it;
    const litrosTag = `${it.barrilLitros}L`;
    const jaTemLitros = new RegExp(`\\b${it.barrilLitros}\\s*L\\b`, "i").test(it.nome);
    return {
      ...it,
      nome: jaTemLitros ? it.nome : `${it.nome} ${litrosTag}`,
    };
  });
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
