package com.pdvsaoloureco.app;

import android.content.Context;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AndroidPrinterPlugin")
public class AndroidPrinterPlugin extends Plugin {
    private static final String TAG = "AndroidPrinterPlugin";

    private AndroidPrinterBridge printerBridge;

    @Override
    public void load() {
        super.load();
        try {
            Context ctx = null;

            try {
                ctx = getContext();
            } catch (Throwable ignore) {}

            if (ctx == null) {
                try {
                    if (getActivity() != null) ctx = getActivity().getApplicationContext();
                } catch (Throwable ignore) {}
            }

            if (ctx == null) {
                Log.e(TAG, "Context nulo ao inicializar plugin.");
                return;
            }

            printerBridge = new AndroidPrinterBridge(ctx.getApplicationContext());
            Log.i(TAG, "Plugin carregado. Bridge criada.");
        } catch (Throwable t) {
            Log.e(TAG, "Falha ao inicializar AndroidPrinterBridge", t);
        }
    }

    private String safeStatus() {
        try {
            String s = (printerBridge != null ? printerBridge.printerStatus() : "bridge nula");
            if (s == null) return "status indisponível";
            s = s.trim();
            return s.isEmpty() ? "status indisponível" : s;
        } catch (Throwable t) {
            return "status indisponível";
        }
    }

    private boolean isBridgeOk() {
        try {
            if (printerBridge == null) return false;

            final String status = safeStatus();
            if (status == null) return false;

            final String s = status.trim().toLowerCase();

            return s.startsWith("ok")
                    || s.contains("ok")
                    || s.contains("conect")
                    || s.contains("ready")
                    || s.contains("bound");
        } catch (Throwable t) {
            return false;
        }
    }

    private void resolveError(PluginCall call, String status, String error) {
        JSObject ret = new JSObject();
        ret.put("ok", false);
        ret.put("status", status != null ? status : safeStatus());
        ret.put("error", error != null ? error : "Erro desconhecido");
        call.resolve(ret);
    }

    private void resolveOk(PluginCall call, boolean ok, String status, String error) {
        JSObject ret = new JSObject();
        ret.put("ok", ok);
        ret.put("status", status != null ? status : safeStatus());
        if (error != null && !error.trim().isEmpty()) ret.put("error", error);
        call.resolve(ret);
    }

    @PluginMethod
    public void ping(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("pong", true);
        ret.put("status", safeStatus());
        call.resolve(ret);
    }

    @PluginMethod
    public void isBridgeReady(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ok", isBridgeOk());
        ret.put("status", safeStatus());
        call.resolve(ret);
    }

    @PluginMethod
    public void printerStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("ok", isBridgeOk());
        ret.put("status", safeStatus());
        call.resolve(ret);
    }

    @PluginMethod
    public void printTesteDireto(PluginCall call) {
        if (!isBridgeOk()) {
            resolveError(call, safeStatus(), "Impressora não conectada");
            return;
        }

        boolean ok = false;
        try {
            Log.i(TAG, "printTesteDireto solicitado");
            ok = printerBridge.printTesteDireto();
            resolveOk(call, ok, safeStatus(), ok ? null : "Falha no auto-teste");
        } catch (Throwable t) {
            Log.e(TAG, "printTesteDireto erro", t);
            resolveError(call, safeStatus(), "Exceção no auto-teste: " + (t.getMessage() != null ? t.getMessage() : t.toString()));
        }
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text", "");
        if (text == null) text = "";

        if (!isBridgeOk()) {
            resolveError(call, safeStatus(), "Impressora não conectada");
            return;
        }

        boolean ok = false;
        try {
            int len = text.length();
            String head = text.substring(0, Math.min(40, len)).replace("\n", " ");
            Log.i(TAG, "printText solicitado. len=" + len + ", head=\"" + head + "\"");

            ok = printerBridge.printText(text);
            resolveOk(call, ok, safeStatus(), ok ? null : "Falha ao imprimir texto");
        } catch (Throwable t) {
            Log.e(TAG, "printText erro", t);
            resolveError(call, safeStatus(), "Exceção ao imprimir texto: " + (t.getMessage() != null ? t.getMessage() : t.toString()));
        }
    }

    @PluginMethod
    public void printHtml(PluginCall call) {
        String html = call.getString("html", "");
        if (html == null) html = "";

        if (!isBridgeOk()) {
            resolveError(call, safeStatus(), "Impressora não conectada");
            return;
        }

        boolean ok = false;
        try {
            int len = html.length();
            String head = html.substring(0, Math.min(40, len)).replace("\n", " ");
            Log.i(TAG, "printHtml solicitado. len=" + len + ", head=\"" + head + "\"");

            ok = printerBridge.printHtml(html);
            resolveOk(call, ok, safeStatus(), ok ? null : "Falha ao imprimir HTML");
        } catch (Throwable t) {
            Log.e(TAG, "printHtml erro", t);
            resolveError(call, safeStatus(), "Exceção ao imprimir HTML: " + (t.getMessage() != null ? t.getMessage() : t.toString()));
        }
    }
}
