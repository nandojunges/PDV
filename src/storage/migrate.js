import { LS_KEYS } from "./keys";
import { loadJSON, saveJSON } from "./storage";

export function ensureMigrations() {
  // versão simples para futuro
  const v = loadJSON(LS_KEYS.version, { v: 1 });
  if (!v?.v) {
    saveJSON(LS_KEYS.version, { v: 1 });
    return;
  }
  // se no futuro precisar, você incrementa v e transforma dados.
}
