import { expect, type Page, test } from "@playwright/test";
import { DistrictSource } from "../src/generation/regional/DistrictStrategy.js";
import { regionalWorld } from "../src/generation/regional/WorldDescriptor.js";

const source = new DistrictSource(regionalWorld(2026));
const lot = source
  .owner(0, 0)
  ?.blocks.flatMap((b) => b.lots)
  .find((l) => l.buildingType.startsWith("prop-regional-apartment-"));
if (!lot) throw new Error("Missing apartment checkpoint");
const generation = {
  type: "regional",
  version: "regional-v3",
  seed: 2026,
  preset: "temperate-v1",
} as const;
const arrival = { x: lot.entrance.x, y: lot.entrance.y, generation };
async function state(page: Page) {
  return page.evaluate(() => {
    const game = (
      document.querySelector("#game") as unknown as {
        __game: import("../src/client/GameClient.js").GameClient;
      }
    ).__game;
    return {
      room: game.stateView.roomState,
      error: game.editorModel.patternError,
      props: game.stateView.props,
      player: game.stateView.playerEntity.position,
    };
  });
}
async function draw(page: Page, from: [number, number], to = from) {
  const coordinates = await page.evaluate(
    ({ from, to }) => {
      const game = (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameClient.js").GameClient;
        }
      ).__game;
      return {
        a: game.camera.worldToScreen(from[0] * 32 + 8, from[1] * 32 + 8),
        b: game.camera.worldToScreen(to[0] * 32 + 8, to[1] * 32 + 8),
      };
    },
    { from, to },
  );
  const box = await page.locator("#game").boundingBox();
  if (!box) throw new Error("Missing game canvas");
  await page.mouse.move(box.x + coordinates.a.sx, box.y + coordinates.a.sy);
  await page.mouse.down();
  await page.mouse.move(box.x + coordinates.b.sx, box.y + coordinates.b.sy, { steps: 6 });
  await page.mouse.up();
}
async function enter(page: Page) {
  await page.getByRole("button", { name: /Enter apartment/ }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-interior", /interior-v1/);
  await expect.poll(async () => (await state(page)).room?.revision).toBeDefined();
}

test("draws a connected gameplay room with real walls, validates, undoes, walks and restores it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(
    `/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}&arrival=${encodeURIComponent(JSON.stringify(arrival))}`,
  );
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await enter(page);
  await page.locator("#game").click({ position: { x: 700, y: 100 } });
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Rooms", exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Road", exact: false })).toBeHidden();
  await page.evaluate(() => {
    const g = (
      document.querySelector("#game") as unknown as {
        __game: import("../src/client/GameClient.js").GameClient;
      }
    ).__game;
    g.camera.snapTo(176, 100);
    g.camera.zoom = 0.6;
  });
  const initial = (await state(page)).room;
  await page.getByRole("button", { name: "Room rectangle", exact: true }).click();
  await draw(page, [4, 0], [10, 4]);
  await expect.poll(async () => (await state(page)).error).toBe("");
  await expect.poll(async () => (await state(page)).room?.revision).toBe(1);
  await page.getByRole("button", { name: "Door", exact: true }).click();
  await draw(page, [4, 3]);
  await expect.poll(async () => (await state(page)).room?.revision).toBe(2);
  expect((await state(page)).room?.document.cells.find((c) => c.x === 4 && c.y === 3)?.value).toBe(
    "+",
  );
  await page.screenshot({ path: "/tmp/tilefun-editable-gameplay-room.png" });
  await page.getByRole("button", { name: "Undo room stroke", exact: true }).click();
  await expect.poll(async () => (await state(page)).room?.revision).toBe(3);
  await page.keyboard.press("ControlOrMeta+z");
  await expect.poll(async () => (await state(page)).room?.document).toEqual(initial?.document);
  await page.getByRole("button", { name: "Redo room stroke", exact: true }).click();
  await expect.poll(async () => (await state(page)).room?.revision).toBe(5);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect.poll(async () => (await state(page)).room?.revision).toBe(6);
  // Furniture lives in the edited floor, through the actual indoor palette.
  const furnitureCount = async () =>
    (await state(page)).props.filter((p) => p.type.startsWith("prop-interior-furniture:")).length;
  await page.getByRole("button", { name: "Props", exact: false }).click();
  await page.getByRole("button", { name: "stool", exact: true }).click();
  await draw(page, [6, 2]);
  await expect.poll(furnitureCount).toBe(4);
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await draw(page, [6, 2]);
  await expect.poll(furnitureCount).toBe(3);
  await page.getByRole("button", { name: "stool", exact: true }).click();
  await draw(page, [6, 2]);
  await expect.poll(furnitureCount).toBe(4);
  await page.getByRole("button", { name: "Rooms", exact: false }).click();
  // Invalid erasure cannot remove the street doorway or enter history.
  await draw(page, [2, 4]); // selected Door, same protected door = no-op
  await page.getByRole("button", { name: "Paint / erase", exact: true }).click();
  await draw(page, [2, 4]);
  await expect.poll(async () => (await state(page)).error).toMatch(/doorway/);
  expect((await state(page)).room?.revision).toBe(6);
  await draw(page, [1, 2]);
  await expect.poll(async () => (await state(page)).error).toMatch(/Furniture/);
  expect((await state(page)).room?.revision).toBe(6);
  const saved = (await state(page)).room;
  const walls = (await state(page)).props.find((p) => p.type === "prop-interior-wall")?.walls;
  expect(walls?.length).toBeGreaterThan(8);
  await page.evaluate(() => {
    const game = (
      document.querySelector("#game") as unknown as {
        __game: import("../src/client/GameClient.js").GameClient;
      }
    ).__game;
    game.transport.send({ type: "flush" });
  });
  await page.keyboard.press("Tab");
  // Walk through the actual new vertical doorway, then into the extension.
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => (await state(page)).player.wx).toBeGreaterThan(180);
  await page.keyboard.up("ArrowRight");
  await page.screenshot({ path: "/tmp/tilefun-edited-room-walking.png" });
  await page.reload();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  const resume = page.getByRole("button", { name: "Resume", exact: true });
  await resume.click();
  await enter(page);
  await expect.poll(async () => (await state(page)).room).toEqual(saved);
  await expect
    .poll(async () => (await state(page)).props.find((p) => p.type === "prop-interior-wall")?.walls)
    .toEqual(walls);
  await expect.poll(furnitureCount).toBe(4);
  await page.getByRole("button", { name: "Return to street" }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-interior", "");
  expect(errors).toEqual([]);
});
