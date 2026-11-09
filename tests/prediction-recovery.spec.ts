import { expect, test } from "@playwright/test";
import type { RemoteStateView } from "../src/client/ClientStateView.js";
import type { GameTestHooks } from "../src/client/GameTestHooks.js";
import { createDescriptor } from "../src/generation/GenerationDescriptor.js";

test(`input sequence and authority recovery survive repeated edit/play replacement`, async ({
  page,
}) => {
  await page.goto(
    `/tilefun/?perf&nogamepad&generation=${encodeURIComponent(JSON.stringify(createDescriptor("flat", 2026)))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.getByTestId("world-menu")).toBeHidden();
  await expect(page.locator("#game")).toHaveAttribute("data-generator", "flat");
  await page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
    const seqs: number[] = [];
    const send = g.transport.send.bind(g.transport);
    g.transport.send = (message) => {
      if (message.type === "player-input") seqs.push(message.seq);
      send(message);
    };
    Object.assign(window, { __submittedInputSequences: seqs });
  });
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Tab");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game
              .stateView.editorEnabled,
        ),
      )
      .toBe(true);
    if (i === 0) {
      // Random solid chickens can block this flat-world movement fixture.
      await page.evaluate(() => {
        const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game;
        for (const entity of g.stateView.entities)
          if (entity.type === "chicken")
            g.transport.send({ type: "edit-delete-entity", entityId: entity.id });
      });
      await expect
        .poll(() =>
          page.evaluate(() => {
            const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks })
              .__game;
            return g.stateView.entities.some((e) => e.type === "chicken");
          }),
        )
        .toBe(false);
    }
    await page.waitForTimeout(150);
    await page.keyboard.press("Tab");
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game
              .stateView.editorEnabled,
        ),
      )
      .toBe(false);
    const before = await page.evaluate(
      () =>
        (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game.stateView
          .playerEntity.position.wx,
    );
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(250);
    await page.keyboard.up("ArrowRight");
    await expect
      .poll(() =>
        page.evaluate(() => {
          const g = (document.querySelector("#game") as unknown as { __game: GameTestHooks })
            .__game;
          const view = g.stateView as RemoteStateView;
          return Math.abs(view.playerEntity.position.wx - view.serverPlayerEntity.position.wx);
        }),
      )
      .toBeLessThan(4);
    const after = await page.evaluate(
      () =>
        (document.querySelector("#game") as unknown as { __game: GameTestHooks }).__game.stateView
          .playerEntity.position.wx,
    );
    expect(after).toBeGreaterThan(before + 4);
  }
  const sequences = await page.evaluate(
    () => (window as unknown as { __submittedInputSequences: number[] }).__submittedInputSequences,
  );
  expect(sequences.length).toBeGreaterThan(20);
  expect(sequences.every((seq, i) => i === 0 || seq > (sequences[i - 1] ?? 0))).toBe(true);
});

test.use({ channel: "chromium" });
