import { PRODUCT_SHORTCUTS } from "./productShortcuts";

const ICON_BASE_PATH = "/Icons/";

export const ICONS = PRODUCT_SHORTCUTS.reduce((acc, item) => {
  acc[item.key] = `${ICON_BASE_PATH}${item.imagem}`;
  return acc;
}, {});

export const ICON_FALLBACK_KEYS = {
  almoco_adulto: "almoco_socio",
  caipirinha: "suco",
  meio_almoco: "almoco_socio",
  pet_chopp: "chope",
  picole: "sorvete",
  ref_1l: "ref_2l",
};

export function getIconSrc(iconKey, fallbackKey = "ref_600") {
  return ICONS[iconKey] || ICONS[fallbackKey] || "";
}

export function getFallbackIconSrc(iconKey, fallbackKey = "ref_600") {
  const mappedFallbackKey = ICON_FALLBACK_KEYS[iconKey] || fallbackKey;
  return ICONS[mappedFallbackKey] || ICONS[fallbackKey] || "";
}
