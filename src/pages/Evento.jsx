// src/pages/Evento.jsx
import React, { useMemo, useState, useEffect, useRef } from "react";
import { BrowserQRCodeReader } from "@zxing/browser";
import { loadJSON, saveJSON } from "../storage/storage";
import { LS_KEYS } from "../storage/keys";
import { getFlowState } from "../domain/eventoFlow";
import { useConfig } from "../config/ConfigProvider";
import { getOrCreateEventoKey, getOrCreateEventoPin, shortId } from "../rede/eventIdentity";
import { PDV_PORT } from "../net/pdvNetConfig";
import { imprimirTexto } from "../utils/androidPrinter";
import {
  REPORT_LINE_WIDTH,
  REPORT_SEPARATOR,
  centerText,
  formatRow,
  formatSectionTitle,
  joinLines,
} from "../services/reportText";
import {
  getLocalIp,
  joinAsClient,
  startMasterServer,
  stopMasterServer,
} from "../net/connectivity";
import {
  buildTotals,
  countPendingSales,
  getProdutosSnapshot,
  getProdutosSnapshotDelta,
  getOrCreateDeviceId,
  persistSaleSummary,
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
function fmtBRL(value) {
  return `R$ ${Number(value || 0).toFixed(2).replace(".", ",")}`;
}


const ITEM_LIST_KEYS = ["itens", "items", "produtos", "products", "carrinho", "cart"];
const ITEM_NAME_KEYS = ["nome", "name", "titulo", "title", "descricao"];
const ITEM_PRICE_KEYS = ["preco", "price", "valor", "unitPrice", "precoUnit"];
const ITEM_QTD_KEYS = ["qtd", "qty", "quantidade", "quantity"];
const ITEM_TOTAL_KEYS = ["total", "valorTotal", "subtotal"];

function pickField(obj, keys) {
  if (!obj) return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null && obj[key] !== "") return obj[key];
  }
  return undefined;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") {
    const raw = value.replace(/\s/g, "").replace(",", ".");
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeNameKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function extractItensFromVenda(venda) {
  if (!venda || typeof venda !== "object") return [];
  let itensRaw = null;
  for (const key of ITEM_LIST_KEYS) {
    if (Array.isArray(venda[key])) {
      itensRaw = venda[key];
      break;
    }
  }
  if (!Array.isArray(itensRaw)) return [];

  const itens = [];
  for (const item of itensRaw) {
    const nome = pickField(item, ITEM_NAME_KEYS);
    const nomeLimpo = String(nome || "").trim();
    if (!nomeLimpo) continue;

    const qtd = toNumber(pickField(item, ITEM_QTD_KEYS)) || 1;
    let preco = toNumber(pickField(item, ITEM_PRICE_KEYS));
    let total = toNumber(pickField(item, ITEM_TOTAL_KEYS));

    if (preco == null && total != null && qtd) preco = total / qtd;
    if (total == null && preco != null) total = preco * qtd;

    if (preco == null && total == null) continue;

    itens.push({
      nome: nomeLimpo,
      preco: preco == null ? null : preco,
      qtd,
      total: total == null ? 0 : total,
    });
  }
  return itens;
}

