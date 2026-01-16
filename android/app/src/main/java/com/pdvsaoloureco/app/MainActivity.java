package com.pdvsaoloureco.app;

import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "MainActivity";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        try {
            // Registro explícito do plugin (necessário quando não existe auto-registro no projeto)
            registerPlugin(AndroidPrinterPlugin.class);
            Log.i(TAG, "AndroidPrinterPlugin registrado com sucesso");
        } catch (Throwable t) {
            Log.e(TAG, "Falha ao registrar AndroidPrinterPlugin", t);
        }

        Log.i(TAG, "MainActivity onCreate finalizado");
    }
}
