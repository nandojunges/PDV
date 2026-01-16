// src/pages/Ajustes.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { readFileAsDataURL, fmtBRL } from "../domain/math";
import { ICONS } from "../domain/icons";
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
  const [logoFileName, setLogoFileName] = useState("");
  const { permitirMultiDispositivo, setPermitirMultiDispositivo } = useConfig();

  const fileRef = useRef(null);

  async function pickLogo(file) {
    if (!file) return;
    const url = await readFileAsDataURL(file);
    setAjustes((p) => ({ ...(p || {}), logoDataUrl: url }));
    setLogoFileName(file.name || "logo");
  }

  function removerLogo() {
    if (!confirm("Remover logo?")) return;
    setAjustes((p) => ({ ...(p || {}), logoDataUrl: "" }));
    setLogoFileName("");
    if (fileRef.current) fileRef.current.value = "";
  }

  const LOGO_SLOT_MM = 35;
  const logoAlturaMm = Number.isFinite(Number(ajustes?.logoImgMm))
    ? Number(ajustes?.logoImgMm)
    : 20;

  useEffect(() => {
    const next = {};
    if (!Number.isFinite(Number(ajustes?.logoImgMm))) {
      next.logoImgMm = 20;
    }
    if (typeof ajustes?.impressaoEcoImagem !== "boolean") {
      next.impressaoEcoImagem = false;
    }
    if (typeof ajustes?.ticketTopoTextoBold !== "boolean") {
      next.ticketTopoTextoBold = false;
    }
    if (Object.keys(next).length > 0) {
      setAjustes((p) => ({ ...(p || {}), ...next }));
    }
  }, [
    ajustes?.logoImgMm,
    ajustes?.impressaoEcoImagem,
    ajustes?.ticketTopoTextoBold,
    setAjustes,
  ]);

  function salvar() {
    setAjustes((p) => ({
      ...(p || {}),
      nomeOrganizacao: nomeOrg,
      textoRodape: rodape,
      logoImgMm: logoAlturaMm,
      ticketImagemModo: ajustes?.ticketImagemModo || "produto",
      ticketTopoTexto: (ajustes?.ticketTopoTexto || "").toUpperCase(),
      ticketTopoTextoBold: Boolean(ajustes?.ticketTopoTextoBold),
      impressaoEcoImagem: Boolean(ajustes?.impressaoEcoImagem),
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
      iconKey: "ref_lata",
      // exemplo do item (apenas preview)
      qtd: 1,
      produto: "Refrigerante lata",
      valor: 5,
    };
  }, [nomeOrg, rodape, ajustes?.logoDataUrl, logoAlturaMm]);

  const textoTopoTicket = (ajustes?.ticketTopoTexto || "").toUpperCase();
  const textoTopoTicketBold = Boolean(ajustes?.ticketTopoTextoBold);
  const TEXT_MAX_LINES = 2;
  const TEXT_MAX_CHARS_PER_LINE = 22;

  function normalizeTicketTexto(value) {
    const upper = String(value || "").toUpperCase().replace(/\r/g, "");
    const lines = upper.split("\n").slice(0, TEXT_MAX_LINES);
    const trimmedLines = lines.map((line) =>
      line.slice(0, TEXT_MAX_CHARS_PER_LINE),
    );
    return trimmedLines.join("\n");
  }

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

    // ===== Logo upload =====
    logoUploadCard: {
      marginTop: 12,
      padding: "12px 14px",
      borderRadius: 12,
      border: "1px solid #e2e8f0",
      background: "#f8fafc",
      display: "flex",
      flexDirection: "column",
      gap: 12,
    },
    logoUploadLine: {
      fontWeight: 900,
      color: "#0f172a",
      wordBreak: "break-word",
    },
    logoUploadActions: {
      display: "flex",
      flexWrap: "wrap",
      gap: 10,
      alignItems: "center",
    },

    // ===== Ticket container =====
    previewBox: {
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      borderRadius: 16,
      padding: 14,
    },

    // ✅ Ticket (layout antigo correto)
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
    logoText: {
      textAlign: "center",
      whiteSpace: "pre-line",
      wordBreak: "break-word",
      lineHeight: 1.1,
      fontSize: 20,
      padding: "0 4mm",
    },
    rangeWrap: {
      flex: 1,
      padding: "10px 8px",
      borderRadius: 12,
      background: "#f8fafc",
    },
    rangeInput: {
      flex: 1,
      width: "100%",
      height: 40,
      padding: "8px 0",
      touchAction: "pan-x",
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

    subLinha: {
      marginTop: "0.5mm",
      fontSize: 10,
      color: "#64748b",
      fontWeight: 700,
    },

    // ✅ empurra rodapé/corte para o fim sem quebrar
    push: { flex: 1 },

    rodape: {
      textAlign: "center",
      fontSize: 12,
      fontWeight: 800,
      wordBreak: "break-word",
    },

    // ✅ corte no fluxo (layout antigo perfeito)
    corte: {
      marginTop: "2mm",
      paddingTop: "2mm",
      borderTop: "1px dashed #94a3b8",
      fontWeight: 800,
      letterSpacing: 1,
      fontSize: 10,
      color: "#64748b",
      textAlign: "center",
    },
  };

  const isWide =
    typeof window !== "undefined" ? window.innerWidth >= 980 : false;

  const previewTitulo = `${preview.qtd}x ${preview.produto}`.trim();
  const previewItemFont =
    previewTitulo.length > 24 ? 12 : previewTitulo.length > 18 ? 13 : 14;
  const rawModoImagem = String(ajustes?.ticketImagemModo || "").toLowerCase();
  const modoImagem = rawModoImagem
    ? /texto/i.test(rawModoImagem)
      ? "texto"
      : /logo/i.test(rawModoImagem)
        ? "logo"
        : /produto|icone|ícone|icon|product/i.test(rawModoImagem)
          ? "produto"
          : "produto"
    : "produto";
  const previewIconKey = preview.iconKey || "ref_600";
  const previewImgSrc =
    modoImagem === "logo"
      ? preview.logo
      : modoImagem === "produto"
        ? ICONS[previewIconKey] || ICONS.ref_600
        : "";
  const previewImgStyle = s.logoImg;
  const previewTextoTopo =
    modoImagem === "texto" ? textoTopoTicket.trim() : "";
  const logoTextFontSizePx = Math.round(logoAlturaMm * 0.9) + 6;
  const previewTextoTopoStyle = {
    ...s.logoText,
    fontWeight: textoTopoTicketBold ? 900 : 700,
    fontFamily: textoTopoTicketBold
      ? '"Arial Black", "Impact", system-ui, -apple-system, Segoe UI, Roboto, Arial'
      : "system-ui, -apple-system, Segoe UI, Roboto, Arial",
    color: previewTextoTopo ? "#0f172a" : "#94a3b8",
    opacity: previewTextoTopo ? 1 : 0.6,
    lineHeight: textoTopoTicketBold ? 1.05 : 1.12,
    fontSize: `${logoTextFontSizePx}px`,
  };

  return (
    <Card title="Ajustes" subtitle="Personalização do ticket">
      <div className="hr" />

      <div style={s.wrap}>
        {readOnly ? (
          <div className="muted" style={{ fontWeight: 800, marginBottom: 10 }}>
            Caixa aberto ou vendas registradas — ajustes bloqueados
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
                Imagem no topo do ticket
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                <label style={{ display: "flex", gap: 8, fontWeight: 800 }}>
                  <input
                    type="radio"
                    name="ticketImagemModo"
                    value="logo"
                    checked={modoImagem === "logo"}
                    onChange={() =>
                      setAjustes((p) => ({
                        ...(p || {}),
                        ticketImagemModo: "logo",
                      }))
                    }
                    disabled={readOnly}
                  />
                  Usar logo (upload)
                </label>
                <label style={{ display: "flex", gap: 8, fontWeight: 800 }}>
                  <input
                    type="radio"
                    name="ticketImagemModo"
                    value="produto"
                    checked={modoImagem === "produto"}
                    onChange={() =>
                      setAjustes((p) => ({
                        ...(p || {}),
                        ticketImagemModo: "produto",
                      }))
                    }
                    disabled={readOnly}
                  />
                  Usar ícone do produto
                </label>
                <label style={{ display: "flex", gap: 8, fontWeight: 800 }}>
                  <input
                    type="radio"
                    name="ticketImagemModo"
                    value="texto"
                    checked={modoImagem === "texto"}
                    onChange={() =>
                      setAjustes((p) => ({
                        ...(p || {}),
                        ticketImagemModo: "texto",
                      }))
                    }
                    disabled={readOnly}
                  />
                  Texto
                </label>
              </div>

              {modoImagem === "logo" ? (
                <>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => pickLogo(e.target.files?.[0])}
                    disabled={readOnly}
                  />

                  <div style={s.logoUploadCard}>
                    <div style={s.logoUploadLine}>
                      Arquivo:{" "}
                      {logoFileName || "Nenhum arquivo selecionado"}
                    </div>

                    <div style={s.logoUploadActions}>
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
                </>
              ) : (
                <>
                  {modoImagem === "produto" ? (
                    <div
                      className="muted"
                      style={{ marginTop: 10, fontWeight: 800 }}
                    >
                      O ticket usará o ícone do produto impresso.
                    </div>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      <div className="muted" style={{ marginBottom: 6 }}>
                        Texto do topo do ticket (máx. 2 linhas)
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          alignItems: "center",
                        }}
                      >
                        <textarea
                          className="input"
                          rows={2}
                          value={textoTopoTicket}
                          onChange={(e) =>
                            setAjustes((p) => ({
                              ...(p || {}),
                              ticketTopoTexto: normalizeTicketTexto(
                                e.target.value,
                              ),
                            }))
                          }
                          placeholder="Digite aqui (até 2 linhas)"
                          disabled={readOnly}
                          style={{ resize: "none", width: "100%" }}
                        />
                        <Button
                          variant={textoTopoTicketBold ? "primary" : "secondary"}
                          small
                          onClick={() =>
                            setAjustes((p) => ({
                              ...(p || {}),
                              ticketTopoTextoBold: !p?.ticketTopoTextoBold,
                            }))
                          }
                          disabled={readOnly}
                        >
                          Negrito: {textoTopoTicketBold ? "ON" : "OFF"}
                        </Button>
                      </div>
                      <div className="muted" style={{ marginTop: 6 }}>
                        Limite sugerido: {TEXT_MAX_CHARS_PER_LINE} caracteres por
                        linha.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="fullRow">
              <div className="muted" style={{ marginBottom: 6 }}>
                Altura da imagem (mm)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={s.rangeWrap}>
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
                    style={s.rangeInput}
                  />
                </div>
                <div style={{ fontWeight: 800, width: 50, textAlign: "right" }}>
                  {logoAlturaMm.toFixed(1)}mm
                </div>
              </div>
            </div>

            <div className="fullRow">
              <div className="muted" style={{ marginBottom: 6 }}>
                Impressão econômica de imagem (térmica)
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
                  checked={Boolean(ajustes?.impressaoEcoImagem)}
                  onChange={(e) =>
                    setAjustes((p) => ({
                      ...(p || {}),
                      impressaoEcoImagem: e.target.checked,
                    }))
                  }
                  disabled={readOnly}
                />
                Ativar redução de tinta na impressão
              </label>
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
              style={s.ticket}
              className={`ticketPreview${ajustes?.impressaoEcoImagem ? " eco-img" : ""}`}
            >
              <div style={s.inner}>
                {/* Cabeçalho */}
                <div style={s.title}>{preview.nome}</div>

                <div style={s.meta}>
                  <div>{preview.data}</div>
                </div>

                <div style={s.dash} />
                <div style={s.logoBox}>
                  {previewImgSrc ? (
                    <img
                      src={previewImgSrc}
                      alt="logo"
                      style={previewImgStyle}
                      className="ticketPreviewImg"
                    />
                  ) : modoImagem === "texto" ? (
                    <div style={previewTextoTopoStyle}>
                      {previewTextoTopo || "DIGITE O TEXTO"}
                    </div>
                  ) : null}
                </div>
                <div style={s.dash} />

                {/* Item */}
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

                {/* Rodapé + Corte */}
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