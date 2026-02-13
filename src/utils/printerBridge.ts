import { Capacitor } from "@capacitor/core";

export async function printSunmi(text: string) {
  if (Capacitor.getPlatform() !== "android") {
    throw new Error("Não é Android");
  }

  const { PrinterBridge } = (window as any).Capacitor.Plugins;

  const res = await PrinterBridge.printText({ text });

  if (!res.success) {
    throw new Error("Erro nativo na impressão");
  }
}
