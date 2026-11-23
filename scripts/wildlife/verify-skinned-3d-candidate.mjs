import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { chromium } from "playwright";
import { createServer } from "vite";
import { workshopPlugin } from "../../src/server/workshopService.ts";

const output = resolve(process.argv[2] ?? "data/wildlife-3d-campaign/runtime-pilot");
const state = await mkdtemp(join(tmpdir(), "tilefun-wildlife-runtime-"));
process.env.WORKSHOP_DATA_DIR = join(state, "workshop");
process.env.WORKSHOP_AUTH_DIR = join(state, "auth");
process.env.ART_NOTES_DIR = join(state, "notes");
process.env.INTERIOR_REVIEW_DIR = join(state, "interior");
process.env.WORKSHOP_LOCAL_AUTH_BYPASS = "1";
const server = await createServer({
  configFile: false,
  base: "/tilefun/",
  mode: "development",
  cacheDir: join(state, "vite-cache"),
  plugins: [workshopPlugin(), react()],
  optimizeDeps: { entries: ["workshop.html"], exclude: ["@dimforge/rapier3d-compat"] },
  server: { host: "127.0.0.1", port: 0, hmr: false, allowedHosts: ["127.0.0.1"] },
  logLevel: "error",
});
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  assert(address && typeof address !== "string");
  browser = await chromium.launch({
    channel: "chromium",
    args: ["--enable-webgl", "--use-angle=swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1240, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const notices = [];
  page.on("console", (message) => {
    if (message.type() === "error" && /WebGL|VALIDATE_STATUS|shader/i.test(message.text())) {
      notices.push(message.text());
    }
  });
  const modelPath = "/demos/wildlife-3d/cat-pilot-v1/model.glb";
  const spritePath = "/demos/wildlife-v2/cat/finish-v1/sheet.png";
  const isAsset = (request, path) => new URL(request.url()).pathname.endsWith(path);
  const root = `http://127.0.0.1:${address.port}/tilefun/workshop.html?geometry=nature-behavior-cat`;
  const route = "#/tool/world-geometry";
  const lab = page.getByLabel("Natural landscape playground");
  const switchModels = page.getByRole("checkbox", { name: "3D animals", exact: true });
  const stageReady = async (count) => {
    await page.waitForFunction((value) => {
      const stage = document.querySelector("[aria-label='Natural landscape playground']");
      return (
        stage?.getAttribute("data-ready") === "true" &&
        stage.getAttribute("data-wildlife-meshes") === String(value)
      );
    }, count);
  };
  const normalAssets = [];
  const spy = (request) => {
    if (isAsset(request, modelPath)) normalAssets.push(request.url());
  };
  page.on("request", spy);
  await page.goto(`${root}&wildlife3d=0${route}`);
  await stageReady(0);
  assert.deepEqual(normalAssets, []);
  page.off("request", spy);

  const actualModel = page.waitForResponse((response) => isAsset(response, modelPath));
  await page.goto(`${root}&wildlife3d=1${route}`);
  assert((await actualModel).ok());
  await stageReady(1);
  await lab.screenshot({ path: join(output, "cat-lab-model.png") });
  await switchModels.uncheck();
  await stageReady(0);
  await lab.screenshot({ path: join(output, "cat-lab-sprite.png") });
  await switchModels.check();
  await stageReady(1);

  const failurePage = await browser.newPage({ viewport: { width: 1240, height: 900 } });
  const spriteRequests = [];
  failurePage.on("request", (request) => {
    if (isAsset(request, spritePath)) spriteRequests.push(request.url());
  });
  await failurePage.route(
    (url) => url.pathname.endsWith(modelPath),
    (route) => route.fulfill({ status: 404 }),
  );
  const failure = failurePage.waitForEvent("console", {
    predicate: (message) =>
      message.type() === "warning" && message.text().includes("3D animal could not load"),
  });
  await failurePage.goto(`${root}&wildlife3d=1${route}`);
  await failure;
  await failurePage.waitForFunction(() => {
    const stage = document.querySelector("[aria-label='Natural landscape playground']");
    return (
      stage?.getAttribute("data-ready") === "true" &&
      stage.getAttribute("data-wildlife-meshes") === "0"
    );
  });
  assert.deepEqual(spriteRequests, []);
  assert.deepEqual(errors, []);
  assert.deepEqual(notices, []);
  console.log(
    "Skinned cat in the shared scene, immediate sprite switch and model-only load failure verified.",
  );
} finally {
  await browser?.close();
  await server.close();
  await rm(state, { recursive: true, force: true });
}
