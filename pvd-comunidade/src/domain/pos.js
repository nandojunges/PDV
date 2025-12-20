import { toBRDateTime } from "./math";

export function totalDoCarrinho(carrinho) {
  return (carrinho || []).reduce((acc, it) => acc + Number(it.subtotal || 0), 0);
}

export function buildVenda({ id, eventoNome, carrinho, pagamento, recebido, troco }) {
  const total = totalDoCarrinho(carrinho);

  return {
    id,
    data: new Date().toISOString(),
    eventoNome,
    pagamento, // dinheiro | pix | cartao
    recebido: recebido ?? null,
    troco: troco ?? null,
    total,
    itens: (carrinho || []).map((it) => ({
      produtoId: it.produtoId,
      nome_snapshot: it.nome,
      preco_snapshot: it.preco,
      qtd: it.qtd,
      subtotal: it.subtotal,
      tipo_snapshot: it.tipo || "simples",
    })),
  };
}

export function resumoFinanceiroPorEvento(vendas) {
  const lista = Array.isArray(vendas) ? vendas : [];
  const qtd = lista.length;

  let total = 0;
  let totalDinheiro = 0;
  let totalPix = 0;
  let totalCartao = 0;

  for (const v of lista) {
    const t = Number(v.total || 0);
    total += t;
    if (v.pagamento === "pix") totalPix += t;
    else if (v.pagamento === "cartao") totalCartao += t;
    else totalDinheiro += t;
  }

  return { qtd, total, totalDinheiro, totalPix, totalCartao };
}

export function calcularCaixaEsperado({ abertura, movimentos, resumoEvento }) {
  const movs = Array.isArray(movimentos) ? movimentos : [];
  let reforcos = 0;
  let sangrias = 0;

  for (const m of movs) {
    const val = Number(m.valor || 0);
    if (m.tipo === "reforco") reforcos += val;
    if (m.tipo === "sangria") sangrias += val;
  }

  const dinheiroRecebido = Number(resumoEvento?.totalDinheiro || 0);

  const caixaEsperado = Number(abertura || 0) + dinheiroRecebido + reforcos - sangrias;

  return { reforcos, sangrias, caixaEsperado };
}

export function exportarCSVVendas({ eventoNome, vendas }) {
  const rows = [];
  rows.push([
    "Evento",
    "Data",
    "VendaID",
    "Pagamento",
    "Item",
    "Qtd",
    "Preco",
    "Subtotal",
    "TotalVenda",
    "Recebido",
    "Troco",
  ]);

  for (const v of vendas || []) {
    for (const it of v.itens || []) {
      rows.push([
        eventoNome,
        toBRDateTime(v.data),
        v.id,
        v.pagamento,
        it.nome_snapshot,
        it.qtd,
        it.preco_snapshot,
        it.subtotal,
        v.total,
        v.recebido ?? "",
        v.troco ?? "",
      ]);
    }
  }

  const csv = rows
    .map((r) => r.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `relatorio_${eventoNome.replaceAll(" ", "_").toLowerCase()}_${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}
