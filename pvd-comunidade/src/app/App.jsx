// src/app/App.jsx
import React, { useEffect, useMemo, useState } from "react";

import TopBar from "../components/TopBar";

import Evento from "../pages/Evento";
import Produtos from "../pages/Produtos";
import Venda from "../pages/Venda";
import Caixa from "../pages/Caixa";
import Relatorio from "../pages/Relatorio";
import Ajustes from "../pages/Ajustes";

import { LS_KEYS } from "../storage/keys";
import { loadJSON, saveJSON } from "../storage/storage";
import { ensureMigrations } from "../storage/migrate";
import { resumoFinanceiroPorEvento } from "../domain/pos";

export default function App() {
  useEffect(() => {
    ensureMigrations();
  }, []);

  const [tab, setTab] = useState("evento");

  const [evento, setEvento] = useState(() =>
    loadJSON(LS_KEYS.evento, { nome: "", abertoEm: null, produtos: [] })
  );

  const [produtos, setProdutos] = useState(() =>
    loadJSON(LS_KEYS.produtos, [])
  );

  const [vendas, setVendas] = useState(() =>
    loadJSON(LS_KEYS.vendas, [])
  );

  const [caixa, setCaixa] = useState(() =>
    loadJSON(LS_KEYS.caixa, {
      abertoEm: null,
      abertura: null,
      movimentos: [],
    })
  );

  const [ajustes, setAjustes] = useState(() =>
    loadJSON(LS_KEYS.ajustes, {
      logoDataUrl: "",
      textoRodape: "Obrigado pela preferência!",
      nomeOrganizacao: "Comunidade",
    })
  );

  useEffect(() => saveJSON(LS_KEYS.evento, evento), [evento]);
  useEffect(() => saveJSON(LS_KEYS.produtos, produtos), [produtos]);
  useEffect(() => saveJSON(LS_KEYS.vendas, vendas), [vendas]);
  useEffect(() => saveJSON(LS_KEYS.caixa, caixa), [caixa]);
  useEffect(() => saveJSON(LS_KEYS.ajustes, ajustes), [ajustes]);

  const resumoEvento = useMemo(() => {
    const nomeEv = (evento?.nome || "").trim();
    if (!nomeEv) return null;
    return resumoFinanceiroPorEvento(
      (Array.isArray(vendas) ? vendas : []).filter((v) => v.eventoNome === nomeEv)
    );
  }, [vendas, evento]);

  const hasEventoAberto = Boolean((evento?.nome || "").trim());

  function abrirEvento(nome) {
    const nm = String(nome || "").trim();
    if (!nm) return alert("Informe o nome do evento.");

    const abertoEm = new Date().toISOString();

    setEvento({ nome: nm, abertoEm, produtos: [] });
    setProdutos([]);
    setCaixa({
      abertura: null,
      abertoEm: null,
      movimentos: [],
    });

    // ao abrir, vai para PRODUTOS
    setTab("produtos");
  }

  function zerarTudo() {
    if (!confirm("Zerar TODOS os dados?")) return;

    setEvento({ nome: "", abertoEm: null, produtos: [] });
    setProdutos([]);
    setVendas([]);
    setCaixa({ abertoEm: null, abertura: null, movimentos: [] });
    setAjustes({
      logoDataUrl: "",
      textoRodape: "Obrigado pela preferência!",
      nomeOrganizacao: "Comunidade",
    });

    setTab("evento");
  }

  function zerarVendasEvento() {
    const nomeEv = (evento?.nome || "").trim();
    if (!nomeEv) return;
    if (!confirm(`Zerar vendas do evento "${nomeEv}"?`)) return;

    setVendas((prev) =>
      (Array.isArray(prev) ? prev : []).filter((v) => v.eventoNome !== nomeEv)
    );
  }

  function zerarCaixaEvento() {
    const nomeEv = (evento?.nome || "").trim();
    if (!nomeEv) return;
    if (!confirm(`Zerar caixa do evento "${nomeEv}"?`)) return;

    setCaixa((prev) => ({
      ...prev,
      abertura: null,
      movimentos: [],
    }));
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f5f6f8" }}>
      <TopBar
        tab={tab}
        setTab={setTab}
        evento={evento}
        resumo={resumoEvento}
        onZerarTudo={zerarTudo}
      />

      <main style={{ padding: 16 }}>
        {tab === "evento" && (
          <Evento
            evento={evento}
            abrirEvento={abrirEvento}
            vendas={vendas}
            caixa={caixa}
            setCaixa={setCaixa}
            setVendas={setVendas}
          />
        )}

        {tab === "produtos" && (
          <Produtos
            produtos={produtos}
            setProdutos={setProdutos}
            setTab={setTab}
          />
        )}

        {tab === "venda" && (
          <Venda
            evento={evento}
            produtos={produtos}
            vendas={vendas}
            setVendas={setVendas}
            ajustes={ajustes}
          />
        )}

        {tab === "caixa" && (
          <Caixa
            evento={evento}
            caixa={caixa}
            setCaixa={setCaixa}
            resumoEvento={resumoEvento}
            disabled={!hasEventoAberto}
            onZerarCaixa={zerarCaixaEvento}
          />
        )}

        {tab === "relatorio" && (
          <Relatorio
            evento={evento}
            vendas={vendas}
            produtos={produtos}
            caixa={caixa}
            ajustes={ajustes}
            resumoEvento={resumoEvento}
            onZerarVendas={zerarVendasEvento}
            disabled={!hasEventoAberto}
          />
        )}

        {tab === "ajustes" && (
          <Ajustes ajustes={ajustes} setAjustes={setAjustes} />
        )}
      </main>
    </div>
  );
}
