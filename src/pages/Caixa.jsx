// src/pages/Caixa.jsx
import React, { useMemo, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { fmtBRL, toNumBR } from "../domain/math";
import { imprimirTexto } from "../utils/androidPrinter";
import {
  REPORT_LINE_WIDTH,
  REPORT_SEPARATOR,
  centerText,
  formatRow,
  formatSectionTitle,
  joinLines,
} from "../services/reportText";
import { loadJSON, saveJSON } from "../storage/storage";
import { LS_KEYS } from "../storage/keys";

/* ===================== máscara de moeda (digit shifting) ===================== */
function onlyDigits(s) {
  return String(s || "").replace(/\D/g, "");
}
function maskBRLFromDigits(raw) {
  const d = onlyDigits(raw);
  const n = Number(d || "0");
  const cents = n % 100;
  const ints = Math.floor(n / 100);

  const intsFmt = String(ints).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const centsFmt = String(cents).padStart(2, "0");
  return `${intsFmt},${centsFmt}`;
}

/* ===================== storage: status do evento ===================== */
function loadEventosMeta() {
  const arr = loadJSON(LS_KEYS.eventosMeta, []);
  return Array.isArray(arr) ? arr : [];
}
function saveEventosMeta(arr) {
  saveJSON(LS_KEYS.eventosMeta, Array.isArray(arr) ? arr : []);
}

function norm(s) {
  return String(s ?? "").trim().toLowerCase();
}

function formatHora(iso) {
  const dt = new Date(iso || Date.now());
  if (Number.isNaN(dt.getTime())) return "--:--";
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
}

function formatDateTime(iso) {
  const dt = new Date(iso || Date.now());
  if (Number.isNaN(dt.getTime())) return "--/--/---- --:--";
  return dt.toLocaleString("pt-BR");
}

function normalizePayment(pagamentoRaw) {
  const p = String(pagamentoRaw ?? "").trim().toLowerCase();
  if (!p || p === "dinheiro" || p === "cash") return "dinheiro";
  if (p.includes("pix")) return "pix";
  if (p.includes("cart") || p.includes("card") || p.includes("credito") || p.includes("debito")) {
    return "cartao";
  }
  return "dinheiro";
}


function safeNum(value) {
  return Number(value) || 0;
}

function extractItensFromVenda(venda) {
  const itens =
    venda?.itens ??
    venda?.items ??
    venda?.produtos ??
    venda?.products ??
    venda?.carrinho ??
    venda?.cart ??
    [];
  if (!Array.isArray(itens)) return [];

  return itens
    .map((it) => {
      const nome =
        it?.nome ??
        it?.name ??
        it?.titulo ??
        it?.title ??
        it?.descricao ??
        it?.produto ??
        "";
      const qtd = safeNum(it?.qtd ?? it?.qty ?? it?.quantidade ?? it?.quantity) || 1;
      const total =
        safeNum(it?.subtotal ?? it?.total ?? it?.valorTotal ?? it?.valor_total ?? 0) || 0;
      let preco = safeNum(
        it?.unitario ??
          it?.preco ??
          it?.price ??
          it?.valor ??
          it?.unitPrice ??
          it?.precoUnit
      );
      if (!preco && total && qtd) {
        preco = total / qtd;
      }
      if (!nome || (!total && !preco)) return null;
      const totalFinal = total || preco * qtd;
      if (!Number.isFinite(totalFinal) || !Number.isFinite(preco)) return null;
      return {
        nome: String(nome).trim(),
        qtd: qtd || 1,
        preco,
        total: totalFinal,
      };
    })
    .filter(Boolean);
}

function aggregateItens(vendasLista) {
  const mapa = new Map();
  vendasLista.forEach((venda) => {
    extractItensFromVenda(venda).forEach((it) => {
      const nomeNormalizado = String(it.nome).trim().toLowerCase();
      const precoCentavos = Math.round(safeNum(it.preco) * 100);
      const key = `${nomeNormalizado}|${precoCentavos}`;
      const atual = mapa.get(key) || {
        nome: it.nome,
        preco: safeNum(it.preco),
        qtd: 0,
        total: 0,
      };
      atual.qtd += safeNum(it.qtd);
      atual.total += safeNum(it.total);
      mapa.set(key, atual);
    });
  });

  return Array.from(mapa.values()).sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (b.qtd !== a.qtd) return b.qtd - a.qtd;
    return a.nome.localeCompare(b.nome);
  });
}

