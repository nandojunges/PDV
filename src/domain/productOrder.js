const PRODUCT_ORDER_KEYS = [
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

const PRODUCT_ORDER_BY_KEY = new Map(
  PRODUCT_ORDER_KEYS.map((key, index) => [key, index]),
);

function normalizeForOrder(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getProductOrderKey(item) {
  const explicitKey = String(item?.iconKey || item?.iconeKey || item?.icone || item?.key || "").trim();
  if (PRODUCT_ORDER_BY_KEY.has(explicitKey)) return explicitKey;

  const name = normalizeForOrder(item?.nome || item?.produto || item?.name || item?.titulo || item?.title);
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

export function getProductOrderIndex(item) {
  const key = getProductOrderKey(item);
  return PRODUCT_ORDER_BY_KEY.get(key) ?? PRODUCT_ORDER_KEYS.length;
}

export function sortProductsForDisplay(items) {
  return (Array.isArray(items) ? items : [])
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const orderDiff = getProductOrderIndex(a.item) - getProductOrderIndex(b.item);
      if (orderDiff !== 0) return orderDiff;
      return a.index - b.index;
    })
    .map(({ item }) => item);
}
