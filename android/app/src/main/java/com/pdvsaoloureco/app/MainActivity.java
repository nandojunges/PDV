package com.pdvsaoloureco.app;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Registra o plugin de impressão
        registerPlugin(AndroidPrinterPlugin.class);
        Log.i("MainActivity", "PLUGIN REGISTRADO");
    }
}
