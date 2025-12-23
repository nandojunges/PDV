// src/pages/Caixa.jsx
import React, { useMemo, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { fmtBRL, toNumBR } from "../domain/math";
import { loadJSON, saveJSON } from "../storage/storage";
import { LS_KEYS } from "../storage/keys";
import { expandirItensParaTickets, printTickets } from "./Venda";

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

function getVendaDate(venda) {
  return (
    venda?.criadoEm ||
    venda?.createdAt ||
    venda?.data ||
    venda?.created_at ||
    venda?.created ||
    null
  );
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

  const vendasRecentes = useMemo(() => {
    const ordenadas = [...vendasEvento].sort((a, b) => {
      const dataA = new Date(getVendaDate(a) || 0).getTime();
      const dataB = new Date(getVendaDate(b) || 0).getTime();
      return dataB - dataA;
    });
    return ordenadas.slice(0, 10);
  }, [vendasEvento]);

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

  const totalDinheiroVendas = vendasEvento
    .filter((v) => {
      const p = String(v?.pagamento ?? v?.formaPagamento ?? "").toLowerCase();
      return p === "dinheiro" || p === "cash" || p === "";
    })
    .reduce((s, v) => s + totalFallback(v), 0);

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

  const entrouDinheiro = useMemo(() => totalDinheiroVendas, [totalDinheiroVendas]);
  const totalNoCaixaAgora = useMemo(() => abertura + entrouDinheiro, [abertura, entrouDinheiro]);

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

  function finalizarCaixa() {
    if (disabled) return;
    if (!eventoAberto) return alert("Abra um evento antes de finalizar.");
    if (!aberturaJaDefinida) return alert("Abra o caixa antes de finalizar.");

    const fecharAgora = new Date().toISOString();

    // ✅ snapshot simples do fechamento (sem itens)
    const fechamento = {
      eventoNome,
      abertoEm: abertoEm || null,
      fechadoEm: fecharAgora,
      abertura: Number(abertura || 0) || 0,
      entrouDinheiro: Number(entrouDinheiro || 0) || 0,
      totalNoCaixa: Number(totalNoCaixaAgora || 0) || 0,
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

    // ✅ o "zerar relatório" é o pai limpar o evento atual.
    // Aqui só disparamos o callback.
    if (typeof onFinalizarCaixa === "function") onFinalizarCaixa(fechamento);
  }

  const bloqueiaZerarCaixa =
    vendasEvento.length > 0 || flowState === "CAIXA_ABERTO";

  function reimprimirVenda(venda) {
    if (!venda?.itens?.length) return;
    const tickets = expandirItensParaTickets(venda.itens);
    const ajustes = loadJSON(LS_KEYS.ajustes, {});
    printTickets({
      eventoNome: venda.eventoNome || evento.nome,
      dataISO: venda.criadoEm || venda.createdAt || new Date().toISOString(),
      tickets,
      mensagemRodape: ajustes?.textoRodape || "Obrigado pela preferência!",
      logoDataUrl: ajustes?.logoDataUrl || "",
      logoAlturaMm: Number(ajustes?.logoImgMm || 20),
    });
  }

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

      <Card title="Últimas vendas" subtitle="Reimprima se a impressora falhar.">
        {!eventoAberto ? (
          <div className="muted">Abra um evento para ver as últimas vendas.</div>
        ) : vendasRecentes.length === 0 ? (
          <div className="muted">Nenhuma venda registrada neste evento.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {vendasRecentes.map((venda, index) => {
              const dataISO = getVendaDate(venda);
              const hora = formatHora(dataISO);
              const totalVenda = Number(venda?.total || 0) || 0;
              const pagamento = String(venda?.pagamento || "dinheiro");
              const podeReimprimir = Array.isArray(venda?.itens) && venda.itens.length > 0;
              return (
                <div
                  key={venda?.id || `${dataISO || "sem-data"}-${index}`}
                  className="row space"
                  style={{
                    paddingBottom: 10,
                    borderBottom: "1px solid #e5e7eb",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <div style={{ fontWeight: 900 }}>{hora}</div>
                      {index === 0 && <span className="badge">ÚLTIMA</span>}
                    </div>
                    <div className="muted">
                      {fmtBRL(totalVenda)} • {pagamento}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    small
                    onClick={() => reimprimirVenda(venda)}
                    disabled={disabled || !podeReimprimir}
                    title={
                      podeReimprimir
                        ? "Reimprimir tickets"
                        : "Venda sem itens para reimprimir"
                    }
                  >
                    Reimprimir
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
