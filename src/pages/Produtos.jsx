// src/pages/Produtos.jsx
import React, { useMemo, useRef, useState, useEffect, Component } from "react";
import Select from "react-select";
import Card from "../components/Card";
import { ICONS } from "../domain/icons";

/* ===================== CONSTANTES ===================== */
const TIPO_OPTIONS = [
  { value: "unitario", label: "Venda unitária" },
  { value: "combo", label: "Combo" },
];

const LIB = [
  { key: "agua", nome: "Água (500ml)" },
  { key: "ref_lata", nome: "Refrigerante Lata" },
  { key: "ref_600", nome: "Refrigerante 600ml" },
  { key: "ref_2l", nome: "Refrigerante 2L" },
  { key: "cer_lata", nome: "Cerveja Lata" },
  { key: "cer_garrafa", nome: "Cerveja Garrafa" },
  { key: "chope", nome: "Chopp (Copo)" },
  { key: "barril", nome: "Barril de chopp" },
  { key: "lanche", nome: "Lanche" },
  { key: "sobremesa", nome: "Sobremesa" },
  { key: "sorvete", nome: "Sorvete" },
  { key: "fichas", nome: "Fichas" },
  { key: "suco", nome: "Suco" },
  { key: "almoco_socio", nome: "Almoço do Sócio" },
  { key: "prato_talher", nome: "Prato e Talher" },
];

/* ===================== HELPERS ===================== */
function mkId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    String(Date.now()) + "-" + Math.random().toString(16).slice(2)
  );
}

function digitsToBRL(digits) {
  const only = String(digits || "").replace(/\D/g, "");
  const n = Number(only || "0");
  const cents = n % 100;
  const reais = Math.floor(n / 100);
  return `${reais},${String(cents).padStart(2, "0")}`;
}

function brlToNumber(brlStr) {
  const s = String(brlStr || "").trim();
  if (!s) return 0;
  const norm = s.replace(/\./g, "").replace(",", ".");
  const n = Number(norm);
  return Number.isFinite(n) ? n : 0;
}

function fmtBRL(n) {
  const v = Number(n) || 0;
  return v.toFixed(2).replace(".", ",");
}

/* ===================== ESTILOS DOS BOTÕES ===================== */
const btnBase = {
  height: 44,
  borderRadius: 14,
  border: "1px solid #d1d5db",
  padding: "0 14px",
  fontWeight: 900,
  cursor: "pointer",
  background: "#fff",
  userSelect: "none",
  WebkitTapHighlightColor: "transparent",
  transition: "all 0.2s ease",
};

const btnPrimary = {
  ...btnBase,
  background: "#111827",
  borderColor: "#111827",
  color: "#fff",
};

const btnDanger = {
  ...btnBase,
  background: "#ef4444",
  borderColor: "#ef4444",
  color: "#fff",
};

const btnSoft = { 
  ...btnBase, 
  background: "#f8fafc",
};

/* ===================== REACT-SELECT CONFIG ===================== */
const rsStyles = {
  container: (b) => ({ ...b, width: "100%" }),
  control: (base, state) => ({
    ...base,
    minHeight: 44,
    height: 44,
    borderRadius: 14,
    borderColor: state.isFocused ? "#111827" : "#cbd5e1",
    boxShadow: state.isFocused ? "0 0 0 1px #111827" : "none",
    ":hover": { borderColor: "#111827" },
    fontSize: 15,
    fontWeight: 800,
    background: "#fff",
  }),
  valueContainer: (b) => ({ ...b, padding: "0 12px" }),
  indicatorsContainer: (b) => ({ ...b, height: 44 }),
  menuPortal: (b) => ({ ...b, zIndex: 999999 }),
};

