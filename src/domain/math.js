export function uid() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function fmtBRL(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function toNumBR(s) {
  if (s == null) return 0;
  const t = String(s).replace(/\./g, "").replace(",", ".").trim();
  const n = Number(t);
  return Number.isFinite(n) ? n : 0;
}

export function toBRDateTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR");
  } catch {
    return String(iso || "");
  }
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
      reader.readAsDataURL(file);
    } catch (e) {
      reject(e);
    }
  });
}
