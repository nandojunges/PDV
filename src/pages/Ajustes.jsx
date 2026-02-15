// src/pages/Ajustes.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { readFileAsDataURL, fmtBRL } from "../domain/math";
import { ICONS } from "../domain/icons";
import { useConfig } from "../config/ConfigProvider";

/* ===================== CONSTANTES ===================== */
const LOGO_SLOT_MM = 35;
const TEXT_MAX_LINES = 2;
const TEXT_MAX_CHARS_PER_LINE = 22;
const LOGO_MIN_MM = 10;
const LOGO_MAX_MM = 30;
const LOGO_STEP_MM = 0.5;

export default function Ajustes({
  ajustes,
  setAjustes,
  hasEventoAberto,
  readOnly = false,
  onSalvar,
}) {
  // ==================== ESTADOS ====================
  const [nomeOrg, setNomeOrg] = useState(ajustes?.nomeOrganizacao || "");
  const [rodape, setRodape] = useState(ajustes?.textoRodape || "");
  const [logoFileName, setLogoFileName] = useState("");
  const [aviso, setAviso] = useState({ type: "", message: "" });
  
  const { permitirMultiDispositivo, setPermitirMultiDispositivo } = useConfig();

  // ==================== REFS ====================
  const fileRef = useRef(null);
  const formRef = useRef(null);

  // ==================== MEMOIZED VALUES ====================
  const logoAlturaMm = Number.isFinite(Number(ajustes?.logoImgMm))
    ? Number(ajustes?.logoImgMm)
    : 20;

  const textoTopoTicket = (ajustes?.ticketTopoTexto || "").toUpperCase();
  const textoTopoTicketBold = Boolean(ajustes?.ticketTopoTextoBold);

  // ==================== FUNÇÕES ====================
  async function pickLogo(file) {
    if (!file) return;
    
    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      setAviso({ type: "error", message: "❌ Selecione uma imagem válida" });
      return;
    }
    
    // Validar tamanho (máx 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setAviso({ type: "error", message: "❌ Imagem muito grande (máx 5MB)" });
      return;
    }
    
    try {
      const url = await readFileAsDataURL(file);
      setAjustes((p) => ({ ...(p || {}), logoDataUrl: url }));
      setLogoFileName(file.name || "logo");
      setAviso({ type: "success", message: "✅ Logo carregada com sucesso" });
    } catch (error) {
      setAviso({ type: "error", message: "❌ Erro ao carregar imagem" });
    }
  }

  function removerLogo() {
    if (!confirm("Remover logo do ticket?")) return;
    setAjustes((p) => ({ ...(p || {}), logoDataUrl: "" }));
    setLogoFileName("");
    if (fileRef.current) fileRef.current.value = "";
    setAviso({ type: "info", message: "🗑️ Logo removida" });
  }

  // ==================== EFFECTS ====================
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

  useEffect(() => {
    if (aviso.message) {
      const timer = setTimeout(() => setAviso({ type: "", message: "" }), 3000);
      return () => clearTimeout(timer);
    }
  }, [aviso]);

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
    
    setAviso({ type: "success", message: "✅ Ajustes salvos com sucesso!" });
    
    // Scroll suave para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function normalizeTicketTexto(value) {
    const upper = String(value || "").toUpperCase().replace(/\r/g, "");
    const lines = upper.split("\n").slice(0, TEXT_MAX_LINES);
    const trimmedLines = lines.map((line) =>
      line.slice(0, TEXT_MAX_CHARS_PER_LINE),
    );
    return trimmedLines.join("\n");
  }

  // ==================== PREVIEW ====================
  const preview = useMemo(() => {
    return {
      nome: (nomeOrg || "").trim() || "Nome do evento",
      data: new Date().toLocaleDateString("pt-BR"),
      logo: ajustes?.logoDataUrl || "",
      rodape: (rodape || "").trim() || "Obrigado pela preferência!",
      logoImgMm: logoAlturaMm,
      iconKey: "ref_lata",
      qtd: 1,
      produto: "Refrigerante lata",
      valor: 5,
    };
  }, [nomeOrg, rodape, ajustes?.logoDataUrl, logoAlturaMm]);

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

  const previewTextoTopo = modoImagem === "texto" ? textoTopoTicket.trim() : "";
  const logoTextFontSizePx = Math.round(logoAlturaMm * 0.9) + 6;

  // ==================== ESTILOS ====================
  const styles = {
    alert: {
      info: { background: "#e0f2fe", color: "#0369a1", border: "1px solid #7dd3fc" },
      success: { background: "#dcfce7", color: "#166534", border: "1px solid #86efac" },
      warning: { background: "#fef9c3", color: "#854d0e", border: "1px solid #fde047" },
      error: { background: "#fee2e2", color: "#991b1b", border: "1px solid #fca5a5" },
    },
    ticket: {
      container: {
        width: "58mm",
        maxWidth: "100%",
        height: "80mm",
        margin: "0 auto",
        background: "#fff",
        border: "2px solid #e5e7eb",
        borderRadius: 16,
        padding: "4mm 3mm",
        boxSizing: "border-box",
        boxShadow: "0 10px 24px rgba(0,0,0,0.1)",
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
        color: "#111827",
      },
      meta: {
        marginTop: "1mm",
        display: "flex",
        justifyContent: "center",
        gap: 10,
        fontSize: 11,
        color: "#6b7280",
        fontWeight: 700,
      },
      dash: {
        borderTop: "2px dashed #cbd5e1",
        margin: "2mm 0",
      },
      logoBox: {
        height: `${LOGO_SLOT_MM}mm`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        margin: "1mm 0 2mm 0",
        background: "#f9fafb",
        borderRadius: 8,
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
        fontWeight: textoTopoTicketBold ? 900 : 700,
        fontFamily: textoTopoTicketBold
          ? '"Arial Black", "Impact", system-ui'
          : "system-ui, -apple-system",
        color: previewTextoTopo ? "#111827" : "#9ca3af",
        opacity: previewTextoTopo ? 1 : 0.6,
      },
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
      },
      qtd: {
        fontWeight: 900,
        fontSize: 13,
        whiteSpace: "nowrap",
        color: "#2563eb",
      },
      itemName: {
        fontWeight: 900,
        fontSize: 14,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "clip",
        color: "#111827",
      },
      price: {
        fontWeight: 900,
        fontSize: 15,
        whiteSpace: "nowrap",
        color: "#059669",
      },
      rodape: {
        textAlign: "center",
        fontSize: 12,
        fontWeight: 800,
        wordBreak: "break-word",
        color: "#4b5563",
        marginTop: "auto",
      },
      corte: {
        marginTop: "2mm",
        paddingTop: "2mm",
        borderTop: "2px dashed #94a3b8",
        fontWeight: 800,
        letterSpacing: 1,
        fontSize: 10,
        color: "#6b7280",
        textAlign: "center",
      },
    },
  };

  const isWide = typeof window !== "undefined" ? window.innerWidth >= 980 : false;
  const previewTitulo = `${preview.qtd}x ${preview.produto}`.trim();
  const previewItemFont = previewTitulo.length > 24 ? 12 : previewTitulo.length > 18 ? 13 : 14;

  return (
    <div className="ajustes-container" ref={formRef}>
      <style>{`
        .ajustes-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 12px;
        }
        .ajustes-container input,
        .ajustes-container select,
        .ajustes-container textarea {
          font-size: 16px;
        }
        
        /* Grid de formulário */
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
          margin: 20px 0;
        }
        
        .muted {
          color: #6b7280;
          font-size: 13px;
          font-weight: 500;
        }
        
        .input {
          width: 100%;
          padding: 12px 14px;
          border: 2px solid #e5e7eb;
          border-radius: 14px;
          font-size: 15px;
          outline: none;
          transition: all 0.2s ease;
          background: #fff;
        }
        .input:focus {
          border-color: #2563eb;
          box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1);
        }
        .input:disabled {
          background: #f3f4f6;
          cursor: not-allowed;
          opacity: 0.7;
        }
        
        textarea.input {
          min-height: 80px;
          resize: vertical;
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
        }
        
        .alert {
          padding: 12px 16px;
          border-radius: 10px;
          margin-bottom: 16px;
          font-weight: 500;
          font-size: 14px;
          animation: slideIn 0.3s ease;
        }
        
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .radio-group {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          background: #f8fafc;
          padding: 12px;
          border-radius: 14px;
          border: 1px solid #e5e7eb;
        }
        
        .radio-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 700;
          color: #374151;
          cursor: pointer;
        }
        
        .radio-label input[type="radio"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        
        .logo-upload-card {
          background: #f8fafc;
          border: 2px dashed #cbd5e1;
          border-radius: 14px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          align-items: center;
          text-align: center;
        }
        
        .range-container {
          display: flex;
          align-items: center;
          gap: 16px;
          background: #f8fafc;
          padding: 12px 16px;
          border-radius: 14px;
          border: 1px solid #e5e7eb;
        }
        
        .range-input {
          flex: 1;
          height: 40px;
          -webkit-appearance: none;
          background: transparent;
        }
        
        .range-input::-webkit-slider-runnable-track {
          height: 6px;
          background: #e5e7eb;
          border-radius: 999px;
        }
        
        .range-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 24px;
          width: 24px;
          border-radius: 50%;
          background: #2563eb;
          margin-top: -9px;
          cursor: pointer;
          border: 2px solid #fff;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        .range-input:focus {
          outline: none;
        }
        
        .range-value {
          font-weight: 800;
          min-width: 60px;
          text-align: right;
          color: #2563eb;
        }
        
        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          color: #374151;
          background: #f8fafc;
          padding: 12px 16px;
          border-radius: 14px;
          border: 1px solid #e5e7eb;
          cursor: pointer;
        }
        
        .checkbox-label input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }
        
        .preview-box {
          background: #f8fafc;
          border: 2px solid #e5e7eb;
          border-radius: 20px;
          padding: 16px;
          position: sticky;
          top: 80px;
        }
        
        @media (max-width: 980px) {
          .preview-box {
            position: static;
            margin-top: 16px;
          }
        }
        
        .action-buttons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 24px;
          padding-top: 16px;
          border-top: 2px solid #e5e7eb;
        }
      `}</style>

      {/* Alerta */}
      {aviso.message && (
        <div className="alert" style={styles.alert[aviso.type]}>
          {aviso.message}
        </div>
      )}

      <Card 
        title="Configurações do Ticket" 
        subtitle="Personalize a aparência do cupom"
      >
        {readOnly ? (
          <div className="badge" style={{ marginBottom: 20, background: "#fee2e2", color: "#991b1b", borderColor: "#fecaca" }}>
            ⚠️ Ajustes bloqueados - Caixa aberto ou vendas registradas
          </div>
        ) : (
          <div className="badge" style={{ marginBottom: 20, background: "#dbeafe", color: "#1e40af", borderColor: "#bfdbfe" }}>
            ✏️ Modo de edição
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: isWide ? "1.2fr 0.8fr" : "1fr", gap: 24 }}>
          {/* ===== FORMULÁRIO ===== */}
          <div>
            <div className="formGrid">
              {/* Nome do evento */}
              <div className="fullRow">
                <div className="muted" style={{ marginBottom: 8 }}>
                  Nome do evento/organização
                </div>
                <input
                  className="input"
                  value={nomeOrg}
                  onChange={(e) => setNomeOrg(e.target.value)}
                  placeholder="Ex: Festa da Linguiça"
                  disabled={readOnly}
                />
              </div>

              {/* Rodapé */}
              <div className="fullRow">
                <div className="muted" style={{ marginBottom: 8 }}>
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

              {/* Imagem no topo */}
              <div className="fullRow">
                <div className="muted" style={{ marginBottom: 8 }}>
                  Imagem no topo do ticket
                </div>

                <div className="radio-group">
                  <label className="radio-label">
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
                    <span>📷 Logo (upload)</span>
                  </label>
                  
                  <label className="radio-label">
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
                    <span>🖼️ Ícone do produto</span>
                  </label>
                  
                  <label className="radio-label">
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
                    <span>📝 Texto personalizado</span>
                  </label>
                </div>

                {/* Upload de logo */}
                {modoImagem === "logo" && (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      onChange={(e) => pickLogo(e.target.files?.[0])}
                      disabled={readOnly}
                    />

                    <div className="logo-upload-card">
                      <div style={{ fontSize: 14, color: "#4b5563" }}>
                        {logoFileName ? (
                          <>📎 {logoFileName}</>
                        ) : (
                          <>Nenhum arquivo selecionado</>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: 10 }}>
                        <Button
                          variant="primary"
                          small
                          onClick={() => fileRef.current?.click()}
                          disabled={readOnly}
                        >
                          Escolher arquivo
                        </Button>

                        {preview.logo && (
                          <Button
                            variant="danger"
                            small
                            onClick={removerLogo}
                            disabled={readOnly}
                          >
                            Remover
                          </Button>
                        )}
                      </div>
                      
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>
                        PNG, JPG ou SVG • Máx 5MB
                      </div>
                    </div>
                  </>
                )}

                {/* Texto personalizado */}
                {modoImagem === "texto" && (
                  <div style={{ marginTop: 12 }}>
                    <div className="muted" style={{ marginBottom: 8 }}>
                      Texto do topo (máx. 2 linhas)
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <textarea
                        className="input"
                        rows={2}
                        value={textoTopoTicket}
                        onChange={(e) =>
                          setAjustes((p) => ({
                            ...(p || {}),
                            ticketTopoTexto: normalizeTicketTexto(e.target.value),
                          }))
                        }
                        placeholder="Digite o texto..."
                        disabled={readOnly}
                        style={{ flex: 1 }}
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
                        style={{ height: 80 }}
                      >
                        <strong>B</strong>
                      </Button>
                    </div>
                    <div className="muted" style={{ marginTop: 6, fontSize: 11 }}>
                      {TEXT_MAX_CHARS_PER_LINE} caracteres por linha
                    </div>
                  </div>
                )}
              </div>

              {/* Altura da imagem */}
              <div className="fullRow">
                <div className="muted" style={{ marginBottom: 8 }}>
                  Altura da imagem (mm)
                </div>
                <div className="range-container">
                  <input
                    type="range"
                    min={LOGO_MIN_MM}
                    max={LOGO_MAX_MM}
                    step={LOGO_STEP_MM}
                    value={logoAlturaMm}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setAjustes((p) => ({ ...(p || {}), logoImgMm: v }));
                    }}
                    disabled={readOnly}
                    className="range-input"
                  />
                  <span className="range-value">{logoAlturaMm.toFixed(1)}mm</span>
                </div>
              </div>

              {/* Impressão econômica */}
              <div className="fullRow">
                <label className="checkbox-label">
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
                  <span>Economia de tinta (impressão térmica)</span>
                </label>
              </div>

              {/* Multi-dispositivo */}
              <div className="fullRow">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={Boolean(permitirMultiDispositivo)}
                    onChange={(e) => setPermitirMultiDispositivo(e.target.checked)}
                    disabled={readOnly}
                  />
                  <span>Permitir uso em múltiplos dispositivos</span>
                </label>
              </div>
            </div>

            {/* Botões de ação - AGORA NO FINAL */}
            <div className="action-buttons">
              <Button 
                variant="primary" 
                onClick={salvar} 
                disabled={readOnly}
                style={{ minWidth: 200 }}
              >
                💾 Salvar configurações
              </Button>
            </div>
          </div>

          {/* ===== PREVIEW DO TICKET ===== */}
          <div className="preview-box">
            <div className="muted" style={{ fontWeight: 900, marginBottom: 16, fontSize: 16 }}>
              Pré-visualização
            </div>

            <div style={styles.ticket.container}>
              <div style={styles.ticket.inner}>
                {/* Cabeçalho */}
                <div style={styles.ticket.title}>{preview.nome}</div>
                <div style={styles.ticket.meta}>
                  <div>{preview.data}</div>
                </div>

                <div style={styles.ticket.dash} />
                
                {/* Imagem/Logo/Texto */}
                <div style={styles.ticket.logoBox}>
                  {previewImgSrc ? (
                    <img
                      src={previewImgSrc}
                      alt="preview"
                      style={styles.ticket.logoImg}
                    />
                  ) : modoImagem === "texto" ? (
                    <div style={styles.ticket.logoText}>
                      {previewTextoTopo || "DIGITE O TEXTO"}
                    </div>
                  ) : null}
                </div>
                
                <div style={styles.ticket.dash} />

                {/* Item de exemplo */}
                <div style={styles.ticket.itemBlock}>
                  <div style={styles.ticket.itemTop}>
                    <span style={styles.ticket.qtd}>{preview.qtd}x</span>
                    <span style={{ ...styles.ticket.itemName, fontSize: previewItemFont }}>
                      {preview.produto}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <span style={styles.ticket.price}>{fmtBRL(preview.valor)}</span>
                  </div>
                </div>

                <div style={styles.ticket.dash} />

                {/* Rodapé e corte */}
                <div style={{ flex: 1 }} />
                <div style={styles.ticket.rodape}>{preview.rodape}</div>
                <div style={styles.ticket.corte}>CORTE AQUI</div>
              </div>
            </div>

            <div className="muted" style={{ marginTop: 12, fontSize: 12, textAlign: "center" }}>
              58mm x 80mm • Visualização aproximada
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}