# PDV Comunidade (Vite + Capacitor)

Aplicação de PDV focada em operação offline com Android/Sunmi.

## Fluxo de build para produção (Android)

Use este fluxo para gerar o web build e sincronizar no projeto Android:

```bash
npm run build
npx cap sync android
```

Atalho equivalente:

```bash
npm run android:build
```

## Scripts úteis

- `npm run dev` — desenvolvimento local (Vite).
- `npm run build` — build de produção web.
- `npm run build:mobile` — build mobile sem PWA.
- `npm run android:sync` — sincroniza `dist` no projeto Android (Capacitor).
- `npm run android:build` — roda `build + cap sync android`.

## Abrir no Android Studio

```bash
npx cap open android
```
