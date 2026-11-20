import { defineConfig } from "vite"

// Stake serves the build from a versioned sub-path: every asset URL must be relative.
// Static output only — no runtime fetches to external origins (fonts are bundled).
export default defineConfig({
  base: "./",
  build: { target: "es2022", assetsInlineLimit: 0 },
  server: { port: 5173, host: true },
})
