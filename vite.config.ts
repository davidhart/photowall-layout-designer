import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// The production build inlines all JS/CSS/assets into one standalone .html file,
// per the single-file distribution goal in DESIGN.md.
export default defineConfig(({ command }) => ({
  // GitHub Pages serves the site under `/<repo>/`. Build-time only — the dev
  // server keeps the root `/` so `npm run dev` works without extra path.
  // The build output is a single self-contained HTML file with everything
  // inlined, so this base path mostly future-proofs against turning the
  // single-file plugin off later.
  base: command === "build" ? "/photowall-layout-designer/" : "/",
  plugins: [viteSingleFile()],
  build: {
    target: "es2020",
    // Inline everything; no separate asset files.
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100_000,
  },
}));
