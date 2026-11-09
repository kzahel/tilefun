import { expect, test } from "@playwright/test";
import type { GameTestHooks } from "../src/client/GameTestHooks.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import type { ActorRecord } from "../src/persistence/ActorRecords.js";
import { ROBIN_TYPE } from "../src/wildlife/Robin.js";
import { flushLocalWorld, stopLocalWorld, worldRecords } from "./helpers/local-world.js";

test.use({ channel: "chromium" });
// Shared Rapier contacts rest bodies within solver slop of the ground rather
// than at exact zero, and the landing impact's depenetration can briefly give
// the player ~20 px/s (frog, measured natively). The removed automatic wildlife
// bounces (c473f541) launched at 75-95 px/s.
const grounded = (z: number) => Math.abs(z) < 0.5;
const MAX_LANDING_VZ = 40;
test("grove robins fly to crowns, react to landing and reload their flight pose", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `/tilefun/workshop.html?geometry=nature-robins&landscape=thicket#/tool/world-geometry`,
  );
  const c = page.getByLabel("Natural landscape playground");
  await expect(c).toHaveAttribute("data-ready", "true");
  // Keep the replicated region fixed: hydration reorders runtime actors, so
  // following the first robin can stream a different grove after reload.
  await page.getByLabel("Follow selected animal").uncheck();
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
    .poll(async () => (await poses()).some((f) => f.clip === 2 && f.z > 20), {
      intervals: [30],
      timeout: 15000,
    })
    .toBe(true);
  // Pause a routine flight before the escape below. This checks saved phase,
  // rather than assuming the client restarts its one-shot at frame zero.
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(c).toHaveAttribute("data-authority-running", "false");
  const before = await poses();
  await page.waitForTimeout(250);
  expect(await poses()).toEqual(before);
  await page.screenshot({ path: "/tmp/tilefun-robin-grove.png", fullPage: true });
  await page.getByRole("button", { name: "Save / reload scene", exact: true }).click();
  await expect(c).toHaveAttribute("data-reload-count", "1");
  const restored = await poses();
  expect(restored.length).toBe(before.length);
  for (const f of before) {
    // Runtime IDs are reassigned on hydration; durable identity is checked in headless residency tests.
    const r = restored.find((r) => Math.abs(r.x - f.x) < 0.01 && Math.abs(r.y - f.y) < 0.01);
    // Rapier stores f32 positions relative to an origin chosen from the first
    // hydrated body; at the grove's |y| ≈ 8600 px one f32 step is 2^-10 px, so a
    // reload may re-round by one step (CI: -8608.6982421875 → -8608.697265625).
    expect(r?.x).toBeCloseTo(f.x, 2);
    expect(r?.y).toBeCloseTo(f.y, 2);
    expect(r?.z).toBeCloseTo(f.z, 3);
    if (f.clip === 1 || f.clip === 2) expect(r?.frame).toBe(f.frame);
  }
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect
    .poll(async () => (await poses()).some((f) => f.clip === 0 && grounded(f.z)))
    .toBe(true);
  await expect
    // Perched at the 32 px crown within Rapier contact error.
    .poll(async () => (await poses()).some((f) => f.clip === 0 && Math.abs(f.z - 32) < 0.5), {
      timeout: 15000,
    })
    .toBe(true);
  await page.screenshot({ path: "/tmp/tilefun-robin-perch.png", fullPage: true });
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
  expect(Number(await c.getAttribute("data-player-max-vz"))).toBeLessThan(MAX_LANDING_VZ);
  expect(errors).toEqual([]);
});

test("robin ball contact dispatches client chirps through the live Worker", async ({ page }) => {
  const generation = createDescriptor("flat", 1);
  const arrival = { x: 4, y: 4, generation };
  await page.goto(
    `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
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
      if (played && kind === "robin")
        canvas.dataset.chirps = String(Number(canvas.dataset.chirps ?? 0) + 1);
      return played;
    };
  }, ROBIN_TYPE);
  const robin = () =>
    page.evaluate((type) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
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
          }, ROBIN_TYPE);
        return state;
      },
      { timeout: 15000, intervals: [150] },
    )
    .toBe("scared");
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
  await expect(page.getByTestId("world-menu")).toBeHidden();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  const robins = () =>
    page.evaluate((type) => {
      const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
      return g.stateView.entities
        .filter(
          (e) =>
            e.type === type && Math.hypot(e.position.wx + 163 * 16, e.position.wy + 519 * 16) < 500,
        )
        .map((e) => ({ id: e.id, x: e.position.wx, y: e.position.wy }));
    }, ROBIN_TYPE);
  await expect.poll(async () => (await robins()).length).toBeGreaterThanOrEqual(2);
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.locator('[data-editor-tab="entities"]').click();
  await page.getByRole("button", { name: "Place Robin (click map)", exact: true }).click();
  // Opening the editor can publish additional nearby generated individuals.
  // Take the baseline immediately before the edit, after navigation settles.
  const original = await robins(),
    removed = original[0];
  if (!removed) throw new Error("Missing generated robin");
  await page.locator("#game").click({ position: { x: 300, y: 170 } });
  await expect
    .poll(async () => (await robins()).length)
    .toBeGreaterThanOrEqual(original.length + 1);
  const savedRobins = async () =>
    (await worldRecords(page))
      .filter((r) => r.collection === "entities")
      .map((r) => r.value as ActorRecord)
      .filter((r) => r.type === ROBIN_TYPE);
  await flushLocalWorld(page);
  const beforeDeletion = await savedRobins();
  const manual = beforeDeletion.filter((r) => !r.proceduralId);
  expect(manual).toHaveLength(1);
  await page.evaluate((id) => {
    const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    g.transport.send({ type: "edit-delete-entity", entityId: id });
  }, removed.id);
  await expect.poll(async () => (await robins()).some((r) => r.id === removed.id)).toBe(false);
  await page.getByRole("button", { name: "Exit editor", exact: true }).click();
  await stopLocalWorld(page);
  const afterDeletion = await savedRobins();
  const deleted = beforeDeletion.filter(
    (r) => !afterDeletion.some((saved) => saved.persistentId === r.persistentId),
  );
  expect(deleted).toHaveLength(1);
  expect(deleted[0]?.proceduralId).toBeTruthy();
  expect(afterDeletion.some((r) => r.persistentId === manual[0]?.persistentId)).toBe(true);
  await page.goto("/tilefun/?nogamepad");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await expect.poll(async () => (await robins()).length).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: "/tmp/tilefun-robins-game.png" });
  // Reopening may stream extra individuals. Verify the exact saved edit identities instead.
  await stopLocalWorld(page);
  const reopened = await savedRobins();
  expect(reopened.some((r) => r.persistentId === manual[0]?.persistentId)).toBe(true);
  expect(reopened.some((r) => r.proceduralId === deleted[0]?.proceduralId)).toBe(false);
  expect(
    (await worldRecords(page)).find((r) => r.key === deleted[0]?.proceduralId)?.value,
  ).toMatchObject({ deleted: true });
});
