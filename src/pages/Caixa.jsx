// src/pages/Caixa.jsx
import React, { useMemo, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { fmtBRL, toNumBR } from "../domain/math";
import { imprimirTexto } from "../utils/sunmiPrinter";
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

/* ===================== CONSTANTES ===================== */
const REPORT_WIDTH = 32;

/* ===================== HELPERS ===================== */
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
  const itens = venda?.itens ?? venda?.items ?? venda?.produtos ?? venda?.products ?? venda?.carrinho ?? venda?.cart ?? [];
  if (!Array.isArray(itens)) return [];

  return itens
    .map((it) => {
      const nome = it?.nome ?? it?.name ?? it?.titulo ?? it?.title ?? it?.descricao ?? it?.produto ?? "";
      const qtd = safeNum(it?.qtd ?? it?.qty ?? it?.quantidade ?? it?.quantity) || 1;
      const total = safeNum(it?.subtotal ?? it?.total ?? it?.valorTotal ?? it?.valor_total ?? 0) || 0;
      let preco = safeNum(it?.unitario ?? it?.preco ?? it?.price ?? it?.valor ?? it?.unitPrice ?? it?.precoUnit);
      if (!preco && total && qtd) preco = total / qtd;
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
  const deviceId = venda?.deviceId ?? venda?.deviceID ?? venda?.device?.id ?? venda?.maquininhaId ?? "local";
  const deviceName = venda?.deviceName ?? venda?.device?.name ?? venda?.device?.label ?? venda?.maquininhaName ?? "Local";
  return {
    deviceId: String(deviceId || "local"),
    deviceName: String(deviceName || "Local"),
  };
}

// 🔥 FUNÇÃO CORRIGIDA - RELATÓRIO MAIS LIMPO
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
}) {
  const agora = new Date();
  const lines = [];

  // 🔥 CABEÇALHO
  lines.push(centerText("FECHAMENTO DE CAIXA", REPORT_WIDTH));
  lines.push(centerText(eventoNome || "EVENTO", REPORT_WIDTH));
  lines.push(REPORT_SEPARATOR);
  lines.push(`Período: ${formatDateTime(abertoEm)} → ${formatDateTime(fechadoEm)}`);
  lines.push(REPORT_SEPARATOR);

  // 🔥 RESUMO GERAL (simplificado)
  lines.push(formatSectionTitle("RESUMO"));
  lines.push(...formatRow("Abertura", fmtBRL(safeNum(abertura))));
  lines.push(...formatRow("Total vendido", fmtBRL(safeNum(totalVendidoGeral))));
  lines.push(REPORT_SEPARATOR);

  // 🔥 PAGAMENTOS (consolidado)
  lines.push(formatSectionTitle("PAGAMENTOS"));
  lines.push(...formatRow("Dinheiro", fmtBRL(safeNum(pagamentosGeral?.dinheiro))));
  lines.push(...formatRow("Pix", fmtBRL(safeNum(pagamentosGeral?.pix))));
  lines.push(...formatRow("Cartão", fmtBRL(safeNum(pagamentosGeral?.cartao))));
  lines.push(REPORT_SEPARATOR);

  // 🔥 SANGRIAS
  lines.push(formatSectionTitle("SANGRIAS"));
  if (sangrias && sangrias.length > 0) {
    sangrias.forEach((s, index) => {
      lines.push(...formatRow(`Sangria ${index + 1}`, fmtBRL(safeNum(s?.valor))));
    });
    lines.push(...formatRow("Total sangrias", fmtBRL(safeNum(totalSangrias))));
    lines.push(...formatRow("Saldo final (dinheiro)", fmtBRL(safeNum(saldoDinheiroFinal))));
  } else {
    lines.push("Nenhuma sangria registrada.");
    lines.push(...formatRow("Saldo final", fmtBRL(safeNum(saldoDinheiroFinal))));
  }
  lines.push(REPORT_SEPARATOR);

  // 🔥 ITENS VENDIDOS (apenas uma vez)
  lines.push(formatSectionTitle("ITENS VENDIDOS"));
  if (itensGeral && itensGeral.length > 0) {
    itensGeral.forEach((it) => {
      lines.push(...formatRow(`${it.nome} x${it.qtd}`, fmtBRL(safeNum(it.total))));
    });
  } else {
    lines.push("Nenhum item registrado.");
  }
  lines.push(REPORT_SEPARATOR);

  // 🔥 RODAPÉ
  lines.push(`Impresso em: ${formatDateTime(agora.toISOString())}`);
  lines.push(centerText("FIM DO RELATÓRIO", REPORT_WIDTH));

  return joinLines(lines);
}

