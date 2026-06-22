import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// The production build inlines all JS/CSS/assets into one standalone .html file,
// per the single-file distribution goal in DESIGN.md.
export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: "es2020",
    // Inline everything; no separate asset files.
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 100_000,
  },
});
