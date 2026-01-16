// src/services/receiptTemplate58.js
export function wrapThermal58(contentHtml, opts = {}) {
  const esc = (v) =>
    String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const title = opts?.title ? String(opts.title) : "Impressão";
  const footer = opts?.footer ? String(opts.footer) : "";
  const content = String(contentHtml || "");
  const footerHtml = footer ? `<div class="footer">${esc(footer)}</div>` : "";

  // Se quiser ativar economia de tinta na imagem, passe { ecoImg: true }
  const ecoImgClass = opts?.ecoImg ? "eco-img" : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${esc(title)}</title>
  <style>
    @page { size: 58mm auto; margin: 0; }
    html, body { width: 58mm; margin: 0; padding: 0; }
    body { font-family: monospace, system-ui; font-size: 11px; line-height: 1.25; color: #000; }
    .paper { width: 58mm; padding: 6px 6px; box-sizing: border-box; }
    .center { text-align: center; }
    .right { text-align: right; }
    .row { display: flex; justify-content: space-between; gap: 6px; }
    .sep { border-top: 1px dashed #000; margin: 6px 0; }
    .muted { opacity: 0.85; }
    h1, h2, h3 { margin: 0 0 4px 0; font-size: 12px; }

    .section-title { font-weight: 700; margin: 6px 0 4px; }
    .mt-6 { margin-top: 6px; }
    .ticket { display: block; }
    .ticket + .ticket { margin-top: 8px; }
    .title { font-size: 12px; font-weight: 700; text-align: center; }
    .date { font-size: 11px; text-align: center; }
    .logoBox { display: flex; align-items: center; justify-content: center; margin: 6px 0; }
    .logoBox img { max-width: 100%; max-height: 30mm; width: auto; height: auto; object-fit: contain; display: block; }
    .eco-img .logoBox img { filter: grayscale(1) contrast(0.85) brightness(1.1) saturate(0.35); opacity: 0.7; image-rendering: pixelated; }
    .itemBlock { display: flex; flex-direction: column; gap: 2px; margin-top: 2px; }
    .itemTop { display: flex; align-items: baseline; gap: 6px; min-width: 0; }
    .qty { font-size: 11px; font-weight: 700; white-space: nowrap; }
    .itemName { font-size: 11px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .itemName.smallText { font-size: 10px; }
    .itemName.xsmallText { font-size: 9px; }
    .itemBottom { display: flex; justify-content: flex-end; }
    .price { font-size: 12px; font-weight: 700; white-space: nowrap; }
    .sub { font-size: 10px; opacity: 0.85; margin-top: 2px; }
    .thanks { text-align: center; font-size: 11px; font-weight: 700; margin-top: 4px; }
    .cutlineWrap { text-align: center; margin-top: 6px; }
    .cutline { border-top: 1px dashed #000; margin: 0 4px; }
    .cuttext { font-size: 9px; letter-spacing: 1px; opacity: 0.7; margin-top: 2px; font-weight: 700; }
    .footer { margin-top: 8px; text-align: center; opacity: 0.85; }
  </style>
</head>
<body class="${ecoImgClass}">
  <div class="paper">
    ${content}
    ${footerHtml}
  </div>
</body>
</html>`;
}