function extractProdutoInfo(produto) {
  if (!produto || typeof produto !== "object") return null;
  const nome = pickField(produto, ITEM_NAME_KEYS);
  const nomeLimpo = String(nome || "").trim();
  if (!nomeLimpo) return null;
  const preco = toNumber(
    pickField(produto, ["preco", "price", "valor", "valorUnitario", "unitPrice"])
  );
  return { nome: nomeLimpo, preco: preco == null ? null : preco };
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
  readOnly = false,
  setEvento,
  setCaixa,
  setVendas,
  setProdutos,
  ajustes = {},
  setAjustes,
}) {
  const { permitirMultiDispositivo, config, updateConfig } = useConfig();
  const PORTA_LAN = String(PDV_PORT || 8787);
  const [nome, setNome] = useState(evento?.nome || "");
  const deviceId = useMemo(() => getOrCreateDeviceId(), []);

  const normalizarPorta = (porta) => {
    const valor = String(porta || "").trim();
    if (!valor || valor === "5173" || valor === "5179") return PORTA_LAN;
    return valor;
  };

  // ✅ se mudar o evento ativo (abrir/zerar), reflete no input
  useEffect(() => {
    setNome(evento?.nome || "");
  }, [evento?.nome]);

  // modal resumo
  const [evResumo, setEvResumo] = useState(null);

  // conectividade
  const [clienteHost, setClienteHost] = useState(config?.masterHost || "");
  const [clientePorta, setClientePorta] = useState(normalizarPorta(config?.masterPort));
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
  const [pendingCount, setPendingCount] = useState(countPendingSales());
  const [avisoConectar, setAvisoConectar] = useState("");
  const [cameraErro, setCameraErro] = useState("");

  const videoRef = useRef(null);
  const qrControlsRef = useRef(null);
  const qrReaderRef = useRef(null);

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
  const eventoBloqueado = readOnly;
  const bloqueioStyle = eventoBloqueado ? { opacity: 0.5, cursor: "not-allowed" } : {};
  const portaPlaceholder = PORTA_LAN;

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
  const isCliente = config?.modoMulti === "client" || evento?.modo === "client";
  const portaMaster = normalizarPorta(config?.masterPort);
  const isNative = useMemo(() => {
    const cap = window?.Capacitor;
    if (!cap) return false;
    if (typeof cap.isNativePlatform === "function") {
      return cap.isNativePlatform();
    }
    return Boolean(cap?.getPlatform && cap.getPlatform() !== "web");
  }, []);

  const eventoIdAtual = isCliente ? clienteEventId || config?.eventIdAtual || "" : eventoIdCurto;
  const eventoPinAtual = isCliente ? clientePin || config?.pinAtual || "" : eventoPin;
  const hostAtual = isCliente ? clienteHost || config?.masterHost || "" : serverIp || "";
  const portaAtual = isCliente
    ? normalizarPorta(clientePorta || config?.masterPort)
    : portaMaster;
  const hostParaQr = serverIp || (!isNative ? window?.location?.hostname || "" : "");
  const qrPayload = useMemo(() => {
    if (!eventoIdAtual || !eventoPinAtual) return "";
    const host = hostParaQr || "";
    const port = portaAtual || portaPlaceholder;
    return `PDV_EVENT|host=${host}|port=${port}|id=${eventoIdAtual}|pin=${eventoPinAtual}`;
  }, [eventoIdAtual, eventoPinAtual, hostParaQr, portaAtual, portaPlaceholder]);

  const qrUrl = useMemo(() => {
    if (!qrPayload) return "";
    const encoded = encodeURIComponent(qrPayload);
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encoded}`;
  }, [qrPayload]);

  useEffect(() => {
    if (!eventoAberto || !permitirMultiDispositivo) {
      setStatusConexao("Aguardando conexões");
      setServerAtivo(false);
      setServerErro("");
      return;
    }

    if (evento?.modo !== "client") {
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
  }, [eventoAberto, permitirMultiDispositivo, evento, eventoPin, eventoIdCurto, updateConfig]);

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
    setClientePorta(normalizarPorta(config?.masterPort));
    setClientePin(config?.pinAtual || "");
    setClienteEventId(config?.eventIdAtual || "");
    setModoConectar("manual");
    setQrInput("");
    setErroConectar("");
    setAvisoConectar("");
    setCameraErro("");
    setMostrarConectar(true);
  }

  function salvarDadosLan(data) {
    try {
      localStorage.setItem("pdv:lan-draft", JSON.stringify(data));
    } catch {
      // ignore
    }
  }

  function pararLeitorQr() {
    if (qrControlsRef.current?.stop) {
      qrControlsRef.current.stop();
    }
    if (qrReaderRef.current?.reset) {
      qrReaderRef.current.reset();
    }
    qrControlsRef.current = null;
    qrReaderRef.current = null;
    if (videoRef.current?.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks?.() || [];
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }

  async function iniciarLeitorQr() {
    setErroConectar("");
    setAvisoConectar("");
    setCameraErro("");
    if (!navigator?.mediaDevices?.getUserMedia || !videoRef.current) {
      setCameraErro("Câmera não disponível ou permissão negada.");
      return;
    }
    pararLeitorQr();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      stream.getTracks().forEach((track) => track.stop());
      const reader = new BrowserQRCodeReader();
      qrReaderRef.current = reader;
      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error, controlsInstance) => {
          if (result) {
            const texto =
              typeof result?.getText === "function" ? result.getText() : String(result);
            tratarQrLido(texto);
            controlsInstance?.stop?.();
          }
          if (error?.name === "NotAllowedError" || error?.name === "NotFoundError") {
            setCameraErro("Câmera não disponível ou permissão negada.");
          }
        }
      );
      qrControlsRef.current = controls;
    } catch (error) {
      setCameraErro("Câmera não disponível ou permissão negada.");
    }
  }

  useEffect(() => {
    if (modoConectar === "qr" && mostrarConectar) {
      void iniciarLeitorQr();
    } else {
      pararLeitorQr();
    }
    return () => {
      pararLeitorQr();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoConectar, mostrarConectar]);

  async function conectarCliente() {
    const dados =
      modoConectar === "qr"
        ? parseQrPayload(qrInput)
        : {
            host: String(clienteHost || "").trim(),
            port: normalizarPorta(clientePorta || portaPlaceholder),
            pin: String(clientePin || "").trim(),
            eventId: String(clienteEventId || "").trim(),
          };
    if (!dados) {
      setErroConectar("Não foi possível ler os dados do QR.");
      return;
    }
    const { host, port: porta, pin, eventId } = dados;
    if (!host) {
      setErroConectar("Informe o IP do mestre ou leia o QR Code");
      return;
    }
    if (!porta || Number.isNaN(Number(porta))) {
      setErroConectar("Porta inválida.");
      return;
    }
    if (!eventId) {
      setErroConectar("Informe o ID do evento.");
      return;
    }
    if (!/^\d{6}$/.test(pin)) {
      setErroConectar("PIN deve ter 6 dígitos.");
      return;
    }

    setClienteHost(host);
    setClientePorta(normalizarPorta(porta));
    setClientePin(pin);
    setClienteEventId(eventId);
    setStatusConexao("Conectando...");
    setErroConectar("");
    if (serverAtivo) {
      await pararServidor();
    }

    try {
      if (typeof joinAsClient !== "function") {
        salvarDadosLan({ host, port: porta, eventId, pin });
        setErroConectar("Conexão LAN ainda não implementada");
        return;
      }
      const response = await joinAsClient({
        host,
        port: porta,
        pin,
        eventId,
        deviceId,
        deviceName: navigator?.userAgent || "Cliente",
      });
      const snapshot = response?.snapshot || null;
      const ticketModel = response?.ticketModel || snapshot?.ticketModel || null;
      if (ticketModel && typeof setAjustes === "function") {
        setAjustes((prev) => ({ ...(prev || {}), ...ticketModel }));
      }
      if (snapshot?.products && typeof setProdutos === "function") {
        setProdutos(Array.isArray(snapshot.products) ? snapshot.products : []);
        if (snapshot?.updatedAt) {
          saveJSON(LS_KEYS.produtosSyncAt, snapshot.updatedAt);
        }
      }
      if (snapshot?.products && typeof setEvento === "function") {
        const nomeEvento =
          String(snapshot?.eventName || "").trim() ||
          String(evento?.nome || "").trim() ||
          "Evento sincronizado";
        setEvento((prev) => ({
          ...(prev || {}),
          nome: nomeEvento,
          abertoEm: prev?.abertoEm || new Date().toISOString(),
          produtos: Array.isArray(snapshot.products) ? snapshot.products : prev?.produtos || [],
          modo: "client",
        }));
      }

      setStatusConexao("Conectado");
      updateConfig((prev) => ({
        ...prev,
        modoMulti: "client",
        masterHost: host,
        masterPort: normalizarPorta(porta),
        pinAtual: pin,
        eventIdAtual: eventId,
      }));
      setMostrarConectar(false);
      alert("Conectado");
    } catch (error) {
      setStatusConexao("Falha ao conectar");
      setErroConectar(error?.message || "Não foi possível conectar.");
    }
  }

  async function iniciarServidor() {
    const porta = normalizarPorta(config?.masterPort || portaPlaceholder);
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
          const snapshot = getProdutosSnapshot();
          return {
            snapshot,
            ticketModel: {
              nomeOrganizacao: ajustes?.nomeOrganizacao,
              textoRodape: ajustes?.textoRodape,
              logoDataUrl: ajustes?.logoDataUrl,
              logoMaxHeightMm: ajustes?.logoMaxHeightMm,
              ticketMinHeightMm: ajustes?.ticketMinHeightMm,
              ticketMaxHeightMm: ajustes?.ticketMaxHeightMm,
            },
          };
        },
        onSale: ({ sale, summary, deviceId, deviceName }) => {
          if (summary) {
            const normalizedSummary = {
              ...summary,
              deviceId: summary?.deviceId ?? deviceId ?? null,
              deviceName: summary?.deviceName || deviceName || "Cliente",
            };
            const result = persistSaleSummary(normalizedSummary);
            return {
              applied: result.added,
              totals: null,
              serverSaleId: normalizedSummary?.saleId || normalizedSummary?.id || null,
            };
          }
          if (!sale) {
            return { applied: false, totals: null, serverSaleId: null };
          }
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
          return {
            snapshotDelta: getProdutosSnapshotDelta({ since }),
            ticketModel: {
              nomeOrganizacao: ajustes?.nomeOrganizacao,
              textoRodape: ajustes?.textoRodape,
              logoDataUrl: ajustes?.logoDataUrl,
              logoMaxHeightMm: ajustes?.logoMaxHeightMm,
              ticketMinHeightMm: ajustes?.ticketMinHeightMm,
              ticketMaxHeightMm: ajustes?.ticketMaxHeightMm,
            },
          };
        },
      });
      const ip = await getLocalIp();
      setServerIp(ip || "");
      setServerAtivo(true);
      setStatusConexao("Mestre ativo");
    } catch (error) {
      setServerAtivo(false);
      setStatusConexao("Não iniciado");
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
    if (!data.id || !data.pin || !data.port || !("host" in data)) return null;
    return {
      host: data.host || "",
      port: normalizarPorta(data.port),
      pin: String(data.pin || ""),
      eventId: data.id,
    };
  }

  function tratarQrLido(payload) {
    setQrInput(payload);
    const dados = parseQrPayload(payload);
    if (!dados) {
      setErroConectar("QR inválido.");
      return;
    }
    pararLeitorQr();
    setClienteHost(dados.host);
    setClientePorta(dados.port);
    setClienteEventId(dados.eventId);
    setClientePin(dados.pin);
    setModoConectar("manual");
    setAvisoConectar("QR lido com sucesso.");
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

    const itensMap = new Map();
    const itensPorNome = new Map();
    const registrarItem = (item) => {
      if (!item) return;
      const nome = String(item.nome || "").trim();
      if (!nome) return;
      const precoNum = Number.isFinite(item.preco) ? Number(item.preco) : null;
      const precoKey = precoNum == null ? "sem-preco" : precoNum.toFixed(2);
      const chave = `${normalizeNameKey(nome)}__${precoKey}`;
      if (!itensMap.has(chave)) {
        itensMap.set(chave, {
          nome,
          preco: precoNum,
          qtd: 0,
          total: 0,
        });
      }
      const registro = itensMap.get(chave);
      registro.qtd += Number(item.qtd || 0) || 0;
      registro.total += Number(item.total || 0) || 0;

      const nomeKey = normalizeNameKey(nome);
      if (!itensPorNome.has(nomeKey)) itensPorNome.set(nomeKey, new Set());
      itensPorNome.get(nomeKey).add(chave);
    };

    for (const venda of evVendas) {
      const itensVenda = extractItensFromVenda(venda);
      for (const item of itensVenda) {
        registrarItem(item);
      }
    }

    const metaEncerrado = encerradosMap.get(String(nomeEv || "").trim());
    const produtosLista =
      String(nomeEv || "").trim() === String(evento?.nome || "").trim()
        ? produtosEvento
        : Array.isArray(metaEncerrado?.produtos)
          ? metaEncerrado.produtos
          : Array.isArray(metaEncerrado?.fechamento?.produtos)
            ? metaEncerrado.fechamento.produtos
            : [];

    for (const produto of produtosLista) {
      const info = extractProdutoInfo(produto);
      if (!info) continue;
      const nomeKey = normalizeNameKey(info.nome);
      const precoKey = info.preco == null ? "sem-preco" : info.preco.toFixed(2);
      const chave = `${nomeKey}__${precoKey}`;

      if (info.preco == null) {
        const existentes = itensPorNome.get(nomeKey);
        if (existentes && existentes.size > 0) continue;
      }

      if (!itensMap.has(chave)) {
        itensMap.set(chave, {
          nome: info.nome,
          preco: info.preco,
          qtd: 0,
          total: 0,
        });
      }
    }

    const itensResumo = Array.from(itensMap.values()).sort((a, b) => {
      const totalDiff = (Number(b.total || 0) || 0) - (Number(a.total || 0) || 0);
      if (totalDiff !== 0) return totalDiff;
      const qtdDiff = (Number(b.qtd || 0) || 0) - (Number(a.qtd || 0) || 0);
      if (qtdDiff !== 0) return qtdDiff;
      return String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR");
    });

    const itensComVenda = itensResumo.filter((it) => (Number(it.qtd || 0) || 0) > 0).length;
    const itensSemVenda = itensResumo.length - itensComVenda;
    const totalItensCalculado = itensResumo.reduce((s, it) => s + (Number(it.total || 0) || 0), 0);
    const totalItens = Number(resumo.total || 0) || totalItensCalculado;

    return {
      nome: nomeEv,
      resumo,
      caixaAtual: !!caixaAtual,
      abertura,
      reforcos,
      sangrias,
      saldoDinheiroEsperado,
      itensResumo,
      itensTotais: {
        totalItens,
        itensComVenda,
        itensSemVenda,
      },
      encerradoEm: encerradosMap.get(String(nomeEv || "").trim())?.encerradoEm || null,
    };
  }

  async function imprimirResumoCaixa(resumoCaixa) {
    if (!resumoCaixa) return;
    const periodo = resumoCaixa.resumo.primeira
      ? `${toBRDateTime(resumoCaixa.resumo.primeira)} → ${toBRDateTime(resumoCaixa.resumo.ultima)}`
      : "Sem vendas registradas.";
    const impressoEm = toBRDateTime(new Date().toISOString());
    const lines = [];

    lines.push(centerText(String(resumoCaixa.nome || "").trim(), REPORT_LINE_WIDTH));
    lines.push(periodo);
    if (resumoCaixa.encerradoEm) {
      lines.push(`Encerrado em: ${toBRDateTime(resumoCaixa.encerradoEm)}`);
    }
    lines.push(REPORT_SEPARATOR);
    lines.push(formatSectionTitle("Totais"));
    lines.push(...formatRow("Total vendido", fmtBRL(resumoCaixa.resumo.total || 0)));
    lines.push(...formatRow("Dinheiro", fmtBRL(resumoCaixa.resumo.porPagamento.dinheiro || 0)));
    lines.push(...formatRow("Pix", fmtBRL(resumoCaixa.resumo.porPagamento.pix || 0)));
    lines.push(...formatRow("Cartão", fmtBRL(resumoCaixa.resumo.porPagamento.cartao || 0)));
    if (resumoCaixa.caixaAtual) {
      lines.push(...formatRow("Abertura", fmtBRL(resumoCaixa.abertura || 0)));
      lines.push(
        ...formatRow(
          "Saldo esperado (dinheiro)",
          fmtBRL(resumoCaixa.saldoDinheiroEsperado || 0)
        )
      );
    }
    lines.push(REPORT_SEPARATOR);
    lines.push(formatSectionTitle("Itens do evento"));
    if (resumoCaixa.itensResumo && resumoCaixa.itensResumo.length > 0) {
      resumoCaixa.itensResumo.forEach((item) => {
        const precoTexto = item.preco == null ? "" : ` @ ${fmtBRL(item.preco)}`;
        const label = `${item.nome}${precoTexto} x${Number(item.qtd || 0)}`;
        lines.push(...formatRow(label, fmtBRL(item.total || 0)));
      });
    } else {
      lines.push("Nenhum item registrado.");
    }
    lines.push(
      ...formatRow("Total geral (itens)", fmtBRL(resumoCaixa.itensTotais?.totalItens || 0))
    );
    lines.push(REPORT_SEPARATOR);
    lines.push(`Impresso em: ${impressoEm}`);
    lines.push(centerText("FIM DO RELATÓRIO", REPORT_LINE_WIDTH));

    const texto = joinLines(lines);
    const resultado = await imprimirTexto(texto);
    if (!resultado?.ok) {
      const erroMsg = resultado?.error ? ` (${resultado.error})` : "";
      alert(`Não foi possível imprimir o relatório.${erroMsg}`);
    }
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
    : serverErro
      ? "Erro ao iniciar"
      : "Não iniciado";
  const statusAtual = isCliente ? statusConexao : statusMaster;
  const ipMestreLabel = isCliente
    ? clienteHost || config?.masterHost || "-"
    : serverIp || "-";
  const mostrarAvisoIpMestre = isNative && !isCliente && !serverIp;

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

            {permitirMultiDispositivo && (
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
                onClick={() => setMostrarConectividade(true)}
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
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <div>
                    <strong style={{ color: "#111827" }}>ID do evento:</strong>{" "}
                    {eventoIdAtual || "-"}
                  </div>
                  <div>
                    <strong style={{ color: "#111827" }}>PIN:</strong> {eventoPinAtual || "-"}
                  </div>
                  <div>
                    <strong style={{ color: "#111827" }}>IP do mestre:</strong> {ipMestreLabel}
                  </div>
                  {mostrarAvisoIpMestre && (
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>
                      Não foi possível ler o IP automaticamente. Informe manualmente ou verifique
                      o plugin NetworkInterface/HttpServer no APK.
                    </div>
                  )}
                  <div>
                    <strong style={{ color: "#111827" }}>Porta:</strong> {portaAtual}
                  </div>
                  <div>
                    <strong style={{ color: "#111827" }}>Status:</strong> {statusAtual}
                  </div>
                  {pendingCount > 0 && isCliente && (
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>
                      Fila offline: {pendingCount} venda(s)
                    </div>
                  )}
                </div>

                <div style={{ display: "grid", gap: 8, justifyItems: "center" }}>
                  {qrUrl ? (
                    <div
                      style={{
                        width: 260,
                        height: 260,
                        maxWidth: "80vw",
                        maxHeight: "80vw",
                        padding: 12,
                        borderRadius: 0,
                        border: "1px solid #111827",
                        background: "#fff",
                        boxSizing: "border-box",
                        overflow: "visible",
                      }}
                    >
                      <img
                        src={qrUrl}
                        alt="QR Code do evento"
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "block",
                          objectFit: "contain",
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>
                      QR disponível após gerar ID e PIN.
                    </div>
                  )}
                </div>
              </div>
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
                    {fmtBRL(evResumo.resumo.total || 0)}
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ color: "#6b7280" }}>Dinheiro</div>
                  <div style={{ fontWeight: 900 }}>
                    {fmtBRL(evResumo.resumo.porPagamento.dinheiro || 0)}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ color: "#6b7280" }}>Pix</div>
                  <div style={{ fontWeight: 900 }}>
                    {fmtBRL(evResumo.resumo.porPagamento.pix || 0)}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ color: "#6b7280" }}>Cartão</div>
                  <div style={{ fontWeight: 900 }}>
                    {fmtBRL(evResumo.resumo.porPagamento.cartao || 0)}
                  </div>
                </div>

                <div style={{ height: 1, background: "#e5e7eb", margin: "10px 0" }} />

                {evResumo.caixaAtual ? (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ color: "#6b7280" }}>Abertura</div>
                      <div style={{ fontWeight: 900 }}>
                        {fmtBRL(evResumo.abertura || 0)}
                      </div>
                    </div>

                    <div style={{ height: 1, background: "#e5e7eb", margin: "10px 0" }} />

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 900 }}>Saldo esperado (dinheiro)</div>
                      <div style={{ fontWeight: 950 }}>
                        {fmtBRL(evResumo.saldoDinheiroEsperado || 0)}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ color: "#9ca3af", fontSize: 13 }}>
                    Observação: abertura só fica no evento atual.
                  </div>
                )}
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontWeight: 900, marginBottom: 8 }}>Itens do evento</div>
                <div
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 90px 70px 100px",
                      gap: 6,
                      padding: "8px 10px",
                      fontSize: 12,
                      fontWeight: 800,
                      background: "#f8fafc",
                    }}
                  >
                    <div>Item</div>
                    <div style={{ textAlign: "right" }}>Preço</div>
                    <div style={{ textAlign: "right" }}>Qtd</div>
                    <div style={{ textAlign: "right" }}>Total (R$)</div>
                  </div>
                  <div style={{ maxHeight: 260, overflowY: "auto" }}>
                    {(evResumo.itensResumo || []).map((item, idx) => (
                      <div
                        key={`${item.nome}-${item.preco ?? "sem-preco"}-${idx}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 90px 70px 100px",
                          gap: 6,
                          padding: "8px 10px",
                          fontSize: 13,
                          borderTop: "1px solid #e5e7eb",
                        }}
                      >
                        <div style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.nome}
                        </div>
                        <div style={{ textAlign: "right", color: "#6b7280" }}>
                          {item.preco == null ? "-" : fmtBRL(item.preco)}
                        </div>
                        <div style={{ textAlign: "right" }}>{Number(item.qtd || 0)}</div>
                        <div style={{ textAlign: "right", fontWeight: 800 }}>
                          {fmtBRL(item.total || 0)}
                        </div>
                      </div>
                    ))}
                    {(!evResumo.itensResumo || evResumo.itensResumo.length === 0) && (
                      <div
                        style={{
                          padding: "10px",
                          fontSize: 13,
                          color: "#9ca3af",
                          borderTop: "1px solid #e5e7eb",
                        }}
                      >
                        Nenhum item encontrado.
                      </div>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginTop: 8,
                    fontWeight: 900,
                  }}
                >
                  <div>Total geral (itens)</div>
                  <div>{fmtBRL(evResumo.itensTotais?.totalItens || 0)}</div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
                <button style={btn("soft")} onClick={() => imprimirResumoCaixa(evResumo)}>
                  Imprimir
                </button>
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
                {modoConectar !== "qr" && (
                  <button
                    style={{ ...btn("soft"), height: 32 }}
                    onClick={() => {
                      setModoConectar("qr");
                      void iniciarLeitorQr();
                    }}
                  >
                    Ler QR Code
                  </button>
                )}
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
                  {qrInput && (
                    <div
                      style={{
                        fontSize: 12,
                        color: "#6b7280",
                        border: "1px solid #e5e7eb",
                        borderRadius: 10,
                        padding: 8,
                        background: "#f9fafb",
                        wordBreak: "break-all",
                      }}
                    >
                      {qrInput}
                    </div>
                  )}
                </div>
              )}

              {avisoConectar && (
                <div style={{ color: "#9ca3af", fontSize: 12, marginTop: 8 }}>
                  {avisoConectar}
                </div>
              )}
              {modoConectar === "qr" && (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      width: "100%",
                      height: 220,
                      borderRadius: 12,
                      border: "1px solid #e5e7eb",
                      background: "#0f172a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <video
                      ref={videoRef}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      muted
                      playsInline
                    />
                    {cameraErro && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 12,
                          textAlign: "center",
                          background: "rgba(15,23,42,0.85)",
                          color: "#fff",
                        }}
                      >
                        {cameraErro}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 8 }}>
                    <button
                      style={btn("soft")}
                      onClick={() => {
                        pararLeitorQr();
                        setModoConectar("manual");
                      }}
                    >
                      Fechar leitor
                    </button>
                    <button
                      style={btn("dark")}
                      onClick={() => {
                        pararLeitorQr();
                        void iniciarLeitorQr();
                      }}
                    >
                      Reiniciar leitura
                    </button>
                  </div>
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