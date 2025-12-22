// src/components/TopBar.jsx
import React from "react";
import Tabs from "./Tabs";
import { toBRDateTime } from "../domain/math";

export default function TopBar({ evento, tab, setTab, step }) {
  return (
    <div className="topbar">
      <div className="row space topbarRow">
        <div className="topbarLeft">
          <div className="topTitle">
            PVD Comunidade
            <span className="topDeveloper">Desenvolvido por Fernando Junges</span>
          </div>

          <div className="topMeta">
            {evento?.nome ? (
              <>
                <span className="badge badgeDark">{evento.nome}</span>
                <span className="topMetaText">
                  Aberto: {evento.abertoEm ? toBRDateTime(evento.abertoEm) : "-"}
                </span>
              </>
            ) : (
              <span className="topMetaText">Nenhum evento aberto</span>
            )}
          </div>
        </div>

        <div className="topbarRight">
          <Tabs tab={tab} setTab={setTab} step={step} />
        </div>
      </div>
    </div>
  );
}
