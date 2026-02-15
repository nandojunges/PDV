import React, { useState } from 'react';
import { imprimirTexto } from "../utils/sunmiPrinter";

export default function TesteSunmiNovo({ aberto, onClose }) {
  const [log, setLog] = useState([]);
  const [carregando, setCarregando] = useState(false);

  const adicionarLog = (msg) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const limparLog = () => {
    setLog([]);
  };

  const testarDiagnostico = async () => {
    setCarregando(true);
    adicionarLog('🔍 Executando diagnóstico completo...');
    try {
      const resultado = await diagnosticarSunmi();
      adicionarLog(resultado);
    } catch (error) {
      adicionarLog(`❌ Erro: ${error.message}`);
    }
    setCarregando(false);
  };

  const testarTicketSimples = async () => {
    setCarregando(true);
    
    const ticket = `
================================
    TESTE SIMPLES
================================
Mesa: 05
1x Refrigerante
Total: R$ 5,00
================================
    `;
    
    adicionarLog('🎫 Imprimindo ticket simples...');
    try {
      const resultado = await imprimirTexto(ticket);
      adicionarLog(resultado.ok ? '✅ Ticket impresso!' : `❌ Falha: ${resultado.error}`);
    } catch (error) {
      adicionarLog(`❌ Erro: ${error.message}`);
    }
    setCarregando(false);
  };

  const testarEnter = async () => {
    setCarregando(true);
    adicionarLog('⏎ Testando avanço de linha...');
    try {
      const resultado = await imprimirTexto("\n\n\n");
      adicionarLog(resultado.ok ? '✅ Comando enviado!' : `❌ Falha: ${resultado.error}`);
    } catch (error) {
      adicionarLog(`❌ Erro: ${error.message}`);
    }
    setCarregando(false);
  };

  if (!aberto) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.8)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}>
      <div style={{
        background: '#1e1e1e',
        borderRadius: 16,
        maxWidth: 500,
        width: '100%',
        maxHeight: '80vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Cabeçalho */}
        <div style={{
          padding: 16,
          background: '#2d2d2d',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #404040'
        }}>
          <h3 style={{ color: '#fff', margin: 0 }}>
            🖨️ Teste Impressora
          </h3>
          <div>
            <button 
              onClick={limparLog}
              style={{
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                padding: '5px 10px',
                marginRight: 8,
                cursor: 'pointer'
              }}
            >
              Limpar
            </button>
            <button 
              onClick={onClose}
              style={{
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: 4,
                padding: '5px 10px',
                cursor: 'pointer'
              }}
            >
              Fechar
            </button>
          </div>
        </div>

        {/* Botões */}
        <div style={{
          padding: 16,
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap'
        }}>
          <button
            onClick={testarDiagnostico}
            disabled={carregando}
            style={buttonStyle('#9C27B0')}
          >
            🔍 Diagnóstico
          </button>

          <button
            onClick={testarEnter}
            disabled={carregando}
            style={buttonStyle('#00BCD4')}
          >
            ⏎ Testar Enter
          </button>

          <button
            onClick={testarTicketSimples}
            disabled={carregando}
            style={buttonStyle('#4CAF50')}
          >
            🎫 Ticket Teste
          </button>
        </div>

        {/* Log */}
        <div style={{
          padding: 16,
          paddingTop: 0
        }}>
          <div style={{
            background: '#000',
            color: '#0f0',
            padding: 12,
            borderRadius: 8,
            fontFamily: 'monospace',
            fontSize: 13,
            height: 300,
            overflow: 'auto'
          }}>
            {log.map((msg, i) => (
              <div key={i} style={{ margin: '2px 0' }}>{msg}</div>
            ))}
            {log.length === 0 && (
              <div style={{ color: '#666' }}>Clique em Diagnóstico para começar...</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const buttonStyle = (bgColor) => ({
  padding: '10px 20px',
  background: bgColor,
  color: 'white',
  border: 'none',
  borderRadius: 6,
  fontSize: 14,
  fontWeight: 'bold',
  cursor: 'pointer',
  opacity: 0.9,
  flex: 1,
  minWidth: 120
});