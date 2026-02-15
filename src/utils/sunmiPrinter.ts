import { Capacitor } from "@capacitor/core";
import { registerPlugin } from "@capacitor/core";

export type PrintResult = { ok: true } | { ok: false; error: string };

type SunmiWoyouPlugin = {
  connect(): Promise<{ ok: boolean; message?: string; error?: string }>;
  initPrinter(): Promise<{ ok: boolean; message?: string; error?: string }>;
  printText(options: { text: string }): Promise<{ ok: boolean; message?: string; error?: string }>;
  printBitmap(options: { base64: string }): Promise<{ ok: boolean; message?: string; error?: string }>; // 👈 NOVO
  lineWrap(options: { lines: number }): Promise<{ ok: boolean; message?: string; error?: string }>;
  cutPaper(): Promise<{ ok: boolean; message?: string; error?: string }>;
  getStatus(): Promise<{ connected: boolean; service_connected: boolean; bridge_exists: boolean }>;
};

export const SunmiWoyou = registerPlugin<SunmiWoyouPlugin>("SunmiWoyou");

const isNativeAndroid = () => {
  return Capacitor.getPlatform() === "android" && Capacitor.isNativePlatform();
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ==================== FUNÇÃO PRINCIPAL ====================

/**
 * IMPRIME TEXTO NA SUNMI V2
 * @param texto Texto a ser impresso
 * @returns Resultado da impressão
 */
export async function imprimirTexto(texto: string): Promise<PrintResult> {
  if (!isNativeAndroid()) {
    console.log("Preview:", texto);
    return { ok: true };
  }

  if (!texto || texto.trim().length === 0) {
    return { ok: false, error: "Texto vazio" };
  }

  try {
    console.log("🖨️ Imprimindo texto...");
    
    // 1. Conecta
    const connectResult = await SunmiWoyou.connect();
    if (!connectResult?.ok) {
      return { ok: false, error: "Falha ao conectar" };
    }
    await sleep(200);
    
    // 2. Inicializa
    await SunmiWoyou.initPrinter();
    await sleep(200);
    
    // 3. Imprime
    await SunmiWoyou.printText({ text: texto + "\n\n" });
    
    // 4. Finaliza
    await SunmiWoyou.lineWrap({ lines: 3 });
    
    return { ok: true };
    
  } catch (error: any) {
    return { ok: false, error: error?.message || "Erro desconhecido" };
  }
}

// ==================== NOVA FUNÇÃO PARA IMPRIMIR BITMAP ====================

/**
 * IMPRIME UMA IMAGEM NA SUNMI V2
 * @param base64 Imagem em formato base64
 * @returns Resultado da impressão
 */
export async function imprimirBitmap(base64: string): Promise<PrintResult> {
  if (!isNativeAndroid()) {
    console.log("Preview de bitmap (simulado)");
    return { ok: true };
  }

  if (!base64 || base64.length === 0) {
    return { ok: false, error: "Imagem vazia" };
  }

  try {
    console.log("🖼️ Imprimindo bitmap...");
    
    // 1. Conecta
    const connectResult = await SunmiWoyou.connect();
    if (!connectResult?.ok) {
      return { ok: false, error: "Falha ao conectar" };
    }
    await sleep(200);
    
    // 2. Inicializa
    await SunmiWoyou.initPrinter();
    await sleep(200);
    
    // 3. Imprime o bitmap
    await SunmiWoyou.printBitmap({ base64 });
    
    // 4. Finaliza
    await SunmiWoyou.lineWrap({ lines: 2 });
    
    return { ok: true };
    
  } catch (error: any) {
    return { ok: false, error: error?.message || "Erro desconhecido" };
  }
}

// ==================== DIAGNÓSTICO ====================

/**
 * Diagnóstico completo da impressora
 */
export async function diagnosticarSunmi(): Promise<string> {
  if (!isNativeAndroid()) return "Não está em Android nativo";

  let log = "=== DIAGNÓSTICO SUNMI ===\n";
  
  try {
    log += "\n1️⃣ connect()...\n";
    const c = await SunmiWoyou.connect();
    log += `   ${JSON.stringify(c)}\n`;
    
    log += "\n2️⃣ getStatus()...\n";
    const s = await SunmiWoyou.getStatus();
    log += `   ${JSON.stringify(s)}\n`;
    
    log += "\n3️⃣ initPrinter()...\n";
    const i = await SunmiWoyou.initPrinter();
    log += `   ${JSON.stringify(i)}\n`;
    
    log += "\n4️⃣ printText()...\n";
    const p = await SunmiWoyou.printText({ text: "TESTE\n" });
    log += `   ${JSON.stringify(p)}\n`;
    
  } catch (error: any) {
    log += `\n❌ ERRO: ${error.message}\n`;
  }
  
  return log;
}

// ==================== TESTES RÁPIDOS ====================

/**
 * Teste rápido (apenas para ver se a impressora responde)
 */
export async function testarEnter(): Promise<PrintResult> {
  return imprimirTexto("\n\n");
}

/**
 * Teste com texto simples
 */
export async function testarImpressora(): Promise<PrintResult> {
  return imprimirTexto("TESTE\nOK\n");
}

/**
 * Teste com bitmap (usa um ícone de exemplo)
 */
export async function testarBitmap(): Promise<PrintResult> {
  // Cria um bitmap simples em base64 (um quadrado preto de exemplo)
  // Em produção, você usaria os ícones reais do ICONS
  const canvas = `
    iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==
  `.trim();
  
  return imprimirBitmap(canvas);
}