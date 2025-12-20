// src/components/ProductTile.jsx
import React, { useMemo, useState } from "react";
import { fmtBRL } from "../domain/math";

const ICONS = {
  agua: "/Icons/agua.png",
  ref_lata: "/Icons/refri-lata.png",
  ref_600: "/Icons/refri-600.png",
  ref_2l: "/Icons/refri-2l.png",
  cer_lata: "/Icons/cerveja-lata.png",
  cer_garrafa: "/Icons/cerveja-garrafa.png",
  chope: "/Icons/chope.png",
  barril: "/Icons/barril.png",
  lanche: "/Icons/lanche.png",
  sobremesa: "/Icons/sobremesa.png",
  sorvete: "/Icons/sorvete.png",
  fichas: "/Icons/fichas.png",
  suco: "/Icons/suco.png",
};

export default function ProductTile({ produto, onClick }) {
  const [imgErro, setImgErro] = useState(false);

  const imgSrc = useMemo(() => {
    if (produto?.img) return produto.img;
    if (produto?.iconKey && ICONS[produto.iconKey]) return ICONS[produto.iconKey];
    return "";
  }, [produto]);

  const mostrarImg = imgSrc && !imgErro;

  return (
    <button className="btn atalhoCard" onClick={onClick} type="button">
      <div className="atalhoImgWrap">
        {mostrarImg ? (
          <img
            className="atalhoImg"
            src={imgSrc}
            alt={produto?.nome || "Produto"}
            onError={() => setImgErro(true)}
          />
        ) : (
          <div className="atalhoFallback" aria-hidden="true">
            📦
          </div>
        )}
      </div>
      <div className="atalhoNome">{produto?.nome}</div>
      <div className="atalhoPreco">{fmtBRL(produto?.preco)}</div>
      {(produto?.tipo === "combo" || produto?.tipo === "caucao") && (
        <div className="badge">
          {produto.tipo === "combo" ? "Combo" : "Caução"}
        </div>
      )}
    </button>
  );
}
