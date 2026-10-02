import { expect, test } from "@playwright/test";
import { actorPlacements } from "../src/generation/ActorPlacements.js";
import { createGenerator } from "../src/generation/Generator.js";
import { inspectionPlacements } from "../src/persistence/WorldInspection.js";
import { Chunk } from "../src/world/Chunk.js";
import { chunkData } from "../src/world/ChunkData.js";

const baselineGeneration = {
  type: "regional",
  version: "regional-v3",
  seed: 2026,
  preset: "temperate-v1",
} as const;
for (const fixture of [
  { name: "farm", x: 677, y: 1320, actor: "farm:0:1:cow" },
  { name: "woodland", x: -985, y: -985, actor: "woodland:-8:-8:crow" },
  {
    name: "dense-connected",
    x: 300,
    y: 519,
    actor: "settlement:0:0:crossing:walker",
    generation: {
      type: "regional",
      version: "regional-v5",
      seed: 2026,
      preset: "temperate-v1",
    } as const,
  },
  {
    name: "dense",
    x: 300,
    y: 519,
    actor: "settlement:0:0:crossing:walker",
    generation: {
      type: "regional",
      version: "regional-v4",
      seed: 2026,
      preset: "temperate-v1",
    } as const,
  },
]) {
  test(`shared ${fixture.name} tiles, props, and actors render and match the actual worker`, async ({
    page,
  }) => {
    const generation = "generation" in fixture ? fixture.generation : baselineGeneration;
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(
      `/tilefun/world-explorer.html?generation=${encodeURIComponent(JSON.stringify(generation))}&x=${fixture.x}&y=${fixture.y}&zoom=16&mode=tiles`,
    );
    const app = page.locator("#app");
    await expect(app).toHaveAttribute("data-settled", "true");
    await expect
      .poll(async () => JSON.parse((await app.getAttribute("data-actor-ids")) ?? "[]"))
      .toContain(fixture.actor);
    await expect
      .poll(async () => Number(await app.getAttribute("data-tile-ready")))
      .toBeGreaterThan(0);
    await expect(app).toHaveAttribute("data-tile-complete", "true");
    await page.screenshot({ path: `/tmp/tilefun-settled-${fixture.name}-preview.png` });
    const workerUrl = page.workers()[0]?.url();
    if (!workerUrl) throw new Error("Missing worker");
    const bounds = {
        minX: fixture.x - 24,
        minY: fixture.y - 24,
        maxX: fixture.x + 24,
        maxY: fixture.y + 24,
      },
      cx = Math.floor(fixture.x / 16),
      cy = Math.floor(fixture.y / 16);
    const output = await page.evaluate(
      async (args) => {
        const worker = new Worker(args.workerUrl, { type: "module" });
        try {
          return await new Promise<{
            placements: unknown;
            actors: unknown;
            buffers: Record<string, number[]>;
          }>((resolve, reject) => {
            worker.onmessage = ({ data }) => {
              if (data.type === "error") reject(new Error(data.message));
              else if (data.type === "result")
                resolve({
                  placements: data.placements,
                  actors: data.actors,
                  buffers: Object.fromEntries(
                    Object.entries(data.chunks[0].data).map(([k, v]) => [
                      k,
                      Array.from(v as Uint8Array),
                    ]),
                  ),
                });
            };
            worker.onerror = (e) => reject(new Error(e.message));
            worker.postMessage({
              type: "query",
              id: 1,
              world: args.generation,
              request: {
                bounds: args.bounds,
                detail: "region",
                sampleStep: 4,
                limits: { maxSamples: 24576, maxOwners: 144, maxFeatures: 432 },
              },
              footprint: args.bounds,
              exact: [{ cx: args.cx, cy: args.cy }],
            });
          });
        } finally {
          worker.terminate();
        }
      },
      { workerUrl, generation, bounds, cx, cy },
    );
    expect(output.actors).toEqual(actorPlacements(createGenerator(generation), bounds));
    expect(output.placements).toEqual(inspectionPlacements(generation, bounds));
    const chunk = new Chunk();
    createGenerator(generation).terrain.generate(chunk, cx, cy);
    expect(output.buffers).toEqual(
      Object.fromEntries(Object.entries(chunkData(chunk)).map(([k, v]) => [k, Array.from(v)])),
    );
    if (fixture.name === "farm") {
      await page.getByRole("link", { name: "Play here" }).click();
      await page.getByRole("button", { name: "New World", exact: true }).click();
      const readActors = () =>
        page.evaluate(() => {
          const g = (
            document.querySelector("#game") as unknown as {
              __game: import("../src/client/GameClient.js").GameClient;
            }
          ).__game;
          return g.stateView.entities
            .filter((e) => e.type === "cow" || e.type === "chicken" || e.type.startsWith("person"))
            .map((e) => ({ type: e.type, id: e.id, ...e.position }));
        });
      await expect
        .poll(readActors)
        .toEqual(expect.arrayContaining([expect.objectContaining({ type: "cow" })]));
      const before = await readActors();
      await expect
        .poll(async () => {
          const now = await readActors();
          return now.some((e) => {
            const old = before.find((o) => o.id === e.id);
            return old && Math.hypot(e.wx - old.wx, e.wy - old.wy) > 8;
          });
        })
        .toBe(true);
      await page.screenshot({ path: "/tmp/tilefun-settled-farm-game.png" });
      const info = await page.evaluate(() => {
        const g = (
          document.querySelector("#game") as unknown as {
            __game: import("../src/client/GameClient.js").GameClient;
          }
        ).__game;
        const cow = g.stateView.entities.find((e) => e.type === "cow");
        if (!cow) throw new Error("Missing cow");
        g.transport.send({ type: "edit-delete-entity", entityId: cow.id });
        g.transport.send({ type: "flush" });
        return {
          worldId: g.mainMenu.currentWorldId,
          x: g.stateView.playerEntity.position.wx / 16,
          y: g.stateView.playerEntity.position.wy / 16,
        };
      });
      await expect
        .poll(async () => (await readActors()).filter((e) => e.type === "cow").length)
        .toBe(0);
      await page.goto(
        `/tilefun/world-explorer.html?worldId=${info.worldId}&generation=${encodeURIComponent(JSON.stringify(generation))}&x=${fixture.x}&y=${fixture.y}&zoom=16&mode=tiles`,
      );
      await expect(app).toHaveAttribute("data-settled", "true");
      await expect
        .poll(async () => JSON.parse((await app.getAttribute("data-actor-ids")) ?? "[]"))
        .not.toContain(fixture.actor);
      await page.getByRole("link", { name: "Play here" }).click();
      await expect(page.locator("#game")).toHaveAttribute(
        "data-generation",
        JSON.stringify(generation),
      );
      await expect
        .poll(async () => (await readActors()).filter((e) => e.type === "cow").length)
        .toBe(0);
    }
    expect(errors).toEqual([]);
  });
}
