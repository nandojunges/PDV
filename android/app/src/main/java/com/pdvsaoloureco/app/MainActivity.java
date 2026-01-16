package com.pdvsaoloureco.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Registra o plugin de impressão
        registerPlugin(AndroidPrinterPlugin.class);
    }
}
