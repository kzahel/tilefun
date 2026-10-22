import { expect, test } from "@playwright/test";
import { animalSoundCoverage } from "../src/audio/AnimalVoice.js";
import type { GameClient } from "../src/client/GameClient.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import { ANIMAL_BROWSER_ENTRIES } from "../src/workshop/AnimalBrowserData.js";

const coverageCount = (coverage: ReturnType<typeof animalSoundCoverage>) =>
  ANIMAL_BROWSER_ENTRIES.filter((a) => animalSoundCoverage(a.type) === coverage).length;

test.use({ channel: "chromium" });

test("recorded voices decode, render audible samples, audition by keyboard and follow real lab actions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    const state = { buffers: [] as AudioBuffer[], active: new Set<AudioBufferSourceNode>() };
    (window as unknown as { __voiceTest: typeof state }).__voiceTest = state;
    const start = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (when = 0, offset = 0, duration?: number) {
      if (this.buffer) state.buffers.push(this.buffer);
      state.active.add(this);
      this.addEventListener("ended", () => state.active.delete(this), { once: true });
      if (duration === undefined) start.call(this, when, offset);
      else start.call(this, when, offset, duration);
    };
  });
  await page.goto("/tilefun/workshop.html?geometry=nature-behavior-dog#/tool/world-geometry");
  await page.getByLabel("Animal sound coverage", { exact: true }).selectOption("recorded");
  const results = page.getByRole("region", { name: "Animal results" });
  await expect(results.locator("article")).toHaveCount(coverageCount("recorded"));
  const button = results
    .locator('[data-animal="tiger"]')
    .getByRole("button", { name: /Audition .* voice/ });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: /tiger: Roar/i })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Animal recording credits and licenses" }),
  ).toHaveAttribute("href", "/tilefun/assets/audio/animals/CREDITS.txt");
  const energy = await page.evaluate(async () => {
    const buffer = (
      window as unknown as { __voiceTest: { buffers: AudioBuffer[] } }
    ).__voiceTest.buffers.at(-1);
    if (!buffer) throw Error("No recorded voice reached a real Web Audio source");
    const context = new OfflineAudioContext(2, Math.ceil(buffer.duration * 24000), 24000);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const pan = context.createStereoPanner();
    pan.pan.value = 0.75;
    source.connect(pan).connect(context.destination);
    source.start();
    const output = await context.startRendering();
    return [0, 1].map((channel) => output.getChannelData(channel).reduce((s, v) => s + v * v, 0));
  });
  expect(energy[0]).toBeGreaterThan(1);
  expect(energy[1]).toBeGreaterThan((energy[0] ?? 0) * 4);
  await page.getByLabel("Animal sound coverage", { exact: true }).selectOption("synthesized");
  await expect(results.locator("article")).toHaveCount(coverageCount("synthesized"));
  await results
    .locator('[data-animal="robin"]')
    .getByRole("button", { name: /Audition .* voice/ })
    .focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").filter({ hasText: "Robin: Chirp" })).toBeVisible();
  const chirp = await page.evaluate(() => {
    const b = (
      window as unknown as { __voiceTest: { buffers: AudioBuffer[] } }
    ).__voiceTest.buffers.at(-1);
    return b
      ? { duration: b.duration, energy: b.getChannelData(0).reduce((s, v) => s + v * v, 0) }
      : undefined;
  });
  expect(chirp?.duration).toBeCloseTo(0.36, 3);
  expect(chirp?.energy).toBeGreaterThan(1);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __voiceTest: { active: Set<unknown> } }).__voiceTest.active.size,
      ),
    )
    .toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await page.getByLabel("Landscape scene", { exact: true }).selectOption("robins");
  const canvas = page.getByLabel("Natural landscape playground");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Enable creature sounds", exact: true }).click();
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-creature-calls")), { timeout: 15000 })
    .toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { __voiceTest: { active: Set<unknown> } }).__voiceTest.active.size,
      ),
    )
    .toBe(0);
  await page.getByLabel("Animal sound coverage", { exact: true }).selectOption("missing");
  await expect(results.locator("article")).toHaveCount(coverageCount("missing"));
  expect(errors).toEqual([]);
});

test("ordinary Worker game plays placed farm voices and stops them at menu/focus boundaries", async ({
  page,
}) => {
  const generation = createDescriptor("flat", 1),
    arrival = { x: 4, y: 4, generation };
  await page.goto(
    `/tilefun/?nogamepad&renderer=canvas&generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  const canvas = page.locator("#game");
  await expect(canvas).toHaveAttribute("data-ready", "true");
  await page.getByTestId("main-menu-toggle").click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    const p = g.stateView.playerEntity.position;
    g.transport.send({
      type: "edit-spawn",
      entityType: "wildlife-cow-provisional-v1",
      wx: p.wx + 48,
      wy: p.wy,
    });
  });
  await page.getByRole("button", { name: "Exit editor", exact: true }).click();
  const diagnostics = () =>
    page.evaluate(
      () =>
        (
          document.querySelector("#game") as unknown as {
            __game: {
              audioManager: { creatureAudioDiagnostics: { active: number; played: number } };
            };
          }
        ).__game.audioManager.creatureAudioDiagnostics,
    );
  await expect
    .poll(async () => (await diagnostics()).played, { timeout: 30000 })
    .toBeGreaterThan(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  await expect.poll(async () => (await diagnostics()).active).toBe(0);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(async () => (await diagnostics()).active).toBe(0);
});
