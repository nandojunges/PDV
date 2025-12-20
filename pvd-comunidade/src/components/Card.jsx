// src/components/Card.jsx
import React from "react";

export default function Card({
  title,
  titulo,
  subtitle,
  subtitulo,
  right,
  children,
}) {
  const tituloFinal = title || titulo;
  const subtituloFinal = subtitle || subtitulo;

  return (
    <div className="card">
      {(tituloFinal || right) && (
        <div className="cardHeader">
          <div>
            {tituloFinal && <h2>{tituloFinal}</h2>}
            {subtituloFinal && (
              <div className="muted">{subtituloFinal}</div>
            )}
          </div>

          {right && <div>{right}</div>}
        </div>
      )}

      <div className="cardBody">{children}</div>
    </div>
  );
}
