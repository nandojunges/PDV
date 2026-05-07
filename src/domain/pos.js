import { toBRDateTime } from "./math";

const PRODUCT_DISPLAY_ORDER_KEYS = [
  "agua",
  "ref_lata",
  "ref_600",
  "ref_1l",
  "ref_2l",
  "cer_lata",
  "cer_garrafa",
  "chope",
  "petchopp",
  "petchopp_2l",
  "barril",
  "caipirinha",
  "suco",
  "lanche",
  "sobremesa",
  "sorvete",
  "picole",
  "prato_talher",
  "fichas",
  "meio_almoco",
  "almoco_adulto",
  "almoco_socio",
];

const PRODUCT_DISPLAY_ORDER_BY_KEY = new Map(
  PRODUCT_DISPLAY_ORDER_KEYS.map((key, index) => [key, index]),
);

function normalizeProductNameForDisplayOrder(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getProductDisplayOrderKey(item) {
  const explicitKey = String(item?.iconKey || item?.iconeKey || item?.icone || item?.key || "").trim();
  if (PRODUCT_DISPLAY_ORDER_BY_KEY.has(explicitKey)) return explicitKey;

  const name = normalizeProductNameForDisplayOrder(
    item?.nome || item?.produto || item?.name || item?.titulo || item?.title,
  );
  if (!name) return "";

  if (name.includes("agua")) return "agua";

  if (name.includes("refrigerante") || name.includes("refri")) {
    if (/(^|\s)(lata|latinha)(\s|$)/.test(name)) return "ref_lata";
    if (/(^|\s)600\s*ml(\s|$)/.test(name)) return "ref_600";
    if (/(^|\s)1\s*l(\s|$)/.test(name) || /1\s*litro/.test(name)) return "ref_1l";
    if (/(^|\s)2\s*l(\s|$)/.test(name) || /2\s*litros?/.test(name)) return "ref_2l";
    return "ref_lata";
  }

  if (name.includes("cerveja")) {
    if (/(^|\s)(garrafa|long neck|longneck)(\s|$)/.test(name)) return "cer_garrafa";
    if (/(^|\s)(lata|latinha)(\s|$)/.test(name)) return "cer_lata";
    return "cer_lata";
  }

  if (name.includes("barril")) return "barril";
  if (name.includes("pet") && (name.includes("chopp") || name.includes("chope"))) {
    if (/(^|\s)2\s*l(\s|$)/.test(name) || /2\s*litros?/.test(name)) return "petchopp_2l";
    return "petchopp";
  }
  if (name.includes("chopp") || name.includes("chope")) return "chope";

  if (name.includes("caipirinha")) return "caipirinha";
  if (name.includes("suco")) return "suco";
  if (name.includes("lanche")) return "lanche";
  if (name.includes("sobremesa")) return "sobremesa";
  if (name.includes("sorvete")) return "sorvete";
  if (name.includes("picole")) return "picole";
  if (name.includes("prato") && name.includes("talher")) return "prato_talher";
  if (name.includes("ficha")) return "fichas";
  if (name.includes("meio") && name.includes("almoco")) return "meio_almoco";
  if (name.includes("almoco") && name.includes("adulto")) return "almoco_adulto";
  if (name.includes("almoco") && (name.includes("socio") || name.includes("associado"))) return "almoco_socio";

  return "";
}

export function sortProductsForDisplay(items) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const orderA = PRODUCT_DISPLAY_ORDER_BY_KEY.get(getProductDisplayOrderKey(a.item)) ?? PRODUCT_DISPLAY_ORDER_KEYS.length;
      const orderB = PRODUCT_DISPLAY_ORDER_BY_KEY.get(getProductDisplayOrderKey(b.item)) ?? PRODUCT_DISPLAY_ORDER_KEYS.length;
      if (orderA !== orderB) return orderA - orderB;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}


export function totalDoCarrinho(carrinho) {
  return (carrinho || []).reduce((acc, it) => acc + Number(it.subtotal || 0), 0);
}

export function buildVenda(data) {
  const carrinho = Array.isArray(data?.carrinho) ? data.carrinho : [];
  const itens = carrinho.map((it) => {
    const qtd = Number(it?.qtd ?? it?.quantidade ?? 0) || 0;
    const unitario = Number(it?.unitario ?? it?.preco ?? it?.valor ?? 0) || 0;
    const subtotal = Number(it?.subtotal ?? qtd * unitario) || 0;
    return {
      produtoId: it?.produtoId ?? it?.id ?? "",
      nome: it?.nome ?? it?.produto ?? it?.name ?? "",
      qtd,
      unitario,
      preco: unitario,
      precoSnapshot: unitario,
      subtotal,
      categoria: it?.categoria ?? it?.category ?? "",
      tipo: it?.tipo ?? "unitario",
      comboQtd: it?.comboQtd ?? null,
      isBarril: it?.isBarril ?? false,
      barrilLitros: it?.barrilLitros ?? null,
      unitarioPorLitro: it?.unitarioPorLitro ?? null,
      iconKey: it?.iconKey ?? "",
      img: it?.img ?? "",
    };
  });

  const total = itens.reduce((s, it) => s + (Number(it.subtotal) || 0), 0);
  const createdAt = new Date().toISOString();

  return {
    id: data?.id,
    eventoId: data?.eventoId ?? null,
    eventoNome: data?.eventoNome ?? "",
    pagamento: data?.pagamento ?? "dinheiro",
    recebido: data?.recebido ?? null,
    troco: data?.troco ?? null,
    itens,
    total,
    createdAt,
    data: createdAt,
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