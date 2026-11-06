import { expect, type Page, test } from "@playwright/test";
import type { GameTestHooks } from "../src/client/GameTestHooks.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";

test.use({ channel: "chromium" });

declare global {
  interface Window {
    __carAudio: {
      active: Set<AudioBufferSourceNode>;
      contexts: Set<BaseAudioContext>;
      started: number;
      steps: number;
    };
  }
}
async function instrument(page: Page) {
  await page.addInitScript(() => {
    const state = {
      active: new Set<AudioBufferSourceNode>(),
      contexts: new Set<BaseAudioContext>(),
      started: 0,
      steps: 0,
    };
    window.__carAudio = state;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration?: number) {
      if (this.loop) {
        state.started++;
        state.active.add(this);
        state.contexts.add(this.context);
        this.addEventListener("ended", () => state.active.delete(this), { once: true });
      }
      if (duration === undefined) start.call(this, when, offset);
      else start.call(this, when, offset, duration);
    };
  });
}
// Closing a context releases its sources without waiting for scheduled "ended" events.
const voices = (page: Page) =>
  page.evaluate(
    () => [...window.__carAudio.active].filter((s) => s.context.state !== "closed").length,
  );

test("Worker driving suppresses footsteps, plays a real engine and silences it at lifecycle boundaries", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await instrument(page);
  const generation = createDescriptor("flat", 1);
  await page.goto(
    `/tilefun/?nogamepad&generation=${encodeURIComponent(JSON.stringify(generation))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    for (const e of g.stateView.entities)
      if (e.type !== "player") g.transport.send({ type: "edit-delete-entity", entityId: e.id });
    const p = g.stateView.playerEntity.position;
    g.transport.send({
      type: "edit-spawn",
      entityType: "vehicle-v1:compact-1",
      wx: p.wx + 44,
      wy: p.wy,
    });
    const play = g.audioManager.playOneShot.bind(g.audioManager);
    g.audioManager.playOneShot = (options) => {
      // Footsteps have a family of preloaded surface buffers; ignore other effects.
      if (
        ["grass", "sand", "concrete", "wood", "generic"].some((surface) =>
          Array.from(
            { length: 10 },
            (_, i) => `${surface}_${String(i).padStart(surface === "generic" ? 2 : 3, "0")}`,
          ).some((key) => g.audioManager.getBuffer(key) === options.buffer),
        )
      )
        window.__carAudio.steps++;
      play(options);
    };
  });
  await page.getByRole("button", { name: "Exit editor", exact: true }).click();
  await page.getByRole("button", { name: /^Drive car/ }).click();
  await expect.poll(() => voices(page)).toBe(1);
  const before = await page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    return { x: g.stateView.playerEntity.position.wx, steps: window.__carAudio.steps };
  });
  await page.keyboard.down("d");
  try {
    await expect
      .poll(() =>
        page.evaluate(() => {
          const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks })
            .__game;
          return g.stateView.playerEntity.position.wx;
        }),
      )
      .toBeGreaterThan(before.x + 40);
  } finally {
    await page.keyboard.up("d");
  }
  expect(await page.evaluate(() => window.__carAudio.steps)).toBe(before.steps);
  expect(await page.evaluate(() => window.__carAudio.started)).toBe(1);
  const energy = await page.evaluate(async () => {
    const buffer = [...window.__carAudio.active][0]?.buffer;
    if (!buffer) throw Error("Missing real engine buffer");
    const ctx = new OfflineAudioContext(1, 24000, 24000);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
    return (await ctx.startRendering()).getChannelData(0).reduce((s, v) => s + v * v, 0);
  });
  expect(energy).toBeGreaterThan(100);
  await page.keyboard.press("Escape");
  await expect.poll(() => voices(page)).toBe(0);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(() => voices(page)).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(() => voices(page)).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => voices(page)).toBe(1);
  await page.getByRole("button", { name: /^Get out/ }).click();
  await expect.poll(() => voices(page)).toBe(0);
  await page.keyboard.down("s");
  try {
    await expect
      .poll(() => page.evaluate(() => window.__carAudio.steps))
      .toBeGreaterThan(before.steps);
  } finally {
    await page.keyboard.up("s");
  }
  expect(errors).toEqual([]);
});

test("traffic lab uses the shared engine after gesture unlock and releases audio on pause and teardown", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await instrument(page);
  await page.goto("/tilefun/workshop.html?renderer=gpu&meshes#/tool/traffic");
  await expect(page.getByLabel("World geometry scene")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Enable engine sounds", exact: true }).click();
  expect(await voices(page)).toBe(0); // Standing near NPC traffic does not start a driver voice.
  await page.getByRole("button", { name: /^Drive car/ }).click();
  await expect.poll(() => voices(page)).toBe(1);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(() => voices(page)).toBe(0);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(() => voices(page)).toBe(1);
  await page.getByRole("button", { name: "Mute engine sounds", exact: true }).click();
  await expect.poll(() => voices(page)).toBe(0);
  await page.getByRole("button", { name: "Enable engine sounds", exact: true }).click();
  await expect.poll(() => voices(page)).toBe(1);
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  await expect.poll(() => voices(page)).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(() => [...window.__carAudio.contexts].every((c) => c.state === "closed")),
    )
    .toBe(true);
  await expect.poll(() => page.workers().length).toBe(0);
  expect(errors).toEqual([]);
});
