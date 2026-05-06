const DEFAULT_ADMIN_PASSWORD = "123456";

export function confirmarSenhaAcao({
  acao = "executar esta ação",
  senha = DEFAULT_ADMIN_PASSWORD,
} = {}) {
  if (typeof window === "undefined") return false;
  const informada = window.prompt(`Digite a senha para ${acao}:`);
  if (informada === null) return false;
  const ok = String(informada) === String(senha);
  if (!ok) {
    window.alert("Senha incorreta.");
  }
  return ok;
}

export function executarComSenha({ acao, senha, onConfirmar }) {
  if (!confirmarSenhaAcao({ acao, senha })) return false;
  if (typeof onConfirmar === "function") {
    onConfirmar();
  }
  return true;
}
