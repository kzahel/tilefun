import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { privateDataPlugin } from "./src/server/privateDataPlugin.js";
import { tilefunServer } from "./src/server/vitePlugin.js";
import { workshopPlugin } from "./src/server/workshopService.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const useHttps = process.env.HTTPS === "1";

export default defineConfig({
  base: "/tilefun/",
  define: {
    "import.meta.env.VITE_BUILD_ID": JSON.stringify(
      process.env.VITE_BUILD_ID ?? new Date().toISOString(),
    ),
  },
  plugins: [
    privateDataPlugin(root),
    useHttps && basicSsl(),
    tilefunServer(),
    workshopPlugin(),
    react(),
  ].filter(Boolean),
  server: {
    host: true, // listen on all interfaces, not just localhost
    allowedHosts: ["tilefun.graehlarts.com"],
  },
  clearScreen: false,
  build: {
    rolldownOptions: {
      input: {
        main: resolve(root, "index.html"),
        rendererLab: resolve(root, "renderer-lab.html"),
        tools: resolve(root, "tools.html"),
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
