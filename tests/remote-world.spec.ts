import { type ChildProcess, spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { createGenerator } from "../src/generation/Generator.js";
import { DistrictStrategy } from "../src/generation/regional/DistrictStrategy.js";
import { FsWorldRegistry } from "../src/persistence/FsWorldRegistry.js";

// Exercise real HTTP, WebSocket snapshots, filesystem saves, and two independent clients.
test("two clients share a persistent interior and cross-origin explorer reads live authority", async ({
  browser,
  page,
}) => {
  test.setTimeout(60_000);
  const directory = await mkdtemp(join(tmpdir(), "tilefun-network-check-"));
  const registry = new FsWorldRegistry(directory),
    generation = createDescriptor("regional", 2026);
  let child: ChildProcess | undefined;
  const start = async () => {
    child = spawn(process.execPath, ["--import", "tsx", "src/server/standalone.ts"], {
      cwd: process.cwd(),
      env: { ...process.env, PORT: "4191", DATA_DIR: directory },
      stdio: "pipe",
    });
    let logs = "";
    child.stdout?.on("data", (b) => {
      logs += b.toString();
    });
    child.stderr?.on("data", (b) => {
      logs += b.toString();
    });
    const ready = async () => {
      try {
        return (await fetch("http://localhost:4191/api/world-list")).ok;
      } catch {
        return false;
      }
    };
    try {
      await expect.poll(ready, { timeout: 10_000 }).toBe(true);
    } catch (error) {
      throw new Error(`${error}\n${logs}`);
    }
  };
  const stop = async () => {
    const p = child;
    if (!p || p.exitCode !== null) return;
    const exit = new Promise<void>((resolve) => p.once("exit", () => resolve()));
    p.kill("SIGTERM");
    await exit;
    child = undefined;
  };
  const second = await browser.newContext();
  try {
    await registry.open();
    const meta = await registry.createWorld(
      "Network checkpoint",
      undefined,
      undefined,
      undefined,
      generation,
    );
    registry.close();
    const terrain = createGenerator(generation).terrain;
    if (!(terrain instanceof DistrictStrategy)) throw new Error("No district");
    const lot = terrain.districts
      .owner(0, 0)
      ?.blocks.flatMap((b) => b.lots)
      .find((l) => l.buildingType.startsWith("prop-regional-apartment-"));
    if (!lot) throw new Error("No apartment");
    await start();
    const url = `/tilefun/?server=localhost:4191&worldId=${meta.id}&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify({ x: lot.entrance.x, y: lot.entrance.y, generation }))}`;
    const two = await second.newPage();
    for (const p of [page, two]) {
      await p.goto(`http://localhost:4174${url}`);
      await expect(p.locator("#game")).toHaveAttribute("data-ready", "true");
      await p.getByText("Network checkpoint", { exact: true }).click();
      await expect(p.getByRole("button", { name: /Enter apartment/ })).toBeVisible();
      await p.getByRole("button", { name: /Enter apartment/ }).click();
      await expect(p.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    }
    expect(await page.locator("#game").getAttribute("data-interior")).toBe(
      await two.locator("#game").getAttribute("data-interior"),
    );
    const furnitureCount = async (p: typeof page) =>
      p.evaluate(() => {
        const g = (
          document.querySelector("#game") as unknown as {
            __game: import("../src/client/GameClient.js").GameClient;
          }
        ).__game;
        return g.stateView.props.filter((p) => p.type.startsWith("prop-interior-furniture:"))
          .length;
      });
    await expect.poll(() => furnitureCount(page)).toBe(3);
    await expect.poll(() => furnitureCount(two)).toBe(3);
    await page.evaluate(() => {
      const g = (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameClient.js").GameClient;
        }
      ).__game;
      const bed = g.stateView.props.find((p) => p.proceduralId === "fixture:bed");
      if (!bed) throw new Error("No bed");
      g.transport.send({ type: "edit-delete-prop", propId: bed.id });
      g.transport.send({ type: "flush" });
    });
    await expect.poll(() => furnitureCount(two)).toBe(2);
    await page.getByRole("button", { name: "Return to street" }).click();
    await expect(page.getByRole("button", { name: /Enter apartment/ })).toBeVisible();
    await page.goto(
      `/tilefun/world-explorer.html?server=localhost:4191&worldId=${meta.id}&generation=${encodeURIComponent(JSON.stringify(generation))}&x=${lot.entrance.x}&y=${lot.entrance.y}&zoom=16&mode=tiles`,
    );
    await expect(page.locator("#app")).toHaveAttribute("data-settled", "true");
    await expect(page.getByText(/live authority/).first()).toBeVisible();
    const snapshot = await page.request.get(
      `http://localhost:4191/api/world-preview?worldId=${meta.id}&chunks=[]&bounds=${encodeURIComponent(JSON.stringify({ minX: lot.entrance.x - 16, minY: lot.entrance.y - 16, maxX: lot.entrance.x + 16, maxY: lot.entrance.y + 16 }))}`,
    );
    expect(snapshot.headers()["access-control-allow-origin"]).toBe("*");
    expect((await snapshot.json()).coverage).toBe("live authority");
    await two.close();
    await stop();
    await start();
    await page.goto(`http://localhost:4174${url}`);
    await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
    await page.getByText("Network checkpoint", { exact: true }).click();
    await page.getByRole("button", { name: /Enter apartment/ }).click();
    await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
    await expect.poll(() => furnitureCount(page)).toBe(2);
  } finally {
    await second.close();
    await stop();
    await rm(directory, { recursive: true, force: true });
  }
});
