import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { FsWorldRegistry } from "../src/persistence/FsWorldRegistry.js";

test("in-game map keeps distant multiplayer players live and long-press travels safely", async ({
  browser,
  page,
}) => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), "tilefun-map-"));
  const registry = new FsWorldRegistry(directory);
  const other = await browser.newContext();
  let child: ChildProcess | undefined;
  try {
    await registry.open();
    const world = await registry.createWorld("Map checkpoint", "flat", 42);
    registry.close();
    child = spawn(process.execPath, ["--import", "tsx", "src/server/standalone.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: "4195",
        DATA_DIR: directory,
        NET_TRANSPORT: "ws",
        TILEFUN_TRUSTED_COOP: "0",
      },
      stdio: "pipe",
    });
    let logs = "";
    child.stdout?.on("data", (chunk) => {
      logs += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      logs += chunk;
    });
    await expect
      .poll(async () => {
        if (child?.exitCode !== null) throw new Error(logs);
        try {
          return (await fetch("http://localhost:4195/api/world-list")).ok;
        } catch {
          return false;
        }
      })
      .toBe(true);
    const url = "/tilefun/?server=localhost:4195";
    const two = await other.newPage();
    for (const p of [page, two]) {
      await p.goto(url);
      await expect(p.locator("#game")).toHaveAttribute("data-ready", "true");
    }
    await two.evaluate(async () => {
      const game = (
        document.querySelector("#game") as unknown as {
          __game: {
            gcSendRequest(message: unknown): Promise<unknown>;
            nextRequestId: number;
            mainMenu: { currentWorldId: string };
          };
        }
      ).__game;
      await game.gcSendRequest({
        type: "join-realm",
        requestId: game.nextRequestId++,
        worldId: game.mainMenu.currentWorldId,
        arrival: {
          x: 4000,
          y: -2000,
          generation: { type: "flat", version: "flat-v1", seed: 42, preset: "grass" },
        },
      });
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.getByRole("button", { name: "Open world map" }).click();
    const map = page.getByTestId("world-map");
    await expect(map).toBeVisible();
    await expect(map).toHaveAttribute("data-settled", "true");
    await expect(map.getByTestId("world-map-player")).toHaveCount(2);
    const distant = map.locator('[data-testid="world-map-player"][data-self="false"]');
    await expect(distant).toHaveAttribute("data-x", "4000");
    await two.keyboard.down("d");
    await expect
      .poll(async () => Number(await distant.getAttribute("data-x")))
      .toBeGreaterThan(4001);
    await two.keyboard.up("d");

    const self = map.locator('[data-testid="world-map-player"][data-self="true"]');
    const originalX = Number(await self.getAttribute("data-x"));
    const canvas = map.getByTestId("world-map-canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Missing map canvas");
    // A drag held past the threshold is navigation, never travel.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, { steps: 5 });
    await page.waitForTimeout(750);
    await page.mouse.up();
    await expect(map).toBeVisible();
    await expect(self).toHaveAttribute("data-x", String(originalX));
    await map.getByRole("button", { name: "Find me" }).click();
    await expect(map).toHaveAttribute("data-settled", "true");
    const centerX = Number(await map.getAttribute("data-x"));
    const zoom = Number(await map.getAttribute("data-zoom"));
    const targetX = centerX + 180 / zoom;
    await page.mouse.move(box.x + box.width / 2 + 180, box.y + box.height / 2);
    await page.mouse.down();
    await expect(map).toBeHidden({ timeout: 10_000 });
    await page.mouse.up();
    await page.keyboard.press("g");
    await expect(map).toBeVisible();
    await expect
      .poll(async () => Number(await self.getAttribute("data-x")))
      .toBeCloseTo(targetX, 0);
    await expect(map).toHaveAttribute("data-world-id", world.id);
    await other.close();
    await expect(map.getByTestId("world-map-player")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(map).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    await other.close();
    if (child && child.exitCode === null) {
      const exited = new Promise<void>((resolve) => child?.once("exit", () => resolve()));
      child.kill("SIGTERM");
      await exited;
    }
    await rm(directory, { recursive: true, force: true });
  }
});

test("touch map supports hold-to-travel and cancels a hold on pointer cancellation", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.goto("/tilefun/");
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    // Use known walkable terrain; a hold over open water should correctly fail.
    await page.evaluate(async () => {
      const game = (
        document.querySelector("#game") as unknown as {
          __game: {
            gcSendRequest(message: unknown): Promise<{ meta: { id: string } }>;
            nextRequestId: number;
          };
        }
      ).__game;
      const generation = { type: "flat", version: "flat-v1", seed: 42, preset: "grass" };
      const created = await game.gcSendRequest({
        type: "create-world",
        requestId: game.nextRequestId++,
        name: "Touch map",
        generation,
      });
      await game.gcSendRequest({
        type: "join-realm",
        requestId: game.nextRequestId++,
        worldId: created.meta.id,
        arrival: { x: 0, y: 0, generation },
      });
    });
    await page.getByRole("button", { name: "Open world map" }).tap();
    const map = page.getByTestId("world-map");
    await expect(map).toHaveAttribute("data-settled", "true");
    const canvas = map.getByTestId("world-map-canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Missing touch map canvas");
    const session = await context.newCDPSession(page);
    const pinchPoints = [
      { x: box.x + box.width / 2 - 40, y: box.y + box.height / 2, id: 1 },
      { x: box.x + box.width / 2 + 40, y: box.y + box.height / 2, id: 2 },
    ];
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: pinchPoints,
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: pinchPoints.map((p, i) => ({ ...p, x: p.x + (i === 0 ? -40 : 40) })),
    });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await expect.poll(async () => Number(await map.getAttribute("data-zoom"))).toBeCloseTo(2);
    await page.waitForTimeout(750);
    await expect(map).toBeVisible();
    await map.getByRole("button", { name: "Zoom out" }).tap();
    await map.getByRole("button", { name: "Find me" }).tap();
    await expect(map).toHaveAttribute("data-settled", "true");
    const point = { x: box.x + box.width / 2 + 50, y: box.y + box.height / 2 };
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await session.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    await page.waitForTimeout(750);
    await expect(map).toBeVisible();
    await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] });
    await expect(map).toBeHidden({ timeout: 10_000 });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await page.getByRole("button", { name: "Open world map" }).tap();
    await expect(map).toHaveAttribute("data-settled", "true");
    await expect(map.locator('[data-testid="world-map-player"][data-self="true"]')).toBeVisible();
    await expect(map.locator('[data-testid="world-map-player"][data-self="true"]')).toHaveAttribute(
      "data-x",
      "50",
    );
    await map.getByRole("button", { name: "Close map" }).tap();
    await expect(map).toBeHidden();
  } finally {
    await context.close();
  }
});
