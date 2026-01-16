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
  const eventosMeta = loadJSON(LS_KEYS.eventosMeta, []);

  const metaEvento = useMemo(() => {
    if (!evento?.nome || !Array.isArray(eventosMeta)) return null;
    return eventosMeta.find((item) => norm(item?.nome) === norm(evento.nome)) || null;
  }, [eventosMeta, evento?.nome]);

  const fechamento = metaEvento?.fechamento || null;
  const usandoFechamento = Boolean(fechamento?.fechadoEm || metaEvento?.encerradoEm);

  const vendasEvento = vendas.filter((v) => {
    const matchId = evento?.id && v?.eventoId && v.eventoId === evento.id;
    const matchNome =
      norm(v?.eventoNome) && norm(evento?.nome) && norm(v.eventoNome) === norm(evento.nome);
    return matchId || matchNome;
  });

  const isMaster = permitirMultiDispositivo && config?.modoMulti === "master" && !usandoFechamento;
  const saleSummaries = useMemo(() => {
    if (!isMaster) return [];
    const raw = loadJSON(LS_KEYS.saleSummaries, []);
    return Array.isArray(raw) ? raw : [];
  }, [isMaster]);

  const saleSummariesEvento = useMemo(() => {
    if (!isMaster) return [];
    const nomeAtual = String(evento?.nome || "").trim();
    return saleSummaries.filter((summary) => {
      const matchId = evento?.id && summary?.eventoId && summary.eventoId === evento.id;
      const matchNome =
        norm(summary?.eventoNome) &&
        norm(evento?.nome) &&
        norm(summary.eventoNome) === norm(evento.nome);
      return (matchId || matchNome) && (!nomeAtual || norm(summary?.eventoNome) === norm(nomeAtual));
    });
  }, [evento?.id, evento?.nome, isMaster, saleSummaries]);

  const breakdownPorDevice = useMemo(() => {
    if (!isMaster) return [];
    const mapaDevices = new Map();
    saleSummariesEvento.forEach((summary) => {
      const key = String(summary?.deviceId || "unknown");
      const deviceName = String(summary?.deviceName || "Cliente");
      const current =
        mapaDevices.get(key) || {
          deviceId: key,
          deviceName,
          total: 0,
          vendas: 0,
          itensMap: new Map(),
        };
      current.deviceName = deviceName || current.deviceName;
      current.total += Number(summary?.total || 0) || 0;
      current.vendas += 1;
      extrairItensResumo(summary).forEach((it) => {
        if (!it.nome) return;
        const itemKey = it.barrilLitros ? `${it.nome}::${it.barrilLitros}` : it.nome;
        const itemAtual = current.itensMap.get(itemKey) || {
          nome: it.nome,
          qtd: 0,
          total: 0,
          barrilLitros: it.barrilLitros,
        };
        itemAtual.qtd += it.qtd;
        itemAtual.total += it.subtotal;
        current.itensMap.set(itemKey, itemAtual);
      });
      mapaDevices.set(key, current);
    });
    return Array.from(mapaDevices.values())
      .map((device) => {
        const itens = Array.from(device.itensMap.values())
          .map((it) => {
            if (!it.barrilLitros) return it;
            const litrosTag = `${it.barrilLitros}L`;
            const jaTemLitros = new RegExp(`\\b${it.barrilLitros}\\s*L\\b`, "i").test(it.nome);
            return {
              ...it,
              nome: jaTemLitros ? it.nome : `${it.nome} ${litrosTag}`,
            };
          })
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
        return {
          ...device,
          itens,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [isMaster, saleSummariesEvento]);

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
    saleSummariesEvento.forEach((summary) => {
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

  const linhasCalculadas = Array.from(mapa.values()).map((it) => {
    if (!it.barrilLitros) return it;
    const litrosTag = `${it.barrilLitros}L`;
    const jaTemLitros = new RegExp(`\\b${it.barrilLitros}\\s*L\\b`, "i").test(it.nome);
    return {
      ...it,
      nome: jaTemLitros ? it.nome : `${it.nome} ${litrosTag}`,
    };
  });
  const linhasFechamento = Array.isArray(fechamento?.itensGeral) ? fechamento.itensGeral : [];
  const linhas = usandoFechamento ? linhasFechamento : linhasCalculadas;
  const totalVendido = usandoFechamento
    ? Number(
        fechamento?.totalVendidoGeral ??
          linhasFechamento.reduce((s, l) => s + (Number(l?.total) || 0), 0)
      )
    : linhas.reduce((s, l) => s + l.total, 0);
  const abertura = usandoFechamento ? Number(fechamento?.abertura ?? 0) : Number(caixa?.abertura ?? 0);
  const totalGeral = abertura + totalVendido;
  const sangrias = usandoFechamento
    ? fechamento?.sangrias || []
    : (Array.isArray(caixa?.movimentos) ? caixa.movimentos : []).filter(
        (mov) => mov?.tipo === "sangria"
      );
  const totalSangrias = usandoFechamento
    ? Number(fechamento?.totalSangrias ?? 0)
    : sangrias.reduce((s, mov) => s + (Number(mov?.valor) || 0), 0);
  const saldoDinheiroFinal = usandoFechamento
    ? Number(fechamento?.saldoDinheiroFinal ?? 0)
    : abertura + totalVendido - totalSangrias;
  const porDeviceFechamento = Array.isArray(fechamento?.porDevice) ? fechamento.porDevice : [];

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
            <div className="miniCard">
              <div className="muted">Total de sangrias</div>
              <div className="big">{fmtBRL(totalSangrias)}</div>
            </div>
            <div className="miniCard">
              <div className="muted">Saldo final em dinheiro</div>
              <div className="big">{fmtBRL(saldoDinheiroFinal)}</div>
            </div>
          </div>

          <div className="hr" />

          <div className="muted" style={{ fontWeight: 900, marginBottom: 8 }}>
            Sangrias do evento
          </div>
          {sangrias.length === 0 ? (
            <div className="muted">Nenhuma sangria registrada.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sangrias.map((mov, index) => (
                <div key={mov?.id || `${mov?.criadoEm}-${index}`} className="row space">
                  <div style={{ fontWeight: 800 }}>Sangria {index + 1}</div>
                  <div style={{ fontWeight: 800 }}>{fmtBRL(Number(mov?.valor) || 0)}</div>
                </div>
              ))}
            </div>
          )}

          <div className="hr" />

          {usandoFechamento && porDeviceFechamento.length > 0 && (
            <>
              <div className="muted" style={{ fontWeight: 900, marginBottom: 8 }}>
                Por maquininha
              </div>
              <div style={{ display: "grid", gap: 16 }}>
                {porDeviceFechamento.map((device) => (
                  <div key={device.deviceId || device.deviceName} className="tableWrap">
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>
                      {device.deviceName || "Local"}
                      <span className="muted" style={{ marginLeft: 6, fontWeight: 700 }}>
                        ({device.deviceId || "local"})
                      </span>
                    </div>
                    <div className="row" style={{ flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
                      <div className="miniCard">
                        <div className="muted">Total</div>
                        <div className="big">{fmtBRL(Number(device.totalVendido || 0))}</div>
                      </div>
                    </div>
                    {device.itens?.length ? (
                      <table className="table" style={{ width: "100%" }}>
                        <thead>
                          <tr>
                            <th>Item</th>
                            <th style={{ width: 90, textAlign: "right" }}>Qtd.</th>
                            <th style={{ width: 120, textAlign: "right" }}>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {device.itens.map((item) => (
                            <tr key={`${device.deviceId}-${item.nome}`}>
                              <td style={{ fontWeight: 800 }}>{item.nome}</td>
                              <td style={{ textAlign: "right" }}>{item.qtd}</td>
                              <td style={{ textAlign: "right" }}>
                                {fmtBRL(Number(item.total || 0))}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="muted">Nenhum item registrado.</div>
                    )}
                  </div>
                ))}
              </div>
              <div className="hr" />
            </>
          )}

          {isMaster && (
            <>
              <div className="muted" style={{ fontWeight: 900, marginBottom: 8 }}>
                Por maquininha
              </div>

              {breakdownPorDevice.length === 0 ? (
                <div className="muted">Nenhuma venda recebida das maquininhas.</div>
              ) : (
                <div style={{ display: "grid", gap: 16 }}>
                  {breakdownPorDevice.map((device) => (
                    <div key={device.deviceId} className="tableWrap" style={{ padding: 12 }}>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>
                        {device.deviceName || "Cliente"}
                        <span className="muted" style={{ marginLeft: 6, fontWeight: 700 }}>
                          ({device.deviceId})
                        </span>
                      </div>
                      <div className="row" style={{ flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
                        <div className="miniCard">
                          <div className="muted">Total</div>
                          <div className="big">{fmtBRL(device.total)}</div>
                        </div>
                        <div className="miniCard">
                          <div className="muted">Vendas</div>
                          <div className="big">{device.vendas}</div>
                        </div>
                      </div>

                      <div className="muted" style={{ fontWeight: 900, marginBottom: 6 }}>
                        Top 5 itens
                      </div>
                      {device.itens.length === 0 ? (
                        <div className="muted">Nenhum item registrado.</div>
                      ) : (
                        <table className="table" style={{ width: "100%" }}>
                          <thead>
                            <tr>
                              <th>Item</th>
                              <th style={{ width: 90, textAlign: "right" }}>Qtd.</th>
                              <th style={{ width: 120, textAlign: "right" }}>Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {device.itens.map((item) => (
                              <tr key={`${device.deviceId}-${item.nome}`}>
                                <td style={{ fontWeight: 800 }}>{item.nome}</td>
                                <td style={{ textAlign: "right" }}>{item.qtd}</td>
                                <td style={{ textAlign: "right" }}>{fmtBRL(item.total)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="hr" />
            </>
          )}

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
                  {linhas.map((it) => {
                    const unitario = Number(it.unitario ?? it.preco ?? 0);
                    return (
                      <tr key={it.nome}>
                        <td style={{ fontWeight: 900 }}>{it.nome}</td>
                        <td style={{ textAlign: "right" }}>{it.qtd}</td>
                        <td style={{ textAlign: "right" }}>
                          {unitario > 0 ? fmtBRL(unitario) : "—"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 900 }}>
                          {fmtBRL(it.total)}
                        </td>
                      </tr>
                    );
                  })}
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