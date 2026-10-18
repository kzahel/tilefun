import { expect, test } from "@playwright/test";
import type { RemoteStateView } from "../src/client/ClientStateView.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";
import type { RequestMessage } from "../src/shared/requests.js";

type Game = {
  remoteView: RemoteStateView;
  stateView: { editorEnabled: boolean };
  audioManager: {
    trains: {
      voices: Map<number, { rolling: { source: AudioBufferSourceNode }; whistle: unknown }>;
    } | null;
  };
  nextRequestId: number;
  gcSendRequest(request: RequestMessage): Promise<unknown>;
};

test("moving trains produce real stereo audio and silence on menu/focus/scene exit", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const generation = createDescriptor("regional", 2026);
  await page.goto(
    `/tilefun/?nogamepad&renderer=canvas&generation=${encodeURIComponent(JSON.stringify(generation))}`,
  );
  await page.getByPlaceholder("World name...").fill("Train sounds");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.getByTestId("world-menu")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
        return g?.remoteView.serverEntities.filter((e) => e.type.startsWith("train-curve-proof-v1"))
          .length;
      }),
    )
    .toBe(3);
  if (
    await page.evaluate(
      () =>
        (document.querySelector("#game") as unknown as { __game: Game }).__game.stateView
          .editorEnabled,
    )
  )
    await page.keyboard.press("Tab");
  await page.evaluate(async () => {
    const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
    const train = g.remoteView.serverEntities.find((e) => e.type === "train-curve-proof-v1");
    if (!train) throw new Error("Missing train");
    await g.gcSendRequest({
      type: "rcon",
      requestId: g.nextRequestId++,
      command: `tp ${train.position.wx} ${train.position.wy + 60}`,
    });
  });
  const voices = () =>
    page.evaluate(() => {
      const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
      return g.audioManager.trains?.voices.size ?? 0;
    });
  await expect.poll(voices, { timeout: 15000 }).toBe(1);
  // Render the actual runtime chug buffer through Chromium's audio graph.
  const energy = await page.evaluate(async () => {
    const g = (document.querySelector("#game") as unknown as { __game: Game }).__game;
    const voice = g.audioManager.trains?.voices.values().next().value;
    if (!voice?.rolling.source.buffer || !voice.whistle)
      throw new Error("Missing rolling/whistle voices");
    const ctx = new OfflineAudioContext(2, 24000, 24000);
    const source = ctx.createBufferSource();
    source.buffer = voice.rolling.source.buffer;
    const pan = ctx.createStereoPanner();
    pan.pan.value = 0.75;
    source.connect(pan).connect(ctx.destination);
    source.start();
    const rendered = await ctx.startRendering();
    return [0, 1].map((channel) =>
      rendered.getChannelData(channel).reduce((sum, sample) => sum + sample * sample, 0),
    );
  });
  expect(energy[0]).toBeGreaterThan(0);
  expect(energy[1]).toBeGreaterThan((energy[0] ?? 0) * 4);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Resume", exact: true })).toBeVisible();
  await expect.poll(voices).toBe(0);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(voices).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect.poll(voices).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(voices).toBe(1);
  await page.keyboard.press("Tab");
  await expect.poll(voices).toBe(0);
  expect(errors).toEqual([]);
});
