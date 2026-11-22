import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
  // Fonts go inline so the app also works where only its own page can load them.
  build: { assetsInlineLimit: (file) => (file.endsWith(".woff2") ? true : undefined) },
  server: {
    port: 5174,
    proxy: {
      "/api": {
        target: env.VITE_PROXY_TARGET || "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "ASL ORIGINALS POS",
        short_name: "ASL POS",
        description: "In-store point of sale for ASL ORIGINALS.",
        id: "/",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#f7f5ef",
        theme_color: "#ffffff",
        categories: ["business", "shopping"],
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,jpg,woff2}"], maximumFileSizeToCacheInBytes: 3_000_000,
        navigateFallback: "/index.html",
      },
    }),
  ],
};
});
