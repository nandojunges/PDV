const EVENTO_KEY_PREFIX = "pdv:eventoKey";
const EVENTO_PIN_PREFIX = "pdv:eventoPin";

function storageAvailable() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function buildKey(prefix, id) {
  return `${prefix}:${String(id)}`;
}

function uuidFallback() {
  const template = "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx";
  return template.replace(/[xy]/g, (char) => {
    const rand = Math.floor(Math.random() * 16);
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

function generateUuid() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return uuidFallback();
}

function generatePin() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function getOrCreateEventoKey(eventoIdOuNome) {
  if (!storageAvailable()) return "";
  const id = String(eventoIdOuNome || "").trim();
  if (!id) return "";

  const key = buildKey(EVENTO_KEY_PREFIX, id);
  const existing = window.localStorage.getItem(key);
  if (existing) return existing;

  const novo = generateUuid();
  window.localStorage.setItem(key, novo);
  return novo;
}

export function getOrCreateEventoPin(eventoKey) {
  if (!storageAvailable()) return "";
  const key = String(eventoKey || "").trim();
  if (!key) return "";

  const storageKey = buildKey(EVENTO_PIN_PREFIX, key);
  const existing = window.localStorage.getItem(storageKey);
  if (existing) return existing;

  const novo = generatePin();
  window.localStorage.setItem(storageKey, novo);
  return novo;
}

export function shortId(uuid) {
  return String(uuid || "").slice(0, 8);
}