function getDeviceInfo(venda) {
  const deviceId =
    venda?.deviceId ??
    venda?.deviceID ??
    venda?.device?.id ??
    venda?.maquininhaId ??
    "local";
  const deviceName =
    venda?.deviceName ??
    venda?.device?.name ??
    venda?.device?.label ??
    venda?.maquininhaName ??
    "Local";
  return {
    deviceId: String(deviceId || "local"),
    deviceName: String(deviceName || "Local"),
  };
}

function buildRelatorioText({
  eventoNome,
  abertoEm,
  fechadoEm,
  abertura,
  totalVendidoGeral,
  pagamentosGeral,
  itensGeral,
  sangrias,
  totalSangrias,
  saldoDinheiroFinal,
  porDevice,
}) {
  const agora = new Date();
  const lines = [];

  lines.push(centerText("RELATÓRIO DE FECHAMENTO", REPORT_LINE_WIDTH));
  lines.push(`Evento: ${eventoNome || "-"}`);
  lines.push(`Período: ${formatDateTime(abertoEm)} → ${formatDateTime(fechadoEm)}`);
  lines.push(REPORT_SEPARATOR);

  lines.push(formatSectionTitle("Resumo geral"));
  lines.push(...formatRow("Abertura", fmtBRL(safeNum(abertura))));
  lines.push(...formatRow("Total vendido", fmtBRL(safeNum(totalVendidoGeral))));
  lines.push(...formatRow("Dinheiro", fmtBRL(safeNum(pagamentosGeral?.dinheiro))));
  lines.push(...formatRow("Pix", fmtBRL(safeNum(pagamentosGeral?.pix))));
  lines.push(...formatRow("Cartão", fmtBRL(safeNum(pagamentosGeral?.cartao))));
  lines.push(REPORT_SEPARATOR);

  lines.push(formatSectionTitle("Sangrias"));
  if (sangrias && sangrias.length > 0) {
    sangrias.forEach((s, index) => {
      lines.push(...formatRow(`Sangria ${index + 1}`, fmtBRL(safeNum(s?.valor))));
    });
  } else {
    lines.push("Nenhuma sangria registrada.");
  }
  lines.push(...formatRow("Total sangrias", fmtBRL(safeNum(totalSangrias))));
  lines.push(...formatRow("Saldo final (dinheiro)", fmtBRL(safeNum(saldoDinheiroFinal))));
  lines.push(REPORT_SEPARATOR);

  lines.push(formatSectionTitle("Itens vendidos (geral)"));
  if (itensGeral && itensGeral.length > 0) {
    itensGeral.forEach((it) => {
      lines.push(...formatRow(`${it.nome} x${it.qtd}`, fmtBRL(safeNum(it.total))));
    });
  } else {
    lines.push("Nenhum item registrado.");
  }

  if (porDevice && porDevice.length > 0) {
    porDevice.forEach((device) => {
      const pagamentos = device?.pagamentos || {};
      lines.push(REPORT_SEPARATOR);
      lines.push(
        `Por maquininha: ${device.deviceName || "Local"} (${device.deviceId || "local"})`
      );
      lines.push(...formatRow("Total vendido", fmtBRL(safeNum(device.totalVendido))));
      lines.push(...formatRow("Dinheiro", fmtBRL(safeNum(pagamentos.dinheiro))));
      lines.push(...formatRow("Pix", fmtBRL(safeNum(pagamentos.pix))));
      lines.push(...formatRow("Cartão", fmtBRL(safeNum(pagamentos.cartao))));
      lines.push(formatSectionTitle("Itens vendidos"));
      if (device.itens && device.itens.length > 0) {
        device.itens.forEach((it) => {
          lines.push(...formatRow(`${it.nome} x${it.qtd}`, fmtBRL(safeNum(it.total))));
        });
      } else {
        lines.push("Nenhum item registrado.");
      }
    });
  }

  lines.push(REPORT_SEPARATOR);
  lines.push(`Impresso em: ${formatDateTime(agora.toISOString())}`);
  lines.push(centerText("FIM DO RELATÓRIO", REPORT_LINE_WIDTH));

  return joinLines(lines);
}

