package com.pdvsaoloureco.app;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.os.IBinder;
import android.text.Html;
import android.util.Log;
import android.webkit.JavascriptInterface;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

import woyou.aidlservice.jiuiv5.ICallback;
import woyou.aidlservice.jiuiv5.IWoyouService;

public class AndroidPrinterBridge {
    private static final String TAG = "AndroidPrinter";

    private final Context appContext;
    private IWoyouService printerService;
    private volatile CountDownLatch connectionLatch = new CountDownLatch(1);

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
            if (printerService == null) {
                connectionLatch = new CountDownLatch(1);
            }
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

        CountDownLatch latch = connectionLatch;
        boolean connected = false;
        try {
            if (latch != null) {
                connected = latch.await(timeoutMs, TimeUnit.MILLISECONDS);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            Log.w(TAG, "ensureConnected interrompido.", e);
            return false;
        }

        boolean ok = printerService != null || connected;
        if (!ok) {
            Log.w(TAG, "ensureConnected timeout após " + timeoutMs + "ms.");
        }
        return ok;
    }

    private final ServiceConnection serviceConnection = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder service) {
            printerService = IWoyouService.Stub.asInterface(service);
            CountDownLatch latch = connectionLatch;
            if (latch != null) {
                latch.countDown();
            }
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
            connectionLatch = new CountDownLatch(1);
        }

        @Override
        public void onBindingDied(ComponentName name) {
            Log.w(TAG, "onBindingDied: " + name);
            printerService = null;
            isBound = false;
            connectionLatch = new CountDownLatch(1);
        }

        @Override
        public void onNullBinding(ComponentName name) {
            Log.e(TAG, "onNullBinding: " + name);
            printerService = null;
            isBound = false;
            connectionLatch = new CountDownLatch(1);
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
            Log.w(TAG, "printTesteDireto: não conectado.");
            return false;
        }

        try {
            printerService.printText(
                    "### TESTE DO APP ###\n" +
                            "Se saiu isso, OK.\n",
                    callbackNoop
            );

            try { printerService.lineWrap(4, callbackNoop); } catch (Throwable ignored) {}
            Log.i(TAG, "printTesteDireto: enviado ao serviço.");
            return true;
        } catch (Throwable t) {
            Log.e(TAG, "printTesteDireto: erro", t);
            return false;
        }
    }

    @JavascriptInterface
    public boolean printHtml(String html) {
        Log.i(TAG, "printHtml() chamado. len=" + (html == null ? 0 : html.length()) + " connected=" + isConnected());
        if (!isConnected()) {
            Log.w(TAG, "printHtml: não conectado.");
            return false;
        }

        try {
            String text = htmlToPlainText(html);
            text = normalizeTicketText(text);

            Log.i(TAG, "printHtml: texto len=" + text.length());
            if (text.trim().isEmpty()) {
                Log.e(TAG, "printHtml: texto vazio (HTML virou vazio).");
                return false;
            }

            try { printerService.setAlignment(0, callbackNoop); } catch (Throwable ignored) {}
            try { printerService.setFontSize(24f, callbackNoop); } catch (Throwable ignored) {}

            printerService.printText(text, callbackNoop);
            try { printerService.lineWrap(4, callbackNoop); } catch (Throwable ignored) {}

            Log.i(TAG, "printHtml: enviado ao serviço.");
            return true;
        } catch (Throwable t) {
            Log.e(TAG, "printHtml: erro", t);
            return false;
        }
    }

    @JavascriptInterface
    public boolean printText(String text) {
        Log.i(TAG, "printText() chamado. len=" + (text == null ? 0 : text.length()) + " connected=" + isConnected());
        if (!isConnected()) {
            Log.w(TAG, "printText: não conectado.");
            return false;
        }

        try {
            String safe = normalizeTicketText(text);

            Log.i(TAG, "printText: texto len=" + safe.length());
            if (safe.trim().isEmpty()) {
                Log.e(TAG, "printText: texto vazio.");
                return false;
            }

            try { printerService.setAlignment(0, callbackNoop); } catch (Throwable ignored) {}
            try { printerService.setFontSize(24f, callbackNoop); } catch (Throwable ignored) {}

            printerService.printText(safe, callbackNoop);
            try { printerService.lineWrap(4, callbackNoop); } catch (Throwable ignored) {}

            Log.i(TAG, "printText: enviado ao serviço.");
            return true;
        } catch (Throwable t) {
            Log.e(TAG, "printText: erro", t);
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
