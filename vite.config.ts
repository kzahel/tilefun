import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";
import { tilefunServer } from "./src/server/vitePlugin.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const useHttps = process.env.HTTPS === "1";

export default defineConfig({
  base: "/tilefun/",
  plugins: [useHttps && basicSsl(), tilefunServer()].filter(Boolean),
  server: {
    host: true, // listen on all interfaces, not just localhost
    allowedHosts: true, // allow any hostname
  },
  clearScreen: false,
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
