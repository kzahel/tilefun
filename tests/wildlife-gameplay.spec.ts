import { expect, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { MALLARD_TYPE } from "../src/wildlife/Mallard.js";

test.use({ channel: "chromium" });
test("an ordinary game ball throw startles a duck into flight and plays a quack", async ({
  page,
}) => {
  const generation = createDescriptor("flat", 1);
  const arrival = { x: 4, y: 4, generation };
  await page.goto(
    `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.evaluate((type) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    const p = g.stateView.playerEntity.position;
    g.transport.send({ type: "edit-spawn", entityType: type, wx: p.wx + 80, wy: p.wy });
  }, MALLARD_TYPE);
  await expect
    .poll(async () =>
      page.evaluate((type) => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        return g.stateView.entities.some((e) => e.type === type);
      }, MALLARD_TYPE),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Exit editor", exact: true }).click();
  await page.evaluate(() => {
    const g = (
      document.querySelector("#game") as unknown as {
        __game: GameClient;
      }
    ).__game;
    const canvas = document.querySelector("#game") as HTMLCanvasElement;
    const audio = (
      g as unknown as { audioManager: { playDuckQuack(volume?: number, pan?: number): void } }
    ).audioManager;
    const original = audio.playDuckQuack.bind(audio);
    audio.playDuckQuack = (volume, pan) => {
      canvas.dataset.quacks = String(Number(canvas.dataset.quacks ?? 0) + 1);
      original(volume, pan);
    };
  });
  const duck = () =>
    page.evaluate((type) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      const d = g.stateView.entities.find((e) => e.type === type);
      return { state: d?.wanderAI?.state, z: d?.wz ?? 0, clip: d?.sprite?.clip };
    }, MALLARD_TYPE);
  // Existing throws have intentional angle/speed jitter. Aim a short volley at
  // the current body and require an actual hit instead of assuming one throw hits.
  await expect
    .poll(
      async () => {
        const state = (await duck()).state;
        if (state !== "scared")
          await page.evaluate((type) => {
            const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
            const p = g.stateView.playerEntity.position;
            const d = g.stateView.entities.find((e) => e.type === type);
            if (d)
              g.transport.send({
                type: "throw-ball",
                dirX: d.position.wx - p.wx,
                dirY: d.position.wy - p.wy,
                force: 0,
              });
          }, MALLARD_TYPE);
        return state;
      },
      { timeout: 10000, intervals: [150] },
    )
    .toBe("scared");
  await expect(page.locator("#game")).toHaveAttribute("data-quacks", "1");
  await expect
    .poll(
      async () => {
        const d = await duck();
        return d.clip === 5 && d.z > 10;
      },
      { intervals: [50] },
    )
    .toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-duck-ball-flight.png" });
  await expect.poll(async () => (await duck()).state, { timeout: 10000 }).not.toBe("scared");
  expect((await duck()).z).toBe(0);
});
for (const renderer of ["canvas", "gpu"]) {
  test(`duck landing stays grounded and starts a durable escape in the shared pond Worker (${renderer})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=nature-pond&landscape=thicket&renderer=${renderer}#/tool/world-geometry`,
    );
    const c = page.getByLabel("Natural landscape playground");
    await expect(c).toHaveAttribute("data-ready", "true");
    // Keep the complete escape inside the observed pond rather than losing its replica.
    await page.getByLabel("Landscape zoom").selectOption("0.4");
    const poses = async () =>
      JSON.parse((await c.getAttribute("data-wildlife-poses")) ?? "[]") as {
        id: number;
        z: number;
        clip: number;
        state: string;
      }[];
    const original = (await poses()).map((d) => d.id).sort();
    expect(original.length).toBeGreaterThanOrEqual(2);
    await page.getByRole("button", { name: "Hop onto duck", exact: true }).click();
    await expect
      .poll(
        async () => (await poses()).some((d) => d.state === "scared" && d.clip === 5 && d.z > 14),
        { intervals: [50] },
      )
      .toBe(true);
    await expect(c).toHaveAttribute("data-player-max-vz", "0");
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(c).toHaveAttribute("data-authority-running", "false");
    const flying = (await poses()).find((d) => d.clip === 5);
    expect(flying?.z).toBeGreaterThan(0);
    await page.screenshot({ path: `/tmp/tilefun-duck-flight-${renderer}.png`, fullPage: true });
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(c).toHaveAttribute("data-reload-count", "1");
    expect((await poses()).length).toBe(original.length);
    const restored = (await poses()).find((d) => d.clip === 5);
    expect(restored?.z).toBeCloseTo(flying?.z ?? 0, 3);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect
      .poll(
        async () => {
          const duck = (await poses()).find((d) => d.id === restored?.id);
          return !!duck && duck.state !== "scared" && duck.z === 0;
        },
        {
          timeout: 10000,
        },
      )
      .toBe(true);
    expect((await poses()).find((d) => d.id === restored?.id)?.z).toBe(0);
    expect(errors).toEqual([]);
  });
  test(`pond ducks animate in the shared Worker lab and survive reload (${renderer})`, async ({
    page,
  }) => {
    test.setTimeout(60000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=nature-pond&landscape=thicket&renderer=${renderer}#/tool/world-geometry`,
    );
    const c = page.getByLabel("Natural landscape playground");
    await expect(c).toHaveAttribute("data-ready", "true");
    await page.getByLabel("Landscape zoom").selectOption("1.3");
    await expect
      .poll(async () => Number(await c.getAttribute("data-wildlife-count")))
      .toBeGreaterThanOrEqual(2);
    const clips = new Set<number>(),
      poses = new Set<string>();
    await expect
      .poll(
        async () => {
          const ducks: { clip: number; frame: number; direction: number }[] = JSON.parse(
            (await c.getAttribute("data-wildlife-poses")) ?? "[]",
          );
          for (const d of ducks) {
            clips.add(d.clip);
            poses.add(`${d.clip}:${d.frame}:${d.direction}`);
          }
          return clips.has(1) && clips.has(2) && poses.size > 4;
        },
        { timeout: 40000, intervals: [160] },
      )
      .toBe(true);
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(c).toHaveAttribute("data-authority-running", "false");
    const frozen = await c.getAttribute("data-wildlife-poses");
    await page.waitForTimeout(400);
    expect(await c.getAttribute("data-wildlife-poses")).toBe(frozen);
    await page.screenshot({ path: `/tmp/tilefun-mallard-pond-${renderer}.png`, fullPage: true });
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(c).toHaveAttribute("data-ready", "true");
    await expect
      .poll(async () => Number(await c.getAttribute("data-wildlife-count")))
      .toBeGreaterThanOrEqual(2);
    expect(errors).toEqual([]);
  });
}

