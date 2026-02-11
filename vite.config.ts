import { defineConfig } from "vite";

export default defineConfig({
	base: "/tilefun/",
	test: {
		include: ["src/**/*.test.ts"],
	},
});
