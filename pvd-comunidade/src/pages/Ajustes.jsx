// src/pages/Ajustes.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

  const LOGO_SLOT_MM = 35;
  const logoAlturaMm = Number.isFinite(Number(ajustes?.logoImgMm))
    ? Number(ajustes?.logoImgMm)
    : 20;

  useEffect(() => {
    if (!Number.isFinite(Number(ajustes?.logoImgMm))) {
      setAjustes((p) => ({ ...(p || {}), logoImgMm: 20 }));
    }
  }, [ajustes?.logoImgMm, setAjustes]);

  function salvar() {
    setAjustes((p) => ({
      ...(p || {}),
      nomeOrganizacao: nomeOrg,
      textoRodape: rodape,
      logoImgMm: logoAlturaMm,
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
      logoImgMm: logoAlturaMm,
      // exemplo do item (apenas preview)
      qtd: 1,
      produto: "Refrigerante lata",
      valor: 5,
    };
  }, [nomeOrg, rodape, ajustes?.logoDataUrl, logoAlturaMm]);

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
      boxSizing: "border-box",
      boxShadow: "0 10px 24px rgba(0,0,0,.10)",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      position: "relative",
      overflow: "hidden",
    },

    inner: {
      width: "52mm",
      margin: "0 auto",
      height: "100%",
      display: "flex",
      flexDirection: "column",
    },
    content: {
      paddingBottom: "10mm",
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
      marginTop: "1mm",
      display: "flex",
      justifyContent: "center",
      gap: 10,
      fontSize: 11,
      color: "#475569",
      fontWeight: 700,
    },

    dash: { borderTop: "1px dashed #cbd5e1", margin: "1.5mm 0" },

    logoBox: {
      height: `${LOGO_SLOT_MM}mm`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      margin: "1mm 0 2mm 0",
    },
    logoImg: {
      display: "block",
      height: `${preview.logoImgMm || 20}mm`,
      maxHeight: `${LOGO_SLOT_MM}mm`,
      maxWidth: "100%",
      width: "auto",
      objectFit: "contain",
    },

    // ===== Linha do item (cara de ticket) =====
    itemBlock: {
      padding: "1mm 0",
      display: "flex",
      flexDirection: "column",
      gap: 2,
    },
    itemTop: {
      display: "flex",
      alignItems: "baseline",
      gap: 8,
      minWidth: 0,
    },
    qtd: {
      fontWeight: 900,
      fontSize: 13,
      whiteSpace: "nowrap",
    },
    itemName: {
      fontWeight: 900,
      fontSize: 14,
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
      fontSize: 15,
      whiteSpace: "nowrap",
    },

    // Sub-linha opcional (se quiser detalhar)
    subLinha: {
      marginTop: "0.5mm",
      fontSize: 10,
      color: "#64748b",
      fontWeight: 700,
    },

    rodape: {
      textAlign: "center",
      fontSize: 12,
      fontWeight: 800,
      wordBreak: "break-word",
    },

    cutlineWrap: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: "3mm",
      textAlign: "center",
    },
    cutline: {
      borderTop: "1px dashed #94a3b8",
      margin: "0 2mm",
    },
    cuttext: {
      fontWeight: 800,
      letterSpacing: 1,
      fontSize: 9,
      color: "#64748b",
      opacity: 0.7,
      marginTop: "1mm",
    },
  };

  const isWide = typeof window !== "undefined" ? window.innerWidth >= 980 : false;
  const previewTitulo = `${preview.qtd}x ${preview.produto}`.trim();
  const previewItemFont =
    previewTitulo.length > 24 ? 12 : previewTitulo.length > 18 ? 13 : 14;

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
                  max="30"
                  step="0.5"
                  value={logoAlturaMm}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setAjustes((p) => ({ ...(p || {}), logoImgMm: v }));
                  }}
                  onInput={(e) => {
                    const v = Number(e.target.value);
                    setAjustes((p) => ({ ...(p || {}), logoImgMm: v }));
                  }}
                  disabled={readOnly}
                  style={{ flex: 1, width: "100%", touchAction: "pan-x" }}
                />
                <div style={{ fontWeight: 800, width: 50, textAlign: "right" }}>
                  {logoAlturaMm.toFixed(1)}mm
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
                <div style={s.content}>
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
                          fontSize: previewItemFont,
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
                  <div style={s.rodape}>{preview.rodape}</div>
                </div>

                <div style={s.cutlineWrap}>
                  <div style={s.cutline} />
                  <div style={s.cuttext}>CORTE AQUI</div>
                </div>
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
