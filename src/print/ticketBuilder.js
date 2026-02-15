import { fmtBRL, toBRDateTime } from "../domain/math";
import { totalDoCarrinho } from "../domain/pos";
import { ICONS } from "../domain/icons";

const normalizeText = (value) => String(value ?? "").trim();

const getVendaDate = (venda) =>
  venda?.criadoEm || venda?.createdAt || venda?.data || new Date().toISOString();

const getVendaItens = (venda) => {
  if (!venda || typeof venda !== "object") return [];
  return (
    venda.itens ??
    venda.items ??
    venda.produtos ??
    venda.products ??
    venda.carrinho ??
    venda.cart ??
    []
  );
};

const normalizeItem = (item) => {
  if (!item || typeof item !== "object") return null;
  
  const nome = normalizeText(item?.nome || item?.produto || item?.name);
  if (!nome) return null;

  const qtd = Number(item?.qtd ?? item?.quantidade ?? 0) || 0;
  if (qtd <= 0) return null;

  const unitario =
    Number(item?.unitario ?? item?.preco ?? item?.valor ?? item?.price ?? 0) || 0;
  const subtotalRaw =
    Number(item?.subtotal ?? item?.total ?? item?.sum ?? qtd * unitario) || 0;
  const subtotal = subtotalRaw || qtd * unitario;

  const iconKey = item?.iconKey || item?.icone || "ref_600";

  return {
    nome,
    qtd,
    unitario,
    subtotal,
    iconKey,
  };
};

// 🔥 FUNÇÃO: Converte URL do ícone para Base64 (otimizada)
const iconUrlToBase64 = async (iconKey) => {
  return new Promise((resolve) => {
    const url = ICONS[iconKey];
    if (!url) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        // Tamanho ideal para impressão térmica (150x150)
        canvas.width = 150;
        canvas.height = 150;
        const ctx = canvas.getContext("2d");
        
        // Limpa o canvas (fundo transparente)
        ctx.clearRect(0, 0, 150, 150);
        
        // Centraliza a imagem
        const scale = Math.min(120 / img.width, 120 / img.height);
        const width = img.width * scale;
        const height = img.height * scale;
        const x = (150 - width) / 2;
        const y = (150 - height) / 2;
        
        // Desenha a imagem redimensionada e centralizada
        ctx.drawImage(img, x, y, width, height);
        
        // Converte para PNG base64
        const base64 = canvas.toDataURL("image/png").split(",")[1];
        resolve(base64);
      } catch (e) {
        console.warn("Erro ao converter imagem:", e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

// 🔥 FUNÇÃO QUE CRIA O TICKET EXATAMENTE IGUAL AO PREVIEW
const buildTicketLikePreview = ({ venda, ajustes, item }) => {
  const lines = [];
  
  // 1. TÍTULO (em maiúsculas)
  const titulo = normalizeText(ajustes?.nomeOrganizacao || venda?.eventoNome || "COMUNIDADE");
  lines.push(titulo.toUpperCase());
  
  // 2. DATA (apenas data)
  const data = new Date().toLocaleDateString('pt-BR');
  lines.push(data);
  
  // 3. PRIMEIRA LINHA TRACEJADA
  lines.push("-".repeat(32));
  
  // 4. ESPAÇO PARA A IMAGEM (linha em branco)
  lines.push("");
  
  // 5. ITEM
  lines.push(`${item.qtd}x ${item.nome}`);
  
  // 6. PREÇO
  lines.push(`R$ ${item.subtotal.toFixed(2).replace('.', ',')}`);
  
  // 7. SEGUNDA LINHA TRACEJADA
  lines.push("-".repeat(32));
  
  // 8. RODAPÉ
  const rodape = normalizeText(ajustes?.textoRodape || "Obrigado pela preferência!");
  lines.push(rodape);
  
  // 9. LINHA DE CORTE
  lines.push("-".repeat(32));
  lines.push("CORTE AQUI");
  
  return lines.join("\n") + "\n";
};

// 🔥 FUNÇÃO PRINCIPAL: Retorna tickets com imagem e texto
export const buildTicketsPerItemComImagem = async ({ venda, ajustes, device } = {}) => {
  const itensRaw = getVendaItens(venda);
  const itens = itensRaw.map(normalizeItem).filter(Boolean);
  const tickets = [];

  for (const item of itens) {
    const qtd = Number(item.qtd) || 0;
    if (qtd <= 0) continue;
    
    const unitValue = item.subtotal / qtd;

    // Converte o ícone para base64
    let base64Icon = null;
    if (item.iconKey) {
      try {
        base64Icon = await iconUrlToBase64(item.iconKey);
        console.log(`✅ Ícone ${item.iconKey} convertido`);
      } catch (e) {
        console.warn(`❌ Erro ao converter ícone ${item.iconKey}:`, e);
      }
    }

    // Cria um ticket para cada unidade
    for (let index = 0; index < qtd; index += 1) {
      const ticketText = buildTicketLikePreview({
        venda,
        ajustes,
        item: {
          ...item,
          qtd: 1,
          subtotal: unitValue,
        },
      });

      tickets.push({
        text: ticketText,
        imagem: base64Icon,
        iconKey: item.iconKey,
      });
    }
  }

  return tickets;
};

// Mantém as funções originais para compatibilidade
export const buildTicketsPerItem = ({ venda, ajustes, device } = {}) => {
  const itensRaw = getVendaItens(venda);
  const itens = itensRaw.map(normalizeItem).filter(Boolean);
  const tickets = [];

  itens.forEach((item) => {
    const qtd = Number(item.qtd) || 0;
    if (qtd <= 0) return;
    const unitValue = item.subtotal / qtd;

    for (let index = 0; index < qtd; index += 1) {
      tickets.push(
        buildTicketText({
          venda: {
            ...(venda || {}),
            itens: [{ 
              ...item, 
              qtd: 1, 
              subtotal: unitValue, 
              unitario: unitValue,
              iconKey: item.iconKey
            }],
            total: unitValue,
          },
          ajustes,
          device,
        }),
      );
    }
  });

  return tickets;
};

export const buildTicketText = ({ venda, ajustes, device } = {}) => {
  const itensRaw = getVendaItens(venda);
  const itens = itensRaw.map(normalizeItem).filter(Boolean);

  const lines = [];
  
  const headerLines = buildHeaderLines({ venda, ajustes });
  if (headerLines.length) {
    lines.push(...headerLines);
  }

  lines.push(`Data: ${toBRDateTime(getVendaDate(venda))}`);

  const deviceName = normalizeText(device?.name || device?.label);
  if (deviceName) {
    lines.push(`Terminal: ${deviceName}`);
  }

  lines.push("-".repeat(32));

  itens.forEach((item) => {
    const iconName = item.iconKey ? `[${item.iconKey}]` : "[produto]";
    lines.push(`${iconName} ${item.qtd}x ${item.nome}`);
    lines.push(`  ${fmtBRL(item.subtotal)}`);
  });

  const total =
    Number(venda?.total ?? totalDoCarrinho(itens)) ||
    itens.reduce((acc, item) => acc + item.subtotal, 0);

  lines.push("-".repeat(32));
  lines.push(`TOTAL: ${fmtBRL(total)}`);

  const rodape = normalizeText(ajustes?.textoRodape);
  if (rodape) lines.push(rodape);

  lines.push("-".repeat(32));
  lines.push("CORTE AQUI");

  const output = lines.join("\n").trimEnd();
  return output ? `${output}\n` : "\n";
};