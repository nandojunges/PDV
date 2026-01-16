import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const isMobile = mode === "mobile";

  return {
    base: "./",

    plugins: [
      react(),

      // No Capacitor (Android), NÃO usar service worker/PWA
      !isMobile &&
        VitePWA({
          registerType: "autoUpdate",
          includeAssets: ["favicon.svg"],
          manifest: {
            name: "PVD Comunidade",
            short_name: "PVD",
            description: "Ponto de Venda offline para eventos",
            theme_color: "#111827",
            background_color: "#111827",
            display: "standalone",
            start_url: ".",
            icons: [
              {
                src: "favicon.svg",
                sizes: "any",
                type: "image/svg+xml",
              },
            ],
          },
        }),
    ].filter(Boolean),

    resolve: {
      dedupe: ["react", "react-dom"],
    },
  };
});
