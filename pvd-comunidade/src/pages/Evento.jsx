// src/pages/Evento.jsx
import React, { useMemo, useState, useEffect } from "react";
import { loadJSON, saveJSON } from "../storage/storage";
import { LS_KEYS } from "../storage/keys";
import { getFlowState } from "../domain/eventoFlow";
import { useConfig } from "../config/ConfigProvider";
import { getOrCreateEventoKey, getOrCreateEventoPin, shortId } from "../rede/eventIdentity";
import {
  getLocalIp,
  joinAsClient,
  startMasterServer,
  stopMasterServer,
  syncFromMaster,
} from "../net/connectivity";
import {
  buildTotals,
  countPendingSales,
  getEventoSnapshot,
  getOrCreateDeviceId,
  getSnapshotDelta,
  persistSale,
} from "../state/pdvStore";

const SENHA_EXCLUIR = "123456";

/* ===================== storage: status do evento ===================== */
function loadEventosMeta() {
  const arr = loadJSON(LS_KEYS.eventosMeta, []);
  return Array.isArray(arr) ? arr : [];
}
function saveEventosMeta(arr) {
  saveJSON(LS_KEYS.eventosMeta, Array.isArray(arr) ? arr : []);
}

function pad2(n) {
  return String(n).padStart(2, "0");
}
function toBRDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}
function toBRDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}, ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}`;
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
  zIndex: 9999,
};

const modalCard = {
  width: "100%",
  maxWidth: 420,
  background: "#fff",
  borderRadius: 14,
  border: "1px solid #e5e7eb",
  boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
  overflow: "hidden",
};

const modalHead = {
  padding: "14px 14px 10px",
  borderBottom: "1px solid #e5e7eb",
  fontWeight: 900,
};

const modalBody = { padding: 14 };

const btn = (variant = "soft") => {
  const base = {
    height: 36,
    borderRadius: 10,
    border: "1px solid #d1d5db",
    padding: "0 12px",
    fontWeight: 800,
    cursor: "pointer",
    background: "#fff",
  };
  if (variant === "primary") {
    return { ...base, borderColor: "#2563eb", background: "#2563eb", color: "#fff" };
  }
  if (variant === "danger") {
    return { ...base, borderColor: "#ef4444", background: "#ef4444", color: "#fff" };
  }
  if (variant === "dark") {
    return { ...base, borderColor: "#111827", background: "#111827", color: "#fff" };
  }
  return { ...base, background: "#f8fafc" };
};

export default function Evento({
  evento,
  abrirEvento,
  vendas = [],
  caixa,
  flowState,
  setEvento,
  setCaixa,
  setVendas,
  setProdutos,
}) {
  const { permitirMultiDispositivo, config, updateConfig } = useConfig();
  const [nome, setNome] = useState(evento?.nome || "");
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  // ✅ se mudar o evento ativo (abrir/zerar), reflete no input
  useEffect(() => {
    setNome(evento?.nome || "");
  }, [evento?.nome]);

  // modal resumo
  const [evResumo, setEvResumo] = useState(null);

  // conectividade
  const [clienteHost, setClienteHost] = useState(config?.masterHost || "");
  const [clientePorta, setClientePorta] = useState(config?.masterPort || "5179");
  const [clientePin, setClientePin] = useState(config?.pinAtual || "");
  const [clienteEventId, setClienteEventId] = useState(config?.eventIdAtual || "");
  const [statusConexao, setStatusConexao] = useState("Aguardando conexões");
  const [mostrarConectar, setMostrarConectar] = useState(false);
  const [mostrarConectividade, setMostrarConectividade] = useState(false);
  const [modoConectar, setModoConectar] = useState("manual");
  const [qrInput, setQrInput] = useState("");
  const [erroConectar, setErroConectar] = useState("");
  const [serverIp, setServerIp] = useState("");
  const [serverAtivo, setServerAtivo] = useState(false);
  const [serverErro, setServerErro] = useState("");
  const [clientsConnected, setClientsConnected] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [pendingCount, setPendingCount] = useState(countPendingSales());

  // modal excluir
  const [evExcluir, setEvExcluir] = useState(null);
  const [senha, setSenha] = useState("");
  const [erroSenha, setErroSenha] = useState("");

  // ✅ mapa de encerrados (cache)
  const encerradosMap = useMemo(() => {
    const meta = loadEventosMeta();
    const map = new Map();
    for (const m of meta) {
      const nm = String(m?.nome || "").trim();
      if (!nm) continue;
      map.set(nm, m);
    }
    return map;
  }, [vendas, evento?.nome]); // re-render quando algo muda no app

  const historico = useMemo(() => {
    const vs = Array.isArray(vendas) ? vendas : [];
    const map = new Map();

    for (const v of vs) {
      const nomeEv = String(v?.eventoNome || "").trim();
      if (!nomeEv) continue;

      const criadoEm = v?.criadoEm || v?.createdAt || v?.data || v?.quando || null;
      const total = Number(v?.total ?? v?.valorTotal ?? 0) || 0;
      const pagamento = String(v?.pagamento || "").toLowerCase();

      if (!map.has(nomeEv)) {
        map.set(nomeEv, {
          nome: nomeEv,
          primeiraData: criadoEm,
          ultimaData: criadoEm,
          vendas: 0,
          total: 0,
          porPagamento: { dinheiro: 0, pix: 0, cartao: 0 },
        });
      }

      const it = map.get(nomeEv);
      it.vendas += 1;
      it.total += total;

      if (pagamento === "dinheiro") it.porPagamento.dinheiro += total;
      else if (pagamento === "pix") it.porPagamento.pix += total;
      else if (pagamento === "cartao" || pagamento === "cartão") it.porPagamento.cartao += total;

      if (criadoEm) {
        if (!it.primeiraData || new Date(criadoEm) < new Date(it.primeiraData)) it.primeiraData = criadoEm;
        if (!it.ultimaData || new Date(criadoEm) > new Date(it.ultimaData)) it.ultimaData = criadoEm;
      }
    }

    // inclui evento atual mesmo sem vendas
    const atual = String(evento?.nome || "").trim();
    if (atual && !map.has(atual)) {
      map.set(atual, {
        nome: atual,
        primeiraData: evento?.abertoEm || null,
        ultimaData: evento?.abertoEm || null,
        vendas: 0,
        total: 0,
        porPagamento: { dinheiro: 0, pix: 0, cartao: 0 },
      });
    }

    // também inclui eventos encerrados que ainda não tenham vendas (só se quiser aparecer)
    // (se não quiser, pode remover este bloco)
    for (const [nm] of encerradosMap.entries()) {
      if (!map.has(nm)) {
        const meta = encerradosMap.get(nm);
        map.set(nm, {
          nome: nm,
          primeiraData: meta?.fechamento?.abertoEm || meta?.encerradoEm || null,
          ultimaData: meta?.encerradoEm || null,
          vendas: 0,
          total: 0,
          porPagamento: { dinheiro: 0, pix: 0, cartao: 0 },
        });
      }
    }

    const arr = Array.from(map.values()).sort((a, b) => {
      const da = a.ultimaData ? new Date(a.ultimaData).getTime() : 0;
      const db = b.ultimaData ? new Date(b.ultimaData).getTime() : 0;
      return db - da;
    });

    // garante o atual em cima
    if (atual) {
      const idx = arr.findIndex((x) => x.nome === atual);
      if (idx > 0) {
        const [item] = arr.splice(idx, 1);
        arr.unshift(item);
      }
    }

    return arr;
  }, [vendas, evento, encerradosMap]);

  const eventoAberto = Boolean(String(evento?.nome || "").trim());
  const produtosEvento = Array.isArray(evento?.produtos) ? evento.produtos : [];
  const estadoFluxo =
    flowState || getFlowState({ evento, produtos: produtosEvento, caixa, vendas });
  const eventoBloqueado = estadoFluxo === "PRONTO_PARA_VENDER" || estadoFluxo === "VENDENDO";
  const bloqueioStyle = eventoBloqueado ? { opacity: 0.5, cursor: "not-allowed" } : {};
  const portaPlaceholder = "5179";

  const eventoKey = useMemo(() => {
    if (!permitirMultiDispositivo || !eventoAberto) return "";
    const idBase = evento?.id || evento?.nome;
    return getOrCreateEventoKey(idBase);
  }, [permitirMultiDispositivo, eventoAberto, evento?.id, evento?.nome]);

  const eventoPin = useMemo(() => {
    if (!eventoKey) return "";
    return getOrCreateEventoPin(eventoKey);
  }, [eventoKey]);

  const eventoIdCurto = eventoKey ? shortId(eventoKey) : "";
  const isCliente = config?.modoMulti === "client";
  const portaMaster = config?.masterPort || portaPlaceholder;
  const qrPayload = useMemo(() => {
    if (!eventoIdCurto || !eventoPin) return "";
    const host = serverIp || "";
    const port = portaMaster || portaPlaceholder;
    return `PDV_EVENT|id=${eventoIdCurto}|pin=${eventoPin}|host=${host}|port=${port}`;
  }, [eventoIdCurto, eventoPin, serverIp, portaMaster, portaPlaceholder]);

  useEffect(() => {
    if (!eventoAberto || !permitirMultiDispositivo) {
      setStatusConexao("Aguardando conexões");
      setServerAtivo(false);
      setServerErro("");
      return;
    }

    if (!isCliente) {
      updateConfig((prev) => {
        const next = {
          ...prev,
          modoMulti: "master",
          pinAtual: eventoPin || prev.pinAtual,
          eventIdAtual: eventoIdCurto || prev.eventIdAtual,
        };
        if (
          prev.modoMulti === next.modoMulti &&
          prev.pinAtual === next.pinAtual &&
          prev.eventIdAtual === next.eventIdAtual
        ) {
          return prev;
        }
        return next;
      });
      setStatusConexao("Aguardando conexões");
    } else {
      setStatusConexao((prev) => {
        if (prev === "Conectado" || prev === "Conectando..." || prev === "Sincronizando...") {
          return prev;
        }
        return "Desconectado";
      });
    }
  }, [eventoAberto, permitirMultiDispositivo, isCliente, eventoPin, eventoIdCurto, updateConfig]);

  useEffect(() => {
    setPendingCount(countPendingSales());
  }, [vendas]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(countPendingSales());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!eventoAberto || !permitirMultiDispositivo) return;
    if (isCliente) return;
    if (serverAtivo) return;
    void iniciarServidor();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoAberto, permitirMultiDispositivo, isCliente]);

  function alertEventoBloqueado() {
    alert("Evento em andamento. Finalize o caixa para editar/excluir.");
  }

  function abrirLocal() {
    const nm = String(nome || "").trim();
    if (!nm) return alert("Informe o nome do evento.");
    if (permitirMultiDispositivo) {
      updateConfig((prev) => ({
        ...prev,
        modoMulti: "master",
        pinAtual: eventoPin || prev.pinAtual,
        eventIdAtual: eventoIdCurto || prev.eventIdAtual,
      }));
      setStatusConexao("Aguardando conexões");
    }
    abrirEvento(nm, { modo: "local", rede: null });
    setNome("");
  }

  function abrirModalConectar() {
    setClienteHost(config?.masterHost || "");
    setClientePorta(config?.masterPort || portaPlaceholder);
    setClientePin(config?.pinAtual || "");
    setClienteEventId(config?.eventIdAtual || "");
    setModoConectar("manual");
    setQrInput("");
    setErroConectar("");
    setMostrarConectar(true);
  }

  async function conectarCliente() {
    const dados =
      modoConectar === "qr"
        ? parseQrPayload(qrInput)
        : {
            host: String(clienteHost || "").trim(),
            port: String(clientePorta || "").trim() || portaPlaceholder,
            pin: String(clientePin || "").trim(),
            eventId: String(clienteEventId || "").trim(),
          };
    if (!dados) {
      setErroConectar("Não foi possível ler os dados do QR.");
      return;
    }
    const { host, port: porta, pin, eventId } = dados;
    if (!host || !porta || !pin || !eventId) {
      setErroConectar("Preencha Host, Porta, ID e PIN.");
      return;
    }

    setClienteHost(host);
    setClientePorta(porta);
    setClientePin(pin);
    setClienteEventId(eventId);
    setStatusConexao("Conectando...");
    setErroConectar("");
    if (serverAtivo) {
      await pararServidor();
    }

    try {
      const response = await joinAsClient({
        host,
        port: porta,
        pin,
        eventId,
        deviceId,
        deviceName: navigator?.userAgent || "Cliente",
      });
      const snapshot = response?.snapshot || null;
      if (snapshot?.itensEvento && typeof setProdutos === "function") {
        setProdutos(Array.isArray(snapshot.itensEvento) ? snapshot.itensEvento : []);
      }
      if (snapshot?.caixaState && typeof setCaixa === "function") {
        setCaixa(snapshot.caixaState);
      }
      if (snapshot?.relatorioState?.vendas && typeof setVendas === "function") {
        setVendas(Array.isArray(snapshot.relatorioState.vendas) ? snapshot.relatorioState.vendas : []);
      }
      if (snapshot?.evento?.nome && typeof setEvento === "function") {
        setEvento((prev) => ({
          ...(prev || {}),
          nome: snapshot.evento.nome,
          abertoEm: snapshot.evento.abertoEm || prev?.abertoEm,
          produtos: Array.isArray(snapshot.itensEvento) ? snapshot.itensEvento : prev?.produtos || [],
          modo: "client",
        }));
      }

      setStatusConexao("Conectado");
      setLastSyncAt(snapshot?.serverTime || new Date().toISOString());
      updateConfig((prev) => ({
        ...prev,
        modoMulti: "client",
        masterHost: host,
        masterPort: porta,
        pinAtual: pin,
        eventIdAtual: eventId,
      }));
      setMostrarConectar(false);
    } catch (error) {
      setStatusConexao("Falha ao conectar");
      setServerErro(error?.message || "Não foi possível conectar.");
    }
  }

  async function iniciarServidor() {
    const porta = String(config?.masterPort || portaPlaceholder || "5179");
    if (!eventoPin || !eventoIdCurto) {
      setServerErro("PIN ou evento inválido.");
      return;
    }
    setServerErro("");
    try {
      await startMasterServer({
        port: Number(porta),
        pin: eventoPin,
        eventId: eventoIdCurto,
        onClientJoin: () => {
          setClientsConnected((prev) => prev + 1);
          const snapshot = getEventoSnapshot();
          return { snapshot };
        },
        onSale: ({ sale }) => {
          const result = persistSale({ sale, setVendas });
          const vendasLista = loadJSON(LS_KEYS.vendas, []);
          const vendasEvento = Array.isArray(vendasLista)
            ? vendasLista.filter(
                (v) => String(v?.eventoNome || "").trim() === String(evento?.nome || "").trim()
              )
            : [];
          return {
            applied: result.added,
            totals: buildTotals(vendasEvento.length ? vendasEvento : [result.venda]),
            serverSaleId: result.venda.id,
          };
        },
        onSyncRequest: ({ since }) => {
          return getSnapshotDelta({ since });
        },
      });
      const ip = await getLocalIp();
      setServerIp(ip || "");
      setServerAtivo(true);
      setStatusConexao("Mestre ativo");
    } catch (error) {
      setServerAtivo(false);
      setStatusConexao("Servidor inativo");
      setServerErro(error?.message || "Não foi possível iniciar o servidor.");
    }
  }

  async function pararServidor() {
    try {
      await stopMasterServer();
    } finally {
      setServerAtivo(false);
      setStatusConexao("Servidor inativo");
    }
  }

  async function sincronizarCliente() {
    const host = String(config?.masterHost || "").trim();
    const porta = String(config?.masterPort || "").trim();
    const pin = String(config?.pinAtual || "").trim();
    const eventId = String(config?.eventIdAtual || "").trim();
    if (!host || !porta || !pin || !eventId) return;
    setStatusConexao("Sincronizando...");
    try {
      const response = await syncFromMaster({
        host,
        port: porta,
        pin,
        eventId,
        deviceId,
        since: lastSyncAt,
      });
      const delta = response?.snapshotDelta || null;
      if (delta?.sales && typeof setVendas === "function") {
        delta.sales.forEach((sale) => persistSale({ sale, setVendas }));
      }
      setLastSyncAt(delta?.updatedAt || new Date().toISOString());
      setStatusConexao("Conectado");
    } catch (error) {
      setStatusConexao("Falha ao sincronizar");
      setServerErro(error?.message || "Não foi possível sincronizar.");
    }
  }

  function parseQrPayload(payload) {
    if (!payload) return null;
    const raw = String(payload).trim();
    if (!raw) return null;
    if (!raw.startsWith("PDV_EVENT|")) return null;
    const parts = raw.split("|").slice(1);
    const data = parts.reduce((acc, part) => {
      const [key, value] = part.split("=");
      if (key && value !== undefined) {
        acc[key.trim()] = value.trim();
      }
      return acc;
    }, {});
    if (!data.id || !data.pin || !data.port || !data.host) return null;
    return {
      host: data.host,
      port: data.port,
      pin: data.pin,
      eventId: data.id,
    };
  }

  function calcularCaixaDoEvento(nomeEv) {
    const vs = Array.isArray(vendas) ? vendas : [];
    const evVendas = vs.filter(
      (v) => String(v?.eventoNome || "").trim() === String(nomeEv || "").trim()
    );

    const resumo = {
      vendas: evVendas.length,
      total: 0,
      porPagamento: { dinheiro: 0, pix: 0, cartao: 0 },
      primeira: null,
      ultima: null,
    };

    for (const v of evVendas) {
      const total = Number(v?.total ?? v?.valorTotal ?? 0) || 0;
      resumo.total += total;

      const pagamento = String(v?.pagamento || "").toLowerCase();
      if (pagamento === "dinheiro") resumo.porPagamento.dinheiro += total;
      else if (pagamento === "pix") resumo.porPagamento.pix += total;
      else if (pagamento === "cartao" || pagamento === "cartão") resumo.porPagamento.cartao += total;

      const criadoEm = v?.criadoEm || v?.createdAt || v?.data || v?.quando || null;
      if (criadoEm) {
        if (!resumo.primeira || new Date(criadoEm) < new Date(resumo.primeira)) resumo.primeira = criadoEm;
        if (!resumo.ultima || new Date(criadoEm) > new Date(resumo.ultima)) resumo.ultima = criadoEm;
      }
    }

    const nmAtual = String(evento?.nome || "").trim();
    const caixaAtual =
      nmAtual &&
      nmAtual === String(nomeEv || "").trim() &&
      caixa &&
      typeof caixa === "object"
        ? caixa
        : null;

    let abertura = Number(caixaAtual?.abertura ?? 0) || 0;
    const movimentos = Array.isArray(caixaAtual?.movimentos) ? caixaAtual.movimentos : [];
    const reforcos = movimentos
      .filter((m) => m?.tipo === "reforco")
      .reduce((s, m) => s + (Number(m?.valor) || 0), 0);
    const sangrias = movimentos
      .filter((m) => m?.tipo === "sangria")
      .reduce((s, m) => s + (Number(m?.valor) || 0), 0);

    const saldoDinheiroEsperado = abertura + resumo.porPagamento.dinheiro + reforcos - sangrias;

    return {
      nome: nomeEv,
      resumo,
      caixaAtual: !!caixaAtual,
      abertura,
      reforcos,
      sangrias,
      saldoDinheiroEsperado,
      encerradoEm: encerradosMap.get(String(nomeEv || "").trim())?.encerradoEm || null,
    };
  }

  function pedirExcluir(ev) {
    setEvExcluir(ev);
    setSenha("");
    setErroSenha("");
  }

  function confirmarExcluir() {
    if (!evExcluir) return;
    if (senha !== SENHA_EXCLUIR) {
      setErroSenha("Senha incorreta.");
      return;
    }

    const nomeEv = String(evExcluir.nome || "").trim();

    // remove vendas do evento
    if (typeof setVendas === "function") {
      setVendas((prev) =>
        (Array.isArray(prev) ? prev : []).filter(
          (v) => String(v?.eventoNome || "").trim() !== nomeEv
        )
      );
    }

    // se estava ativo, limpa caixa (apenas se o pai mantiver isso)
    const atual = String(evento?.nome || "").trim();
    if (atual && atual === nomeEv && typeof setCaixa === "function") {
      setCaixa((prev) => ({
        ...(prev && typeof prev === "object" ? prev : {}),
        abertura: null,
        movimentos: [],
      }));
    }

    // remove também o status ENCERRADO no cache
    const meta = loadEventosMeta();
    const novo = meta.filter((m) => String(m?.nome || "").trim() !== nomeEv);
    saveEventosMeta(novo);

    setEvExcluir(null);
  }

  const inputStyle = {
    width: "100%",
    height: 44,
    fontSize: 16, // iOS zoom fix
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #d1d5db",
    outline: "none",
  };

  const statusMaster = serverAtivo
    ? clientsConnected > 0
      ? `${clientsConnected} cliente(s) conectado(s)`
      : "Aguardando conexões"
    : "Servidor inativo";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", paddingBottom: 12 }}>
      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          padding: 14,
          boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ fontSize: 22, fontWeight: 950, marginBottom: 10 }}>Evento</div>

        <div style={{ display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#6b7280", marginBottom: 6 }}>
              Nome do evento
            </div>
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Almoço dos Sócios"
              style={inputStyle}
              disabled={eventoBloqueado}
            />
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              style={{ ...btn("primary"), ...bloqueioStyle }}
              onClick={() => {
                if (eventoBloqueado) {
                  alertEventoBloqueado();
                  return;
                }
                abrirLocal();
              }}
            >
              Abrir evento
            </button>

            {eventoAberto && (
              <button
                style={btn("soft")}
                onClick={() => setEvResumo(calcularCaixaDoEvento(evento.nome))}
              >
                Ver caixa do evento
              </button>
            )}

            {eventoAberto && permitirMultiDispositivo && (
              <button
                style={{ ...btn("soft"), height: 34 }}
                onClick={abrirModalConectar}
              >
                Conectar-se a um evento
              </button>
            )}

            {eventoAberto && permitirMultiDispositivo && (
              <button
                style={{ ...btn("soft"), height: 34 }}
                onClick={() => setMostrarConectividade((prev) => !prev)}
              >
                Conectividade
              </button>
            )}
          </div>

          <div style={{ marginTop: 2 }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>Status</div>
            <div style={{ color: "#6b7280", fontSize: 14 }}>
              {eventoAberto ? (
                <>
                  Evento aberto:{" "}
                  <strong style={{ color: "#111827" }}>{evento.nome}</strong>{" "}
                  <span style={{ color: "#9ca3af" }}>
                    • Aberto em {evento?.abertoEm ? toBRDateTime(evento.abertoEm) : "-"}
                  </span>
                </>
              ) : (
                "Nenhum evento aberto"
              )}
            </div>
          </div>

        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 950, marginBottom: 10, color: "#111827" }}>
          Histórico de eventos
        </div>

        {historico.length === 0 ? (
          <div style={{ color: "#6b7280", fontSize: 14 }}>
            Nenhum histórico ainda. Depois das primeiras vendas, o resumo aparece aqui.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {historico.map((ev) => {
              const dt = ev.primeiraData || ev.ultimaData || null;
              const nomeEv = String(ev.nome || "").trim();
              const isAtual = String(evento?.nome || "").trim() === nomeEv;

              const meta = encerradosMap.get(nomeEv);
              const encerrado = Boolean(meta?.encerradoEm);

              return (
                <div
                  key={ev.nome}
                  style={{
                    background: "#fff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    padding: 12,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div
                          style={{
                            fontWeight: 950,
                            fontSize: 16,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {ev.nome}
                        </div>

                        {isAtual && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              padding: "3px 8px",
                              borderRadius: 999,
                              background: "#111827",
                              color: "#fff",
                            }}
                          >
                            ATIVO
                          </span>
                        )}

                        {!isAtual && encerrado && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 900,
                              padding: "3px 8px",
                              borderRadius: 999,
                              background: "#e5e7eb",
                              color: "#111827",
                            }}
                          >
                            ENCERRADO
                          </span>
                        )}
                      </div>

                      <div style={{ color: "#6b7280", fontSize: 13, marginTop: 4 }}>
                        {dt ? `Data: ${toBRDate(dt)}` : "Data: -"}
                        {encerrado && meta?.encerradoEm ? (
                          <>
                            <span style={{ color: "#9ca3af" }}> • </span>
                            Encerrado em: {toBRDateTime(meta.encerradoEm)}
                          </>
                        ) : null}
                        <span style={{ color: "#9ca3af" }}> • </span>
                        Vendas: {ev.vendas}
                        <span style={{ color: "#9ca3af" }}> • </span>
                        Total:{" "}
                        <strong style={{ color: "#111827" }}>
                          R$ {Number(ev.total || 0).toFixed(2).replace(".", ",")}
                        </strong>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        style={{ ...btn("soft"), padding: "0 10px", height: 34 }}
                        onClick={() => setEvResumo(calcularCaixaDoEvento(ev.nome))}
                      >
                        Caixa
                      </button>

                      {/* ✅ Excluir permitido mesmo se ENCERRADO */}
                      <button
                        style={{ ...btn("danger"), padding: "0 10px", height: 34, ...bloqueioStyle }}
                        onClick={() => {
                          if (eventoBloqueado) {
                            alertEventoBloqueado();
                            return;
                          }
                          pedirExcluir(ev);
                        }}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {mostrarConectividade && eventoAberto && permitirMultiDispositivo && (
        <div style={overlay} onClick={() => setMostrarConectividade(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>Conectividade</div>
            <div style={modalBody}>
              {!isCliente ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "grid", gap: 6 }}>
                    <div>
                      <strong style={{ color: "#111827" }}>ID do evento:</strong>{" "}
                      {eventoIdCurto || "-"}
                    </div>
                    <div>
                      <strong style={{ color: "#111827" }}>PIN:</strong> {eventoPin || "-"}
                    </div>
                    <div>
                      <strong style={{ color: "#111827" }}>Endereço:</strong>{" "}
                      {serverIp ? serverIp : "-"}
                    </div>
                    <div>
                      <strong style={{ color: "#111827" }}>Porta:</strong> {portaMaster}
                    </div>
                    <div>
                      <strong style={{ color: "#111827" }}>Status:</strong> {statusMaster}
                    </div>
                    {serverAtivo && !serverIp && (
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>
                        No Vite: modo demonstração
                      </div>
                    )}
                    {serverErro && (
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>{serverErro}</div>
                    )}
                  </div>

                  <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
                    {qrPayload ? (
                      <>
                        <div
                          style={{
                            width: 160,
                            height: 160,
                            borderRadius: 12,
                            border: "1px dashed #d1d5db",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            color: "#9ca3af",
                            textAlign: "center",
                            padding: 10,
                          }}
                        >
                          QR Code (TODO)
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
                          {qrPayload}
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: "#9ca3af" }}>
                        QR disponível após gerar ID e PIN.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <div>
                    <strong style={{ color: "#111827" }}>IP do mestre:</strong>{" "}
                    {clienteHost || config?.masterHost || "-"}
                  </div>
                  <div>
                    <strong style={{ color: "#111827" }}>Porta:</strong>{" "}
                    {clientePorta || config?.masterPort || portaPlaceholder}
                  </div>
                  <div>
                    <strong style={{ color: "#111827" }}>ID do evento:</strong>{" "}
                    {clienteEventId || config?.eventIdAtual || "-"}
                  </div>
                  <div>
                    <strong style={{ color: "#111827" }}>PIN:</strong>{" "}
                    {clientePin || config?.pinAtual || "-"}
                  </div>
                  <div>
                    <strong style={{ color: "#111827" }}>Status:</strong> {statusConexao}
                  </div>
                  <div>
                    <strong style={{ color: "#111827" }}>Fila offline:</strong>{" "}
                    {pendingCount} venda(s)
                  </div>
                  <button style={btn("soft")} onClick={sincronizarCliente}>
                    Sincronizar agora
                  </button>
                  {serverErro && (
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>{serverErro}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {evResumo && (
        <div style={overlay} onClick={() => setEvResumo(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>Caixa • {evResumo.nome}</div>
            <div style={modalBody}>
              <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 10 }}>
                {evResumo.resumo.primeira
                  ? `Período: ${toBRDateTime(evResumo.resumo.primeira)} → ${toBRDateTime(evResumo.resumo.ultima)}`
                  : "Sem vendas registradas."}
                {evResumo.encerradoEm ? (
                  <>
                    <div style={{ marginTop: 6 }}>
                      <strong>Encerrado em:</strong> {toBRDateTime(evResumo.encerradoEm)}
                    </div>
                  </>
                ) : null}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 900 }}>Total vendido</div>
                  <div style={{ fontWeight: 950 }}>
                    R$ {Number(evResumo.resumo.total || 0).toFixed(2).replace(".", ",")}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ color: "#6b7280" }}>Dinheiro</div>
                  <div style={{ fontWeight: 900 }}>
                    R$ {Number(evResumo.resumo.porPagamento.dinheiro || 0).toFixed(2).replace(".", ",")}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ color: "#6b7280" }}>Pix</div>
                  <div style={{ fontWeight: 900 }}>
                    R$ {Number(evResumo.resumo.porPagamento.pix || 0).toFixed(2).replace(".", ",")}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ color: "#6b7280" }}>Cartão</div>
                  <div style={{ fontWeight: 900 }}>
                    R$ {Number(evResumo.resumo.porPagamento.cartao || 0).toFixed(2).replace(".", ",")}
                  </div>
                </div>

                <div style={{ height: 1, background: "#e5e7eb", margin: "10px 0" }} />

                {evResumo.caixaAtual ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ color: "#6b7280" }}>Abertura</div>
                      <div style={{ fontWeight: 900 }}>
                        R$ {Number(evResumo.abertura || 0).toFixed(2).replace(".", ",")}
                      </div>
                    </div>

                    <div style={{ height: 1, background: "#e5e7eb", margin: "10px 0" }} />

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 900 }}>Saldo esperado (dinheiro)</div>
                      <div style={{ fontWeight: 950 }}>
                        R$ {Number(evResumo.saldoDinheiroEsperado || 0).toFixed(2).replace(".", ",")}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#9ca3af", fontSize: 13 }}>
                    Observação: abertura só fica no evento atual.
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button style={btn("soft")} onClick={() => setEvResumo(null)}>
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {evExcluir && (
        <div style={overlay} onClick={() => setEvExcluir(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>Excluir evento</div>
            <div style={modalBody}>
              <div style={{ fontSize: 14, marginBottom: 10 }}>
                Confirme a senha para excluir:
                <div style={{ fontWeight: 950, marginTop: 6 }}>{evExcluir.nome}</div>
              </div>

              <input
                value={senha}
                onChange={(e) => {
                  setSenha(e.target.value);
                  setErroSenha("");
                }}
                placeholder="Digite a senha"
                style={inputStyle}
                inputMode="numeric"
              />

              {erroSenha && (
                <div style={{ color: "#ef4444", fontSize: 13, marginTop: 8, fontWeight: 800 }}>
                  {erroSenha}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button style={btn("soft")} onClick={() => setEvExcluir(null)}>
                  Cancelar
                </button>
                <button style={btn("danger")} onClick={confirmarExcluir}>
                  Excluir
                </button>
              </div>

              <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 10 }}>
                Senha padrão: {SENHA_EXCLUIR}
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarConectar && (
        <div style={overlay} onClick={() => setMostrarConectar(false)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={modalHead}>Conectar-se a um evento</div>
            <div style={modalBody}>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <button
                  style={{ ...btn(modoConectar === "manual" ? "dark" : "soft"), height: 32 }}
                  onClick={() => setModoConectar("manual")}
                >
                  Digitar dados
                </button>
                <button
                  style={{ ...btn(modoConectar === "qr" ? "dark" : "soft"), height: 32 }}
                  onClick={() => setModoConectar("qr")}
                >
                  Ler QR Code
                </button>
              </div>

              {modoConectar === "manual" ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", marginBottom: 4 }}>
                      Host/IP do mestre
                    </div>
                    <input
                      value={clienteHost}
                      onChange={(e) => setClienteHost(e.target.value)}
                      placeholder="Ex: 192.168.0.10"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", marginBottom: 4 }}>
                      Porta
                    </div>
                    <input
                      value={clientePorta}
                      onChange={(e) => setClientePorta(e.target.value)}
                      placeholder={portaPlaceholder}
                      style={inputStyle}
                      inputMode="numeric"
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", marginBottom: 4 }}>
                      ID do evento
                    </div>
                    <input
                      value={clienteEventId}
                      onChange={(e) => setClienteEventId(e.target.value)}
                      placeholder="ID do evento"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", marginBottom: 4 }}>
                      PIN
                    </div>
                    <input
                      value={clientePin}
                      onChange={(e) => setClientePin(e.target.value)}
                      placeholder="PIN (6 dígitos)"
                      style={inputStyle}
                      inputMode="numeric"
                    />
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Cole o conteúdo do QR:
                  </div>
                  <input
                    value={qrInput}
                    onChange={(e) => {
                      setQrInput(e.target.value);
                      setErroConectar("");
                    }}
                    placeholder="PDV_EVENT|id=...|pin=...|host=...|port=..."
                    style={inputStyle}
                  />
                </div>
              )}

              {erroConectar && (
                <div style={{ color: "#ef4444", fontSize: 12, marginTop: 10, fontWeight: 700 }}>
                  {erroConectar}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button style={btn("soft")} onClick={() => setMostrarConectar(false)}>
                  Cancelar
                </button>
                <button style={btn("primary")} onClick={conectarCliente}>
                  Conectar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
