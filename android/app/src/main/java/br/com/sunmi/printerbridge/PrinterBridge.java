package com.pdvsaoloureco.app;

import android.content.*;
import android.os.IBinder;
import android.os.RemoteException;
import android.util.Log;

import woyou.aidlservice.jiuiv5.IWoyouService;

public class PrinterBridge {

    private IWoyouService service;
    private boolean bound = false;
    private Context context;

    public PrinterBridge(Context ctx) {
        context = ctx;
        bind();
    }

    private void bind() {
        Intent intent = new Intent();
        intent.setPackage("woyou.aidlservice.jiuiv5");
        intent.setAction("woyou.aidlservice.jiuiv5.IWoyouService");

        context.bindService(intent, new ServiceConnection() {
            @Override
            public void onServiceConnected(ComponentName name, IBinder binder) {
                service = IWoyouService.Stub.asInterface(binder);
                bound = true;
            }

            @Override
            public void onServiceDisconnected(ComponentName name) {
                bound = false;
                service = null;
            }
        }, Context.BIND_AUTO_CREATE);
    }

    public boolean isReady() {
        return bound && service != null;
    }

    public int printText(String text) {
        if (!isReady()) return -1;
        try {
            service.printerInit();
            service.printText(text, "UTF-8");
            service.lineWrap(3);
            return 0;
        } catch (RemoteException e) {
            return -1;
        }
    }
}
