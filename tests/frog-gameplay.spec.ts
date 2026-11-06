import { expect, test } from "@playwright/test";
import type { GameTestHooks } from "../src/client/GameTestHooks.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { FROG_TYPE } from "../src/wildlife/Frog.js";

test.use({ channel: "chromium" });
// Behavior/persistence cases without a GPU-output contract use Canvas: hosted
// software WebGL slows every page action about eightfold.

// Shared Rapier contacts rest bodies within solver slop of the ground rather
// than at exact zero, and the landing impact's depenetration can briefly give
// the player ~20 px/s (frog, measured natively). The removed automatic wildlife
// bounces (c473f541) launched at 75-95 px/s.
const grounded = (z: number) => Math.abs(z) < 0.5;
const MAX_LANDING_VZ = 40;
// Behavior on Canvas; GPU output is covered by gpu-renderer.spec.ts.
for (const renderer of ["canvas"]) {
  test(`pond frogs physically hop, react to landing and reload their mid-hop pose (${renderer})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      `/tilefun/workshop.html?geometry=nature-frogs&landscape=thicket&renderer=${renderer}#/tool/world-geometry`,
    );
    const c = page.getByLabel("Natural landscape playground");
    await expect(c).toHaveAttribute("data-ready", "true");
    await page.getByLabel("Landscape zoom").selectOption("1.3");
    const poses = async () =>
      JSON.parse((await c.getAttribute("data-frog-poses")) ?? "[]") as {
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
      .poll(
        async () =>
          (await poses()).some((f) => f.clip === 1 && f.z > 4 && f.frame >= 3 && f.frame <= 6),
        { intervals: [30] },
      )
      .toBe(true);
    // Pause a routine hop as well as the escape below. This checks saved phase,
    // rather than assuming the client restarts its one-shot at frame zero.
    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(c).toHaveAttribute("data-authority-running", "false");
    const before = await poses();
    await page.waitForTimeout(250);
    expect(await poses()).toEqual(before);
    await page.screenshot({ path: `/tmp/tilefun-frog-pond-${renderer}.png`, fullPage: true });
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
      .poll(async () => (await poses()).some((f) => f.clip === 0 && grounded(f.z)))
      .toBe(true);
    const hopOntoFrog = page.getByRole("button", { name: "Hop onto frog", exact: true });
    await expect
      .poll(
        async () => {
          const frogs = await poses();
          if (frogs.some((f) => f.state === "scared" && f.clip === 1 && f.z > 3)) return true;
          // The control picks the first grounded, non-scared frog. During a
          // hop's push-off that frog can move away before the player lands;
          // when none qualifies the control does nothing. Try a resting target
          // and let any alarm finish before trying another real landing.
          const target = frogs.find((f) => f.state !== "scared" && grounded(f.z));
          if (!frogs.some((f) => f.state === "scared") && target?.clip === 0)
            await hopOntoFrog.click();
          return false;
        },
        { timeout: 10000, intervals: [30] },
      )
      .toBe(true);
    await expect
      .poll(async () => (await poses()).every((f) => f.state !== "scared"), { timeout: 10000 })
      .toBe(true);
    expect(Number(await c.getAttribute("data-player-max-vz"))).toBeLessThan(MAX_LANDING_VZ);
    expect(errors).toEqual([]);
  });
}

test("frog ball contact dispatches client croaks through the live Worker", async ({ page }) => {
  const generation = createDescriptor("flat", 1);
  const arrival = { x: 4, y: 4, generation };
  await page.goto(
    `/tilefun/?nogamepad&renderer=canvas&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.getByTestId("world-menu")).toBeHidden();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.evaluate((type) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    const p = g.stateView.playerEntity.position;
    g.transport.send({ type: "edit-spawn", entityType: type, wx: p.wx + 100, wy: p.wy });
    const canvas = document.querySelector("#game") as HTMLCanvasElement;
    const audio = g.audioManager;
    const original = audio.playCreatureCall.bind(audio);
    audio.playCreatureCall = (id, kind, volume, pan) => {
      const played = original(id, kind, volume, pan);
      if (played && kind === "frog")
        canvas.dataset.croaks = String(Number(canvas.dataset.croaks ?? 0) + 1);
      return played;
    };
  }, FROG_TYPE);
  const frog = () =>
    page.evaluate((type) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
      const f = g.stateView.entities.find((e) => e.type === type);
      return { exists: !!f, state: f?.wanderAI?.state, z: f?.wz ?? 0, clip: f?.sprite?.clip };
    }, FROG_TYPE);
  await expect.poll(async () => (await frog()).exists).toBe(true);
  await page.getByRole("button", { name: "Exit editor", exact: true }).click();
  // Keep one actual keyboard-release -> PlayScene -> Worker throw boundary.
  await page.keyboard.press("b", { delay: 50 });
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          document.querySelector("#game") as unknown as { __game: GameTestHooks }
        ).__game.stateView.entities.some((e) => e.type === "ball"),
      ),
    )
    .toBe(true);
  // Throws deliberately vary. Require a real hit from a short aimed volley.
  await expect
    .poll(
      async () => {
        const state = (await frog()).state;
        if (state !== "scared")
          await page.evaluate((type) => {
            const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks })
              .__game;
            const p = g.stateView.playerEntity.position,
              f = g.stateView.entities.find((e) => e.type === type);
            if (f)
              g.transport.send({
                type: "throw-ball",
                dirX: f.position.wx - p.wx,
                dirY: f.position.wy - p.wy,
                // Shared ball physics: a low throw lands ~70 px out (205); reach the target.
                force: 1,
              });
          }, FROG_TYPE);
        return state;
      },
      { timeout: 15000, intervals: [150] },
    )
    .toBe("scared");
  await expect
    .poll(async () => Number(await page.locator("#game").getAttribute("data-croaks")))
    .toBeGreaterThan(0);
});

test("ordinary pond frogs support manual creation and durable deletion on world reopening", async ({
  page,
}) => {
  const generation = createDescriptor("regional", 2026);
  const arrival = { x: 227, y: -183, generation };
  await page.goto(
    `/tilefun/?nogamepad&renderer=canvas&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  await page.getByPlaceholder("World name...").fill("Durable frog pond");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.getByTestId("world-menu")).toBeHidden();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  const frogs = () =>
    page.evaluate((type) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
      return g.stateView.entities
        .filter(
          (e) =>
            e.type === type && Math.hypot(e.position.wx - 227 * 16, e.position.wy + 183 * 16) < 500,
        )
        .map((e) => ({ id: e.id, x: e.position.wx, y: e.position.wy }));
    }, FROG_TYPE);
  await expect.poll(async () => (await frogs()).length).toBeGreaterThanOrEqual(2);
  const original = await frogs(),
    removed = original[0];
  if (!removed) throw new Error("Missing generated frog");
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator('[data-editor-tab="entities"]').click();
  await page.getByRole("button", { name: "Place Common frog (click map)", exact: true }).click();
  await page.locator("#game").click({ position: { x: 300, y: 170 } });
  await expect.poll(async () => (await frogs()).length).toBe(original.length + 1);
  await page.evaluate((id) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    g.transport.send({ type: "edit-delete-entity", entityId: id });
  }, removed.id);
  await expect.poll(async () => (await frogs()).length).toBe(original.length);
  await page.getByRole("button", { name: "Exit editor", exact: true }).click();
  await page.evaluate(async () => {
    const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
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
  await page.goto("/tilefun/?nogamepad&renderer=canvas");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect.poll(async () => (await frogs()).length).toBe(original.length);
  await page.screenshot({ path: "/tmp/tilefun-frogs-game.png" });
});