test("ordinary seeded pond has durable ducks and offers manual creation in Entities", async ({
  page,
}) => {
  const generation = createDescriptor("regional", 2026);
  const arrival = { x: 227, y: -183, generation };
  await page.goto(
    `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  await page.getByPlaceholder("World name...").fill("Durable duck pond");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  const ducks = () =>
    page.evaluate((type) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      return g.stateView.entities
        .filter(
          (e) =>
            e.type === type && Math.hypot(e.position.wx - 227 * 16, e.position.wy + 183 * 16) < 500,
        )
        .map((e) => ({ id: e.id, x: e.position.wx, y: e.position.wy }));
    }, MALLARD_TYPE);
  await expect.poll(async () => (await ducks()).length).toBeGreaterThanOrEqual(2);
  const original = await ducks(),
    removed = original[0];
  if (!removed) throw new Error("Missing generated duck");
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator('[data-editor-tab="entities"]').click();
  await page.getByRole("button", { name: "Place Mallard duck (click map)", exact: true }).click();
  await page.locator("#game").click({ position: { x: 300, y: 170 } });
  await expect.poll(async () => (await ducks()).length).toBe(original.length + 1);
  await page.evaluate((id) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    g.transport.send({ type: "edit-delete-entity", entityId: id });
  }, removed.id);
  await expect.poll(async () => (await ducks()).length).toBe(original.length);
  await page.getByRole("button", { name: "Exit editor", exact: true }).click();
  await page.evaluate(async () => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    g.loop.stop();
    const host = g.netEmulatedTransport.base as unknown as {
      setHidden(v: boolean): void;
      flush(): Promise<void>;
      shutdown(): Promise<void>;
    };
    host.setHidden(true);
    await host.flush();
    await host.shutdown();
  });
  await page.goto("/tilefun/?nogamepad");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect.poll(async () => (await ducks()).length).toBe(original.length);
  await page.screenshot({ path: "/tmp/tilefun-mallard-game.png" });
});
