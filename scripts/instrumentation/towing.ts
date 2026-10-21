/** Real Worker + shared game panel captures. Isolated data and owned Chromium/server. */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { promisify } from "node:util";
import { chromium, expect } from "@playwright/test";
import react from "@vitejs/plugin-react";
import { createServer } from "vite";
import type { TowingCanvas } from "../../src/workshop/TowingPage.js";

const output = resolve(
  process.argv.find((a) => a.startsWith("--output="))?.slice(9) ?? "data/3d-investigation/towing",
);
assert.ok(output.startsWith(resolve("data") + sep));
await mkdir(output, { recursive: true });
process.env.WORKSHOP_LOCAL_AUTH_BYPASS = "1";
for (const key of [
  "WORKSHOP_AUTH_DIR",
  "WORKSHOP_DATA_DIR",
  "ART_NOTES_DIR",
  "INTERIOR_REVIEW_DIR",
])
  process.env[key] = resolve(output, "server", key);
const { privateDataPlugin } = await import("../../src/server/privateDataPlugin.js");
const { workshopPlugin } = await import("../../src/server/workshopService.js");
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  cacheDir: "node_modules/.vite-towing-capture",
  logLevel: "error",
  plugins: [react(), privateDataPlugin(resolve(".")), workshopPlugin()],
  server: { port: 0, host: "127.0.0.1", watch: null },
  optimizeDeps: { entries: ["workshop.html"] },
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
try {
  await server.listen();
  const address = server.httpServer?.address();
  assert.ok(address && typeof address !== "string");
  browser = await chromium.launch({ channel: "chromium", headless: true });
  const page = await browser.newPage({ viewport: { width: 1100, height: 900 } }),
    errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `http://127.0.0.1:${address.port}/tilefun/workshop.html?geometry=towing&renderer=gpu&meshes#/tool/world-geometry`,
  );
  const canvas = page.getByLabel("Towing scene");
  await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 60000 });
  const report = () => canvas.evaluate((c: TowingCanvas) => c.__towingDiagnostics?.());
  await expect
    .poll(async () => (await report())?.meshDraws ?? 0, { timeout: 60000 })
    .toBeGreaterThan(0);
  const states: Record<string, unknown> = {};
  const capture = async (id: string) => {
    const data = await canvas.evaluate(
      (c: TowingCanvas) => c.__captureTowing?.().toDataURL().split(",")[1],
    );
    assert.ok(data);
    await writeFile(resolve(output, `${id}.png`), Buffer.from(data, "base64"));
    states[id] = await report();
  };
  await capture("parked");
  await page.getByRole("button", { name: "Attach car", exact: true }).click();
  await expect.poll(async () => (await report())?.car?.owner).toBe((await report())?.truck?.id);
  await capture("attached");
  await page.getByRole("button", { name: /Drive car/ }).click();
  await canvas.focus();
  await page.keyboard.down("ArrowRight");
  const start = (await report())?.truck?.wx ?? 0;
  try {
    await expect.poll(async () => (await report())?.truck?.wx ?? 0).toBeGreaterThan(start + 55);
  } finally {
    await page.keyboard.up("ArrowRight");
  }
  await page.keyboard.down("ArrowDown");
  try {
    await expect
      .poll(async () => Math.abs((await report())?.truck?.heading ?? 0))
      .toBeGreaterThan(0.4);
  } finally {
    await page.keyboard.up("ArrowDown");
  }
  await expect(page.getByRole("button", { name: "Release car", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(async () => (await report())?.authority.clock?.running).toBe(false);
  await capture("turning");
  for (const mode of ["canvas", "gpu", "gpu-mesh"]) {
    await page.getByLabel("Towing renderer").selectOption(mode);
    await expect(page.getByLabel("Towing renderer")).toBeEnabled();
    await capture(mode);
  }
  await page.getByRole("button", { name: "Reload", exact: true }).click();
  await expect.poll(async () => (await report())?.car?.owner).toBe((await report())?.truck?.id);
  await capture("reloaded");
  await writeFile(
    resolve(output, "report.json"),
    `${JSON.stringify({ states, errors }, null, 2)}\n`,
  );
  await writeFile(
    resolve(output, "index.html"),
    `<!doctype html><meta name="viewport" content="width=device-width"><title>Wheel-lift towing</title><style>body{font:16px system-ui;background:#26382f;color:white;margin:24px}img{width:768px;max-width:100%;image-rendering:pixelated}article{margin:32px 0}</style><h1>Wheel-lift towing</h1><p>Actual shared Worker gameplay and renderer captures.</p>${Object.keys(
      states,
    )
      .map((id) => `<article><h2>${id}</h2><img src="${id}.png"></article>`)
      .join("")}`,
  );
  if (process.argv.includes("--game")) {
    const run = await promisify(execFile)(
      process.execPath,
      [
        "node_modules/tsx/dist/cli.mjs",
        "scripts/instrumentation/towing-game.ts",
        `--base-url=http://127.0.0.1:${address.port}`,
        `--output=${output}`,
      ],
      { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
    );
    console.log(run.stdout);
  }
  assert.deepEqual(errors, []);
  console.log(`Captured ${Object.keys(states).length} towing states to ${output}`);
} finally {
  await browser?.close();
  await server.close();
}
