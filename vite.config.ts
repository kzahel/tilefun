import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { devUpdatePlugin } from "./src/server/devUpdatePlugin.js";
import { privateDataPlugin } from "./src/server/privateDataPlugin.js";
import { tilefunServer } from "./src/server/vitePlugin.js";
import { workshopPlugin } from "./src/server/workshopService.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const useHttps = process.env.HTTPS === "1";
const autoReload = process.env.TILEFUN_AUTO_RELOAD === "1";

export default defineConfig({
  base: "/tilefun/",
  // Standalone capture/benchmark servers must not replace the live dev cache.
  cacheDir: "node_modules/.vite-dev",
  define: {
    "import.meta.env.VITE_MANUAL_RELOAD": JSON.stringify(!autoReload),
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(
      process.env.VITE_BUILD_ID ?? new Date().toISOString(),
    ),
  },
  plugins: [
    privateDataPlugin(root),
    devUpdatePlugin(),
    useHttps && basicSsl(),
    tilefunServer(),
    workshopPlugin(),
    react(),
  ].filter(Boolean),
  server: {
    // The live server is also used for play while agents edit this checkout.
    hmr: autoReload,
    ws: autoReload ? {} : false,
    host: true, // listen on all interfaces, not just localhost
    allowedHosts: ["tilefun.graehlarts.com"],
    watch: { ignored: ["**/playwright-report/**", "**/test-results/**"] },
  },
  clearScreen: false,
  build: {
    rolldownOptions: {
      input: {
        main: resolve(root, "index.html"),
        rendererLab: resolve(root, "renderer-lab.html"),
        tools: resolve(root, "tools.html"),
        drivingBench: resolve(root, "driving-bench.html"),
        workshop: resolve(root, "workshop.html"),
        worldExplorer: resolve(root, "world-explorer.html"),
        artWorkbench: resolve(root, "art-workbench.html"),
        buildingLab: resolve(root, "building-lab.html"),
        interiorWorkbench: resolve(root, "interior-workbench.html"),
        interiorReview: resolve(root, "interior-review.html"),
        furniturePlaytest: resolve(root, "furniture-playtest.html"),
      },
    },
  },
});
