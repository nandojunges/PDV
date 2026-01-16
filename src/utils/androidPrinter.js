import { Capacitor, registerPlugin } from "@capacitor/core";

export const AndroidPrinterPlugin = registerPlugin("AndroidPrinterPlugin");

function ensureAndroid() {
  return Capacitor.getPlatform() === "android";
}

export async function printText(text) {
  if (!ensureAndroid()) return;
  return AndroidPrinterPlugin.printText({ text });
}

export async function printHtml(html) {
  if (!ensureAndroid()) return;
  return AndroidPrinterPlugin.printHtml({ html });
}

export async function printTesteDireto() {
  if (!ensureAndroid()) return;
  return AndroidPrinterPlugin.printTesteDireto({});
}
