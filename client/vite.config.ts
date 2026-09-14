import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

export default defineConfig({
  plugins: [
    solid(),
    tailwindcss(),
    basicSsl({
      name: "chat-refine",
      certDir: "../.vite-ssl",
      domains: ["localhost", "127.0.0.1"],
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:3000",
      "/ws": { target: "ws://127.0.0.1:3000", ws: true },
    },
  },
});
