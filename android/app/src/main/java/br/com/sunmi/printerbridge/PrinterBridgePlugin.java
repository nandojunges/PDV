package com.pdvsaoloureco.app;

import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "PrinterBridge")
public class PrinterBridgePlugin extends Plugin {

    private PrinterBridge printer;

    @Override
    public void load() {
        printer = new PrinterBridge(getContext());
    }

    @PluginMethod
    public void printText(PluginCall call) {
        String text = call.getString("text", "");
        int result = printer.printText(text);

        JSObject ret = new JSObject();
        ret.put("success", result == 0);
        call.resolve(ret);
    }
}
