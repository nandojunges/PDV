import React, { useState } from "react";
import { printSunmiTest } from "../utils/sunmiPrinter";

export default function TesteSunmi() {
  const [msg, setMsg] = useState("");

  const testar = async () => {
    setMsg("Inicializando...");

    const result = await printSunmiTest();

    if (!result.ok) {
      setMsg("❌ " + result.error);
      return;
    }

    setMsg("✅ Impresso! (se não saiu papel, verifique papel/tampa)");
  };

  return (
    <div style={{ padding: 16 }}>
      <button
        onClick={testar}
        style={{ padding: 12, fontWeight: 800 }}
      >
        🖨️ TESTAR SUNMI
      </button>

      <div style={{ marginTop: 12 }}>{msg}</div>
    </div>
  );
}
