// src/pages/Produtos.jsx
import React, { useMemo, useState } from "react";
import Select from "react-select";
import Card from "../components/Card";

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
const ICONS = {
  agua: "/icons/agua.png",
  ref_lata: "/icons/refri-lata.png",
  ref_600: "/icons/refri-600.png",
  ref_2l: "/icons/refri-2l.png",
  cer_lata: "/icons/cerveja-lata.png",
  cer_garrafa: "/icons/cerveja-garrafa.png",
  chope: "/icons/chope.png",
  barril: "/icons/barril.png",
  lanche: "/icons/lanche.png",
  sobremesa: "/icons/sobremesa.png",
  sorvete: "/icons/sorvete.png",
  fichas: "/icons/fichas.png",
  suco: "/icons/suco.png",
};

const LIB = [
  { key: "agua", nome: "Água (500ml)" },

  { key: "ref_lata", nome: "Refrigerante Lata" },
  { key: "ref_600", nome: "Refrigerante 600ml" },
  { key: "ref_2l", nome: "Refrigerante 2L" },

  { key: "cer_lata", nome: "Cerveja Lata" },
  { key: "cer_garrafa", nome: "Cerveja Garrafa" },

  { key: "chope", nome: "Chope (Copo)" },
  { key: "barril", nome: "Barril de chope" },

  { key: "lanche", nome: "Lanche" },
  { key: "sobremesa", nome: "Sobremesa" },
  { key: "sorvete", nome: "Sorvete" },

  { key: "fichas", nome: "Fichas" },

  { key: "suco", nome: "Suco" },
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

class SelectErrorBoundary extends React.Component {
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
        const opt = TIPO_OPTIONS.find((o) => o.value === e.target.value) || TIPO_OPTIONS[0];
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

/* ===================== componente ===================== */
export default function Produtos({ produtos = [], setProdutos, setTab }) {
  const itensEvento = useMemo(() => (Array.isArray(produtos) ? produtos : []), [produtos]);

  const [nome, setNome] = useState("");
  const [precoDigits, setPrecoDigits] = useState("");
  const [tipo, setTipo] = useState(TIPO_OPTIONS[0]);
  const [comboQtd, setComboQtd] = useState("4");
  const [atalhoKey, setAtalhoKey] = useState("");

  const precoBRL = digitsToBRL(precoDigits);
  const precoNum = brlToNumber(precoBRL);

  const podeAdicionar =
    Boolean(nome.trim()) &&
    precoNum > 0 &&
    (tipo?.value !== "combo" || (parseInt(comboQtd, 10) || 0) >= 2);

  function limparTopo() {
    setNome("");
    setPrecoDigits("");
    setTipo(TIPO_OPTIONS[0]);
    setComboQtd("4");
    setAtalhoKey("");
  }

  function escolherAtalho(it) {
    setNome(it.nome);
    setAtalhoKey(it.key);
  }

  function getIconKeyForItem(nm) {
    const found = LIB.find((x) => x.nome === nm);
    return found?.key || atalhoKey || "";
  }

  function adicionarItemAoEvento() {
    if (!podeAdicionar) return;

    const nm = String(nome || "").trim();
    const t = tipo?.value === "combo" ? "combo" : "unitario";
    const qtdCombo = t === "combo" ? Math.max(2, parseInt(comboQtd || "2", 10) || 2) : null;
    const iconKey = getIconKeyForItem(nm);

    setProdutos((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const idx = arr.findIndex((p) => String(p?.nome || "").trim() === nm);

      const payload = {
        id: idx >= 0 ? arr[idx].id : mkId(),
        nome: nm,
        preco: precoNum,
        ativo: true,
        tipo: t,
        comboQtd: qtdCombo,
        iconKey,
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
    setProdutos((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x.id !== id));
  }

  function toggleAtivo(id) {
    setProdutos((prev) =>
      (Array.isArray(prev) ? prev : []).map((p) => (p.id === id ? { ...p, ativo: !p.ativo } : p))
    );
  }

  function limparItensEvento() {
    if (!confirm("Limpar todos os itens do evento?")) return;
    setProdutos([]);
  }

  const podeFinalizar = itensEvento.length >= 1;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {/* ===== CADASTRO ===== */}
      <Card title="Produtos" subtitle="Selecione no atalho, digite o preço e adicione.">
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
              />
            </div>
          </div>

          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Tipo
            </div>

            {/* ✅ react-select com proteção (sem tela branca) */}
            <TipoSelectSafe value={tipo} onChange={setTipo} />
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
              />
            </div>
          )}

          <div>
            <div className="muted" style={{ marginBottom: 6 }}>
              Preço
            </div>
            <input
              className="input"
              value={precoBRL}
              onChange={(e) => setPrecoDigits(String(e.target.value || "").replace(/\D/g, ""))}
              inputMode="numeric"
              style={{ fontSize: 18, fontWeight: 900 }}
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              Digite só números (ex: 800 = 8,00).
            </div>
          </div>
        </div>

        <div className="hr" />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={adicionarItemAoEvento}
            disabled={!podeAdicionar}
            style={{
              ...(podeAdicionar ? btnPrimary : btnSoft),
              opacity: podeAdicionar ? 1 : 0.55,
              cursor: podeAdicionar ? "pointer" : "not-allowed",
            }}
          >
            Adicionar item ao evento
          </button>

          <button type="button" onClick={limparTopo} style={btnSoft}>
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

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button type="button" onClick={() => toggleAtivo(p.id)} style={btnSoft}>
                    {p.ativo ? "Inativar" : "Ativar"}
                  </button>
                  <button type="button" onClick={() => removerItem(p.id)} style={btnDanger}>
                    Remover
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="hr" />

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between" }}>
          <button type="button" onClick={limparItensEvento} style={btnSoft}>
            Limpar itens do evento
          </button>

          {podeFinalizar && (
            <button
              type="button"
              onClick={() => (typeof setTab === "function" ? setTab("caixa") : null)}
              style={btnPrimary}
            >
              Finalizar produtos
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
            gap: 10,
          }}
        >
          {LIB.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={() => escolherAtalho(it)}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 18,
                background: "#fff",
                padding: 12,
                cursor: "pointer",
                minHeight: 86,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <IconImg iconKey={it.key} size={46} />

              <div
                style={{
                  fontWeight: 950,
                  fontSize: 13,
                  textAlign: "center",
                  lineHeight: 1.1,
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "#2563eb",
                }}
                title={it.nome}
              >
                {it.nome}
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
