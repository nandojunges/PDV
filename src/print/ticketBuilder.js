import { fmtBRL, toBRDateTime } from "../domain/math";
import { totalDoCarrinho } from "../domain/pos";

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

const buildHeaderLines = ({ venda, ajustes }) => {
  const lines = [];
  const topo = normalizeText(ajustes?.ticketTopoTexto);
  if (topo) {
    topo
      .split("\n")
      .map((line) => normalizeText(line))
      .filter(Boolean)
      .forEach((line) => lines.push(line));
  }

  const eventoNome = normalizeText(ajustes?.nomeOrganizacao || venda?.eventoNome);
  if (eventoNome && !lines.includes(eventoNome)) {
    lines.push(eventoNome);
  }

  return lines;
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

  return {
    nome,
    qtd,
    unitario,
    subtotal,
  };
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
    lines.push(`${item.qtd}x ${item.nome} - ${fmtBRL(item.subtotal)}`);
  });

  const total =
    Number(venda?.total ?? totalDoCarrinho(itens)) ||
    itens.reduce((acc, item) => acc + item.subtotal, 0);

  lines.push("-".repeat(32));
  lines.push(`Total: ${fmtBRL(total)}`);

  const rodape = normalizeText(ajustes?.textoRodape);
  if (rodape) lines.push(rodape);

  const output = lines.join("\n").trimEnd();
  return output ? `${output}\n` : "\n";
};

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
            itens: [{ ...item, qtd: 1, subtotal: unitValue, unitario: unitValue }],
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