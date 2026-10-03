import { expect, type Locator, type Page, test } from "@playwright/test";

const base = "/tilefun/workshop.html#/tool/patterns";
const camera = (c: Locator) =>
  c.evaluate((n) => ({
    x: Number(n.dataset.centerX),
    y: Number(n.dataset.centerY),
    zoom: Number(n.dataset.zoom),
  }));
async function stroke(
  page: Page,
  c: Locator,
  a: { x: number; y: number },
  b: { x: number; y: number },
  grid = 16,
) {
  await c.scrollIntoViewIfNeeded();
  const bounds = await c.boundingBox(),
    v = await camera(c);
  if (!bounds) throw new Error("Missing canvas");
  const screen = (p: { x: number; y: number }) => ({
    x: bounds.x + bounds.width / 2 + ((p.x + 0.5) * grid - v.x) * v.zoom,
    y: bounds.y + bounds.height / 2 + ((p.y + 0.5) * grid - v.y) * v.zoom,
  });
  const start = screen(a),
    end = screen(b);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y);
  await page.mouse.up();
}
test("tree drawing previews, validates whole gestures, saves drafts and undoes split ends", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${base}?family=fenced-trees-v1`);
  const c = page.getByTestId("pattern-canvas");
  await expect(c).toHaveAttribute("data-ready", "true");
  await expect(c).toHaveAttribute("data-semantic-cells", "13");
  await page.getByRole("button", { name: "Clear draft", exact: true }).click();
  await expect(c).toHaveAttribute("data-semantic-cells", "0");
  await stroke(page, c, { x: 3, y: 6 }, { x: 15, y: 8 });
  await expect(c).toHaveAttribute("data-semantic-cells", "13");
  const draft = () =>
    page.evaluate(() =>
      JSON.parse(localStorage.getItem("tilefun.pattern-drafts.v1:fenced-trees-v1") ?? "{}"),
    );
  expect((await draft()).cells.every((p: { y: number }) => p.y === 6)).toBe(true);
  await page.getByRole("button", { name: "Erase", exact: true }).click();
  await stroke(page, c, { x: 9, y: 6 }, { x: 9, y: 6 });
  await expect(c).toHaveAttribute("data-semantic-cells", "12");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(c).toHaveAttribute("data-semantic-cells", "13");
  await stroke(page, c, { x: 5, y: 6 }, { x: 5, y: 6 });
  await expect(page.getByRole("alert")).toContainText("2-cell run");
  await expect(c).toHaveAttribute("data-semantic-cells", "13");
  await page.reload();
  await expect(c).toHaveAttribute("data-ready", "true");
  await expect(c).toHaveAttribute("data-semantic-cells", "13");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("fenced-trees-v1.json");
  await c.screenshot({ path: "/tmp/tilefun-pattern-trees.png" });
  expect(errors).toEqual([]);
});
test("rooms draw directly on art, reject invalid doors and keep a stable zoom/pan center", async ({
  page,
}) => {
  await page.goto(base);
  const c = page.getByTestId("pattern-canvas");
  await expect(c).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Clear draft", exact: true }).click();
  await stroke(page, c, { x: 3, y: 3 }, { x: 9, y: 9 }, 32);
  await expect(c).toHaveAttribute("data-semantic-cells", "49");
  await page.getByLabel("Pattern brush").selectOption("+");
  await stroke(page, c, { x: 6, y: 9 }, { x: 6, y: 9 }, 32);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await stroke(page, c, { x: 12, y: 9 }, { x: 12, y: 9 }, 32);
  await expect(page.getByRole("alert")).toContainText("Passage");
  await expect(c).toHaveAttribute("data-semantic-cells", "49");
  const before = await camera(c);
  await c.dispatchEvent("wheel", { deltaY: -60, deltaX: 22 });
  await expect.poll(async () => (await camera(c)).zoom).toBeGreaterThan(before.zoom);
  expect(await camera(c)).toMatchObject({ x: before.x, y: before.y });
  await c.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(async () => (await camera(c)).x).toBeLessThan(before.x);
  await c.dispatchEvent("wheel", { deltaY: 70, shiftKey: true });
  await expect.poll(async () => (await camera(c)).y).toBeGreaterThan(before.y);
  await c.screenshot({ path: "/tmp/tilefun-pattern-rooms.png" });
  const document = {
    version: 1,
    family: "rooms-v1",
    width: 24,
    height: 16,
    cells: [{ x: 5, y: 5, value: "L" }],
  };
  await page.locator('input[type="file"]').setInputFiles({
    name: "room.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(document)),
  });
  await expect(c).toHaveAttribute("data-semantic-cells", "1");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(c).toHaveAttribute("data-semantic-cells", "49");
});
test("pattern kit is discoverable in the inbox with exact preview and next navigation", async ({
  page,
}) => {
  await page.goto("/tilefun/workshop.html#/review/pattern%3Afenced-trees-v1-short?show=all");
  await expect(page.getByRole("heading", { name: "Tree strip · minimum caps" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeEnabled();
  await page.getByLabel("Geometry / routes").check();
  await expect(page.getByRole("button", { name: "Looks right ✓", exact: true })).toBeEnabled();
  await page.getByRole("link", { name: "Draw with this kit →" }).click();
  await expect(page.getByTestId("pattern-canvas")).toHaveAttribute("data-semantic-cells", "4");
  await page.goto("/tilefun/workshop.html#/review/pattern%3Afenced-trees-v1-short?show=all");
  await page.getByRole("button", { name: /Next/ }).click();
  await expect(page).toHaveURL(/fenced-trees-v1-repeat/);
});
test("game row brush uses the same compiler, exposes host history and restores a saved row", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const generation = { type: "flat", version: "flat-v1", seed: 2026, preset: "grass" };
  await page.goto(`/tilefun/?generation=${encodeURIComponent(JSON.stringify(generation))}`);
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.getByRole("button", { name: "New World", exact: true })).toBeHidden();
  await page.locator("#game").click({ position: { x: 500, y: 150 } });
  await page.keyboard.press("Tab");
  await page.getByRole("button", { name: "Patterns", exact: false }).click();
  const coordinates = await page.evaluate(() => {
    const g = (
      document.querySelector("#game") as unknown as {
        __game: import("../src/client/GameClient.js").GameClient;
      }
    ).__game;
    g.camera.snapTo(80, 100);
    g.camera.zoom = 1;
    return { a: g.camera.worldToScreen(8, 104), b: g.camera.worldToScreen(168, 104) };
  });
  const box = await page.locator("#game").boundingBox();
  if (!box) throw new Error("Missing game");
  await page.mouse.move(box.x + coordinates.a.sx, box.y + coordinates.a.sy);
  await page.mouse.down();
  await page.mouse.move(box.x + coordinates.b.sx, box.y + coordinates.b.sy);
  await page.mouse.up();
  const rows = () =>
    page.evaluate(() =>
      (
        document.querySelector("#game") as unknown as {
          __game: import("../src/client/GameClient.js").GameClient;
        }
      ).__game.stateView.props.filter((p) => p.type.startsWith("pattern:")),
    );
  await expect.poll(async () => (await rows()).length).toBe(1);
  expect((await rows())[0]?.type).toBe("pattern:fenced-trees-v1:11");
  await page.getByRole("button", { name: "Undo row stroke", exact: true }).click();
  await expect.poll(async () => (await rows()).length).toBe(0);
  await page.getByRole("button", { name: "Redo row stroke", exact: true }).click();
  await expect.poll(async () => (await rows()).length).toBe(1);
  await page.evaluate(() =>
    (
      document.querySelector("#game") as unknown as {
        __game: import("../src/client/GameClient.js").GameClient;
      }
    ).__game.transport.send({ type: "flush" }),
  );
  await page.reload();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true");
  const resume = page.getByRole("button", { name: "Resume", exact: true });
  if (await resume.isVisible()) await resume.click();
  await expect.poll(async () => (await rows()).length).toBe(1);
  expect(errors).toEqual([]);
});

test("phone studio initially fits its full grid and Shift dragging pans past the edges", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(base);
  const c = page.getByTestId("pattern-canvas");
  await expect(c).toHaveAttribute("data-ready", "true");
  const b = await c.boundingBox(),
    v = await camera(c);
  if (!b) throw new Error("Missing canvas");
  expect(v.zoom * 24 * 32).toBeLessThan(b.width);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await c.scrollIntoViewIfNeeded();
  const box = await c.boundingBox();
  if (!box) throw new Error("Missing canvas");
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 220, box.y + box.height / 2 + 100);
  await page.mouse.up();
  await page.keyboard.up("Shift");
  expect((await camera(c)).x).toBeLessThan(0);
  await page.screenshot({ path: "/tmp/tilefun-pattern-phone.png", fullPage: true });
});
