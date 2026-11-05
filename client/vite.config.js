import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const proxy = { "/api": "http://localhost:4000" };

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Sutra", short_name: "Sutra", description: "Campus academic ERP",
        theme_color: "#0b6e5b", background_color: "#ffffff", display: "standalone", start_url: "/",
        icons: [
          { src: "pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
      },
      // Caches the app shell only. Data lives in IndexedDB so we control what is stored and when it syncs.
      workbox: { navigateFallback: "/index.html", navigateFallbackDenylist: [/^\/api\//] },
    }),
  ],
  server: { proxy },
  preview: { proxy }, // so `npm run preview` can reach the API when testing offline
});