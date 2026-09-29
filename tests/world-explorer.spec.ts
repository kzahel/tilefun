import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";

const explorer = "/tilefun/world-explorer.html";

test("regional map loads without a game runtime, inspects stable features, and shares negative coordinates", async ({
  page,
}) => {
  const errors: string[] = [];
  const sockets: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("websocket", (socket) => sockets.push(socket.url()));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(explorer);
  const app = page.locator("#app");
  await expect(app).toHaveAttribute("data-settled", "true");
  await expect(app).toHaveAttribute("data-seed", "2026");
  await expect(app).toHaveAttribute("data-chunks", "0");
  const map = page.locator("#map");
  const box = await map.boundingBox();
  if (!box) throw new Error("Map is missing");
  await map.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.locator("#inspection")).toHaveAttribute("data-feature-id", "settlement:0:0");
  await expect(page.locator("#inspection")).toContainText("Ferngrove");
  await page.screenshot({ path: path.join(os.tmpdir(), "tilefun-world-explorer-desktop.png") });
  await page.getByRole("button", { name: "Across a cell boundary" }).click();
  await expect(app).toHaveAttribute("data-settled", "true");
  await map.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(map).toHaveAttribute("data-x", /-/);
  await expect(app).toHaveAttribute("data-settled", "true");
  const before = await map.getAttribute("data-x");
  await page.locator('[data-layer="roads"]').uncheck();
  const shared = page.url();
  expect(shared).toContain("version=regional-v1");
  expect(shared).toContain("profile=temperate-v1");
  await page.reload();
  await expect(app).toHaveAttribute("data-settled", "true");
  await expect(map).toHaveAttribute("data-x", before ?? "");
  await expect(page.locator('[data-layer="roads"]')).not.toBeChecked();
  const resources = await page.evaluate(() =>
    performance.getEntriesByType("resource").map((r) => r.name),
  );
  expect(resources.some((r) => /sprites|atlas|\.png|GameClient|GameServer/.test(r))).toBe(false);
  expect(sockets).toEqual([]);
  expect(errors).toEqual([]);
});

test("broad views and rapid navigation have bounded work and discard obsolete seeds", async ({
  page,
}) => {
  await page.goto(explorer);
  const app = page.locator("#app");
  await expect(app).toHaveAttribute("data-settled", "true");
  await page.getByRole("button", { name: "The wider landscape" }).click();
  await expect(app).toHaveAttribute("data-settled", "true");
  await expect(app).toHaveAttribute("data-detail", "overview");
  await expect(app).toHaveAttribute("data-owners", "0");
  await expect(app).toHaveAttribute("data-features", "0");
  expect(Number(await app.getAttribute("data-samples"))).toBeLessThanOrEqual(24_576);
  await page.screenshot({ path: path.join(os.tmpdir(), "tilefun-world-explorer-overview.png") });
  await page.evaluate(() => {
    const app = document.querySelector<HTMLElement>("#app");
    let maxQueue = 0;
    const observer = new MutationObserver(() => {
      maxQueue = Math.max(maxQueue, Number(app?.dataset.queue ?? 0));
      app?.setAttribute("data-observed-max-queue", String(maxQueue));
    });
    if (app) observer.observe(app, { attributes: true, attributeFilter: ["data-queue"] });
    const map = document.querySelector<HTMLCanvasElement>("#map");
    for (let i = 0; i < 80; i++) {
      document.querySelector<HTMLButtonElement>(i % 2 ? "#zoom-in" : "#zoom-out")?.click();
      map?.dispatchEvent(
        new KeyboardEvent("keydown", { key: i % 2 ? "ArrowLeft" : "ArrowRight", bubbles: true }),
      );
    }
    const seed = document.querySelector<HTMLInputElement>("#seed");
    if (seed) seed.value = "7";
    document.querySelector<HTMLFormElement>("#seed-form")?.requestSubmit();
    if (seed) seed.value = "2026";
    document.querySelector<HTMLFormElement>("#seed-form")?.requestSubmit();
  });
  await expect(app).toHaveAttribute("data-settled", "true");
  await expect(app).toHaveAttribute("data-seed", "2026");
  await expect(app).toHaveAttribute("data-queue", "0");
  expect(Number(await app.getAttribute("data-observed-max-queue"))).toBeLessThanOrEqual(2);
  expect(page.workers()).toHaveLength(1);
  await page.goto("about:blank");
  await expect.poll(() => page.workers().length).toBe(0);
});

