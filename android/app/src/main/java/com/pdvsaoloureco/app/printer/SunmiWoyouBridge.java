package com.pdvsaoloureco.app.printer;

import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.ServiceConnection;
import android.graphics.Bitmap;
import android.os.IBinder;
import android.os.RemoteException;
import android.util.Log;

import woyou.aidlservice.jiuiv5.ICallback;
import woyou.aidlservice.jiuiv5.IWoyouService;

public class SunmiWoyouBridge {
    private static final String TAG = "SunmiWoyouBridge";
    private static final String ACTION = "woyou.aidlservice.jiuiv5.IWoyouService";
    private static final String PKG = "woyou.aidlservice.jiuiv5";

    private final Context appContext;
    private IWoyouService service = null;
    private Runnable pendingOk = null;
    private ErrorCallback pendingFail = null;

    public interface ErrorCallback {
        void onError(String error);
    }

    public SunmiWoyouBridge(Context context) {
        this.appContext = context.getApplicationContext();
    }

    public synchronized boolean isConnected() {
        return service != null;
    }

    public void connect(Runnable onOk, ErrorCallback onFail) {
        pendingOk = onOk;
        pendingFail = onFail;

        if (service != null) {
            if (onOk != null) onOk.run();
            return;
        }

        Intent intent = new Intent(ACTION);
        intent.setPackage(PKG);
        appContext.bindService(intent, conn, Context.BIND_AUTO_CREATE);
    }

    private final ServiceConnection conn = new ServiceConnection() {
        @Override
        public void onServiceConnected(ComponentName name, IBinder binder) {
            service = IWoyouService.Stub.asInterface(binder);
            if (service != null && pendingOk != null) {
                pendingOk.run();
            }
        }

        @Override
        public void onServiceDisconnected(ComponentName name) {
            service = null;
        }
    };

    private ICallback callbackNoop = new ICallback.Stub() {
        @Override public void onRunResult(boolean isSuccess) {}
        @Override public void onReturnString(String result) {}
        @Override public void onRaiseException(int code, String msg) {}
        @Override public void onPrintResult(int code, String msg) {}
    };

    private IWoyouService requireService() throws RemoteException {
        if (service == null) throw new RemoteException("Desconectado");
        return service;
    }

    public void init() throws RemoteException {
        requireService().printerInit(callbackNoop);
    }

    public void setAlignment(int alignment) throws RemoteException {
        requireService().setAlignment(alignment, callbackNoop);
    }

    public void printText(String text) throws RemoteException {
        requireService().printText(text, callbackNoop);
    }

    public void lineWrap(int lines) throws RemoteException {
        requireService().lineWrap(lines, callbackNoop);
    }

    public void cutPaper() throws RemoteException {
        byte[] cutCommand = new byte[]{0x1D, 0x56, 0x42, 0x00};
        requireService().sendRAWData(cutCommand, callbackNoop);
    }

    public int getPrinterStatus() throws RemoteException {
        return requireService().updatePrinterState();
    }

    // ========== NOVO MÉTODO PARA IMPRIMIR BITMAP ==========
    public void printBitmap(Bitmap bitmap) throws RemoteException {
        Log.i(TAG, "printBitmap() - largura: " + bitmap.getWidth() + ", altura: " + bitmap.getHeight());
        requireService().printBitmap(bitmap, callbackNoop);
    }
}