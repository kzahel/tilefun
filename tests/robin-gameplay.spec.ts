import { expect, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { ROBIN_TYPE } from "../src/wildlife/Robin.js";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"]) {
  test(`grove robins fly to crowns, react to landing and reload their flight pose (${renderer})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=nature-robins&landscape=thicket&renderer=${renderer}#/tool/world-geometry`,
    );
    const c = page.getByLabel("Natural landscape playground");
    await expect(c).toHaveAttribute("data-ready", "true");
    await page.getByLabel("Landscape zoom").selectOption("1.3");
    const poses = async () =>
      JSON.parse((await c.getAttribute("data-robin-poses")) ?? "[]") as {
        id: number;
        x: number;
        y: number;
        z: number;
        clip: number;
        frame: number;
        state: string;
      }[];
    const original = await poses();
    expect(original.length).toBeGreaterThanOrEqual(2);
    await expect
      .poll(async () => (await poses()).some((f) => f.clip === 2 && f.z > 20), { intervals: [30] })
      .toBe(true);
    // Pause a routine flight before the escape below. This checks saved phase,
    // rather than assuming the client restarts its one-shot at frame zero.
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(c).toHaveAttribute("data-authority-running", "false");
    const before = await poses();
    await page.waitForTimeout(250);
    expect(await poses()).toEqual(before);
    await page.screenshot({ path: `/tmp/tilefun-robin-grove-${renderer}.png`, fullPage: true });
    await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
    await expect(c).toHaveAttribute("data-reload-count", "1");
    const restored = await poses();
    expect(restored.length).toBe(before.length);
    for (const f of before) {
      // Runtime IDs are reassigned on hydration; durable identity is checked in headless residency tests.
      const r = restored.find((r) => Math.abs(r.x - f.x) < 0.01 && Math.abs(r.y - f.y) < 0.01);
      expect(r?.x).toBeCloseTo(f.x, 3);
      expect(r?.y).toBeCloseTo(f.y, 3);
      expect(r?.z).toBeCloseTo(f.z, 3);
      if (f.clip === 1 || f.clip === 2) expect(r?.frame).toBe(f.frame);
    }
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect
      .poll(async () => (await poses()).some((f) => f.clip === 0 && f.z === 0))
      .toBe(true);
    await expect
      .poll(async () => (await poses()).some((f) => f.clip === 0 && f.z === 32), { timeout: 15000 })
      .toBe(true);
    await page.screenshot({ path: `/tmp/tilefun-robin-perch-${renderer}.png`, fullPage: true });
    await page.getByRole("button", { name: "Hop onto robin", exact: true }).click();
    await expect
      .poll(
        async () => (await poses()).some((f) => f.state === "scared" && f.clip === 2 && f.z > 3),
        { intervals: [30] },
      )
      .toBe(true);
    await expect
      .poll(async () => (await poses()).every((f) => f.state !== "scared"), { timeout: 10000 })
      .toBe(true);
    await expect(c).toHaveAttribute("data-player-max-vz", "0");
    expect(errors).toEqual([]);
  });
}

test("ordinary ball throws ricochet from a robin, trigger a short escape flight", async ({
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
    g.transport.send({ type: "edit-spawn", entityType: type, wx: p.wx + 100, wy: p.wy });
    const canvas = document.querySelector("#game") as HTMLCanvasElement;
    const audio = g.audioManager;
    const original = audio.playRobinChirp.bind(audio);
    audio.playRobinChirp = (volume, pan) => {
      canvas.dataset.chirps = String(Number(canvas.dataset.chirps ?? 0) + 1);
      original(volume, pan);
    };
  }, ROBIN_TYPE);
  const robin = () =>
    page.evaluate((type) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      const f = g.stateView.entities.find((e) => e.type === type);
      return { exists: !!f, state: f?.wanderAI?.state, z: f?.wz ?? 0, clip: f?.sprite?.clip };
    }, ROBIN_TYPE);
  await expect.poll(async () => (await robin()).exists).toBe(true);
  await page.getByRole("button", { name: "Exit editor", exact: true }).click();
  // Throws deliberately vary. Require a real hit from a short aimed volley.
  await expect
    .poll(
      async () => {
        const state = (await robin()).state;
        if (state !== "scared")
          await page.evaluate((type) => {
            const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
            const p = g.stateView.playerEntity.position,
              f = g.stateView.entities.find((e) => e.type === type);
            if (f)
              g.transport.send({
                type: "throw-ball",
                dirX: f.position.wx - p.wx,
                dirY: f.position.wy - p.wy,
                force: 0,
              });
          }, ROBIN_TYPE);
        return state;
      },
      { timeout: 15000, intervals: [150] },
    )
    .toBe("scared");
  await expect
    .poll(
      async () => {
        const f = await robin();
        return f.state === "scared" && f.clip === 2 && f.z > 3;
      },
      { intervals: [30] },
    )
    .toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-robin-ball-hop.png" });
  await expect.poll(async () => (await robin()).state, { timeout: 10000 }).not.toBe("scared");
  expect((await robin()).exists).toBe(true);
  await expect
    .poll(async () => Number(await page.locator("#game").getAttribute("data-chirps")))
    .toBeGreaterThan(0);
});

test("ordinary grove robins support manual creation and durable deletion on world reopening", async ({
  page,
}) => {
  const generation = createDescriptor("regional", 2026);
  const arrival = { x: -163, y: -519, generation };
  await page.goto(
    `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  await page.getByPlaceholder("World name...").fill("Durable robin grove");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  const robins = () =>
    page.evaluate((type) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      return g.stateView.entities
        .filter(
          (e) =>
            e.type === type && Math.hypot(e.position.wx + 163 * 16, e.position.wy + 519 * 16) < 500,
        )
        .map((e) => ({ id: e.id, x: e.position.wx, y: e.position.wy }));
    }, ROBIN_TYPE);
  await expect.poll(async () => (await robins()).length).toBeGreaterThanOrEqual(2);
  const original = await robins(),
    removed = original[0];
  if (!removed) throw new Error("Missing generated robin");
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator('[data-editor-tab="entities"]').click();
  await page.getByRole("button", { name: "Place Robin (click map)", exact: true }).click();
  await page.locator("#game").click({ position: { x: 300, y: 170 } });
  await expect.poll(async () => (await robins()).length).toBe(original.length + 1);
  await page.evaluate((id) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    g.transport.send({ type: "edit-delete-entity", entityId: id });
  }, removed.id);
  await expect.poll(async () => (await robins()).length).toBe(original.length);
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
  await expect.poll(async () => (await robins()).length).toBe(original.length);
  await page.screenshot({ path: "/tmp/tilefun-robins-game.png" });
});
