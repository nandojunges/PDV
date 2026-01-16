import { Capacitor } from "@capacitor/core";
import { AndroidPrinterPlugin } from "./androidPrinter";

const listPluginKeys = (plugin) => {
  try {
    if (!plugin) return [];
    return Object.keys(plugin);
  } catch {
    return [];
  }
};

export const getPlatform = () => {
  try {
    if (typeof Capacitor !== "undefined" && Capacitor?.getPlatform) {
      return Capacitor.getPlatform();
    }
  } catch {}
  try {
    return /android/i.test(navigator?.userAgent || "") ? "android" : "web";
  } catch {
    return "web";
  }
};

export const getAndroidPrinterPlugin = () => AndroidPrinterPlugin;

export const isAndroidPrinterAvailable = () => {
  try {
    if (typeof Capacitor !== "undefined" && Capacitor?.isPluginAvailable) {
      return Capacitor.isPluginAvailable("AndroidPrinterPlugin");
    }
  } catch {}
  return false;
};

export const getAndroidPrinterDiagnostics = () => {
  const plugin = getAndroidPrinterPlugin();
  const pluginKeys = listPluginKeys(plugin);
  const isAvailable = isAndroidPrinterAvailable();

  return (
    `UA: ${navigator?.userAgent || "?"}\n` +
    `platform: ${getPlatform()}\n` +
    `Capacitor.isPluginAvailable: ${isAvailable}\n` +
    `AndroidPrinterPlugin typeof: ${typeof plugin}\n` +
    `AndroidPrinterPlugin keys: ${pluginKeys.length ? pluginKeys.join(", ") : "(vazio)"}\n` +
    `printText typeof: ${typeof plugin?.printText}\n` +
    `printHtml typeof: ${typeof plugin?.printHtml}\n` +
    `printTesteDireto typeof: ${typeof plugin?.printTesteDireto}\n`
  );
};

export const logAndroidPrinterStatus = () => {
  if (getPlatform() !== "android") return;
  const plugin = getAndroidPrinterPlugin();
  const isAvailable = isAndroidPrinterAvailable();
  const hasText = typeof plugin?.printText === "function";
  const hasHtml = typeof plugin?.printHtml === "function";
  const hasTest = typeof plugin?.printTesteDireto === "function";

  console.info(
    "[AndroidPrinterPlugin] status",
    JSON.stringify(
      {
        available: isAvailable,
        hasText,
        hasHtml,
        hasTest,
      },
      null,
      2,
    ),
  );
};