/* ===================== ERROR BOUNDARY ===================== */
class SelectErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    console.error("react-select quebrou, usando fallback nativo:", err);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/* ===================== COMPONENTES AUXILIARES ===================== */
function TipoSelectSafe({ value, onChange, disabled }) {
  const fallback = (
    <select
      className="input"
      value={value?.value || "unitario"}
      onChange={(e) => {
        const opt = TIPO_OPTIONS.find((o) => o.value === e.target.value) || TIPO_OPTIONS[0];
        onChange(opt);
      }}
      style={{ height: 44, borderRadius: 14, fontWeight: 900, width: "100%" }}
      disabled={disabled}
    >
      {TIPO_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );

  return (
    <SelectErrorBoundary fallback={fallback}>
      <Select
        options={TIPO_OPTIONS}
        value={value}
        onChange={onChange}
        styles={rsStyles}
        menuPortalTarget={document.body}
        isDisabled={disabled}
      />
    </SelectErrorBoundary>
  );
}

function IconImg({ iconKey, size = 42 }) {
  const src = ICONS[iconKey] || ICONS.ref_600;
  return (
    <img
      src={src}
      alt=""
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        display: "block",
      }}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

/* ===================== COMPONENTE PRINCIPAL ===================== */
export default function Produtos({
  produtos = [],
  setProdutos = () => {},
  onSalvarOfertaDoEvento,
  onFinalizarItens,
  readOnly = false,
  itensFinalizados = false,
}) {
  // ==================== ESTADOS ====================
  const [nome, setNome] = useState("");
  const [precoDigits, setPrecoDigits] = useState("");
  const [tipo, setTipo] = useState(TIPO_OPTIONS[0]);
  const [comboQtd, setComboQtd] = useState("4");
  const [atalhoKey, setAtalhoKey] = useState("");
  const [aviso, setAviso] = useState({ type: "", message: "" });

  // ==================== REFS ====================
  const topoRef = useRef(null);
  const precoRef = useRef(null);
  const nomeRef = useRef(null);

  // ==================== MEMOIZED VALUES ====================
  const itensEvento = useMemo(
    () => (Array.isArray(produtos) ? produtos : []),
    [produtos]
  );

  const atalhosDisponiveis = useMemo(() => LIB, []);

  const precoBRL = digitsToBRL(precoDigits);
  const precoNum = brlToNumber(precoBRL);

  const podeAdicionar =
    Boolean(nome.trim()) &&
    precoNum > 0 &&
    (tipo?.value !== "combo" || (parseInt(comboQtd, 10) || 0) >= 2);

  const bloqueadoEdicao = readOnly;
  const barrilAtual = useMemo(() => {
    const nomeNormalizado = String(nome || "").toLowerCase();
    return nomeNormalizado.includes("barril") || atalhoKey === "barril";
  }, [nome, atalhoKey]);

  // ==================== EFFECTS ====================
  useEffect(() => {
    if (aviso.message) {
      const timer = setTimeout(() => setAviso({ type: "", message: "" }), 2000);
      return () => clearTimeout(timer);
    }
  }, [aviso]);

  // ==================== FUNÇÃO DE SCROLL SIMPLIFICADA ====================
  function scrollToTopAndFocusPrice() {
    if (!topoRef.current) return;

    // Scroll suave para o topo
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    // Foca no campo de preço após o scroll
    setTimeout(() => {
      if (precoRef.current && !bloqueadoEdicao) {
        precoRef.current.focus();
        precoRef.current.select();
        
        // Em dispositivos móveis, força a abertura do teclado
        if ('ontouchstart' in window) {
          precoRef.current.click();
        }
      }
    }, 300);
  }

  function escolherAtalho(it) {
    if (bloqueadoEdicao) return;
    
    setNome(it.nome);
    setAtalhoKey(it.key);
    setAviso({ type: "info", message: `✅ ${it.nome} selecionado` });
    
    scrollToTopAndFocusPrice();
  }

  function getIconKeyForItem(nm) {
    const keyByName = LIB.find(
      (x) => String(x.nome).trim() === String(nm).trim()
    )?.key;
    return keyByName || atalhoKey || "";
  }

  function limparTopo() {
    setNome("");
    setPrecoDigits("");
    setTipo(TIPO_OPTIONS[0]);
    setComboQtd("4");
    setAtalhoKey("");
    
    setTimeout(() => {
      if (nomeRef.current && !bloqueadoEdicao) {
        nomeRef.current.focus();
      }
    }, 100);
  }

  function adicionarItemAoEvento() {
    if (bloqueadoEdicao) {
      setAviso({ type: "warning", message: "⚠️ Edição bloqueada" });
      return;
    }
    if (!podeAdicionar) {
      setAviso({ type: "warning", message: "⚠️ Preencha todos os campos" });
      return;
    }

    const nm = String(nome || "").trim();
    const t = tipo?.value === "combo" ? "combo" : "unitario";
    const qtdCombo =
      t === "combo" ? Math.max(2, parseInt(comboQtd || "2", 10) || 2) : null;
    const varKey = `${nm}__${t}__${qtdCombo ?? ""}`;
    const iconKey = getIconKeyForItem(nm) || "ref_600";
    const barril = barrilAtual || iconKey === "barril";

    setProdutos((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const idx = arr.findIndex((p) => String(p?.varKey || "") === varKey);

      const payload = {
        id: idx >= 0 ? arr[idx].id : mkId(),
        nome: nm,
        preco: precoNum,
        ativo: true,
        tipo: t,
        comboQtd: qtdCombo,
        varKey,
        iconKey: iconKey || "ref_600",
        isBarril: barril,
        precoModo: barril ? "por_litro" : "unitario",
      };

      if (idx >= 0) {
        const cp = [...arr];
        cp[idx] = { ...cp[idx], ...payload };
        setAviso({ type: "success", message: `✅ "${nm}" atualizado` });
        return cp;
      }
      
      setAviso({ type: "success", message: `✅ "${nm}" adicionado` });
      return [...arr, payload];
    });

    limparTopo();
  }

  function removerItem(id) {
    if (bloqueadoEdicao) return;
    const item = itensEvento.find(p => p.id === id);
    if (item && confirm(`Remover "${item.nome}"?`)) {
      setProdutos((prev) =>
        (Array.isArray(prev) ? prev : []).filter((x) => x.id !== id)
      );
      setAviso({ type: "info", message: `🗑️ "${item.nome}" removido` });
    }
  }

  function toggleAtivo(id) {
    if (bloqueadoEdicao) return;
    setProdutos((prev) =>
      (Array.isArray(prev) ? prev : []).map((p) =>
        p.id === id ? { ...p, ativo: !p.ativo } : p
      )
    );
  }

  function limparItensEvento() {
    if (bloqueadoEdicao) return;
    if (itensEvento.length === 0) return;
    if (!confirm("Limpar todos os itens do evento?")) return;
    setProdutos([]);
    setAviso({ type: "info", message: "🗑️ Todos os itens removidos" });
  }

  const podeFinalizar = itensEvento.length >= 1 && !readOnly;

  // ==================== ESTILOS ====================
  const styles = {
    alert: {
      info: { background: "#e0f2fe", color: "#0369a1", border: "1px solid #7dd3fc" },
      success: { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" },
      warning: { background: "#fef9c3", color: "#854d0e", border: "1px solid #fde047" },
      error: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" },
    },
    produtoNomeClamp: {
      fontWeight: 700,
      fontSize: 12,
      textAlign: "center",
      lineHeight: 1.3,
      maxWidth: "100%",
      display: "-webkit-box",
      WebkitLineClamp: 2,
      WebkitBoxOrient: "vertical",
      overflow: "hidden",
      whiteSpace: "normal",
      wordBreak: "break-word",
      color: "#2563eb",
      height: 32,
    },
  };

  return (
    <div className="produtos-container">
      <style>{`
        .produtos-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 12px;
        }
        .produtos-container input,
        .produtos-container select,
        .produtos-container textarea {
          font-size: 16px;
        }
        
        /* SCROLL SUAVE OTIMIZADO */
        html {
          scroll-behavior: smooth;
          scroll-padding-top: 70px;
        }
        
        /* PERFORMANCE DE ANIMAÇÃO */
        * {
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
        }
        
        /* Grid de 3 colunas fixo */
        .grid-3 {
          display: grid !important;
          grid-template-columns: repeat(3, 1fr) !important;
          gap: 10px !important;
        }
        
        .atalho-button {
          border: 2px solid #e5e7eb !important;
          border-radius: 18px !important;
          background: #fff !important;
          padding: 10px !important;
          cursor: pointer !important;
          min-height: 110px !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: center !important;
          gap: 6px !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important;
          width: 100% !important;
          transform: translateZ(0);
          backface-visibility: hidden;
          perspective: 1000px;
          will-change: transform;
          transition: transform 0.15s ease, border-color 0.15s ease !important;
        }
        .atalho-button:hover:not(:disabled) {
          border-color: #2563eb !important;
          transform: translateY(-2px) translateZ(0);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.15) !important;
        }
        .atalho-button:active:not(:disabled) {
          transform: scale(0.97) translateZ(0);
        }
        .atalho-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        
        /* ✅ BADGE CORRIGIDO - TUDO NUMA LINHA */
        .badge-count {
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 4px !important;
          padding: 4px 12px !important;
          background: #2563eb !important;
          color: white !important;
          border-radius: 999px !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          border: none !important;
          white-space: nowrap !important;
          line-height: 1 !important;
        }
        
        .badge-count span {
          display: inline !important;
          line-height: 1 !important;
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
          white-space: nowrap;
        }
        
        .alert {
          padding: 10px 14px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-weight: 500;
          font-size: 14px;
          animation: fadeIn 0.2s ease;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        
        .formGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
        }
        
        @media (max-width: 640px) {
          .formGrid {
            grid-template-columns: 1fr;
          }
        }
        
        .fullRow {
          grid-column: 1 / -1;
        }
        
        .hr {
          height: 1px;
          background: #e5e7eb;
          margin: 16px 0;
        }
        
        .muted {
          color: #6b7280;
          font-size: 13px;
          font-weight: 500;
        }
        
        .input {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          font-size: 15px;
          outline: none;
          transition: border-color 0.15s ease;
        }
        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
        }
        .input:disabled {
          background: #f3f4f6;
          cursor: not-allowed;
        }
      `}</style>

      {/* Alerta */}
      {aviso.message && (
        <div className="alert" style={styles.alert[aviso.type]}>
          {aviso.message}
        </div>
      )}

      {/* âncora para scroll */}
      <div ref={topoRef} style={{ height: 1 }} />

      {/* ===== CADASTRO ===== */}
      <Card 
        title="Cadastro de Produtos" 
        subtitle="Selecione um atalho e defina o preço"
        right={
          <span className="badge-count">
            <span>{itensEvento.length}</span>
            <span>{itensEvento.length === 1 ? 'item' : 'itens'}</span>
          </span>
        }
      >
        {readOnly && (
          <div className="badge" style={{ marginBottom: 16, background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }}>
            ⚠️ Edição bloqueada
          </div>
        )}
        {itensFinalizados && (
          <div className="badge" style={{ marginBottom: 16, background: "#dbeafe", color: "#1e40af", borderColor: "#bfdbfe" }}>
            ✓ Itens finalizados
          </div>
        )}

        <div className="formGrid">
          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Nome do produto
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 16,
                  border: "2px solid #e5e7eb",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "0 0 auto",
                }}
              >
                <IconImg iconKey={getIconKeyForItem(nome.trim())} size={36} />
              </div>

              <input
                ref={nomeRef}
                className="input"
                placeholder="Toque em um atalho..."
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                disabled={bloqueadoEdicao}
              />
            </div>
          </div>

          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Tipo
            </div>

            <TipoSelectSafe
              value={tipo}
              onChange={bloqueadoEdicao ? () => {} : setTipo}
              disabled={bloqueadoEdicao}
            />
          </div>

          {tipo?.value === "combo" && (
            <div className="fullRow">
              <div className="muted" style={{ marginBottom: 6 }}>
                Itens no combo
              </div>
              <input
                className="input"
                value={comboQtd}
                onChange={(e) => setComboQtd(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="Ex: 4"
                disabled={bloqueadoEdicao}
                style={{ maxWidth: 200 }}
              />
            </div>
          )}

          <div className="fullRow">
            <div className="muted" style={{ marginBottom: 6 }}>
              {barrilAtual ? "Preço por litro (R$)" : "Preço (R$)"}
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                ref={precoRef}
                className="input"
                value={precoBRL}
                onChange={(e) =>
                  setPrecoDigits(String(e.target.value || "").replace(/\D/g, ""))
                }
                inputMode="numeric"
                style={{ fontSize: 18, fontWeight: 900, flex: 1 }}
                disabled={bloqueadoEdicao}
                placeholder="0,00"
              />
              <div style={{ fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                Ex: 800 = 8,00
              </div>
            </div>
          </div>
        </div>

        <div className="hr" />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={limparTopo}
            style={btnSoft}
            disabled={bloqueadoEdicao}
          >
            Limpar
          </button>
          <button
            type="button"
            onClick={adicionarItemAoEvento}
            disabled={!podeAdicionar || bloqueadoEdicao}
            style={{
              ...(podeAdicionar && !bloqueadoEdicao ? btnPrimary : btnSoft),
              opacity: podeAdicionar && !bloqueadoEdicao ? 1 : 0.55,
            }}
          >
            Adicionar
          </button>
        </div>
      </Card>

      {/* ===== ITENS DO EVENTO ===== */}
      <Card 
        title="Itens do Evento" 
        subtitle="Gerencie os produtos"
        style={{ marginTop: 16 }}
      >
        {itensEvento.length === 0 ? (
          <div style={{ textAlign: "center", padding: 32, color: "#6b7280" }}>
            📦 Nenhum item adicionado
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {itensEvento.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 10,
                  padding: 12,
                  borderRadius: 16,
                  border: "1px solid #e5e7eb",
                  background: "#fff",
                }}
              >
                <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 14,
                      border: "2px solid #e5e7eb",
                      background: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flex: "0 0 auto",
                    }}
                  >
                    <IconImg iconKey={p.iconKey} size={34} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>
                        {p.nome}
                      </span>
                      {!p.ativo && (
                        <span className="badge" style={{ background: "#111827", color: "#fff" }}>
                          INATIVO
                        </span>
                      )}
                      {p.tipo === "combo" && (
                        <span className="badge" style={{ background: "#dbeafe", color: "#1e40af" }}>
                          Combo{p.comboQtd ? ` x${p.comboQtd}` : ""}
                        </span>
                      )}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 14, color: "#2563eb", fontWeight: 600 }}>
                      R$ {fmtBRL(p.preco)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => toggleAtivo(p.id)}
                    style={btnSoft}
                    disabled={bloqueadoEdicao}
                  >
                    {p.ativo ? "Inativar" : "Ativar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => removerItem(p.id)}
                    style={btnDanger}
                    disabled={bloqueadoEdicao}
                  >
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="hr" />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
          <button
            type="button"
            onClick={limparItensEvento}
            style={btnSoft}
            disabled={bloqueadoEdicao || itensEvento.length === 0}
          >
            Limpar todos
          </button>

          {podeFinalizar && (
            <button
              type="button"
              onClick={() => {
                if (typeof onSalvarOfertaDoEvento === "function") {
                  onSalvarOfertaDoEvento(itensEvento);
                }
                if (typeof onFinalizarItens === "function") {
                  onFinalizarItens();
                }
              }}
              style={btnPrimary}
            >
              Finalizar itens
            </button>
          )}
        </div>
      </Card>

      {/* ===== ATALHOS ===== */}
      <Card 
        title="Atalhos" 
        subtitle="Toque para selecionar"
        style={{ marginTop: 16 }}
      >
        <div className="grid-3">
          {atalhosDisponiveis.map((it) => (
            <button
              key={it.key}
              className="atalho-button"
              onClick={() => escolherAtalho(it)}
              disabled={bloqueadoEdicao}
              title={it.nome}
            >
              <IconImg iconKey={it.key} size={42} />
              <div style={styles.produtoNomeClamp}>
                {it.nome}
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}