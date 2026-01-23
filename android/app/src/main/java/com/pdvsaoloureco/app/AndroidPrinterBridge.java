package com.pdvsaoloureco.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.text.Html;
import android.util.Log;
import android.webkit.JavascriptInterface;

import woyou.aidlservice.jiuiv5.ICallback;
import woyou.aidlservice.jiuiv5.IWoyouService;

public class AndroidPrinterBridge {
    private static final String TAG = "AndroidPrinter";

    private final Context appContext;
    private IWoyouService printerService;
    private volatile String lastError;

    private volatile boolean isBinding = false;
    private volatile boolean isBound = false;

    public AndroidPrinterBridge(Context context) {
        this.appContext = context.getApplicationContext();
        bindPrinterService();
    }

    private void bindPrinterService() {
        if (isBinding) return;
        isBinding = true;

        try {
            Intent intent = new Intent("woyou.aidlservice.jiuiv5.IWoyouService");
            intent.setPackage("woyou.aidlservice.jiuiv5");

            appContext.startService(intent);
            boolean ok = appContext.bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);
            isBound = ok;
            Log.i(TAG, "bindService retornou: " + ok);
        } catch (Throwable e) {
            Log.e(TAG, "Falha ao bind do serviço de impressão", e);
        } finally {
            isBinding = false;
        }
    }

    public boolean ensureConnected(long timeoutMs) {
        if (printerService != null) {
            return true;
        }

        Log.i(TAG, "ensureConnected aguardando conexão. timeoutMs=" + timeoutMs);
        bindPrinterService();

        long start = System.currentTimeMillis();
        while (printerService == null && (System.currentTimeMillis() - start) < timeoutMs) {
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                Log.w(TAG, "ensureConnected interrompido.", e);
                return false;
            }
        }

        boolean ok = printerService != null;
        if (!ok) Log.w(TAG, "ensureConnected timeout após " + timeoutMs + "ms.");
        return ok;
    }

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            printerService = IWoyouService.Stub.asInterface(service);
            Log.i(TAG, "onServiceConnected executado: " + name + " | printerService=" + (printerService != null));
            if (printerService != null) {
                try {
                    printerService.printerInit(callbackNoop);
                    Log.i(TAG, "printerInit executado com sucesso.");
                } catch (Throwable t) {
                    Log.e(TAG, "Falha ao executar printerInit.", t);
                }
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            Log.w(TAG, "onServiceDisconnected executado: " + name);
            printerService = null;
            isBound = false;
        }

        @Override
        public void onBindingDied(ComponentName name) {
            Log.w(TAG, "onBindingDied: " + name);
            printerService = null;
            isBound = false;
        }

        @Override
        public void onNullBinding(ComponentName name) {
            Log.e(TAG, "onNullBinding: " + name);
            printerService = null;
            isBound = false;
        }
    };

    private boolean isConnected() {
        return printerService != null;
    }

    @JavascriptInterface
    public String printerStatus() {
        return isConnected() ? "OK: impressora conectada" : "ERRO: impressora NAO conectada";
    }

    @JavascriptInterface
    public boolean isBridgeReady() {
        return isConnected();
    }

    public boolean isServiceConnected() {
        return isConnected();
    }

    public String getLastError() {
        return lastError;
    }

    private void setLastError(String error) {
        lastError = error;
    }

    private final ICallback callbackNoop = new ICallback.Stub() {
        @Override public void onRunResult(boolean isSuccess) {}

        @Override public void onReturnString(String result) {}

        @Override public void onRaiseException(int code, String msg) {
            Log.e(TAG, "Printer exception: " + code + " - " + msg);
        }
    };

    @JavascriptInterface
    public boolean printTesteDireto() {
        Log.i(TAG, "printTesteDireto() chamado. connected=" + isConnected());
        if (!isConnected()) {
            setLastError("Serviço de impressão não conectado");
            Log.w(TAG, "printTesteDireto: não conectado.");
            return false;
        }

        try {
            printerService.printText(
                    "=== TESTE DIRETO APP ===\n" +
                            "linha 1\n" +
                            "linha 2\n",
                    callbackNoop
            );

            try { printerService.lineWrap(4, callbackNoop); } catch (Throwable ignored) {}
            Log.i(TAG, "printTesteDireto: enviado ao serviço.");
            setLastError(null);
            return true;
        } catch (Throwable t) {
            Log.e(TAG, "printTesteDireto: erro", t);
            setLastError("Falha no teste direto: " + (t.getMessage() != null ? t.getMessage() : t.toString()));
            return false;
        }
    }

    @JavascriptInterface
    public boolean printHtml(String html) {
        Log.i(TAG, "printHtml() chamado. len=" + (html == null ? 0 : html.length()) + " connected=" + isConnected());
        if (!isConnected()) {
            setLastError("Serviço de impressão não conectado");
            Log.w(TAG, "printHtml: não conectado.");
            return false;
        }

        try {
            String text = htmlToPlainText(html);
            text = normalizeTicketText(text);
            String preview = text.substring(0, Math.min(60, text.length())).replace("\n", " ");
            Log.i(TAG, "printHtml: texto len=" + text.length() + " preview=\"" + preview + "\"");
            if (text.trim().isEmpty()) {
                String message = "HTML convertido em texto vazio";
                Log.e(TAG, "printHtml: texto vazio (HTML virou vazio).");
                setLastError(message);
                throw new IllegalArgumentException(message);
            }

            try { printerService.setAlignment(0, callbackNoop); } catch (Throwable ignored) {}
            try { printerService.setFontSize(24f, callbackNoop); } catch (Throwable ignored) {}

            printerService.printText(text, callbackNoop);
            try { printerService.lineWrap(4, callbackNoop); } catch (Throwable ignored) {}

            Log.i(TAG, "printHtml: enviado ao serviço.");
            setLastError(null);
            return true;
        } catch (Throwable t) {
            Log.e(TAG, "printHtml: erro", t);
            setLastError("Falha ao imprimir HTML: " + (t.getMessage() != null ? t.getMessage() : t.toString()));
            return false;
        }
    }

    @JavascriptInterface
    public boolean printText(String text) {
        Log.i(TAG, "printText() chamado. len=" + (text == null ? 0 : text.length()) + " connected=" + isConnected());
        if (!isConnected()) {
            setLastError("Serviço de impressão não conectado");
            Log.w(TAG, "printText: não conectado.");
            return false;
        }

        try {
            String safe = normalizeTicketText(text);
            String preview = safe.substring(0, Math.min(60, safe.length())).replace("\n", " ");
            Log.i(TAG, "printText: texto len=" + safe.length() + " preview=\"" + preview + "\"");
            if (safe.trim().isEmpty()) {
                Log.e(TAG, "printText: texto vazio.");
                setLastError("Texto vazio para impressão");
                return false;
            }

            try { printerService.setAlignment(0, callbackNoop); } catch (Throwable ignored) {}
            try { printerService.setFontSize(24f, callbackNoop); } catch (Throwable ignored) {}

            String head = safe.substring(0, Math.min(120, safe.length())).replace("\n", " ");
            Log.i(TAG, "printText: enviando len=" + safe.length() + ", head=\"" + head + "\"");
            printerService.printText(safe, callbackNoop);
            try { printerService.lineWrap(4, callbackNoop); } catch (Throwable ignored) {}

            Log.i(TAG, "printText: enviado ao serviço.");
            setLastError(null);
            return true;
        } catch (Throwable t) {
            Log.e(TAG, "printText: erro", t);
            setLastError("Falha ao imprimir texto: " + (t.getMessage() != null ? t.getMessage() : t.toString()));
            return false;
        }
    }

    private String htmlToPlainText(String html) {
        if (html == null) return "";
        CharSequence cs;
        try {
            cs = Html.fromHtml(html, Html.FROM_HTML_MODE_LEGACY);
        } catch (Throwable t) {
            cs = Html.fromHtml(html);
        }
        return cs == null ? "" : cs.toString().replace("\r", "");
    }

    private String normalizeTicketText(String s) {
        if (s == null) return "\n";
        String out = s;

        out = out.replace("\u00A0", " ");
        out = out.replaceAll("[ \t]+\n", "\n");
        out = out.replaceAll("\n{3,}", "\n\n");
        out = out.trim();

        if (!out.endsWith("\n")) out = out + "\n";
        return out;
    }
}
