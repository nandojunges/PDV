// src/pages/Caixa.jsx
import React, { useMemo, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { fmtBRL, toNumBR } from "../domain/math";
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

export default function Caixa({
  evento = {},
  caixa,
  setCaixa = () => {},
  resumoEvento,
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

  const vendas = loadJSON(LS_KEYS.vendas, []);
  const eventoCache = loadJSON(LS_KEYS.evento, null);

  const vendasEvento = vendas.filter((v) => {
    if (eventoCache?.id && v?.eventoId) return v.eventoId === eventoCache.id;
    return (
      String(v?.eventoNome).toLowerCase() === String(eventoCache?.nome).toLowerCase()
    );
  });

  const totalDinheiroVendas = vendasEvento
    .filter((v) => {
      const p = String(v?.pagamento ?? v?.formaPagamento ?? "").toLowerCase();
      return p === "dinheiro" || p === "cash" || p === "";
    })
    .reduce((s, v) => s + Number(v?.total ?? v?.valorTotal ?? 0), 0);

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

    // ✅ o "zerar relatório" é o pai limpar o evento atual.
    // Aqui só disparamos o callback.
    if (typeof onFinalizarCaixa === "function") onFinalizarCaixa(fechamento);
  }

  return (
    <div className="split">
      <Card
        title="Caixa"
        subtitle="Abertura e encerramento do evento"
        right={
          <Button variant="danger" onClick={onZerarCaixa} disabled={disabled}>
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
    </div>
  );
}
