import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { inferenceBridge } from "./server/inference-bridge.mjs";

export default defineConfig(({ mode }) => {
  // Loaded from .env.local, which is gitignored: the node's address, model and
  // paths never enter version control.
  const env = loadEnv(mode, process.cwd(), "SIFT_");

  return {
    plugins: [react(), tailwindcss(), inferenceBridge(env)],
    server: { port: 5173 },
  };
});
