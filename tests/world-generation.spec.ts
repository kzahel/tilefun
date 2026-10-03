import { expect, test } from "@playwright/test";
import {
  createDescriptor,
  LATEST_REGIONAL_REVISION,
} from "../src/generation/GenerationDescriptor.js";

test("new worlds and the explorer default to the newest regional revision", async ({ page }) => {
  await page.goto("/tilefun/");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  const initial = JSON.parse(
    (await page.locator("#game").getAttribute("data-generation")) ?? "null",
  );
  expect(initial).toMatchObject({ type: "regional", version: LATEST_REGIONAL_REVISION });
  await page.keyboard.press("Escape");
  const type = page.getByRole("combobox", { name: "World type" });
  const revision = page.getByRole("combobox", { name: "Regional revision" });
  await expect(type).toHaveValue("regional");
  await expect(revision).toHaveCount(0);
  await expect(type.locator("option")).toHaveText([
    "Procedural regional",
    "Classic (legacy)",
    "Island (legacy)",
    "Flat (legacy)",
  ]);
  await page.getByRole("textbox", { name: "World seed" }).fill("2026");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute(
    "data-generation",
    JSON.stringify(createDescriptor("regional", 2026)),
  );
  await page.goto("/tilefun/world-explorer.html");
  await expect(type).toHaveValue("regional");
  await expect(revision).toHaveValue(LATEST_REGIONAL_REVISION);
});