async function printSunmi(texto) {
  return imprimirTexto(texto);
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
  // ==================== ESTADOS ====================
  const [aberturaTxt, setAberturaTxt] = useState("");
  const [sangriaTxt, setSangriaTxt] = useState("");
  const [aviso, setAviso] = useState({ type: "", message: "" });

  // ==================== MEMOIZED VALUES ====================
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
      const matchNome = norm(v?.eventoNome) && norm(eventoRef?.nome) && norm(v.eventoNome) === norm(eventoRef.nome);
      return matchId || matchNome;
    });
  }, [vendasLista, eventoRef?.id, eventoRef?.nome]);

  function totalFallback(v) {
    if (Number(v?.total)) return Number(v.total);
    const itens = v?.itens ?? v?.carrinho ?? [];
    if (!Array.isArray(itens)) return 0;
    return itens.reduce(
      (s, it) => s + (Number(it?.subtotal) || (Number(it?.qtd) || 0) * (Number(it?.unitario ?? it?.preco) || 0)),
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

  const sangriaValor = useMemo(() => {
    return Number(toNumBR(sangriaTxt) || 0) || 0;
  }, [sangriaTxt]);

  const bloqueiaZerarCaixa = vendasEvento.length > 0 || flowState === "CAIXA_ABERTO";

  // ==================== FUNÇÕES ====================
  function abrirCaixa() {
    if (disabled) return;
    if (!eventoAberto) {
      setAviso({ type: "warning", message: "Abra um evento primeiro." });
      return;
    }
    if (aberturaValor <= 0) {
      setAviso({ type: "warning", message: "Informe um valor válido." });
      return;
    }

    setCaixa((prev) => ({
      ...(prev && typeof prev === "object" ? prev : {}),
      abertura: aberturaValor,
      abertoEm: prev?.abertoEm || new Date().toISOString(),
    }));

    setAviso({ type: "success", message: "Caixa aberto com sucesso!" });
    if (typeof onAbrirCaixaOk === "function") onAbrirCaixaOk();
  }

  function getCaixaStorageKey() {
    return LS_KEYS?.caixa || LS_KEYS?.caixaAtual || "caixa";
  }

  function createMovimentoId() {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function adicionarSangria() {
    if (disabled) return;
    if (!eventoAberto) {
      setAviso({ type: "warning", message: "Abra um evento primeiro." });
      return;
    }
    if (!aberturaJaDefinida) {
      setAviso({ type: "warning", message: "Abra o caixa primeiro." });
      return;
    }
    if (sangriaValor <= 0) {
      setAviso({ type: "warning", message: "Valor inválido." });
      return;
    }

    const novoMovimento = {
      id: createMovimentoId(),
      tipo: "sangria",
      valor: sangriaValor,
      criadoEm: new Date().toISOString(),
    };

    setCaixa((prev) => {
      const prevSafe = prev && typeof prev === "object" ? prev : {};
      const prevMovimentos = Array.isArray(prevSafe.movimentos) ? prevSafe.movimentos : [];
      const nextCaixa = { ...prevSafe, movimentos: [...prevMovimentos, novoMovimento] };
      saveJSON(getCaixaStorageKey(), nextCaixa);
      return nextCaixa;
    });
    
    setSangriaTxt("");
    setAviso({ type: "success", message: "Sangria registrada!" });
  }

  function removerSangria(id) {
    if (disabled) return;
    setCaixa((prev) => {
      const prevSafe = prev && typeof prev === "object" ? prev : {};
      const prevMovimentos = Array.isArray(prevSafe.movimentos) ? prevSafe.movimentos : [];
      const nextMovimentos = prevMovimentos.filter((mov) => mov?.id !== id);
      const nextCaixa = { ...prevSafe, movimentos: nextMovimentos };
      saveJSON(getCaixaStorageKey(), nextCaixa);
      return nextCaixa;
    });
    setAviso({ type: "info", message: "Sangria removida." });
  }

  async function finalizarCaixa() {
    if (disabled) return;
    if (!eventoAberto) {
      setAviso({ type: "warning", message: "Abra um evento primeiro." });
      return;
    }
    if (!aberturaJaDefinida) {
      setAviso({ type: "warning", message: "Abra o caixa primeiro." });
      return;
    }

    const fecharAgora = new Date().toISOString();
    const totalSangriasSafe = Number(totalSangrias || 0) || 0;
    const saldoDinheiroFinal = Number(abertura || 0) + Number(pagamentosGeral.dinheiro || 0) - totalSangriasSafe;

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
      sangrias: sangrias.map((mov) => ({
        id: mov?.id,
        valor: Number(mov?.valor) || 0,
        criadoEm: mov?.criadoEm || null,
      })),
      totalSangrias: totalSangriasSafe,
      saldoDinheiroFinal,
    };

    const meta = loadEventosMeta();
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

    // 🔥 IMPRIMIR RELATÓRIO LIMPO
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
    });

    try {
      await printSunmi(texto);
      setAviso({ type: "success", message: "Caixa finalizado com sucesso!" });
    } catch (error) {
      setAviso({ type: "error", message: `Erro ao imprimir: ${error?.message || "desconhecido"}` });
    }

    if (typeof onFinalizarCaixa === "function") onFinalizarCaixa(fechamento);
  }

  // ==================== ESTILOS ====================
  const styles = {
    alert: {
      info: { background: "#e0f2fe", color: "#0369a1", border: "1px solid #7dd3fc" },
      success: { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" },
      warning: { background: "#fef9c3", color: "#854d0e", border: "1px solid #fde047" },
      error: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" },
    },
  };

  return (
    <div className="caixa-container">
      <style>{`
        .caixa-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 12px;
        }
        .caixa-container input,
        .caixa-container select,
        .caixa-container textarea {
          font-size: 16px;
        }
        .formGrid {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: end;
        }
        @media (max-width: 640px) {
          .formGrid {
            grid-template-columns: 1fr;
          }
        }
        .formActions {
          display: flex;
          justify-content: flex-end;
        }
        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
        }
        .hr {
          height: 1px;
          background: #e5e7eb;
          margin: 16px 0;
        }
        .muted {
          color: #6b7280;
          font-size: 13px;
        }
        .badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 700;
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          color: #4b5563;
        }
        .alert {
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-weight: 500;
          animation: slideIn 0.3s ease;
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 15px;
          outline: none;
          transition: border-color 0.2s ease;
        }
        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
        }
        .input:disabled {
          background: #f3f4f6;
          cursor: not-allowed;
        }
        .sangria-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e5e7eb;
          margin-bottom: 8px;
        }
      `}</style>

      {/* Alerta */}
      {aviso.message && (
        <div className="alert" style={styles.alert[aviso.type]}>
          {aviso.message}
        </div>
      )}

      <Card
        title="Caixa"
        subtitle="Abertura e encerramento do evento"
        right={
          <Button
            variant="danger"
            onClick={onZerarCaixa}
            disabled={disabled || bloqueiaZerarCaixa}
            small
          >
            Zerar
          </Button>
        }
      >
        {disabled && (
          <div className="badge" style={{ marginBottom: 16, background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }}>
            ⚠️ Abra um evento para usar o Caixa
          </div>
        )}

        <div className="hr" />

        {/* ABERTURA DO CAIXA */}
        <div>
          <div className="muted" style={{ marginBottom: 8, fontWeight: 700 }}>
            Abertura do caixa
          </div>

          <div className="formGrid">
            <div>
              <input
                className="input"
                placeholder="Valor inicial (R$)"
                value={aberturaTxt}
                onChange={(e) => setAberturaTxt(maskBRLFromDigits(e.target.value))}
                inputMode="numeric"
                disabled={disabled || aberturaJaDefinida}
              />
              <div className="muted" style={{ marginTop: 4, fontSize: 11 }}>
                Digite apenas números (ex: 5000 = R$ 50,00)
              </div>
            </div>

            <Button
              variant="primary"
              onClick={abrirCaixa}
              disabled={disabled || aberturaJaDefinida || aberturaValor <= 0 || !eventoAberto}
              small
            >
              Abrir caixa
            </Button>
          </div>
        </div>

        <div className="hr" />

        {/* RESUMO DO CAIXA */}
        <div>
          <div className="row">
            <span style={{ fontWeight: 600 }}>Abertura</span>
            <span style={{ fontWeight: 700 }}>{fmtBRL(abertura)}</span>
          </div>
          <div className="row">
            <span className="muted">Entrada em dinheiro</span>
            <span style={{ fontWeight: 600 }}>{fmtBRL(entrouDinheiro)}</span>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 16 }}>Total em caixa</span>
            <span style={{ fontWeight: 900, fontSize: 18, color: "#2563eb" }}>
              {fmtBRL(totalNoCaixaAgora)}
            </span>
          </div>
        </div>

        <div className="hr" />

        {/* SANGRIAS */}
        <div>
          <div className="muted" style={{ marginBottom: 8, fontWeight: 700 }}>
            Sangrias
          </div>

          <div className="formGrid" style={{ marginBottom: 12 }}>
            <div>
              <input
                className="input"
                placeholder="Valor da sangria"
                value={sangriaTxt}
                onChange={(e) => setSangriaTxt(maskBRLFromDigits(e.target.value))}
                inputMode="numeric"
                disabled={disabled || !aberturaJaDefinida || !eventoAberto}
              />
            </div>

            <Button
              variant="primary"
              onClick={adicionarSangria}
              disabled={disabled || !aberturaJaDefinida || !eventoAberto || sangriaValor <= 0}
              small
            >
              Adicionar
            </Button>
          </div>

          {sangrias.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              {sangrias.map((mov, index) => (
                <div key={mov?.id || index} className="sangria-item">
                  <div>
                    <div style={{ fontWeight: 600 }}>Sangria {index + 1}</div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {fmtBRL(Number(mov?.valor) || 0)} • {formatHora(mov?.criadoEm)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    small
                    onClick={() => removerSangria(mov?.id)}
                    disabled={disabled}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              
              <div className="row" style={{ marginTop: 8 }}>
                <span className="muted" style={{ fontWeight: 600 }}>Total sangrias</span>
                <span style={{ fontWeight: 700 }}>{fmtBRL(totalSangrias)}</span>
              </div>
            </div>
          ) : (
            <div className="muted" style={{ textAlign: "center", padding: 12 }}>
              Nenhuma sangria registrada
            </div>
          )}
        </div>

        <div className="hr" />

        {/* ENCERRAMENTO */}
        <div className="row">
          <span className="muted" style={{ fontWeight: 700 }}>Encerramento</span>
          <Button
            variant="primary"
            onClick={finalizarCaixa}
            disabled={disabled || !aberturaJaDefinida || !eventoAberto}
          >
            Finalizar caixa
          </Button>
        </div>

        <div className="muted" style={{ marginTop: 12, fontSize: 11, textAlign: "center" }}>
          Ao finalizar, o evento será encerrado e o relatório impresso
        </div>
      </Card>
    </div>
  );
}