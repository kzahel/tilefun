import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import basicSsl from "@vitejs/plugin-basic-ssl";
import { defineConfig } from "vite";
import { interiorReviewPlugin } from "./src/server/interiorReviewPlugin.js";
import { tilefunServer } from "./src/server/vitePlugin.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const useHttps = process.env.HTTPS === "1";

export default defineConfig({
  base: "/tilefun/",
  plugins: [useHttps && basicSsl(), tilefunServer(), interiorReviewPlugin()].filter(Boolean),
  server: {
    host: true, // listen on all interfaces, not just localhost
    allowedHosts: true, // allow any hostname
  },
  clearScreen: false,
  build: {
    rollupOptions: {
      input: {
        main: resolve(root, "index.html"),
        worldExplorer: resolve(root, "world-explorer.html"),
        interiorWorkbench: resolve(root, "interior-workbench.html"),
        interiorReview: resolve(root, "interior-review.html"),
        furniturePlaytest: resolve(root, "furniture-playtest.html"),
      },
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
