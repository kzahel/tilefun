import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });

// Start preview server
const { execSync, spawn } = await import("child_process");
const server = spawn("npx", ["vite", "preview", "--port", "4174", "--strictPort"], {
  stdio: ["ignore", "pipe", "pipe"],
  cwd: process.cwd(),
});

// Wait for server to be ready
await new Promise((resolve) => {
  server.stdout.on("data", (data) => {
    if (data.toString().includes("Local")) resolve();
  });
  setTimeout(resolve, 3000);
});

await page.goto("http://localhost:4174", { waitUntil: "domcontentloaded" });

// Wait for canvas to appear and game to render a few frames
await page.waitForSelector("canvas", { timeout: 5000 });
await page.waitForTimeout(2000);

await page.screenshot({ path: "screenshot.png" });
console.log("Screenshot saved to screenshot.png");

server.kill();
await browser.close();
