// src/pages/Ajustes.jsx
import React, { useMemo, useRef, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { readFileAsDataURL, fmtBRL } from "../domain/math";
import { useConfig } from "../config/ConfigProvider";

export default function Ajustes({
  ajustes,
  setAjustes,
  hasEventoAberto,
  readOnly = false,
  onSalvar,
}) {
  const [nomeOrg, setNomeOrg] = useState(ajustes?.nomeOrganizacao || "");
  const [rodape, setRodape] = useState(ajustes?.textoRodape || "");
  const [logoAreaMm, setLogoAreaMm] = useState(
    Number.isFinite(Number(ajustes?.logoAreaMm)) ? Number(ajustes?.logoAreaMm) : 35
  );
  const { permitirMultiDispositivo, setPermitirMultiDispositivo } = useConfig();

  const fileRef = useRef(null);

  async function pickLogo(file) {
    if (!file) return;
    const url = await readFileAsDataURL(file);
    setAjustes((p) => ({ ...(p || {}), logoDataUrl: url }));
  }

  function removerLogo() {
    if (!confirm("Remover logo?")) return;
    setAjustes((p) => ({ ...(p || {}), logoDataUrl: "" }));
    if (fileRef.current) fileRef.current.value = "";
  }

  function salvar() {
    setAjustes((p) => ({
      ...(p || {}),
      nomeOrganizacao: nomeOrg,
      textoRodape: rodape,
      logoAreaMm,
    }));
    if (hasEventoAberto && typeof onSalvar === "function") {
      onSalvar();
    }
    alert("Ajustes salvos!");
  }

  const preview = useMemo(() => {
    return {
      nome: (nomeOrg || "").trim() || "Nome do evento",
      data: new Date().toLocaleDateString("pt-BR"),
      logo: ajustes?.logoDataUrl || "",
      rodape: (rodape || "").trim() || "Obrigado pela preferência!",
      logoAreaMm,
      // exemplo do item (apenas preview)
      qtd: 1,
      produto: "Refrigerante lata",
      valor: 5,
    };
  }, [nomeOrg, rodape, ajustes?.logoDataUrl, logoAreaMm]);

  const s = {
    // ===== Layout mobile-first =====
    wrap: { width: "100%" },

    // Em mobile: 1 coluna (ticket embaixo)
    grid: {
      display: "grid",
      gridTemplateColumns: "1fr",
      gap: 16,
      alignItems: "start",
    },

    // Em telas maiores: 2 colunas (lado a lado)
    gridWide: {
      display: "grid",
      gridTemplateColumns: "1.15fr 0.85fr",
      gap: 22,
      alignItems: "start",
    },

    // ===== File button pill =====
    filePill: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10,
      alignItems: "center",
      padding: "10px 12px",
      borderRadius: 999,
      border: "1px solid #e2e8f0",
      background: "#f8fafc",
    },

    // ===== Ticket container =====
    previewBox: {
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: 16,
      padding: 14,
    },

    ticket: {
      width: "58mm",
      maxWidth: "100%",
      height: "80mm",
      margin: "0 auto",
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 14,
      padding: "4mm 3mm",
      boxShadow: "0 10px 24px rgba(0,0,0,.10)",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    },

    inner: {
      width: "52mm",
      margin: "0 auto",
      height: "100%",
      display: "flex",
      flexDirection: "column",
    },
    title: {
      fontWeight: 900,
      fontSize: 18,
      textAlign: "center",
      lineHeight: 1.15,
      letterSpacing: 0.2,
      wordBreak: "break-word",
    },

    meta: {
      marginTop: 6,
      display: "flex",
      justifyContent: "center",
      gap: 10,
      fontSize: 12,
      color: "#475569",
      fontWeight: 700,
    },

    dash: { borderTop: "1px dashed #cbd5e1", margin: "12px 0" },

    logoBox: {
      height: `${preview.logoAreaMm || 35}mm`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      margin: "1mm 0 2mm",
    },
    logoImg: {
      display: "block",
      maxWidth: "100%",
      maxHeight: "100%",
      width: "auto",
      height: "auto",
      objectFit: "contain",
    },

    // ===== Linha do item (cara de ticket) =====
    itemBlock: {
      padding: "6px 0",
      display: "flex",
      flexDirection: "column",
      gap: 4,
    },
    itemTop: {
      display: "flex",
      alignItems: "baseline",
      gap: 8,
      minWidth: 0,
    },
    qtd: {
      fontWeight: 900,
      fontSize: 14,
      whiteSpace: "nowrap",
    },
    itemName: {
      fontWeight: 900,
      fontSize: 15,
      whiteSpace: "nowrap",
      overflow: "hidden",
      textOverflow: "clip",
    },
    itemBottom: {
      display: "flex",
      justifyContent: "flex-end",
    },
    price: {
      fontWeight: 900,
      fontSize: 16,
      whiteSpace: "nowrap",
    },

    // Sub-linha opcional (se quiser detalhar)
    subLinha: {
      marginTop: 2,
      fontSize: 11,
      color: "#64748b",
      fontWeight: 700,
    },

    push: {
      flex: 1,
    },
    rodape: {
      textAlign: "center",
      fontSize: 13,
      fontWeight: 800,
      wordBreak: "break-word",
    },

    corte: {
      marginTop: "2mm",
      fontWeight: 800,
      letterSpacing: 1,
      fontSize: 10,
      color: "#64748b",
      textAlign: "center",
    },
  };

  const isWide = typeof window !== "undefined" ? window.innerWidth >= 980 : false;

  return (
    <Card title="Ajustes" subtitle="Personalização do ticket">
      <div className="hr" />

      <div style={s.wrap}>
        {readOnly ? (
          <div className="muted" style={{ fontWeight: 800, marginBottom: 10 }}>
            Evento em andamento — ajustes bloqueados
          </div>
        ) : null}
        <div style={isWide ? s.gridWide : s.grid}>
          {/* ===================== FORM ===================== */}
          <div className="formGrid">
            <div>
              <div className="muted" style={{ marginBottom: 6 }}>
                Nome do evento
              </div>
              <input
                className="input"
                value={nomeOrg}
                onChange={(e) => setNomeOrg(e.target.value)}
                placeholder="Ex: Festa da Linguiça"
                disabled={readOnly}
              />
            </div>

            <div className="fullRow">
              <div className="muted" style={{ marginBottom: 6 }}>
                Texto do rodapé
              </div>
              <input
                className="input"
                value={rodape}
                onChange={(e) => setRodape(e.target.value)}
                placeholder="Ex: Obrigado pela preferência!"
                disabled={readOnly}
              />
            </div>

            <div className="fullRow">
              <div className="muted" style={{ marginBottom: 6 }}>
                Logo (opcional)
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => pickLogo(e.target.files?.[0])}
                disabled={readOnly}
              />

              <div style={s.filePill}>
                <div className="muted" style={{ fontWeight: 900 }}>
                  {preview.logo ? "Logo selecionada" : "Nenhuma logo"}
                </div>

                <Button
                  variant="primary"
                  small
                  onClick={() => fileRef.current?.click()}
                  disabled={readOnly}
                >
                  Escolher arquivo
                </Button>

                {preview.logo ? (
                  <Button
                    variant="danger"
                    small
                    onClick={removerLogo}
                    disabled={readOnly}
                  >
                    Remover
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="fullRow">
              <div className="muted" style={{ marginBottom: 6 }}>
                Altura da logo (mm)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="range"
                  min="10"
                  max="40"
                  step="1"
                  value={logoAreaMm}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setLogoAreaMm(next);
                    setAjustes((p) => ({ ...(p || {}), logoAreaMm: next }));
                  }}
                  disabled={readOnly}
                  style={{ flex: 1 }}
                />
                <div style={{ fontWeight: 800, width: 50, textAlign: "right" }}>
                  {Number(logoAreaMm || 35)}mm
                </div>
              </div>
            </div>

            <div className="formActions">
              <Button variant="primary" onClick={salvar} disabled={readOnly}>
                Salvar
              </Button>
            </div>

            <div className="fullRow" style={{ marginTop: 8 }}>
              <div className="muted" style={{ marginBottom: 6 }}>
                Permitir multi-dispositivo
              </div>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  fontWeight: 700,
                }}
              >
                <input
                  type="checkbox"
                  checked={Boolean(permitirMultiDispositivo)}
                  onChange={(e) => setPermitirMultiDispositivo(e.target.checked)}
                  disabled={readOnly}
                />
                Habilitar uso do PDV em mais de um dispositivo
              </label>
            </div>

            <div className="muted" style={{ marginTop: 4 }}>
              No celular, a pré-visualização fica abaixo para não desconfigurar.
            </div>
          </div>

          {/* ===================== PREVIEW (TICKET) ===================== */}
          <div style={s.previewBox}>
            <div className="muted" style={{ fontWeight: 900, marginBottom: 10 }}>
              Pré-visualização do ticket
            </div>

            <div
              style={{
                ...s.ticket,
              }}
            >
              <div style={s.inner}>
                {/* Cabeçalho */}
                <div style={s.title}>{preview.nome}</div>

                <div style={s.meta}>
                  <div>{preview.data}</div>
                </div>

                <div style={s.dash} />
                <div style={s.logoBox}>
                  {preview.logo ? (
                    <img src={preview.logo} alt="logo" style={s.logoImg} />
                  ) : null}
                </div>
                <div style={s.dash} />

                {/* Item (layout de ticket: nome em uma linha, preço abaixo) */}
                <div style={s.itemBlock}>
                  <div style={s.itemTop}>
                    <span style={s.qtd}>{preview.qtd}x</span>
                    <span
                      style={{
                        ...s.itemName,
                        fontSize:
                          preview.produto.length > 26
                            ? 12
                            : preview.produto.length > 18
                              ? 13
                              : s.itemName.fontSize,
                      }}
                    >
                      {preview.produto}
                    </span>
                  </div>
                  <div style={s.itemBottom}>
                    <span style={s.price}>{fmtBRL(preview.valor)}</span>
                  </div>
                  <div style={s.subLinha}>Exemplo de item (prévia)</div>
                </div>

                <div style={s.dash} />

                {/* Rodapé */}
                <div style={s.push} />
                <div style={s.rodape}>{preview.rodape}</div>
                <div style={s.corte}>CORTE AQUI</div>
              </div>
            </div>
            <div className="muted" style={{ marginTop: 8, fontWeight: 700 }}>
              Tamanho fixo: 58mm x 80mm
            </div>
          </div>
        </div>

      </div>
    </Card>
  );
}
