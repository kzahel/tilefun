import { defineConfig } from "vite";

export default defineConfig({
  base: "/tilefun/",
  server: {
    host: true, // listen on all interfaces, not just localhost
    allowedHosts: true, // allow any hostname
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
