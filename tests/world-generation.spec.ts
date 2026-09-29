import { expect, test } from "@playwright/test";
import { createDescriptor, resolveDescriptor } from "../src/generation/GenerationDescriptor.js";

test("game creates and reopens every generator with the pinned descriptor in IndexedDB", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const choice of ["classic", "island", "flat", "regional"] as const) {
    const generation = createDescriptor(choice, 2026);
    await page.goto(`/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}`);
    const canvas = page.locator("#game");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    await expect(page.getByRole("combobox", { name: "World type" })).toHaveValue(choice);
    await expect(page.getByRole("textbox", { name: "World seed" })).toHaveValue("2026");
    await page.getByPlaceholder("World name...").fill(`${choice} checkpoint`);
    await page.getByRole("button", { name: "New World", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-generator", choice);
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
    await expect(canvas).toHaveAttribute("data-generator", choice);
    await expect(canvas).toHaveAttribute("data-generation", JSON.stringify(generation));
    await page.keyboard.press("Escape");
    await expect(
      page.getByText(`${choice} · seed 2026 · ${generation.version}`, { exact: true }),
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
  const generation = createDescriptor("regional", 2026);
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
  await expect(page.locator("#game")).toHaveAttribute("data-generator", "regional");
  await expect
    .poll(async () =>
      page.evaluate(
        () =>
          (
            document.querySelector("#game") as unknown as {
              __game: import("../src/client/GameClient.js").GameClient;
            }
          ).__game.stateView.props.filter((p) => p.proceduralId && p.type.includes("apartment"))
            .length,
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
    const building = game.stateView.props.find(
      (p) => p.proceduralId && p.type.includes("apartment"),
    );
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
          const req = indexedDB.open(`tilefun-world-${id}`);
          req.onsuccess = () => r(req.result);
        });
        try {
          return await new Promise<string[]>((r) => {
            const req = db.transaction("meta").objectStore("meta").get("state");
            req.onsuccess = () => r(req.result?.deletedProceduralIds ?? []);
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
              if (!chunk?.renderCache || chunk.dirty) return false;
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

test("older Regional explorer revisions remain pinned during game creation", async ({ page }) => {
  const generation = {
    type: "regional",
    seed: 2026,
    version: "regional-v1",
    preset: "temperate-v1",
  } as const;
  await page.goto(`/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}`);
  await expect(page.getByRole("combobox", { name: "Regional revision" })).toHaveValue(
    "regional-v1",
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute(
    "data-generation",
    JSON.stringify(resolveDescriptor(generation)),
  );
});
