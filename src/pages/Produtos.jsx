// src/pages/Produtos.jsx
import React, { useMemo, useRef, useState, useEffect, Component } from "react";
import Select from "react-select";
import Card from "../components/Card";
import { ICONS } from "../domain/icons";

/* ===================== helpers ===================== */
function mkId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    String(Date.now()) + "-" + Math.random().toString(16).slice(2)
  );
}

// máscara: digita "1" -> 0,01 | "12" -> 0,12 | "123" -> 1,23 | "1234" -> 12,34
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

/* ===================== ícones (imagens realistas) ===================== */

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

  // ✅ NOVOS
  { key: "almoco_socio", nome: "Almoço do Sócio" },
  { key: "prato_talher", nome: "Prato e Talher" },
];

/* ===================== botões ===================== */
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
const btnSoft = { ...btnBase, background: "#f8fafc" };

/* ===================== react-select (com fallback e sem tela branca) ===================== */
const TIPO_OPTIONS = [
  { value: "unitario", label: "Venda unitária" },
  { value: "combo", label: "Combo" },
];

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

class SelectErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(err) {
    // evita tela branca; mantém log
    console.error("react-select quebrou, usando fallback nativo:", err);
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

function TipoSelectSafe({ value, onChange }) {
  const fallback = (
    <select
      className="input"
      value={value?.value || "unitario"}
      onChange={(e) => {
        const opt =
          TIPO_OPTIONS.find((o) => o.value === e.target.value) || TIPO_OPTIONS[0];
        onChange(opt);
      }}
      style={{ height: 44, borderRadius: 14, fontWeight: 900 }}
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
      />
    </SelectErrorBoundary>
  );
}

/* ===================== UI helpers ===================== */
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
      onError={(e) => {
        // se não existir imagem, não quebra layout
        e.currentTarget.style.display = "none";
      }}
    />
  );
}

function getScrollParent(node) {
  let parent = node?.parentElement;
  while (parent) {
    const style = window.getComputedStyle(parent);
    const overflowY = style.overflowY || style.overflow;
    if (
      /(auto|scroll)/i.test(overflowY) &&
      parent.scrollHeight > parent.clientHeight
    ) {
      return parent;
    }
    parent = parent.parentElement;
  }
  return null;
}

function getHeaderHeight() {
  const header =
    document.querySelector("header") ||
    document.querySelector("[data-header]") ||
    document.querySelector(".topbar") ||
    document.querySelector(".header");
  return header?.getBoundingClientRect?.().height || 0;
}

