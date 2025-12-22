// src/pages/Ajustes.jsx
import React, { useMemo, useRef, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { readFileAsDataURL, fmtBRL } from "../domain/math";
import { useConfig } from "../config/ConfigProvider";

export default function Ajustes({ ajustes, setAjustes, hasEventoAberto }) {
  const [nomeOrg, setNomeOrg] = useState(ajustes?.nomeOrganizacao || "");
  const [rodape, setRodape] = useState(ajustes?.textoRodape || "");
  const [logoMaxHeightMm, setLogoMaxHeightMm] = useState(
    Number.isFinite(Number(ajustes?.logoMaxHeightMm))
      ? Number(ajustes?.logoMaxHeightMm)
      : 18
  );
  const [ticketMinHeightMm, setTicketMinHeightMm] = useState(
    Number.isFinite(Number(ajustes?.ticketMinHeightMm))
      ? Number(ajustes?.ticketMinHeightMm)
      : 120
  );
  const [ticketMaxHeightMm] = useState(
    Number.isFinite(Number(ajustes?.ticketMaxHeightMm))
      ? Number(ajustes?.ticketMaxHeightMm)
      : 150
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
      logoMaxHeightMm,
      ticketMinHeightMm,
      ticketMaxHeightMm,
    }));
    alert("Ajustes salvos!");
  }

  const preview = useMemo(() => {
    return {
      nome: (nomeOrg || "").trim() || "Nome do evento",
      data: new Date().toLocaleDateString("pt-BR"),
      logo: ajustes?.logoDataUrl || "",
      rodape: (rodape || "").trim() || "Obrigado pela preferência!",
      logoMaxHeightMm,
      ticketMinHeightMm,
      ticketMaxHeightMm,
      // exemplo do item (apenas preview)
      iconeProduto: "🥤",
      qtd: 1,
      produto: "Refrigerante lata",
      valor: 5,
    };
  }, [nomeOrg, rodape, ajustes?.logoDataUrl, logoMaxHeightMm, ticketMinHeightMm, ticketMaxHeightMm]);

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
      margin: "0 auto",
      background: "#fff",
      border: "1px solid #e5e7eb",
      borderRadius: 14,
      padding: "16px 14px",
      boxShadow: "0 10px 24px rgba(0,0,0,.10)",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    },

    inner: {
      width: "52mm",
      margin: "0 auto",
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
      margin: "4px 0 6px",
    },
    logoImg: {
      display: "block",
      width: "100%",
      maxWidth: "100%",
      height: "auto",
      maxHeight: "18mm",
      objectFit: "contain",
    },

    // ===== Linha do item (cara de ticket) =====
    linhaItem: {
      display: "grid",
      gridTemplateColumns: "1fr auto",
      gap: 10,
      alignItems: "baseline",
      padding: "6px 0",
    },
    itemLeft: {
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
    nomeItem: {
      fontWeight: 900,
      fontSize: 15,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    },
    preco: {
      fontWeight: 900,
      fontSize: 16,
      whiteSpace: "nowrap",
      textAlign: "right",
    },

    // Sub-linha opcional (se quiser detalhar)
    subLinha: {
      marginTop: 2,
      fontSize: 11,
      color: "#64748b",
      fontWeight: 700,
    },

    rodape: {
      textAlign: "center",
      fontSize: 13,
      fontWeight: 800,
      marginTop: 6,
      wordBreak: "break-word",
    },

    corte: {
      marginTop: 12,
      display: "flex",
      alignItems: "center",
      gap: 8,
      fontSize: 10,
      color: "#64748b",
      fontWeight: 800,
    },
    corteLine: { flex: 1, borderTop: "1px dashed #94a3b8" },
  };

  const isWide = typeof window !== "undefined" ? window.innerWidth >= 980 : false;

  return (
    <Card title="Ajustes" subtitle="Personalização do ticket">
      <div className="hr" />

      <div style={s.wrap}>
        {hasEventoAberto ? (
          <div className="muted" style={{ fontWeight: 800, marginBottom: 10 }}>
            Evento aberto — modelo do ticket bloqueado
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
                disabled={hasEventoAberto}
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
                disabled={hasEventoAberto}
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
                disabled={hasEventoAberto}
              />

              <div style={s.filePill}>
                <div className="muted" style={{ fontWeight: 900 }}>
                  {preview.logo ? "Logo selecionada" : "Nenhuma logo"}
                </div>

                <Button
                  variant="primary"
                  small
                  onClick={() => fileRef.current?.click()}
                  disabled={hasEventoAberto}
                >
                  Escolher arquivo
                </Button>

                {preview.logo ? (
                  <Button
                    variant="danger"
                    small
                    onClick={removerLogo}
                    disabled={hasEventoAberto}
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
                  min="8"
                  max="20"
                  step="1"
                  value={logoMaxHeightMm}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setLogoMaxHeightMm(next);
                    setAjustes((p) => ({ ...(p || {}), logoMaxHeightMm: next }));
                  }}
                  disabled={hasEventoAberto}
                  style={{ flex: 1 }}
                />
                <div style={{ fontWeight: 800, width: 50, textAlign: "right" }}>
                  {Number(logoMaxHeightMm)}mm
                </div>
              </div>
            </div>

            <div className="formActions">
              <Button variant="primary" onClick={salvar} disabled={hasEventoAberto}>
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
                  disabled={hasEventoAberto}
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
                minHeight: `${Math.max(120, Number(preview.ticketMinHeightMm || 120))}mm`,
              }}
            >
              <div style={s.inner}>
                {/* Cabeçalho */}
                <div style={s.title}>{preview.nome}</div>

                <div style={s.meta}>
                  <div>{preview.data}</div>
                </div>

                {preview.logo ? (
                  <>
                    <div style={s.dash} />
                    <div style={s.logoBox}>
                      <img
                        src={preview.logo}
                        alt="logo"
                        style={{
                          ...s.logoImg,
                          maxHeight: `${preview.logoMaxHeightMm || 18}mm`,
                        }}
                      />
                    </div>
                    <div style={s.dash} />
                  </>
                ) : (
                  <div style={s.dash} />
                )}

                {/* Item (layout de ticket: esquerda item / direita preço) */}
                <div style={s.linhaItem}>
                  <div style={s.itemLeft}>
                    <span aria-hidden="true">{preview.iconeProduto}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, minWidth: 0 }}>
                        <div style={s.qtd}>{preview.qtd}x</div>
                        <div style={s.nomeItem}>{preview.produto}</div>
                      </div>
                      <div style={s.subLinha}>Exemplo de item (prévia)</div>
                    </div>
                  </div>

                  <div style={s.preco}>{fmtBRL(preview.valor)}</div>
                </div>

                <div style={s.dash} />

                {/* Rodapé */}
                <div style={s.rodape}>{preview.rodape}</div>

                {/* Corte */}
                <div style={s.corte}>
                  <div style={s.corteLine} />
                  CORTE AQUI
                  <div style={s.corteLine} />
                </div>

                <div style={{ height: "10mm" }} />
              </div>
            </div>
            <div className="muted" style={{ marginTop: 8, fontWeight: 700 }}>
              Máx recomendado: {preview.ticketMaxHeightMm || 150}mm
            </div>
          </div>
        </div>

      </div>
    </Card>
  );
}
