export async function getLocalIpHint() {
  const fallback = "Use o IP do Wi-Fi do aparelho mestre nas configurações.";

  const networkPlugin = window?.Capacitor?.Plugins?.Network;
  if (!networkPlugin?.getStatus) {
    return { ip: null, hint: fallback };
  }

  try {
    const status = await networkPlugin.getStatus();
    const connection = status?.connectionType ? `Conexão: ${status.connectionType}. ` : "";
    return { ip: null, hint: `${connection}${fallback}`.trim() };
  } catch {
    return { ip: null, hint: fallback };
  }
}