export default function Caixa({
  evento = {},
  caixa,
  setCaixa = () => {},
  resumoEvento,
  vendas = [],
  flowState,
  onAbrirCaixaOk,
  onZerarCaixa,
  onFinalizarCaixa,
  disabled = false,
}) {
  // ✅ blindagem
  const caixaSafe = caixa && typeof caixa === "object" ? caixa : {};
  const abertura = Number(caixaSafe.abertura || 0) || 0;
  const abertoEm = caixaSafe.abertoEm || null;
  const aberturaJaDefinida = abertura > 0;

  const eventoNome = String(evento?.nome || "").trim();
  const eventoAberto = Boolean(eventoNome);

  const vendasLista = Array.isArray(vendas) ? vendas : loadJSON(LS_KEYS.vendas, []);
  const eventoCache = loadJSON(LS_KEYS.evento, null);
  const eventoRef = eventoCache || evento;

  const vendasEvento = useMemo(() => {
    const lista = Array.isArray(vendasLista) ? vendasLista : [];
    return lista.filter((v) => {
      const matchId = eventoRef?.id && v?.eventoId && v.eventoId === eventoRef.id;
      const matchNome =
        norm(v?.eventoNome) &&
        norm(eventoRef?.nome) &&
        norm(v.eventoNome) === norm(eventoRef.nome);
      return matchId || matchNome;
    });
  }, [vendasLista, eventoRef?.id, eventoRef?.nome]);

  function totalFallback(v) {
    if (Number(v?.total)) return Number(v.total);
    const itens = v?.itens ?? v?.carrinho ?? [];
    if (!Array.isArray(itens)) return 0;
    return itens.reduce(
      (s, it) =>
        s +
        (Number(it?.subtotal) ||
          (Number(it?.qtd) || 0) * (Number(it?.unitario ?? it?.preco) || 0)),
      0
    );
  }

  const pagamentosGeral = useMemo(() => {
    return vendasEvento.reduce(
      (acc, venda) => {
        const tipo = normalizePayment(venda?.pagamento ?? venda?.formaPagamento);
        acc[tipo] += totalFallback(venda);
        return acc;
      },
      { dinheiro: 0, pix: 0, cartao: 0 }
    );
  }, [vendasEvento]);

  const totalVendidoGeral = useMemo(() => {
    return pagamentosGeral.dinheiro + pagamentosGeral.pix + pagamentosGeral.cartao;
  }, [pagamentosGeral]);

  const itensGeral = useMemo(() => aggregateItens(vendasEvento), [vendasEvento]);

  const porDevice = useMemo(() => {
    const mapa = new Map();
    vendasEvento.forEach((venda) => {
      const deviceInfo = getDeviceInfo(venda);
      const atual =
        mapa.get(deviceInfo.deviceId) || {
          deviceId: deviceInfo.deviceId,
          deviceName: deviceInfo.deviceName,
          totalVendido: 0,
          pagamentos: { dinheiro: 0, pix: 0, cartao: 0 },
          vendas: [],
        };
      atual.totalVendido += totalFallback(venda);
      const tipo = normalizePayment(venda?.pagamento ?? venda?.formaPagamento);
      atual.pagamentos[tipo] += totalFallback(venda);
      atual.vendas.push(venda);
      mapa.set(deviceInfo.deviceId, atual);
    });

    return Array.from(mapa.values())
      .map((device) => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        totalVendido: device.totalVendido,
        pagamentos: device.pagamentos,
        itens: aggregateItens(device.vendas),
      }))
      .sort((a, b) => b.totalVendido - a.totalVendido);
  }, [vendasEvento]);

  // ✅ campo abertura com máscara “shift”
  const [aberturaTxt, setAberturaTxt] = useState(() => {
    if (aberturaJaDefinida) {
      const cents = Math.round(abertura * 100);
      return maskBRLFromDigits(String(cents));
    }
    return "";
  });

  const aberturaValor = useMemo(() => {
    return Number(toNumBR(aberturaTxt) || 0) || 0;
  }, [aberturaTxt]);

  const entrouDinheiro = useMemo(() => pagamentosGeral.dinheiro, [pagamentosGeral]);
  const movimentos = useMemo(() => {
    return Array.isArray(caixaSafe.movimentos) ? caixaSafe.movimentos : [];
  }, [caixaSafe.movimentos]);
  const sangrias = useMemo(() => {
    return movimentos.filter((mov) => mov?.tipo === "sangria");
  }, [movimentos]);
  const totalSangrias = useMemo(() => {
    return sangrias.reduce((s, mov) => s + (Number(mov?.valor) || 0), 0);
  }, [sangrias]);
  const totalNoCaixaAgora = useMemo(() => {
    return abertura + entrouDinheiro - totalSangrias;
  }, [abertura, entrouDinheiro, totalSangrias]);

  const [sangriaTxt, setSangriaTxt] = useState("");
  const sangriaValor = useMemo(() => {
    return Number(toNumBR(sangriaTxt) || 0) || 0;
  }, [sangriaTxt]);

  function abrirCaixa() {
    if (disabled) return;
    if (!eventoAberto) return alert("Abra um evento antes de abrir o caixa.");
    if (aberturaValor <= 0) return alert("Informe um valor válido para abrir o caixa.");

    setCaixa((prev) => ({
      ...(prev && typeof prev === "object" ? prev : {}),
      abertura: aberturaValor,
      abertoEm: prev?.abertoEm || new Date().toISOString(),
    }));

    if (typeof onAbrirCaixaOk === "function") onAbrirCaixaOk();
  }

  function getCaixaStorageKey() {
    if (LS_KEYS?.caixa) return LS_KEYS.caixa;
    if (LS_KEYS?.caixaAtual) return LS_KEYS.caixaAtual;
    return "caixa";
  }

  function createMovimentoId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function adicionarSangria() {
    if (disabled) return;
    if (!eventoAberto) return alert("Abra um evento antes de lançar sangria.");
    if (!aberturaJaDefinida) return alert("Abra o caixa antes de lançar sangria.");
    if (sangriaValor <= 0) return alert("Informe um valor válido para a sangria.");

    const novoMovimento = {
      id: createMovimentoId(),
      tipo: "sangria",
      valor: sangriaValor,
      criadoEm: new Date().toISOString(),
    };

    setCaixa((prev) => {
      const prevSafe = prev && typeof prev === "object" ? prev : {};
      const prevMovimentos = Array.isArray(prevSafe.movimentos)
        ? prevSafe.movimentos
        : [];
      const nextCaixa = {
        ...prevSafe,
        movimentos: [...prevMovimentos, novoMovimento],
      };
      saveJSON(getCaixaStorageKey(), nextCaixa);
      return nextCaixa;
    });
    setSangriaTxt("");
  }

  function removerSangria(id) {
    if (disabled) return;
    setCaixa((prev) => {
      const prevSafe = prev && typeof prev === "object" ? prev : {};
      const prevMovimentos = Array.isArray(prevSafe.movimentos)
        ? prevSafe.movimentos
        : [];
      const nextMovimentos = prevMovimentos.filter((mov) => mov?.id !== id);
      const nextCaixa = {
        ...prevSafe,
        movimentos: nextMovimentos,
      };
      saveJSON(getCaixaStorageKey(), nextCaixa);
      return nextCaixa;
    });
  }

  async function finalizarCaixa() {
    if (disabled) return;
    if (!eventoAberto) return alert("Abra um evento antes de finalizar.");
    if (!aberturaJaDefinida) return alert("Abra o caixa antes de finalizar.");

    const fecharAgora = new Date().toISOString();
    const totalSangriasSafe = Number(totalSangrias || 0) || 0;
    const saldoDinheiroFinal =
      Number(abertura || 0) + Number(pagamentosGeral.dinheiro || 0) - totalSangriasSafe;

    // ✅ snapshot simples do fechamento (sem itens)
    const fechamento = {
      eventoNome,
      abertoEm: abertoEm || null,
      fechadoEm: fecharAgora,
      abertura: Number(abertura || 0) || 0,
      entrouDinheiro: Number(entrouDinheiro || 0) || 0,
      totalNoCaixa: Number(totalNoCaixaAgora || 0) || 0,
      totalVendidoGeral: Number(totalVendidoGeral || 0) || 0,
      pagamentosGeral: {
        dinheiro: Number(pagamentosGeral.dinheiro || 0) || 0,
        pix: Number(pagamentosGeral.pix || 0) || 0,
        cartao: Number(pagamentosGeral.cartao || 0) || 0,
      },
      itensGeral: itensGeral.map((it) => ({
        nome: it.nome,
        preco: Number(it.preco || 0) || 0,
        qtd: Number(it.qtd || 0) || 0,
        total: Number(it.total || 0) || 0,
      })),
      porDevice: porDevice.map((device) => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        totalVendido: Number(device.totalVendido || 0) || 0,
        pagamentos: {
          dinheiro: Number(device.pagamentos?.dinheiro || 0) || 0,
          pix: Number(device.pagamentos?.pix || 0) || 0,
          cartao: Number(device.pagamentos?.cartao || 0) || 0,
        },
        itens: (device.itens || []).map((it) => ({
          nome: it.nome,
          preco: Number(it.preco || 0) || 0,
          qtd: Number(it.qtd || 0) || 0,
          total: Number(it.total || 0) || 0,
        })),
      })),
      sangrias: sangrias.map((mov) => ({
        id: mov?.id,
        valor: Number(mov?.valor) || 0,
        criadoEm: mov?.criadoEm || null,
      })),
      totalSangrias: totalSangriasSafe,
      saldoDinheiroFinal,
    };

    // ✅ marca no cache como ENCERRADO
    const meta = loadEventosMeta();
    // remove registro antigo do mesmo nome (evita duplicar)
    const semEsse = meta.filter((x) => String(x?.nome || "").trim() !== eventoNome);
    semEsse.unshift({
      nome: eventoNome,
      encerradoEm: fecharAgora,
      fechamento,
    });
    saveEventosMeta(semEsse);

    setCaixa((prev) => ({
      ...(prev && typeof prev === "object" ? prev : {}),
      encerradoEm: fecharAgora,
    }));

    const cfg = loadJSON(LS_KEYS.config, loadJSON(LS_KEYS.ajustes, {}));
    const isMaster = cfg?.modoMulti !== "client";
    if (isMaster) {
      const texto = buildRelatorioText({
        eventoNome,
        abertoEm: fechamento.abertoEm,
        fechadoEm: fechamento.fechadoEm,
        abertura: fechamento.abertura,
        totalVendidoGeral: fechamento.totalVendidoGeral,
        pagamentosGeral: fechamento.pagamentosGeral,
        itensGeral: fechamento.itensGeral,
        sangrias: fechamento.sangrias,
        totalSangrias: fechamento.totalSangrias,
        saldoDinheiroFinal: fechamento.saldoDinheiroFinal,
        porDevice: fechamento.porDevice,
      });
      const resultado = await imprimirTexto(texto);
      if (!resultado?.ok) {
        const erroMsg = resultado?.error ? ` (${resultado.error})` : "";
        alert(`Não foi possível imprimir o relatório.${erroMsg}`);
      }
    }

    // ✅ o "zerar relatório" é o pai limpar o evento atual.
    // Aqui só disparamos o callback.
    if (typeof onFinalizarCaixa === "function") onFinalizarCaixa(fechamento);
  }

  const bloqueiaZerarCaixa =
    vendasEvento.length > 0 || flowState === "CAIXA_ABERTO";

  return (
    <div className="split caixaRoot">
      <style>{`
        .caixaRoot input,
        .caixaRoot select,
        .caixaRoot textarea {
          font-size: 16px;
        }
      `}</style>
      <Card
        title="Caixa"
        subtitle="Abertura e encerramento do evento"
        right={
          <Button
            variant="danger"
            onClick={onZerarCaixa}
            disabled={disabled || bloqueiaZerarCaixa}
          >
            Zerar caixa
          </Button>
        }
      >
        {disabled && (
          <>
            <div className="hr" />
            <div className="muted">Abra um evento para usar o Caixa.</div>
          </>
        )}

        <div className="hr" />

        {/* ===================== ABRIR CAIXA ===================== */}
        <div className="muted" style={{ marginBottom: 8, fontWeight: 900 }}>
          Abertura do caixa
        </div>

        <div className="formGrid">
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Valor (R$)
            </div>
            <input
              className="input"
              placeholder="0,00"
              value={aberturaTxt}
              onChange={(e) => setAberturaTxt(maskBRLFromDigits(e.target.value))}
              inputMode="numeric"
              disabled={disabled || aberturaJaDefinida}
            />
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              Dica: digite apenas números. Ex.: 5 → 0,05 | 50000 → 500,00
            </div>
          </div>

          <div className="formActions">
            <Button
              variant="primary"
              onClick={abrirCaixa}
              disabled={disabled || aberturaJaDefinida || aberturaValor <= 0 || !eventoAberto}
            >
              Abrir caixa
            </Button>
          </div>
        </div>

        <div className="hr" />

        {/* ===================== RESUMO DO CAIXA (SÓ DINHEIRO) ===================== */}
        <div className="row space">
          <div style={{ fontWeight: 900 }}>Abertura</div>
          <div style={{ fontWeight: 900 }}>{fmtBRL(abertura)}</div>
        </div>

        <div className="row space">
          <div className="muted">Entrou em dinheiro (vendas)</div>
          <div style={{ fontWeight: 900 }}>{fmtBRL(entrouDinheiro)}</div>
        </div>

        <div className="row space" style={{ marginTop: 4 }}>
          <div style={{ fontWeight: 900 }}>Total em caixa</div>
          <div style={{ fontWeight: 900, fontSize: 18 }}>{fmtBRL(totalNoCaixaAgora)}</div>
        </div>

        <div className="hr" />

        {/* ===================== SANGRIAS ===================== */}
        <div className="muted" style={{ marginBottom: 8, fontWeight: 900 }}>
          Sangrias
        </div>

        <div className="formGrid">
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Valor (R$)
            </div>
            <input
              className="input"
              placeholder="0,00"
              value={sangriaTxt}
              onChange={(e) => setSangriaTxt(maskBRLFromDigits(e.target.value))}
              inputMode="numeric"
              disabled={disabled || !aberturaJaDefinida || !eventoAberto}
            />
            <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>
              Dica: digite apenas números. Ex.: 5 → 0,05 | 50000 → 500,00
            </div>
          </div>

          <div className="formActions">
            <Button
              variant="primary"
              onClick={adicionarSangria}
              disabled={
                disabled ||
                !aberturaJaDefinida ||
                !eventoAberto ||
                sangriaValor <= 0
              }
            >
              Adicionar sangria
            </Button>
          </div>
        </div>

        {sangrias.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sangrias.map((mov, index) => (
              <div key={mov?.id || `${mov?.criadoEm}-${index}`} className="row space">
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ fontWeight: 900 }}>Sangria {index + 1}</div>
                  <div className="muted">
                    {fmtBRL(Number(mov?.valor) || 0)} • {formatHora(mov?.criadoEm)}
                  </div>
                </div>

                <Button
                  variant="ghost"
                  small
                  onClick={() => removerSangria(mov?.id)}
                  disabled={disabled}
                >
                  Remover
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">Nenhuma sangria lançada.</div>
        )}

        <div className="row space" style={{ marginTop: 4 }}>
          <div className="muted" style={{ fontWeight: 900 }}>
            Total de sangrias
          </div>
          <div style={{ fontWeight: 900 }}>{fmtBRL(totalSangrias)}</div>
        </div>

        <div className="hr" />

        {/* ===================== FINALIZAR ===================== */}
        <div className="row space">
          <div className="muted" style={{ fontWeight: 900 }}>
            Encerramento
          </div>

          <Button
            variant="primary"
            onClick={finalizarCaixa}
            disabled={disabled || !aberturaJaDefinida || !eventoAberto}
          >
            Finalizar caixa
          </Button>
        </div>

        <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          Ao finalizar: o evento fica marcado como encerrado e o sistema deve limpar o evento atual (Relatório zera).
        </div>
      </Card>
    </div>
  );
}