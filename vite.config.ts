import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Tauri attend un port fixe et échoue s'il n'est pas disponible.
const host = process.env.TAURI_DEV_HOST;

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Empêche Vite d'obscurcir les erreurs Rust.
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Tauri gère son propre watch côté Rust.
      ignored: ["**/src-tauri/**"],
    },
  },
  // Variables d'env exposées au client préfixées par VITE_ ou TAURI_.
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    // Cible compatible WebView2 (Edge/Chromium).
    target: "chrome105",
    minify: process.env.TAURI_DEBUG ? false : "esbuild",
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
