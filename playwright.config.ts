import { defineConfig } from "@playwright/test";

export default defineConfig({
	testDir: "./tests",
	timeout: 30_000,
	use: {
		baseURL: "http://localhost:4173",
		screenshot: "only-on-failure",
	},
	webServer: {
		command: "npm run preview",
		port: 4173,
		reuseExistingServer: true,
	},
	projects: [
		{
			name: "chromium",
			use: { browserName: "chromium" },
		},
	],
});