test("game creates and reopens every generator with the pinned descriptor in IndexedDB", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  test.setTimeout(60_000);
  for (const choice of ["classic", "island", "flat", "regional"] as const) {
    const worldType = choice;
    const generation = createDescriptor(choice, 2026);
    await page.goto(`/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}`);
    const canvas = page.locator("#game");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect(page.getByRole("combobox", { name: "World type" })).toHaveValue(worldType);
    await expect(page.getByRole("textbox", { name: "World seed" })).toHaveValue("2026");
    await page.getByPlaceholder("World name...").fill(`${choice} checkpoint`);
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-generator", worldType);
    await expect(canvas).toHaveAttribute("data-seed", "2026");
    await expect(page.getByRole("button", { name: "New World", exact: true })).not.toBeVisible();
    const metadata = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open("tilefun-registry");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      try {
        return await new Promise<
          { name: string; generation?: unknown; seed?: number; worldType?: string }[]
        >((resolve, reject) => {
          const req = db.transaction("worlds").objectStore("worlds").getAll();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      } finally {
        db.close();
      }
    });
    const meta = metadata.find((world) => world.name === `${choice} checkpoint`);
    expect(meta?.generation).toEqual(generation);
    expect(meta?.seed).toBeUndefined();
    expect(meta?.worldType).toBeUndefined();
    await page.goto("/tilefun/");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect(canvas).toHaveAttribute("data-generator", worldType);
    await expect(canvas).toHaveAttribute("data-generation", JSON.stringify(generation));
    await page.keyboard.press("Escape");
    await expect(
      page.getByText(`${worldType} · seed 2026 · ${generation.version}`, { exact: true }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("explorer handoff preserves settings and game reports an invalid seed", async ({ page }) => {
  await page.goto("/tilefun/world-explorer.html");
  await expect(page.locator("#app")).toHaveAttribute("data-settled", "true");
  await page.getByRole("link", { name: "Create this world" }).click();
  await expect(page.getByRole("combobox", { name: "World type" })).toHaveValue("regional");
  await expect(page.getByRole("textbox", { name: "World seed" })).toHaveValue("2026");
  await page.getByRole("textbox", { name: "World seed" }).fill("4294967296");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Seed");
  await page.getByRole("textbox", { name: "World seed" }).fill("2026");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-generator", "regional");
});

test("Play here creates at the preview location and saved inspection includes a deleted building", async ({
  page,
}) => {
  const generation = {
    type: "regional",
    version: LATEST_REGIONAL_REVISION,
    seed: 2026,
    preset: "temperate-v1",
  } as const;
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(
    `/tilefun/world-explorer.html?generation=${encodeURIComponent(JSON.stringify(generation))}&x=300&y=519&zoom=16&mode=tiles`,
  );
  const app = page.locator("#app");
  await expect(app).toHaveAttribute("data-settled", "true");
  await expect
    .poll(async () => JSON.parse((await app.getAttribute("data-prop-ids")) ?? "[]").length)
    .toBeGreaterThan(0);
  await expect
    .poll(async () => Number(await app.getAttribute("data-tile-ready")))
    .toBeGreaterThan(0);
  await page.screenshot({ path: "/tmp/tilefun-district-preview.png" });
  await page.getByRole("link", { name: "Play here" }).click();
  await page.getByPlaceholder("World name...").fill("Play here district");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.getByRole("button", { name: "New World", exact: true })).toBeHidden();
  await expect(page.locator("#game")).toHaveAttribute(
    "data-generation",
    JSON.stringify(generation),
  );
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (
            document.querySelector("#game") as unknown as {
              __game: import("../src/client/GameClient.js").GameClient;
            }
          ).__game.stateView.props.filter((p) => p.proceduralId && p.type.includes("condo")).length,
      ),
    )
    .toBeGreaterThan(0);
  const info = await page.evaluate(() => {
    const game = (
      document.querySelector("#game") as unknown as {
        __game: import("../src/client/GameClient.js").GameClient;
      }
    ).__game;
    const p = game.stateView.playerEntity.position;
    const building = game.stateView.props.find((p) => p.proceduralId && p.type.includes("condo"));
    if (!building) throw new Error("No realized building");
    game.transport.send({ type: "edit-delete-prop", propId: building.id });
    game.transport.send({ type: "flush" });
    return {
      x: p.wx / 16,
      y: p.wy / 16,
      featureId: building.proceduralId,
      worldId: game.mainMenu.currentWorldId,
    };
  });
  expect(Math.hypot(info.x - 300, info.y - 519)).toBeLessThanOrEqual(46);
  await expect
    .poll(async () =>
      page.evaluate(async (id) => {
        const db = await new Promise<IDBDatabase>((r) => {
          const req = indexedDB.open(`tilefun-world-${id}-records-v3`);
          req.onsuccess = () => r(req.result);
        });
        try {
          return await new Promise<string[]>((r) => {
            const req = db.transaction("records").objectStore("records").getAll();
            req.onsuccess = () =>
              r(
                req.result
                  .filter((v) => v.collection === "features" && v.value.deleted)
                  .map((v) => v.value.id),
              );
          });
        } finally {
          db.close();
        }
      }, info.worldId),
    )
    .toContain(info.featureId);
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const game = (
            document.querySelector("#game") as unknown as {
              __game: import("../src/client/GameClient.js").GameClient;
            }
          ).__game;
          const range = game.camera.getVisibleChunkRange();
          for (let cy = range.minCy; cy <= range.maxCy; cy++)
            for (let cx = range.minCx; cx <= range.maxCx; cx++) {
              const chunk = game.stateView.world.getChunkIfLoaded(cx, cy);
              if (!game.renderer.isTerrainReady(chunk)) return false;
            }
          return true;
        }),
      { timeout: 10000 },
    )
    .toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-district-game.png" });
  await page.goto(
    `/tilefun/world-explorer.html?worldId=${info.worldId}&generation=${encodeURIComponent(JSON.stringify(generation))}&x=300&y=519&zoom=16&mode=tiles`,
  );
  await expect(page.locator("#source-coverage")).toContainText("saved snapshot");
  await expect(app).toHaveAttribute("data-settled", "true");
  await expect
    .poll(async () => Number(await app.getAttribute("data-tile-ready")))
    .toBeGreaterThan(0);
  expect(JSON.parse((await app.getAttribute("data-prop-ids")) ?? "[]")).not.toContain(
    info.featureId,
  );
  await expect(page.getByRole("combobox", { name: "World type" })).toBeDisabled();
  await page.getByRole("link", { name: "Play here" }).click();
  await page.getByText("Play here district", { exact: true }).click();
  await expect(page.getByRole("button", { name: "New World", exact: true })).not.toBeVisible();
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (
            document.querySelector("#game") as unknown as {
              __game: import("../src/client/GameClient.js").GameClient;
            }
          ).__game.stateView.props.length,
      ),
    )
    .toBeGreaterThan(0);
  const ids = await page.evaluate(() =>
    (
      document.querySelector("#game") as unknown as {
        __game: import("../src/client/GameClient.js").GameClient;
      }
    ).__game.stateView.props.map((p) => p.proceduralId),
  );
  expect(ids).not.toContain(info.featureId);
});

test("retired URL descriptors cannot create historical worlds", async ({ page }) => {
  const generation = {
    type: "regional",
    version: "regional-v1",
    seed: 2026,
    preset: "temperate-v1",
  };
  await page.goto(`/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}`);
  await expect(page.getByRole("alert")).toContainText("retired generator");
  await expect(page.getByRole("combobox", { name: "Regional revision" })).toHaveCount(0);
});
