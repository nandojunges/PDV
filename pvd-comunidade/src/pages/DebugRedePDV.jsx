import React, { useEffect, useMemo, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { createMockState } from "../domain/pdvState";
import { PDV_PORT } from "../net/pdvNetConfig";
import { startPdvServer, stopPdvServer } from "../net/pdvServer";
import { fetchSnapshot, pingMaster } from "../net/pdvClient";
import { getLocalIpHint } from "../net/pdvLocalIp";

export default function DebugRedePDV() {
  const [masterState, setMasterState] = useState(null);
  const [serverInfo, setServerInfo] = useState({ status: "idle", message: "" });
  const [ipHint, setIpHint] = useState("");

  const [clientIp, setClientIp] = useState("");
  const [clientPort, setClientPort] = useState(String(PDV_PORT));
  const [clientPin, setClientPin] = useState("");
  const [clientStatus, setClientStatus] = useState("");
  const [snapshot, setSnapshot] = useState(null);

  const baseUrl = useMemo(() => {
    const ip = clientIp.trim();
    const port = clientPort.trim();
    if (!ip || !port) return "";
    return `http://${ip}:${port}`;
  }, [clientIp, clientPort]);

  useEffect(() => {
    let mounted = true;
    getLocalIpHint().then((info) => {
      if (!mounted) return;
      setIpHint(info?.hint || "Use o IP do Wi-Fi do aparelho mestre.");
    });
    return () => {
      mounted = false;
    };
  }, []);

  async function abrirServidor() {
    const mock = createMockState();
    setMasterState(mock);
    setServerInfo({ status: "loading", message: "Iniciando servidor..." });

    try {
      await startPdvServer({ getState: () => mock });
      setServerInfo({ status: "ready", message: "Servidor ativo" });
    } catch (error) {
      setServerInfo({
        status: "error",
        message: error?.message || "Falha ao iniciar servidor.",
      });
    }
  }

  async function pararServidor() {
    await stopPdvServer();
    setServerInfo({ status: "idle", message: "Servidor parado" });
  }

  async function testarConexao() {
    setClientStatus("Testando conexão...");
    setSnapshot(null);
    const result = await pingMaster(baseUrl);
    if (result.ok) {
      setClientStatus(`Handshake OK: ${result.data?.app || "Mestre"}`);
    } else {
      setClientStatus(result.error || "Falha no handshake.");
    }
  }

  async function baixarSnapshot() {
    setClientStatus("Baixando snapshot...");
    const result = await fetchSnapshot(baseUrl, clientPin);
    if (result.ok) {
      setSnapshot(result.data);
      setClientStatus("Snapshot recebido.");
    } else {
      setClientStatus(result.error || "Falha ao baixar snapshot.");
    }
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <Card title="Debug Rede PDV" subtitle="Conexão Mestre/Cliente via HTTP">
        <div style={{ display: "grid", gap: 16 }}>
          <section style={{ padding: 12, border: "1px dashed #cbd5e1", borderRadius: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>MODO MESTRE</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <Button variant="primary" onClick={abrirServidor}>
                Abrir Caixa (Servidor)
              </Button>
              <Button variant="danger" onClick={pararServidor}>
                Parar Servidor
              </Button>
            </div>

            <div className="muted" style={{ marginBottom: 6 }}>
              Status: {serverInfo.message || "Servidor não iniciado"}
            </div>

            {masterState ? (
              <div style={{ display: "grid", gap: 6 }}>
                <div>
                  <strong>Caixa ID:</strong> {masterState.caixaId}
                </div>
                <div>
                  <strong>PIN:</strong> {masterState.pin}
                </div>
                <div>
                  <strong>Porta:</strong> {PDV_PORT}
                </div>
                <div className="muted">{ipHint}</div>
              </div>
            ) : (
              <div className="muted">Gere um caixa para exibir PIN e porta.</div>
            )}
          </section>

          <section style={{ padding: 12, border: "1px dashed #cbd5e1", borderRadius: 12 }}>
            <div style={{ fontWeight: 900, marginBottom: 8 }}>MODO CLIENTE</div>

            <div style={{ display: "grid", gap: 10, marginBottom: 10 }}>
              <div>
                <div className="muted" style={{ marginBottom: 4 }}>
                  IP do mestre
                </div>
                <input
                  className="input"
                  value={clientIp}
                  onChange={(e) => setClientIp(e.target.value)}
                  placeholder="192.168.0.10"
                />
              </div>

              <div>
                <div className="muted" style={{ marginBottom: 4 }}>
                  Porta
                </div>
                <input
                  className="input"
                  value={clientPort}
                  onChange={(e) => setClientPort(e.target.value)}
                  placeholder={String(PDV_PORT)}
                />
              </div>

              <div>
                <div className="muted" style={{ marginBottom: 4 }}>
                  PIN
                </div>
                <input
                  className="input"
                  value={clientPin}
                  onChange={(e) => setClientPin(e.target.value)}
                  placeholder="000000"
                />
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Button variant="secondary" onClick={testarConexao}>
                Testar Conexão
              </Button>
              <Button variant="primary" onClick={baixarSnapshot}>
                Baixar Snapshot
              </Button>
            </div>

            <div className="muted" style={{ marginTop: 8 }}>
              {clientStatus || (baseUrl ? `Destino: ${baseUrl}` : "Informe IP e porta.")}
            </div>

            {snapshot?.produtos?.length ? (
              <div style={{ marginTop: 12, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ textAlign: "left", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "6px 4px" }}>Produto</th>
                      <th style={{ padding: "6px 4px" }}>Preço</th>
                      <th style={{ padding: "6px 4px" }}>Categoria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.produtos.map((item) => (
                      <tr key={item.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 4px" }}>
                          {item.iconeKey} {item.nome}
                        </td>
                        <td style={{ padding: "6px 4px" }}>
                          {(item.precoCentavos / 100).toFixed(2)}
                        </td>
                        <td style={{ padding: "6px 4px" }}>{item.categoria}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        </div>
      </Card>
    </div>
  );
}
