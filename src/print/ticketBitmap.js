// src/print/ticketBitmap.js
import { ICONS } from "../domain/icons";
import { toBRDateTime } from "../domain/math";

const WIDTH = 384; // 58mm Sunmi (geralmente 384px)
const PADDING = 18;

/* ===================== MOLDURA / BORDA ===================== */
const FRAME_RADIUS = 22; // canto arredondado (px)
const FRAME_STROKE = 3;  // espessura da borda (px)
const FRAME_INSET = 8;   // afastamento da borda das laterais/topo (px)
const FRAME_GAP_AFTER = 22; // espaço entre a moldura e a linha "CORTE AQUI"

function normalizeText(v) {
  return String(v ?? "").trim();
}

function drawCenteredText(ctx, text, y, size = 24, bold = false) {
  ctx.font = `${bold ? "900" : "700"} ${size}px Arial`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";
  ctx.fillText(text, WIDTH / 2, y);
}

function drawLeftText(ctx, text, y, size = 20, bold = false) {
  ctx.font = `${bold ? "900" : "700"} ${size}px Arial`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#000";
  ctx.fillText(text, PADDING + 10, y);
}

function drawDivider(ctx, y) {
  ctx.fillStyle = "#000";
  ctx.fillRect(PADDING, y, WIDTH - PADDING * 2, 2);
}

