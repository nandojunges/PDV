export const PDV_PORT = 8787;

export function gerarPin() {
  const pin = Math.floor(100000 + Math.random() * 900000);
  return String(pin);
}

export function gerarCaixaIdCurto() {
  const base = Math.random().toString(36).replace(/[^a-z0-9]/g, "");
  return base.slice(0, 8).padEnd(6, "0");
}