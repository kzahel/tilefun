import { expect, test } from "@playwright/test";
import type { GameClient } from "../src/client/GameClient.js";

// Mouse -> palette selection -> world coordinates -> Worker edit -> replica is
// distinct from the exhaustive native TerrainEditor/autotile neighborhood rules.
test("a mouse terrain stroke reaches Worker authority and returns changed terrain", async ({
  page,
}) => {
  await page.goto("/tilefun/");
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.keyboard.press("Tab");
  await page.locator('button[title*="Shlw/Grass"]').click();
  await page.evaluate(() => {
    const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
    const send = g.transport.send.bind(g.transport);
    const strokes: { tx: number; ty: number; before: number }[] = [];
    Object.assign(window, { terrainStrokes: strokes });
    g.transport.send = (message) => {
      if (message.type === "edit-terrain-tile")
        strokes.push({
          tx: message.tx,
          ty: message.ty,
          before: g.stateView.world.getTerrain(message.tx, message.ty),
        });
      send(message);
    };
  });
  const canvas = page.locator("#game");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("No game canvas");
  await canvas.click({ position: { x: box.width * 0.6, y: box.height * 0.6 } });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const g = (document.querySelector("#game") as unknown as { __game: GameClient }).__game;
        const stroke = (
          window as unknown as { terrainStrokes: { tx: number; ty: number; before: number }[] }
        ).terrainStrokes[0];
        return stroke
          ? { before: stroke.before, after: g.stateView.world.getTerrain(stroke.tx, stroke.ty) }
          : undefined;
      }),
    )
    .toEqual({ before: 1, after: 2 });
});