async function loadImage(iconKeyOrUrl) {
  return new Promise((resolve) => {
    // Se já for uma URL de dados (base64), usa direto
    if (iconKeyOrUrl && iconKeyOrUrl.startsWith('data:image')) {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = iconKeyOrUrl;
      return;
    }
    
    // Caso contrário, busca no ICONS
    const url = ICONS[iconKeyOrUrl] || null;
    if (!url) return resolve(null);

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/* ===================== DESENHO: RETÂNGULO ARREDONDADO ===================== */
function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawFrame(ctx, topY, bottomY) {
  // desenha uma borda arredondada em volta do ticket “principal”
  const x = FRAME_INSET;
  const y = topY;
  const w = WIDTH - FRAME_INSET * 2;
  const h = Math.max(1, bottomY - topY);

  ctx.save();
  ctx.lineWidth = FRAME_STROKE;
  ctx.strokeStyle = "#000";
  roundRectPath(ctx, x + FRAME_STROKE / 2, y + FRAME_STROKE / 2, w - FRAME_STROKE, h - FRAME_STROKE, FRAME_RADIUS);
  ctx.stroke();
  ctx.restore();
}

// ✅ Converte o bitmap para preto/branco (térmica gosta disso)
function toMonochrome(ctx, w, h) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  // threshold simples (bom e rápido)
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    const v = lum < 200 ? 0 : 255;
    d[i] = v;
    d[i + 1] = v;
    d[i + 2] = v;
    d[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}

export async function buildTicketBitmapBase64({ venda, ajustes, item }) {
  // canvas “grande” e depois a gente recorta
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = 900;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  // fundo branco (evita “transparência virar preto”)
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // topo do conteúdo dentro da moldura
  const frameTopY = 18;
  let y = frameTopY + 46;

  // 1) Título
  const titulo = normalizeText(
    ajustes?.nomeOrganizacao || venda?.eventoNome || "COMUNIDADE"
  ).toUpperCase();
  drawCenteredText(ctx, titulo, y, 34, true);
  y += 42;

  // 2) Data (igual venda)
  const iso =
    venda?.criadoEm || venda?.createdAt || venda?.data || new Date().toISOString();
  const data =
    String(toBRDateTime(iso) || "").split(" ")[0] ||
    new Date().toLocaleDateString("pt-BR");
  drawCenteredText(ctx, data, y, 20, false);
  y += 34;

  // 3) Linha
  drawDivider(ctx, y);
  y += 26;

  // ==================== 🔥 ESCOLHA DO CONTEÚDO DO TOPO ====================
  const modoImagem = ajustes?.ticketImagemModo || "produto";
  
  // 🔥 VERIFICA SE TEM TEXTO PERSONALIZADO
  const textoPersonalizado = ajustes?.ticketTopoTexto || "";
  const textoPersonalizadoBold = ajustes?.ticketTopoTextoBold || false;
  
  if (modoImagem === "logo") {
    // Usar a logo do evento (upload)
    const imagemParaImprimir = ajustes?.logoDataUrl;
    console.log("📷 Usando logo do evento");
    
    if (imagemParaImprimir) {
      const img = await loadImage(imagemParaImprimir);
      if (img) {
        // Conversão mm → px
        const pixelsPorMm = WIDTH / 58; // ≈ 6.62px por mm
        
        const alturaDesejadaMm = Number(ajustes?.logoImgMm || 20);
        const alturaDesejadaPx = Math.round(alturaDesejadaMm * pixelsPorMm);
        
        // Limitar ao tamanho máximo do espaço disponível
        const alturaMaximaPx = 180;
        const alturaFinal = Math.min(alturaDesejadaPx, alturaMaximaPx);
        
        // Calcula a escala mantendo a proporção
        const scale = alturaFinal / img.height;
        const w = Math.round(img.width * scale);
        const h = alturaFinal;
        const x = Math.round((WIDTH - w) / 2);

        console.log(`📏 Logo: ${alturaDesejadaMm}mm → ${h}px`);

        // desenha a imagem
        ctx.drawImage(img, x, y, w, h);

        y += h + 26;
      } else {
        y += 16;
      }
    } else {
      y += 16;
    }
    
  } else if (modoImagem === "produto") {
    // Usar o ícone do produto
    const imagemParaImprimir = item?.iconKey;
    console.log("🖼️ Usando ícone do produto:", item?.iconKey);
    
    if (imagemParaImprimir) {
      const img = await loadImage(imagemParaImprimir);
      if (img) {
        // Conversão mm → px
        const pixelsPorMm = WIDTH / 58; // ≈ 6.62px por mm
        
        const alturaDesejadaMm = Number(ajustes?.logoImgMm || 20);
        const alturaDesejadaPx = Math.round(alturaDesejadaMm * pixelsPorMm);
        
        // Limitar ao tamanho máximo do espaço disponível
        const alturaMaximaPx = 180;
        const alturaFinal = Math.min(alturaDesejadaPx, alturaMaximaPx);
        
        // Calcula a escala mantendo a proporção
        const scale = alturaFinal / img.height;
        const w = Math.round(img.width * scale);
        const h = alturaFinal;
        const x = Math.round((WIDTH - w) / 2);

        console.log(`📏 Ícone: ${alturaDesejadaMm}mm → ${h}px`);

        // desenha a imagem
        ctx.drawImage(img, x, y, w, h);

        y += h + 26;
      } else {
        y += 16;
      }
    } else {
      y += 16;
    }
    
  } else if (modoImagem === "texto" && textoPersonalizado) {
    // 🔥 MODO TEXTO - Imprime a frase personalizada
    console.log("📝 Modo texto - imprimindo frase:", textoPersonalizado);
    
    // Divide o texto em linhas (máx 2)
    const linhas = textoPersonalizado.split('\n').filter(linha => linha.trim());
    
    // Tamanho da fonte baseado na altura configurada
    const tamanhoFonte = Math.max(18, Math.min(32, Math.round(alturaDesejadaMm * 1.2)));
    
    let espacoUsado = 0;
    
    linhas.forEach((linha, index) => {
      const yLinha = y + (index * (tamanhoFonte + 8));
      drawCenteredText(ctx, linha, yLinha, tamanhoFonte, textoPersonalizadoBold);
      espacoUsado += tamanhoFonte + 8;
    });
    
    y += Math.max(espacoUsado + 10, 60); // Espaço mínimo de 60px
    console.log(`📏 Texto: ${espacoUsado}px de altura`);
    
  } else {
    // Nenhum conteúdo no topo
    console.log("📝 Modo texto - sem conteúdo");
    y += 16;
  }

  // 5) Item
  const nome = normalizeText(item?.nome || "Item");
  const qtd = Number(item?.qtd || 1) || 1;
  drawCenteredText(ctx, `${qtd}x ${nome}`, y, 24, true);
  y += 34;

  // 6) Preço
  const subtotal = Number(item?.subtotal || 0) || 0;
  drawCenteredText(
    ctx,
    `R$ ${subtotal.toFixed(2).replace(".", ",")}`,
    y,
    28,
    true
  );
  y += 40;

  // 7) Linha
  drawDivider(ctx, y);
  y += 30;

  // 8) Rodapé
  const rodape = normalizeText(ajustes?.textoRodape || "Obrigado pela preferência!");
  drawCenteredText(ctx, rodape, y, 20, true);
  y += 34;

  // final do conteúdo principal
  const frameBottomY = y + 18;

  // 9) Moldura
  drawFrame(ctx, frameTopY, frameBottomY);

  // 10) Espaço para corte
  y = frameBottomY + FRAME_GAP_AFTER;

  // 11) Corte
  drawDivider(ctx, y);
  y += 22;
  drawCenteredText(ctx, "CORTE AQUI", y, 18, true);
  y += 36;

  // converte para monocromático
  toMonochrome(ctx, canvas.width, canvas.height);

  // recorta altura final
  const finalCanvas = document.createElement("canvas");
  finalCanvas.width = WIDTH;
  finalCanvas.height = Math.max(260, Math.ceil(y + 10));
  const fctx = finalCanvas.getContext("2d");
  fctx.drawImage(canvas, 0, 0);

  // base64 PNG
  return finalCanvas.toDataURL("image/png").split(",")[1];
}