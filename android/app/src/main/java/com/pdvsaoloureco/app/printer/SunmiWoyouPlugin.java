package com.pdvsaoloureco.app.printer;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.RemoteException;
import android.util.Base64;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SunmiWoyou")
public class SunmiWoyouPlugin extends Plugin {

    private static final String TAG = "SunmiWoyouPlugin";
    private SunmiWoyouBridge bridge;
    private boolean isConnected = false;

    @Override
    public void load() {
        super.load();
        Log.i(TAG, "⚡ Carregando SunmiWoyouPlugin...");
        try {
            bridge = new SunmiWoyouBridge(getContext());
            Log.i(TAG, "✅ Bridge criada");
        } catch (Exception e) {
            Log.e(TAG, "❌ Erro", e);
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        Log.i(TAG, "connect()");

        if (bridge == null) {
            call.resolve(createError("Bridge não inicializada"));
            return;
        }

        bridge.connect(
                () -> {
                    isConnected = true;
                    call.resolve(createOk("Conectado"));
                },
                (error) -> {
                    isConnected = false;
                    call.resolve(createError(error));
                }
        );
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text");

        if (text == null || text.isEmpty()) {
            call.resolve(createError("Texto vazio"));
            return;
        }

        if (!isConnected || bridge == null) {
            call.resolve(createError("Não conectado"));
            return;
        }

        try {
            bridge.printText(text);
            call.resolve(createOk("OK"));
        } catch (RemoteException e) {
            call.resolve(createError(e.getMessage()));
        }
    }

    // ========== NOVO MÉTODO PARA IMPRIMIR BITMAP ==========
    @PluginMethod
    public void printBitmap(PluginCall call) {
        Log.i(TAG, "printBitmap() chamado");

        String base64Image = call.getString("base64");

        if (base64Image == null || base64Image.isEmpty()) {
            call.resolve(createError("Imagem não fornecida"));
            return;
        }

        if (!isConnected || bridge == null) {
            call.resolve(createError("Impressora não conectada"));
            return;
        }

        try {
            // Decodifica base64 para bitmap
            byte[] decodedString = Base64.decode(base64Image, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.length);

            if (bitmap == null) {
                call.resolve(createError("Falha ao decodificar imagem"));
                return;
            }

            Log.i(TAG, "Bitmap decodificado: " + bitmap.getWidth() + "x" + bitmap.getHeight());

            // Envia para impressão
            bridge.printBitmap(bitmap);

            call.resolve(createOk("Bitmap impresso"));
        } catch (RemoteException e) {
            Log.e(TAG, "Erro RemoteException", e);
            call.resolve(createError("Erro remoto: " + e.getMessage()));
        } catch (Exception e) {
            Log.e(TAG, "Erro", e);
            call.resolve(createError("Erro: " + e.getMessage()));
        }
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("connected", isConnected);
        ret.put("bridge_exists", bridge != null);
        ret.put("service_connected", bridge != null ? bridge.isConnected() : false);
        call.resolve(ret);
    }

    @PluginMethod
    public void cutPaper(PluginCall call) {
        if (!isConnected || bridge == null) {
            call.resolve(createError("Não conectado"));
            return;
        }
        try {
            bridge.cutPaper();
            call.resolve(createOk("Corte enviado"));
        } catch (RemoteException e) {
            call.resolve(createError(e.getMessage()));
        }
    }

    @PluginMethod
    public void lineWrap(PluginCall call) {
        int lines = call.getInt("lines", 1);
        if (!isConnected || bridge == null) {
            call.resolve(createError("Não conectado"));
            return;
        }
        try {
            bridge.lineWrap(lines);
            call.resolve(createOk(lines + " linhas"));
        } catch (RemoteException e) {
            call.resolve(createError(e.getMessage()));
        }
    }

    @PluginMethod
    public void initPrinter(PluginCall call) {
        if (!isConnected || bridge == null) {
            call.resolve(createError("Não conectado"));
            return;
        }
        try {
            bridge.init();
            call.resolve(createOk("Inicializado"));
        } catch (RemoteException e) {
            call.resolve(createError(e.getMessage()));
        }
    }

    private JSObject createOk(String msg) {
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("message", msg);
        return ret;
    }

    private JSObject createError(String msg) {
        JSObject ret = new JSObject();
        ret.put("ok", false);
        ret.put("error", msg);
        return ret;
    }
}