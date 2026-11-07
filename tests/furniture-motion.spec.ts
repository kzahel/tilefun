import { expect, type Locator, test } from "@playwright/test";
import { FurnitureMotion, MOTION_SCENES } from "../src/interiors/FurnitureMotion.js";
import { motionSceneSignature } from "../src/interiors/MotionReview.js";

// Shared physics rests the player within its allowed contact error, so a
// supported height differs from the surface by a small fraction of a pixel.
const expectHeight = (room: Locator, z: number) =>
  expect.poll(async () => Number(await room.getAttribute("data-player-z"))).toBeCloseTo(z, 2);

test("shared movement stops at furniture, supports precise placement, and saves a reproducible report", async ({
  page,
}) => {
  const posts: Record<string, unknown>[] = [];
  let offline = true;
  await page.route("**/api/interior-review", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: [] });
      return;
    }
    posts.push(route.request().postDataJSON());
    await route.fulfill({ status: offline ? 503 : 200, json: { saved: !offline } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/furniture-playtest.html?renderer=legacy-canvas&scene=wardrobe");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  const canvas = page.locator("#room");
  await canvas.focus();
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(900);
  await page.keyboard.up("ArrowUp");
  const y = Number(await canvas.getAttribute("data-player-y"));
  expect(y).toBeGreaterThanOrEqual(94);
  expect(y).toBeLessThan(95);
  await page.locator("#mode").selectOption("place");
  await page.getByRole("button", { name: "Move object right one pixel", exact: true }).click();
  await expect(page.locator("#x")).toHaveValue("81");
  await page.locator("#x").fill("22");
  await page.locator("#apply").click();
  await expect(page.locator("#status")).toHaveText("Placement updated.");
  await page.locator("#bounds").check();
  await page.locator("#depth").check();
  await page.locator("#note").fill("Testing collision context");
  await page.locator("#report").click();
  await expect(page.locator("#sync")).toContainText("pending");
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]?.caseId).toBe("furniture-motion-wardrobe");
  expect(posts[0]?.playtest).toMatchObject({ selected: "wardrobe", mode: "place" });
  expect(posts[0]?.furniture).toEqual([{ id: "wardrobe", asset: "wardrobe", x: 22, y: 88 }]);
  expect(posts[0]?.screenshot).toMatch(/^data:image\/png;base64,/);
  offline = false;
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#sync")).toHaveText("Reports saved");
  await expect(page.locator("#x")).toHaveValue("22");
  expect(posts.at(-1)?.id).toBe(posts[0]?.id);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test.describe("automatic walk and phone layout representatives", () => {
  test.describe.configure({ mode: "parallel" });
  // Exhaustive preset route/collider checks live in FurnitureMotion.test.
  for (const scene of MOTION_SCENES.filter((scene) => ["wardrobe", "worktable"].includes(scene.id)))
    test(scene.name, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/api/interior-review", (r) => r.fulfill({ json: [] }));
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/tilefun/furniture-playtest.html?renderer=legacy-canvas&scene=${scene.id}`);
      await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
      await page.locator("#circle").click();
      await expect(page.locator("#status")).toContainText("Walk complete", { timeout: 20000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
        false,
      );
      expect(errors).toEqual([]);
    });
});

test("direction controls release and dragging selects actual sprite pixels", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/furniture-playtest.html?renderer=legacy-canvas&scene=worktable");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  const right = page.getByRole("button", { name: "Walk right", exact: true });
  await right.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const b = await right.boundingBox();
  if (!b) throw new Error("Missing control");
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(200);
  await page.mouse.up();
  // Wait until the released walk settles; a held control would instead walk
  // on to the far wall.
  let x = Number.NaN;
  await expect
    .poll(
      async () => {
        const previous = x;
        x = Number(await page.locator("#room").getAttribute("data-player-x"));
        return Math.abs(x - previous) < 0.001;
      },
      { intervals: [100] },
    )
    .toBe(true);
  expect(x).toBeGreaterThan(85);
  expect(x).toBeLessThan(120);
  await page.waitForTimeout(200);
  expect(Number(await page.locator("#room").getAttribute("data-player-x"))).toBeCloseTo(x, 2);
  await page.locator("#mode").selectOption("place");
  const canvas = page.locator("#room");
  await canvas.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Missing canvas");
  const scale = box.width / 160;
  // Table's opaque top, at native (80,57), not its transparent padded image edge.
  await page.mouse.move(box.x + 80 * scale, box.y + 57 * scale);
  await page.mouse.down();
  await page.mouse.move(box.x + 82 * scale, box.y + 57 * scale);
  await page.mouse.up();
  await expect(page.locator("#x")).toHaveValue("82");
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#x")).toHaveValue("82");
});

test("jumps onto tall furniture, records good verdicts, and reopens changed physics", async ({
  page,
}) => {
  const posts: Record<string, unknown>[] = [];
  await page.route("**/api/interior-review", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: posts });
      return;
    }
    posts.push(route.request().postDataJSON());
    await route.fulfill({ json: { saved: true } });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/furniture-playtest.html?renderer=legacy-canvas&scene=wardrobe");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  const canvas = page.locator("#room");
  await page.locator("#gravity").selectOption("0.25");
  await canvas.focus();
  await page.keyboard.down("ArrowUp");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowUp");
  await page.keyboard.down("Space");
  await expect
    .poll(async () => Number(await canvas.getAttribute("data-player-z")))
    .toBeGreaterThan(34);
  await page.keyboard.down("ArrowUp");
  await page.waitForFunction(() => Number(document.getElementById("room")?.dataset.playerY) < 86);
  await page.keyboard.up("ArrowUp");
  await expect(canvas).toHaveAttribute("data-airborne", "false");
  await page.keyboard.up("Space");
  await expectHeight(canvas, 32);
  await expect(page.locator("#position")).toContainText("On object");
  await page.locator("#good").click();
  await expect(page.locator("#scene")).not.toHaveValue("wardrobe");
  await page.locator("#scene").selectOption("wardrobe");
  await expect(page.locator("#grade")).toContainText("✓ Looks good");
  await expect.poll(() => posts[0]?.verdict).toBe("good");
  expect(posts[0]?.playtest).toMatchObject({
    playerZ: 32,
    groundZ: 32,
    gravityScale: 0.25,
    bodies: { wardrobe: { height: 32, walkableTop: true } },
  });
  await page.reload();
  await expect(page.locator("#grade")).toContainText("✓ Looks good");
  await expect(page.locator("#gravity")).toHaveValue("0.25");
  await page.locator("#physics-controls summary").click();
  await page.locator("#height").fill("40");
  await page.locator("#apply-height").click();
  await expect(page.locator("#status")).toHaveText("Collision height updated.");
  await expect(page.locator("#grade")).toContainText("Unchecked");
  await page.locator("#good").click();
  await expect(page.locator("#scene")).not.toHaveValue("wardrobe");
  await page.locator("#scene").selectOption("wardrobe");
  await expect(page.locator("#grade")).toContainText("✓ Looks good");
  await expect
    .poll(() => posts.at(-1)?.playtest)
    .toMatchObject({
      bodies: { wardrobe: { height: 40, walkableTop: true } },
    });
  await page.locator("#gravity").selectOption("1");
  await expect(page.locator("#grade")).toContainText("Unchecked");
  await page.locator("#depth").check();
  await expect(page.locator("#depth-help")).toContainText("not object height");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

test("phone jump control releases on cancellation and high jumps stay in view", async ({
  page,
}) => {
  await page.goto("/tilefun/furniture-playtest.html?renderer=legacy-canvas&scene=wardrobe");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await page.locator("#gravity").selectOption("0.1");
  const jump = page.locator("#jump");
  await jump.evaluate((el) => el.scrollIntoView({ block: "center" }));
  const b = await jump.boundingBox();
  if (!b) throw new Error("Missing jump control");
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await expect
    .poll(async () => Number(await page.locator("#room").getAttribute("data-view-offset-y")))
    .toBeGreaterThan(0);
  await jump.dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  await expect(page.locator("#room")).toHaveAttribute("data-airborne", "false", { timeout: 8000 });
  await expectHeight(page.locator("#room"), 0);
  await expect(page.locator("#room")).toHaveAttribute("data-view-offset-y", "0");
});

test("approval advances past checked sets offline and finishes the new batch without looping", async ({
  page,
}) => {
  const approved = MOTION_SCENES.slice(0, 3).map((s) => {
    const m = new FurnitureMotion(s.furniture);
    return {
      id: s.id,
      sceneSignature: motionSceneSignature(m.furniture, m.bodies, m.gravityScale),
    };
  });
  const records = approved.map((r) => {
    const config = JSON.parse(r.sceneSignature);
    const furniture = JSON.parse(config.furniture).placements;
    return {
      id: `approved-${r.id}`,
      caseId: `furniture-motion-${r.id}`,
      name: r.id,
      fingerprint: "a".repeat(64),
      verdict: "good",
      note: "",
      sketch: config.sketch,
      createdAt: "2026-09-29T15:30:00Z",
      furniture,
      furnitureCatalogVersion: 1,
      playtest: {
        playerX: 80,
        playerY: 120,
        facing: 0,
        selected: furniture[0].id,
        mode: "walk",
        sceneSignature: r.sceneSignature,
      },
    };
  });
  const posts: Record<string, unknown>[] = [];
  let offline = true;
  await page.route("**/api/interior-review", async (r) => {
    if (r.request().method() === "GET") {
      await r.fulfill({ json: records });
      return;
    }
    posts.push(r.request().postDataJSON());
    await r.fulfill({ status: offline ? 503 : 200, json: { saved: !offline } });
  });
  await page.goto("/tilefun/furniture-playtest.html?renderer=legacy-canvas&scene=next");
  await expect(page.locator("#scene")).toHaveValue("bedside");
  await expect(page.locator("#review-counts")).toHaveText("8 unchecked · 3 approved · 0 reported");
  await page.locator("#good").click();
  await expect(page.locator("#scene")).toHaveValue("dresser");
  await expect(page.locator("#sync")).toContainText("pending");
  await expect.poll(() => posts.length).toBe(1);
  expect(posts[0]?.caseId).toBe("furniture-motion-bedside");
  const id = posts[0]?.id;
  offline = false;
  await page.reload();
  await expect(page.locator("#sync")).toHaveText("Reports saved");
  expect(posts.at(-1)?.id).toBe(id);
  for (const scene of [
    "dresser",
    "tree",
    "floor-lamp",
    "hearth",
    "rug-stool",
    "wall-display",
    "seating-corner",
  ]) {
    await expect(page.locator("#scene")).toHaveValue(scene);
    await page.locator("#good").click();
    await expect(page.locator("#scene")).not.toHaveValue(
      scene === "seating-corner" ? "bunk" : scene,
    );
  }
  await expect(page.locator("#status")).toContainText("All sets approved");
  await expect(page.locator("#review-counts")).toHaveText("0 unchecked · 11 approved · 0 reported");
  await expect(page.locator("#next-unchecked")).toBeDisabled();
  await page.locator("#scene").selectOption("rug-stool");
  await page.locator("#object").selectOption("rug");
  await expect(page.locator("#physics-controls")).toBeHidden();
  await expect(page.locator("#dimensions")).toContainText("Nonblocking");
  await page.locator("#scene").selectOption("wall-display");
  await page.locator("#object").selectOption("picture");
  await expect(page.locator("#physics-controls")).toBeHidden();
  await expect(page.locator("#circle")).toBeDisabled();
});

test("the full player sprite remains visible at the back of the bed after landing", async ({
  page,
}, testInfo) => {
  await page.route("**/api/interior-review", (r) => r.fulfill({ json: [] }));
  await page.goto("/tilefun/furniture-playtest.html?renderer=legacy-canvas&scene=bedside");
  const canvas = page.locator("#room");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await page.locator("#collisions").uncheck();
  const scene = MOTION_SCENES.find((s) => s.id === "bedside");
  const bed = new FurnitureMotion(scene?.furniture ?? [])
    .collisionBoxes()
    .find((b) => b.id === "bed");
  if (!bed) throw new Error("Missing bed");
  const { left, right, top, bottom } = bed.bounds;
  const player = () =>
    canvas.evaluate((el) => {
      const d = (el as HTMLCanvasElement).dataset;
      return {
        x: Number(d.playerX),
        y: Number(d.playerY),
        z: Number(d.playerZ),
        depth: Number(d.playerDepth),
        airborne: d.airborne === "true",
      };
    });
  // Keys are released on observed positions, then the player is left to come to rest.
  const settled = async () => {
    let previous = await player();
    await expect
      .poll(
        async () => {
          const next = await player();
          const still =
            !next.airborne && Math.abs(next.x - previous.x) + Math.abs(next.y - previous.y) < 0.001;
          previous = next;
          return still;
        },
        { intervals: [100] },
      )
      .toBe(true);
    return previous;
  };
  const holdUntil = async (keys: string[], attribute: string, below: number) => {
    for (const key of keys) await page.keyboard.down(key);
    await page.waitForFunction(
      ([attribute, below]) =>
        Number(document.getElementById("room")?.getAttribute(String(attribute))) < Number(below),
      [attribute, below] as const,
    );
    for (const key of keys) await page.keyboard.up(key);
  };
  await canvas.focus();
  // Stand in front of the bed's middle, then jump over its front edge to the back half.
  await holdUntil(["ArrowLeft"], "data-player-x", (left + right) / 2);
  await holdUntil(["ArrowUp"], "data-player-y", bottom + 10);
  const front = await settled();
  expect(front.x).toBeGreaterThan(left + 4);
  expect(front.x).toBeLessThan(right - 4);
  expect(front.y).toBeGreaterThan(bottom);
  await page.keyboard.down("Space");
  await expect.poll(async () => (await player()).z).toBeGreaterThan(bed.height + 1);
  await holdUntil(["ArrowUp"], "data-player-y", top + 6);
  await page.keyboard.up("Space");
  const landed = await settled();
  expect(landed.x).toBeGreaterThan(left);
  expect(landed.x).toBeLessThan(right);
  expect(landed.y).toBeGreaterThan(top);
  expect(landed.y).toBeLessThan((top + bottom) / 2);
  await expectHeight(canvas, bed.height);
  // Feet plus height sort behind the bed's front; support lifts the player above it.
  expect(landed.depth).toBeGreaterThan(bottom);
  // Actors draw at fractional positions with smoothing, so compare against the
  // idle, facing-up frame smoothed at the same offset. Pixels the smoothed frame
  // covers fully must show the sprite; the bed drawn over it fails most of them.
  const visible = () =>
    canvas.evaluate(async (el) => {
      const c = el as HTMLCanvasElement;
      const sx = Number(c.dataset.playerX) - 8;
      const sy =
        Number(c.dataset.playerY) - Number(c.dataset.playerZ) - 16 + Number(c.dataset.viewOffsetY);
      const x = Math.floor(sx),
        y = Math.floor(sy);
      const source = new Image();
      source.src = "/tilefun/assets/sprites/player.png";
      await source.decode();
      const expected = document.createElement("canvas");
      expected.width = 18;
      expected.height = 18;
      const ctx = expected.getContext("2d");
      if (!ctx) throw new Error("Missing context");
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(source, 0, 16, 16, 16, sx - x, sy - y, 16, 16);
      const reference = ctx.getImageData(0, 0, 18, 18).data;
      const actual = c.getContext("2d")?.getImageData(x, y, 18, 18).data;
      if (!actual) throw new Error("Missing pixels");
      let covered = 0,
        matching = 0;
      for (let i = 0; i < reference.length; i += 4)
        if (reference[i + 3] === 255) {
          covered++;
          const distance = Math.max(
            ...[0, 1, 2].map((k) => Math.abs((reference[i + k] ?? 0) - (actual[i + k] ?? 0))),
          );
          if (distance <= 32) matching++;
        }
      return covered > 100 ? matching / covered : 0;
    });
  await expect.poll(visible).toBeGreaterThan(0.95);
  await canvas.screenshot({ path: testInfo.outputPath("standing-on-bed.png") });
});

test("replacing the initial furniture Worker does not abort review startup", async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    let first = true;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (first) {
          first = false;
          // Hold the initial ready response until a setting replaces this host.
          this.addEventListener("message", (event) => event.stopImmediatePropagation(), true);
        }
      }
    };
  });
  await page.goto("/tilefun/furniture-playtest.html?renderer=legacy-canvas&scene=wardrobe");
  await expect(page.locator("#height")).toHaveValue("32");
  await expect(page.locator('#app[data-ready="true"]')).toHaveCount(0);
  await page.locator("#physics-controls summary").click();
  await page.locator("#height").fill("40");
  await page.locator("#apply-height").click();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#sync")).toHaveText("Reports saved");
  await expect(page.locator("#status")).toHaveText("Collision height updated.");
  await expect(page.locator("#good")).toBeEnabled();
});
