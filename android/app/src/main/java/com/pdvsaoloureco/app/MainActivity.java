package com.pdvsaoloureco.app;

import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.pdvsaoloureco.app.printer.SunmiWoyouPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        Log.i("MainActivity", "🚀 Iniciando MainActivity...");

        // ⚠️ CRÍTICO: registerPlugin DEVE vir ANTES de super.onCreate()
        try {
            registerPlugin(SunmiWoyouPlugin.class);
            Log.i("MainActivity", "✅ Plugin SunmiWoyou registrado com SUCESSO");
        } catch (Exception e) {
            Log.e("MainActivity", "❌ Erro ao registrar plugin SunmiWoyou", e);
        }

        // Agora sim chama super.onCreate()
        super.onCreate(savedInstanceState);

        Log.i("MainActivity", "✅ MainActivity completamente inicializada");
    }
}