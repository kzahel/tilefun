import { expect, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { DEER_TYPE } from "../src/wildlife/Deer.js";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"]) {
  test(`woodland deer walk, react to landing and reload their walking pose (${renderer})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=nature-deer&landscape=thicket&renderer=${renderer}#/tool/world-geometry`,
    );
    const c = page.getByLabel("Natural landscape playground");
    await expect(c).toHaveAttribute("data-ready", "true");
    await page.getByLabel("Landscape zoom").selectOption("0.8");
    const poses = async () =>
      JSON.parse((await c.getAttribute("data-deer-poses")) ?? "[]") as {
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
      .poll(async () => (await poses()).some((f) => f.clip === 1 && f.z === 0 && f.frame >= 4), {
        intervals: [30],
      })
      .toBe(true);
    // Pause a routine walk as well as the escape below. This checks saved phase,
    // rather than assuming the client restarts its walk at frame zero.
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(c).toHaveAttribute("data-authority-running", "false");
    const before = await poses();
    await page.waitForTimeout(250);
    expect(await poses()).toEqual(before);
    await page.screenshot({ path: `/tmp/tilefun-deer-woodland-${renderer}.png`, fullPage: true });
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
      if (f.clip === 1) expect(r?.frame).toBe(f.frame);
    }
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect
      .poll(async () => (await poses()).some((f) => f.clip === 0 && f.z === 0))
      .toBe(true);
    await page.getByRole("button", { name: "Hop onto deer", exact: true }).click();
    await expect
      .poll(
        async () => (await poses()).some((f) => f.state === "scared" && f.clip === 3 && f.z === 0),
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

test("ordinary ball throws ricochet from a deer, trigger a short grounded escape", async ({
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
  }, DEER_TYPE);
  const deer = () =>
    page.evaluate((type) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      const f = g.stateView.entities.find((e) => e.type === type);
      return { exists: !!f, state: f?.wanderAI?.state, z: f?.wz ?? 0, clip: f?.sprite?.clip };
    }, DEER_TYPE);
  await expect.poll(async () => (await deer()).exists).toBe(true);
  await page.getByRole("button", { name: "Exit editor", exact: true }).click();
  // Throws deliberately vary. Require a real hit from a short aimed volley.
  await expect
    .poll(
      async () => {
        const state = (await deer()).state;
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
          }, DEER_TYPE);
        return state;
      },
      { timeout: 15000, intervals: [150] },
    )
    .toBe("scared");
  await expect
    .poll(
      async () => {
        const f = await deer();
        return f.state === "scared" && f.clip === 3 && f.z === 0;
      },
      { intervals: [30] },
    )
    .toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-deer-ball-hop.png" });
  await expect.poll(async () => (await deer()).state, { timeout: 10000 }).not.toBe("scared");
  expect((await deer()).exists).toBe(true);
});

test("ordinary woodland deer support manual creation and durable deletion on world reopening", async ({
  page,
}) => {
  const generation = createDescriptor("regional", 2026);
  const arrival = { x: -164, y: -460, generation };
  await page.goto(
    `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  await page.getByPlaceholder("World name...").fill("Durable deer woodland");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  const deer = () =>
    page.evaluate((type) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
      return g.stateView.entities
        .filter(
          (e) =>
            e.type === type && Math.hypot(e.position.wx + 164 * 16, e.position.wy + 460 * 16) < 500,
        )
        .map((e) => ({ id: e.id, x: e.position.wx, y: e.position.wy }));
    }, DEER_TYPE);
  await expect.poll(async () => (await deer()).length).toBeGreaterThanOrEqual(2);
  const original = await deer(),
    removed = original[0];
  if (!removed) throw new Error("Missing generated deer");
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator('[data-editor-tab="entities"]').click();
  await page.getByRole("button", { name: "Place Deer (click map)", exact: true }).click();
  await page.locator("#game").click({ position: { x: 300, y: 170 } });
  await expect.poll(async () => (await deer()).length).toBe(original.length + 1);
  await page.evaluate((id) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    g.transport.send({ type: "edit-delete-entity", entityId: id });
  }, removed.id);
  await expect.poll(async () => (await deer()).length).toBe(original.length);
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
  await expect.poll(async () => (await deer()).length).toBe(original.length);
  await page.screenshot({ path: "/tmp/tilefun-deer-game.png" });
});