/* ===================== componente ===================== */
export default function Produtos({
  produtos = [],
  setProdutos = () => {},
  onSalvarOfertaDoEvento,
  onFinalizarItens,
  readOnly = false,
  itensFinalizados = false,
}) {
  const itensEvento = useMemo(
    () => (Array.isArray(produtos) ? produtos : []),
    [produtos]
  );

  const atalhosDisponiveis = useMemo(() => LIB, []);

  const [nome, setNome] = useState("");
  const [precoDigits, setPrecoDigits] = useState("");
  const [tipo, setTipo] = useState(TIPO_OPTIONS[0]);
  const [comboQtd, setComboQtd] = useState("4");
  const [atalhoKey, setAtalhoKey] = useState("");
  const [pendingScroll, setPendingScroll] = useState(false);

  const precoBRL = digitsToBRL(precoDigits);
  const precoNum = brlToNumber(precoBRL);

  const podeAdicionar =
    Boolean(nome.trim()) &&
    precoNum > 0 &&
    (tipo?.value !== "combo" || (parseInt(comboQtd, 10) || 0) >= 2);

  // ✅ refs para rolar pro topo e focar o preço
  const topoRef = useRef(null);
  const precoRef = useRef(null);

  useEffect(() => {
    if (!pendingScroll) return undefined;
    let raf1 = 0;
    let raf2 = 0;
    let focusTimer = 0;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const topo = topoRef.current;
        if (!topo?.getBoundingClientRect) {
          setPendingScroll(false);
          return;
        }

        const scroller =
          getScrollParent(topo) ||
          document.scrollingElement ||
          document.documentElement;
        const headerH = getHeaderHeight();
        const EXTRA = 34;
        const OFFSET = headerH + EXTRA;
        const rect = topo.getBoundingClientRect();
        const isDocScroller =
          scroller === document.scrollingElement ||
          scroller === document.documentElement ||
          scroller === document.body;
        const currentTop = isDocScroller ? window.scrollY : scroller.scrollTop;
        const target = Math.max(0, currentTop + rect.top - OFFSET);

        if (isDocScroller) {
          window.scrollTo({ top: target, behavior: "smooth" });
        } else {
          scroller.scrollTo({ top: target, behavior: "smooth" });
        }
        setPendingScroll(false);

        focusTimer = window.setTimeout(() => {
          try {
            precoRef.current?.focus?.();
            precoRef.current?.select?.();
          } catch (_) {}
        }, 300);
      });
    });

    return () => {
      if (raf1) cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [pendingScroll]);

  function limparTopo() {
    setNome("");
    setPrecoDigits("");
    setTipo(TIPO_OPTIONS[0]);
    setComboQtd("4");
    setAtalhoKey("");
  }

  const bloqueadoEdicao = readOnly;

  function scrollTopoEFocusPreco() {
    setPendingScroll(true);
  }

  function escolherAtalho(it) {
    if (bloqueadoEdicao) return;
    setNome(it.nome);
    setAtalhoKey(it.key);

    // ✅ sobe até o formulário e deixa o campo de preço visível
    scrollTopoEFocusPreco();
  }

  function getIconKeyForItem(nm) {
    const keyByName = LIB.find(
      (x) => String(x.nome).trim() === String(nm).trim()
    )?.key;
    return keyByName || atalhoKey || "";
  }

  function isBarrilNome(nm) {
    const nomeNormalizado = String(nm || "").toLowerCase();
    return (
      nomeNormalizado.includes("barril") || getIconKeyForItem(nm) === "barril"
    );
  }

  function adicionarItemAoEvento() {
    if (bloqueadoEdicao) return;
    if (!podeAdicionar) return;

    const nm = String(nome || "").trim();
    const t = tipo?.value === "combo" ? "combo" : "unitario";
    const qtdCombo =
      t === "combo" ? Math.max(2, parseInt(comboQtd || "2", 10) || 2) : null;
    const varKey = `${nm}__${t}__${qtdCombo ?? ""}`;
    const iconKey = getIconKeyForItem(nm) || "ref_600";
    const barril = isBarrilNome(nm) || iconKey === "barril";

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
        return cp;
      }
      return [...arr, payload];
    });

    limparTopo();
  }

  function removerItem(id) {
    if (bloqueadoEdicao) return;
    setProdutos((prev) =>
      (Array.isArray(prev) ? prev : []).filter((x) => x.id !== id)
    );
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
    if (!confirm("Limpar todos os itens do evento?")) return;
    setProdutos([]);
  }

  const podeFinalizar = itensEvento.length >= 1 && !readOnly;
  const barrilAtual = isBarrilNome(nome);
  const produtoNomeClampStyle = {
    fontWeight: 950,
    fontSize: 12,
    textAlign: "center",
    lineHeight: 1.15,
    maxWidth: "100%",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    whiteSpace: "normal",
    wordBreak: "break-word",
    color: "#2563eb",
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* ✅ âncora para scroll (no topo real do formulário) */}
      <div ref={topoRef} style={{ height: 1 }} />

      {/* ===== CADASTRO ===== */}
      <Card title="Produtos" subtitle="Selecione no atalho, digite o preço e adicione.">
        {readOnly && (
          <div className="badge" style={{ marginBottom: 10 }}>
            Caixa aberto ou vendas registradas. Edição bloqueada.
          </div>
        )}
        {itensFinalizados && (
          <div className="badge" style={{ marginBottom: 10 }}>
            Itens do evento finalizados.
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
                  border: "1px solid #e5e7eb",
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
                className="input"
                placeholder="Toque em um atalho abaixo..."
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                style={{ fontSize: 16 }}
                disabled={bloqueadoEdicao}
              />
            </div>
          </div>

          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Tipo
            </div>

            {/* ✅ react-select com proteção (sem tela branca) */}
            <TipoSelectSafe
              value={tipo}
              onChange={bloqueadoEdicao ? () => {} : setTipo}
            />
          </div>

          {tipo?.value === "combo" && (
            <div>
              <div className="muted" style={{ marginBottom: 6 }}>
                Combo de quantos itens?
              </div>
              <input
                className="input"
                value={comboQtd}
                onChange={(e) => setComboQtd(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="Ex: 4"
                style={{ fontSize: 16 }}
                disabled={bloqueadoEdicao}
              />
            </div>
          )}

          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              {barrilAtual ? "Preço (por litro)" : "Preço"}
            </div>
            <input
              ref={precoRef}
              className="input"
              value={precoBRL}
              onChange={(e) =>
                setPrecoDigits(String(e.target.value || "").replace(/\D/g, ""))
              }
              inputMode="numeric"
              style={{ fontSize: 18, fontWeight: 900 }}
              disabled={bloqueadoEdicao}
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {barrilAtual
                ? "Digite só números (ex: 1800 = 18,00 por litro)."
                : "Digite só números (ex: 800 = 8,00)."}
            </div>
          </div>
        </div>

        <div className="hr" />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={adicionarItemAoEvento}
            disabled={!podeAdicionar || bloqueadoEdicao}
            style={{
              ...(podeAdicionar && !bloqueadoEdicao ? btnPrimary : btnSoft),
              opacity: podeAdicionar && !bloqueadoEdicao ? 1 : 0.55,
              cursor: podeAdicionar && !bloqueadoEdicao ? "pointer" : "not-allowed",
            }}
          >
            Adicionar item ao evento
          </button>

          <button
            type="button"
            onClick={limparTopo}
            style={btnSoft}
            disabled={bloqueadoEdicao}
          >
            Limpar
          </button>
        </div>
      </Card>

      {/* ===== ITENS DO EVENTO ===== */}
      <Card title="Itens do evento" subtitle="">
        {itensEvento.length === 0 ? (
          <div className="muted">Nenhum item adicionado ainda.</div>
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
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 14,
                        border: "1px solid #e5e7eb",
                        background: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flex: "0 0 auto",
                      }}
                    >
                      <IconImg iconKey={p.iconKey} size={34} />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 950,
                          fontSize: 15,
                          color: "#111827",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: 220,
                        }}
                        title={p.nome}
                      >
                        {p.nome}
                      </div>

                      <div className="muted" style={{ marginTop: 2 }}>
                        R$ {fmtBRL(p.preco)}
                      </div>
                    </div>

                    {!p.ativo && (
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
                        INATIVO
                      </span>
                    )}

                    {p.tipo === "combo" && (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 900,
                          padding: "3px 8px",
                          borderRadius: 999,
                          background: "#f3f4f6",
                          color: "#111827",
                          border: "1px solid #e5e7eb",
                        }}
                      >
                        Combo{p.comboQtd ? ` x${p.comboQtd}` : ""}
                      </span>
                    )}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                  }}
                >
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

        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            onClick={limparItensEvento}
            style={btnSoft}
            disabled={bloqueadoEdicao}
          >
            Limpar itens do evento
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
              Finalizar itens do evento
            </button>
          )}
        </div>
      </Card>

      {/* ===== ATALHOS ===== */}
      <Card title="Atalhos" subtitle="">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 8,
          }}
        >
          {atalhosDisponiveis.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => escolherAtalho(it)}
              disabled={bloqueadoEdicao}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#fff",
                padding: 8,
                cursor: bloqueadoEdicao ? "not-allowed" : "pointer",
                opacity: bloqueadoEdicao ? 0.6 : 1,
                minHeight: 98,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: 4,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <IconImg iconKey={it.key} size={42} />

              <div style={produtoNomeClampStyle} title={it.nome}>
                {it.nome}
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}