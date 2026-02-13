// src/app/App.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import TopBar from "../components/TopBar";
import Button from "../components/Button";

import Evento from "../pages/Evento";
import Produtos from "../pages/Produtos";
import Venda from "../pages/Venda";
import Caixa from "../pages/Caixa";
import Relatorio from "../pages/Relatorio";
import Ajustes from "../pages/Ajustes";

import { LS_KEYS } from "../storage/keys";
import { loadJSON, saveJSON } from "../storage/storage";
import { ensureMigrations } from "../storage/migrate";
import { resumoFinanceiroPorEvento } from "../domain/pos";
import { getAllowedTabs, getFlowState } from "../domain/eventoFlow";
import { stopMasterServer, postSaleToMaster, syncFromMaster } from "../net/connectivity";
import { useConfig } from "../config/ConfigProvider";
import {
  buildSaleSummaryFromSale,
  getOrCreateDeviceId,
  readPendingSales,
  removePendingSaleById,
} from "../state/pdvStore";
import { logSunmiPrinterStatus } from "../utils/sunmiPrinter";

export default function App() {
  const { config, permitirMultiDispositivo } = useConfig();
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);
  const deviceName = useMemo(() => {
    if (typeof navigator === "undefined") return "Cliente";
    return navigator?.userAgent || "Cliente";
  }, []);

  useEffect(() => {
    ensureMigrations();
  }, []);

  useEffect(() => {
    logSunmiPrinterStatus();
  }, []);

  function getFlowTargetTab(flowValue) {
    if (flowValue === "ITENS_NAO_FINALIZADOS") return "produtos";
    if (flowValue === "EVENTO_ABERTO_SEM_PRODUTOS") return "produtos";
    if (flowValue === "PRODUTOS_FINALIZADOS") return "ajustes";
    if (flowValue === "AJUSTES_CONFIRMADOS") return "caixa";
    if (flowValue === "CAIXA_ABERTO") return "venda";
    return "evento";
  }

  const [tab, setTab] = useState("evento");
  const [tabNotice, setTabNotice] = useState("");
  const [etapaAtual, setEtapaAtual] = useState("evento");
  const [etapaHistorico, setEtapaHistorico] = useState([]);

  const [evento, setEvento] = useState(() => {
    const raw = loadJSON(LS_KEYS.evento, null);
    if (raw === null) return null;
    const fallback = {
      nome: "",
      abertoEm: null,
      produtos: [],
      modo: "local",
      rede: null,
      itensFinalizados: false,
      produtosConfirmados: false,
      ajustesSalvos: false,
      ajustesConfirmados: false,
      caixaAberto: false,
    };
    if (!raw || typeof raw !== "object") return fallback;
    return {
      ...fallback,
      ...raw,
      modo: raw?.modo || "local",
      rede: raw?.rede || null,
      itensFinalizados: Boolean(raw?.itensFinalizados),
      produtosConfirmados: Boolean(raw?.produtosConfirmados ?? raw?.itensFinalizados),
      ajustesSalvos: Boolean(raw?.ajustesSalvos),
      ajustesConfirmados: Boolean(raw?.ajustesConfirmados ?? raw?.ajustesSalvos),
      caixaAberto: Boolean(raw?.caixaAberto),
      produtos: Array.isArray(raw?.produtos) ? raw.produtos : [],
    };
  });

  const [produtos, setProdutos] = useState(() =>
    loadJSON(LS_KEYS.produtos, [])
  );

  const [vendas, setVendas] = useState(() =>
    loadJSON(LS_KEYS.vendas, [])
  );

  const [caixa, setCaixa] = useState(() =>
    loadJSON(LS_KEYS.caixa, {
      abertoEm: null,
      abertura: null,
      movimentos: [],
    })
  );

  const [ajustes, setAjustes] = useState(() =>
    loadJSON(LS_KEYS.ajustes, {
      logoDataUrl: "",
      textoRodape: "Obrigado pela preferência!",
      nomeOrganizacao: "Comunidade",
      logoImgMm: 20,
      ticketImagemModo: "logo",
    })
  );

  useEffect(() => saveJSON(LS_KEYS.evento, evento), [evento]);
  useEffect(() => saveJSON(LS_KEYS.produtos, produtos), [produtos]);
  useEffect(() => {
    if (!Array.isArray(produtos)) return;
    saveJSON(LS_KEYS.produtosUpdatedAt, new Date().toISOString());
  }, [produtos]);
  useEffect(() => saveJSON(LS_KEYS.vendas, vendas), [vendas]);
  useEffect(() => saveJSON(LS_KEYS.caixa, caixa), [caixa]);
  useEffect(() => saveJSON(LS_KEYS.ajustes, ajustes), [ajustes]);
  useEffect(() => {
    setEvento((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        produtos: Array.isArray(produtos) ? produtos : [],
      };
    });
  }, [produtos]);

  const vendasEvento = useMemo(() => {
    const nomeEv = (evento?.nome || "").trim();
    const eventoId = evento?.id ?? null;
    if (!nomeEv && !eventoId) return [];
    return (Array.isArray(vendas) ? vendas : []).filter((v) => {
      const matchId = eventoId && v?.eventoId && v.eventoId === eventoId;
      const matchNome = nomeEv && String(v?.eventoNome || "").trim() === nomeEv;
      return matchId || matchNome;
    });
  }, [vendas, evento?.id, evento?.nome]);

  const resumoEvento = useMemo(() => {
    if (!vendasEvento.length) return null;
    return resumoFinanceiroPorEvento(vendasEvento);
  }, [vendasEvento]);

  const hasEventoAberto = Boolean((evento?.nome || "").trim());
  const caixaAberto = Boolean(evento?.caixaAberto || caixa?.abertura != null);
  const readOnlyWizard = caixaAberto || vendasEvento.length > 0;
  const flowState = useMemo(
    () => getFlowState({ evento, produtos, caixa, vendas }),
    [evento, produtos, caixa, vendas]
  );
  const allowedTabs = useMemo(
    () => getAllowedTabs(flowState, evento, hasEventoAberto),
    [flowState, evento, hasEventoAberto]
  );
  const lastFlowStateRef = useRef(flowState);

  useEffect(() => {
    if (!hasEventoAberto) return;
    if (evento?.caixaAberto) return;
    if (vendasEvento.length === 0 && caixa?.abertura == null) return;
    setEvento((prev) =>
      prev
        ? {
            ...prev,
            caixaAberto: true,
          }
        : prev
    );
  }, [evento?.caixaAberto, hasEventoAberto, vendasEvento.length, caixa?.abertura]);

  useEffect(() => {
    if (lastFlowStateRef.current === flowState) return;
    lastFlowStateRef.current = flowState;
    const target = getFlowTargetTab(flowState);
    if (target && target !== tab) {
      setTab(target);
      setEtapaAtual(target);
    }
  }, [flowState, tab]);

  useEffect(() => {
    if (!tabNotice) return undefined;
    const timeout = setTimeout(() => setTabNotice(""), 2600);
    return () => clearTimeout(timeout);
  }, [tabNotice]);

  const goToTab = useCallback(
    (nextTab, { pushHistory = true } = {}) => {
      if (!nextTab || nextTab === tab) {
        setEtapaAtual((prev) => prev || tab);
        return;
      }
      if (pushHistory) {
        setEtapaHistorico((prev) => [...prev, tab]);
      }
      setTab(nextTab);
      setEtapaAtual(nextTab);
    },
    [tab]
  );

  const getTabBlockReason = useCallback((flowValue, targetTab) => {
    if (flowValue === "ITENS_NAO_FINALIZADOS" || flowValue === "EVENTO_ABERTO_SEM_PRODUTOS") {
      if (targetTab === "ajustes" || targetTab === "caixa" || targetTab === "venda") {
        return "Finalize os produtos primeiro.";
      }
    }
    if (flowValue === "PRODUTOS_FINALIZADOS") {
      if (targetTab === "caixa" || targetTab === "venda") {
        return "Salve os ajustes do ticket primeiro.";
      }
      if (targetTab === "produtos") {
        return "Produtos já finalizados.";
      }
    }
    if (flowValue === "AJUSTES_CONFIRMADOS") {
      if (targetTab === "venda") return "Abra o caixa primeiro.";
      if (targetTab === "produtos") return "Produtos já finalizados.";
    }
    if (flowValue === "CAIXA_ABERTO") {
      if (targetTab === "produtos") return "Caixa aberto: produtos bloqueados.";
    }
    return "Aba indisponível neste momento.";
  }, []);

  const handleTabClick = useCallback(
    (nextTab) => {
      if (!allowedTabs.includes(nextTab)) {
        setTabNotice(getTabBlockReason(flowState, nextTab));
        return;
      }
      goToTab(nextTab);
    },
    [allowedTabs, flowState, getTabBlockReason, goToTab]
  );

  function abrirEvento(nome, options = {}) {
    const nm = String(nome || "").trim();
    if (!nm) return alert("Informe o nome do evento.");

    const abertoEm = new Date().toISOString();
    const modo = options?.modo || "local";
    const rede = options?.rede || null;

    setEvento({
      nome: nm,
      abertoEm,
      produtos: [],
      modo,
      rede,
      itensFinalizados: false,
      produtosConfirmados: false,
      ajustesSalvos: false,
      ajustesConfirmados: false,
      caixaAberto: false,
    });
    setProdutos([]);
    setCaixa({
      abertura: null,
      abertoEm: null,
      movimentos: [],
    });

    // ao abrir, vai para PRODUTOS
    setEtapaHistorico([]);
    goToTab("produtos");
  }

  async function encerrarEventoAtual(nextTab = "evento") {
    try {
      await stopMasterServer();
    } catch (error) {
      console.warn("Não foi possível encerrar o servidor local.", error);
    }

    setEvento(null);
    setProdutos([]);
    setCaixa({ abertura: null, abertoEm: null, movimentos: [] });
    setEtapaHistorico([]);
    setTab(nextTab);
    setEtapaAtual(nextTab);
  }

  function zerarTudo() {
    if (!confirm("Zerar TODOS os dados?")) return;

    void encerrarEventoAtual();
    setVendas([]);
    setAjustes({
      logoDataUrl: "",
      textoRodape: "Obrigado pela preferência!",
      nomeOrganizacao: "Comunidade",
      logoImgMm: 20,
    });
  }

  function zerarVendasEvento() {
    const nomeEv = (evento?.nome || "").trim();
    if (!nomeEv) return;
    if (!confirm(`Zerar vendas do evento "${nomeEv}"?`)) return;

    setVendas((prev) =>
      (Array.isArray(prev) ? prev : []).filter((v) => v.eventoNome !== nomeEv)
    );
  }

  function zerarCaixaEvento() {
    const nomeEv = (evento?.nome || "").trim();
    if (!nomeEv) return;
    if (!confirm(`Zerar caixa do evento "${nomeEv}"?`)) return;

    setCaixa((prev) => ({
      ...prev,
      abertura: null,
      movimentos: [],
    }));
    setEvento((prev) =>
      prev
        ? {
            ...prev,
            caixaAberto: false,
          }
        : prev
    );
  }

  function finalizarCaixaEvento() {
    void encerrarEventoAtual("venda");
  }

  const podeVoltar =
    hasEventoAberto && !readOnlyWizard && etapaHistorico.length > 0;

  const handleVoltar = useCallback(() => {
    if (!podeVoltar) return;
    setEtapaHistorico((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const anterior = next.pop();
      if (anterior) {
        setTab(anterior);
        setEtapaAtual(anterior);
      }
      return next;
    });
  }, [podeVoltar]);

  useEffect(() => {
    if (!permitirMultiDispositivo) return undefined;
    if (config?.modoMulti !== "client") return undefined;
    if (!evento?.nome) return undefined;

    const host = String(config?.masterHost || "").trim();
    const port = String(config?.masterPort || "").trim();
    const pin = String(config?.pinAtual || "").trim();
    const eventId = String(config?.eventIdAtual || "").trim();

    if (!host || !port || !pin || !eventId) return undefined;

    const interval = setInterval(async () => {
      const pendentes = readPendingSales();
      if (pendentes.length === 0) return;
      for (const item of pendentes) {
        const summary =
          item?.summary ||
          (item?.sale
            ? buildSaleSummaryFromSale({ sale: item.sale, deviceId, deviceName })
            : null);
        if (!summary) continue;
        try {
          await postSaleToMaster({
            host,
            port,
            pin,
            eventId,
            deviceId,
            deviceName,
            summary,
            sale: item?.sale || null,
          });
          removePendingSaleById(summary.saleId || summary.id);
        } catch {
          break;
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [
    permitirMultiDispositivo,
    config?.modoMulti,
    config?.masterHost,
    config?.masterPort,
    config?.pinAtual,
    config?.eventIdAtual,
    evento?.nome,
    deviceId,
    deviceName,
  ]);

  useEffect(() => {
    if (!permitirMultiDispositivo) return undefined;
    if (config?.modoMulti !== "client") return undefined;
    if (!evento?.nome) return undefined;

    const host = String(config?.masterHost || "").trim();
    const port = String(config?.masterPort || "").trim();
    const pin = String(config?.pinAtual || "").trim();
    const eventId = String(config?.eventIdAtual || "").trim();

    if (!host || !port || !pin || !eventId) return undefined;

    let cancelled = false;
    const syncProdutos = async () => {
      if (cancelled) return;
      const since = loadJSON(LS_KEYS.produtosSyncAt, null);
      try {
        const response = await syncFromMaster({
          host,
          port,
          pin,
          eventId,
          deviceId,
          since,
        });
        const delta = response?.snapshotDelta || null;
        if (Array.isArray(delta?.products)) {
          setProdutos(delta.products);
          saveJSON(LS_KEYS.produtosSyncAt, delta.updatedAt || new Date().toISOString());
        } else if (delta?.updatedAt) {
          saveJSON(LS_KEYS.produtosSyncAt, delta.updatedAt);
        }
      } catch {
        // mantém offline
      }
    };

    void syncProdutos();
    const interval = setInterval(syncProdutos, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    permitirMultiDispositivo,
    config?.modoMulti,
    config?.masterHost,
    config?.masterPort,
    config?.pinAtual,
    config?.eventIdAtual,
    evento?.nome,
    deviceId,
  ]);

  return (
    <div style={{ minHeight: "100vh", background: "#f5f6f8" }}>
      <TopBar
        tab={tab}
        onTabClick={handleTabClick}
        evento={evento}
        resumo={resumoEvento}
        allowedTabs={allowedTabs}
        notice={tabNotice}
        onZerarTudo={zerarTudo}
      />

      <main style={{ padding: 16 }} data-etapa={etapaAtual}>
        {podeVoltar && (
          <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
            <Button variant="ghost" onClick={handleVoltar}>
              ← Voltar
            </Button>
          </div>
        )}
        {tab === "evento" && (
          <Evento
            evento={evento}
            abrirEvento={abrirEvento}
            vendas={vendas}
            caixa={caixa}
            flowState={flowState}
            readOnly={readOnlyWizard}
            setEvento={setEvento}
            setCaixa={setCaixa}
            setVendas={setVendas}
            setProdutos={setProdutos}
            ajustes={ajustes}
            setAjustes={setAjustes}
          />
        )}

        {tab === "produtos" && (
          <Produtos
            produtos={produtos}
            setProdutos={setProdutos}
            setTab={goToTab}
            readOnly={readOnlyWizard}
            itensFinalizados={Boolean(evento?.itensFinalizados)}
            onSalvarOfertaDoEvento={(novosProdutos) =>
              setEvento((prev) => ({
                ...prev,
                produtos: Array.isArray(novosProdutos) ? novosProdutos : [],
                itensFinalizados: true,
                produtosConfirmados: true,
                ajustesConfirmados: false,
              }))
            }
            onFinalizarItens={() => {
              goToTab("ajustes");
            }}
          />
        )}

        {tab === "venda" && (
          <Venda
            evento={evento}
            produtos={produtos}
            vendas={vendas}
            setVendas={setVendas}
            setTab={goToTab}
            ajustes={ajustes}
          />
        )}

        {tab === "caixa" && (
          <Caixa
            evento={evento}
            caixa={caixa}
            setCaixa={setCaixa}
            resumoEvento={resumoEvento}
            vendas={vendas}
            flowState={flowState}
            disabled={!hasEventoAberto}
            onZerarCaixa={zerarCaixaEvento}
            onAbrirCaixaOk={() => {
              setEvento((prev) =>
                prev
                  ? {
                      ...prev,
                      caixaAberto: true,
                    }
                  : prev
              );
              goToTab("venda");
            }}
            onFinalizarCaixa={finalizarCaixaEvento}
          />
        )}

        {tab === "relatorio" && (
          <Relatorio
            evento={evento}
            vendas={vendas}
            produtos={produtos}
            caixa={caixa}
            ajustes={ajustes}
            resumoEvento={resumoEvento}
            onZerarVendas={zerarVendasEvento}
            disabled={!hasEventoAberto}
          />
        )}

        {tab === "ajustes" && (
          <Ajustes
            ajustes={ajustes}
            setAjustes={setAjustes}
            hasEventoAberto={hasEventoAberto}
            readOnly={readOnlyWizard}
            onSalvar={() => {
              setEvento((prev) =>
                prev
                  ? {
                      ...prev,
                      ajustesSalvos: true,
                      ajustesConfirmados: true,
                    }
                  : prev
              );
              goToTab("caixa");
            }}
          />
        )}
      </main>
    </div>
  );
}