test("review advances to unchecked cases, persists verdicts, and exports reproducible reports", async ({
  page,
}) => {
  await page.goto(explorer);
  await expect(page.locator("#app")).toHaveAttribute("data-settled", "true");
  await page.getByRole("button", { name: "Looks good" }).click();
  await expect(page.locator("#remaining")).toHaveText("2 unchecked");
  await expect(page.locator(".case-button.active")).toContainText("Across a cell boundary");
  await expect(page.locator("#app")).toHaveAttribute("data-settled", "true");
  await page
    .getByRole("textbox", { name: "Review note" })
    .fill("The transition needs a less rectangular woodland edge.");
  await page.getByRole("button", { name: "Report", exact: false }).click();
  await expect(page.locator("#remaining")).toHaveText("1 unchecked");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export review notes" }).click();
  const download = await downloadPromise;
  const file = await download.path();
  if (!file) throw new Error("Review export is missing");
  const exported = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(exported.records).toHaveLength(2);
  expect(exported.records[1]).toMatchObject({
    caseId: "planning-boundary",
    world: { seed: 2026, generatorVersion: "regional-v1", profile: "temperate-v1" },
    detail: "region",
    overlays: { boundaries: true },
    verdict: "reported",
  });
  expect(exported.records[1].bounds.minX).toBeLessThan(0);
  expect(exported.records[1].location).toContain("zoom=");
  await page.reload();
  await expect(page.locator("#remaining")).toHaveText("1 unchecked");
});

test("phone touch navigation remains responsive with a throttled CPU", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  await page.goto(explorer);
  const app = page.locator("#app");
  await expect(app).toHaveAttribute("data-settled", "true");
  await expect(app).toHaveAttribute("data-ready", "true");
  expect(Number(await app.getAttribute("data-first-view-ms"))).toBeLessThan(2000);
  expect(Number(await app.getAttribute("data-first-view-ms"))).toBeGreaterThan(0);
  await page.screenshot({
    path: path.join(os.tmpdir(), "tilefun-world-explorer-phone.png"),
    fullPage: true,
  });
  const map = page.locator("#map");
  const box = await map.boundingBox();
  if (!box) throw new Error("Phone map is missing");
  const touch = (x: number, y: number) => ({ x: box.x + x, y: box.y + y, id: 1 });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touch(170, 270)],
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [touch(250, 270)] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(map).not.toHaveAttribute("data-x", "300.000");
  await expect(app).toHaveAttribute("data-settled", "true");
  const oldZoom = Number(await map.getAttribute("data-zoom"));
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { ...touch(140, 260), id: 1 },
      { ...touch(230, 260), id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { ...touch(110, 260), id: 1 },
      { ...touch(260, 260), id: 2 },
    ],
  });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect
    .poll(async () => Number(await map.getAttribute("data-zoom")))
    .toBeGreaterThan(oldZoom);
  await expect(app).toHaveAttribute("data-settled", "true");
  await page.screenshot({
    path: path.join(os.tmpdir(), "tilefun-world-explorer-phone-touch.png"),
    fullPage: true,
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});

test("unsupported generator links show an error and can recover through seed selection", async ({
  page,
}) => {
  await page.goto(`${explorer}?version=future`);
  await expect(page.locator("#loading")).toContainText("does not support");
  await expect(page.locator("#app")).not.toHaveAttribute("data-ready", "true");
  await page.locator("#seed").fill("2026");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await expect(page.locator("#app")).toHaveAttribute("data-settled", "true");
  await expect(page.locator("#app")).not.toHaveAttribute("data-error", /.+/);
});
