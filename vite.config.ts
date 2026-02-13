import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: "/tilefun/",
  server: {
    host: true, // listen on all interfaces, not just localhost
    allowedHosts: true, // allow any hostname
  },
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
