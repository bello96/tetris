import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { HttpsProxyAgent } from "https-proxy-agent";

const proxy = process.env.HTTP_PROXY || process.env.HTTPS_PROXY;
const agent = proxy ? new HttpsProxyAgent(proxy) : undefined;

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "https://tetris-worker.deng19940906.workers.dev",
        changeOrigin: true,
        ws: true,
        ...(agent ? { agent } : {}),
      },
    },
  },
});
