import fs from "node:fs";
import { expect, test } from "@playwright/test";

const URL = "/tilefun/interior-review.html";
const API = "/tilefun/api/interior-review";
const STORAGE = "tilefun.indoor-review.v1";

for (const caseId of ["review-4-5c040f50", "review-4-2a17bbc0"]) {
  test(`vertical rail meets a small framed top square at junction ${caseId}`, async ({ page }) => {
    await page.route(`**${API}`, (route) => route.fulfill({ json: [] }));
    await page.addInitScript(
      ({ key, id }) =>
        localStorage.setItem(
          key,
          JSON.stringify({
            current: id,
            stage: "all",
            records: [],
            outbox: [],
            batch: [],
            paused: false,
            draft: "",
          }),
        ),
      { key: STORAGE, id: caseId },
    );
    await page.goto(URL);
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    await expect(page.locator("#case-id")).toHaveText(caseId);
    const rail = await page.locator("#render").evaluate((element) => {
      const ctx = (element as HTMLCanvasElement).getContext("2d");
      if (!ctx) throw new Error("Missing review canvas");
      return Array.from({ length: 40 }, (_, y) => ctx.getImageData(114, 94 + y, 1, 1).data[0]);
    });
    // Only the square's top/bottom outline interrupts the white vertical rail.
    expect(
      rail.every((value, i) =>
        i === 2 || i === 7 ? value === 58 : value !== undefined && value > 240,
      ),
    ).toBe(true);
    const square = await page.locator("#render").evaluate((element) => {
      const ctx = (element as HTMLCanvasElement).getContext("2d");
      if (!ctx) throw new Error("Missing review canvas");
      return Array.from(ctx.getImageData(112, 96, 7, 6).data);
    });
    for (let y = 0; y < 6; y++)
      for (let x = 0; x < 7; x++) {
        const i = (y * 7 + x) * 4;
        expect(square.slice(i, i + 4)).toEqual(
          x === 0 || x === 6 || y === 0 || y === 5 ? [58, 58, 80, 255] : [248, 248, 248, 255],
        );
      }
  });
}

test("upper vertical divider connects to the back wall and has a closed end", async ({ page }) => {
  await page.route(`**${API}`, (route) => route.fulfill({ json: [] }));
  await page.addInitScript(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          current: "review-2-142cab28",
          stage: "all",
          records: [],
          outbox: [],
          batch: [],
          paused: false,
          draft: "",
        }),
      ),
    STORAGE,
  );
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#case-id")).toHaveText("review-2-142cab28");
  const pixels = await page.locator("#render").evaluate((element) => {
    const ctx = (element as HTMLCanvasElement).getContext("2d");
    if (!ctx) throw new Error("Missing review canvas");
    return {
      end: Array.from({ length: 32 }, (_, y) =>
        Array.from(ctx.getImageData(112, 64 + y, 1, 1).data),
      ),
      top: Array.from({ length: 40 }, (_, y) => ctx.getImageData(114, 6 + y, 1, 1).data[0]),
      dividerCorner: Array.from(ctx.getImageData(112, 0, 16, 48).data),
      exteriorCorner: Array.from(ctx.getImageData(0, 0, 16, 48).data),
    };
  });
  expect(pixels.end).toEqual(Array.from({ length: 32 }, () => [58, 58, 80, 255]));
  expect(pixels.top.every((value) => value !== undefined && value > 240)).toBe(true);
  // Their shaded faces must meet the same back-wall baseline.
  expect(pixels.dividerCorner).toEqual(pixels.exteriorCorner);
});

test("south doorway trim has the same clean edges as the north doorway", async ({ page }) => {
  await page.route(`**${API}`, (route) => route.fulfill({ json: [] }));
  await page.addInitScript((key) => {
    localStorage.setItem(
      key,
      JSON.stringify({
        current: "review-1-602a5d6b",
        stage: "all",
        records: [],
        outbox: [],
        batch: [],
        paused: false,
        draft: "",
      }),
    );
  }, STORAGE);
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#case-id")).toHaveText("review-1-602a5d6b");
  const caps = await page.locator("#render").evaluate((element) => {
    const context = (element as HTMLCanvasElement).getContext("2d");
    if (!context) throw new Error("Missing review canvas");
    return [31, 48].flatMap((x) =>
      [129, 130, 131, 132].map((y) => Array.from(context.getImageData(x, y, 1, 1).data)),
    );
  });
  // A repeated middle strip has white pixels here. A capped rail closes its
  // entire four-pixel face with the atlas family's dark outline instead.
  expect(caps).toEqual(Array.from({ length: 8 }, () => [58, 58, 80, 255]));
  const south = await page.locator("#render").evaluate((element) => {
    const ctx = (element as HTMLCanvasElement).getContext("2d");
    if (!ctx) throw new Error("Missing review canvas");
    return [16, 48].flatMap((x) => Array.from(ctx.getImageData(x, 128, 16, 6).data));
  });
  // Selecting Doorways starts with the matching north-door case.
  await page.locator("#stage").selectOption("1");
  await expect(page.locator("#case-id")).toHaveText("review-1-4f6fe72b");
  const north = await page.locator("#render").evaluate((element) => {
    const ctx = (element as HTMLCanvasElement).getContext("2d");
    if (!ctx) throw new Error("Missing review canvas");
    return [16, 48].flatMap((x) => Array.from(ctx.getImageData(x, 0, 16, 6).data));
  });
  expect(south).toEqual(north);
});

test("one-key review saves actual renders to the inbox, pauses at two failures, and supports undo", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#sync")).toHaveText("Saved to server");
  const first = (await page.locator("#case-id").textContent()) ?? "missing";
  await page.keyboard.press("Space");
  await expect(page.locator("#case-id")).not.toHaveText(first);
  await page.waitForTimeout(180);
  await page.keyboard.press("x");
  await page.waitForTimeout(180);
  await page.keyboard.press("n");
  await page.locator("#note").fill("Test review: doorway seam");
  await page.keyboard.press("Enter");
  await expect(page.locator("#pause")).toBeVisible();
  await expect(page.locator("#sync")).toHaveText("Saved to server", { timeout: 15000 });
  const response = await request.get(API);
  const records = await response.json();
  expect(
    records.some(
      (r: { note: string; verdict: string }) =>
        r.note === "Test review: doorway seam" && r.verdict === "wrong",
    ),
  ).toBe(true);
  const stored = fs
    .readFileSync("test-results/interior-review-feedback/feedback.ndjson", "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  expect(
    stored.some(
      (r) =>
        r.note === "Test review: doorway seam" && r.screenshot.startsWith("data:image/png;base64,"),
    ),
  ).toBe(true);
  await expect(page.locator("#pause")).toContainText("Say “ready” in chat");
  await page.locator("#refresh-review").click();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#pause")).toBeVisible();
  await page.locator("#undo").click();
  await expect(page.locator("#pause")).toBeHidden();
  await expect(page.locator("#verdict")).toHaveText("Not reviewed yet");
  await page.locator("#stage").selectOption("3");
  await expect(page.locator("#position")).toContainText("Corners");
  fs.mkdirSync("test-results/interiors", { recursive: true });
  await page.screenshot({ path: "test-results/interiors/indoor-review-desktop.png" });
});

test("offline judgments survive refresh, changed renders reopen, and unchanged good verdicts persist", async ({
  page,
}) => {
  await page.route(`**${API}`, (route) => route.abort());
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  const first = (await page.locator("#case-id").textContent()) ?? "missing";
  await page.keyboard.press("Space");
  await page.waitForTimeout(180);
  await page.keyboard.press("x");
  await page.waitForTimeout(180);
  await page.keyboard.press("x");
  await expect(page.locator("#pause")).toBeVisible();
  await expect(page.locator("#sync")).toContainText("3 pending");
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#pause")).toBeVisible();
  await page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key) ?? "null");
    const changed = state.batch[0];
    changed.fingerprint = "0".repeat(64);
    for (const row of [...state.records, ...state.outbox])
      if (row.caseId === changed.id) row.fingerprint = changed.fingerprint;
    localStorage.setItem(key, JSON.stringify(state));
  }, STORAGE);
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#pause")).toBeHidden();
  await expect(page.locator("#verdict")).toContainText("Changed since your last verdict");
  await expect(page.locator("#case-id")).not.toHaveText(first);
  expect(
    await page.evaluate(
      (key) =>
        JSON.parse(localStorage.getItem(key) ?? "null").records.filter(
          (r: { verdict: string }) => r.verdict === "good",
        ).length,
      STORAGE,
    ),
  ).toBe(1);
});

test("phone review fits the viewport and typed notes do not trigger shortcuts", async ({
  page,
}) => {
  await page.route(`**${API}`, async (route) => {
    await route.fulfill({ json: [] });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  const first = (await page.locator("#case-id").textContent()) ?? "missing";
  await page.locator("#note").fill("wrong x corner");
  await page.keyboard.press("Space");
  await expect(page.locator("#case-id")).toHaveText(first);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  fs.mkdirSync("test-results/interiors", { recursive: true });
  await page.screenshot({ path: "test-results/interiors/indoor-review-phone.png", fullPage: true });
});

test("block pins survive refresh and travel with the screenshot and verdict", async ({ page }) => {
  const reports: Record<string, unknown>[] = [];
  await page.route(`**${API}`, async (route) => {
    if (route.request().method() === "POST") {
      reports.push(route.request().postDataJSON());
      await route.fulfill({ json: { ok: true } });
    } else await route.fulfill({ json: reports });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  const cell = page.locator('#plan button[data-x="1"][data-y="1"]');
  await cell.dblclick();
  await expect(page.locator("#pins button")).toHaveCount(1);
  await expect(cell).toHaveClass("pinned");
  const scale = await page
    .locator("#render")
    .evaluate(
      (canvas) => canvas.getBoundingClientRect().width / (canvas as HTMLCanvasElement).width,
    );
  await page.locator("#render").click({ position: { x: 20 * scale, y: 20 * scale } });
  await expect(page.locator("#pins button")).toHaveCount(2);
  await page.locator("#note").fill("Pinned seam");
  const before = await page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key) ?? "null").annotation,
    STORAGE,
  );
  expect(before.pins).toEqual([
    { x: 32, y: 32, size: 32 },
    { x: 16, y: 16, size: 16 },
  ]);
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#pins button")).toHaveCount(2);
  await expect(page.locator("#note")).toHaveValue("Pinned seam");
  await page.getByRole("button", { name: "Remove pin 2", exact: true }).click();
  await expect(page.locator("#pins button")).toHaveCount(1);
  await page.locator("#wrong").click();
  await expect.poll(() => reports.length).toBe(1);
  expect(reports[0]?.pins).toEqual([{ x: 32, y: 32, size: 32 }]);
  expect(reports[0]?.fingerprint).toBe(before.fingerprint);
  expect(reports[0]?.note).toBe("Pinned seam");
  const pixel = await page.evaluate(async (data) => {
    const image = new Image();
    image.src = data as string;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Missing canvas");
    ctx.drawImage(image, 0, 0);
    return Array.from(ctx.getImageData(32, 32, 1, 1).data);
  }, reports[0]?.screenshot);
  expect(pixel).toEqual([255, 207, 87, 255]);
  await expect(page.locator("#pins button")).toHaveCount(0);
});

for (const [id, x, y] of [
  ["review-5-97e616c", 320, 512],
  ["review-5-97e616c", 576, 608],
  ["review-5-29624761", 448, 704],
] as const) {
  test(`recessed south edge is six pixels high at ${id}:${x},${y}`, async ({ page }) => {
    await page.route(`**${API}`, (route) => route.fulfill({ json: [] }));
    await page.addInitScript(
      ({ key, id }) =>
        localStorage.setItem(
          key,
          JSON.stringify({
            current: id,
            stage: "all",
            records: [],
            outbox: [],
            batch: [],
            paused: false,
            draft: "",
          }),
        ),
      { key: STORAGE, id },
    );
    await page.goto(URL);
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    await expect(page.locator("#case-id")).toHaveText(id);
    const pixels = await page.locator("#render").evaluate(
      (element, { x, y }) => {
        const ctx = (element as HTMLCanvasElement).getContext("2d");
        if (!ctx) throw new Error("Missing canvas");
        return Array.from({ length: 32 }, (_, dy) =>
          Array.from(ctx.getImageData(x, y + dy, 1, 1).data),
        );
      },
      { x, y },
    );
    expect(pixels.slice(0, 6)).toEqual([
      [58, 58, 80, 255],
      ...Array(4).fill([248, 248, 248, 255]),
      [58, 58, 80, 255],
    ]);
    expect(pixels.slice(6)).toEqual(Array(26).fill([23, 30, 42, 255]));
  });
}

test("pinning the emoji plan brings an offscreen apartment block into view on a phone", async ({
  page,
}) => {
  await page.route(`**${API}`, (route) => route.fulfill({ json: [] }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          current: "review-5-97e616c",
          stage: "all",
          records: [],
          outbox: [],
          batch: [],
          paused: false,
          draft: "",
        }),
      ),
    STORAGE,
  );
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await page.locator('#plan button[data-x="7"][data-y="16"]').click();
  const location = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#render");
    const wrap = document.querySelector("#render-wrap");
    if (!canvas || !wrap) throw new Error("Missing render");
    const bounds = canvas.getBoundingClientRect();
    const viewport = wrap.getBoundingClientRect();
    const scale = bounds.width / canvas.width;
    return {
      x: bounds.left + 240 * scale - viewport.left,
      y: bounds.top + 528 * scale - viewport.top,
      width: viewport.width,
      height: viewport.height,
    };
  });
  expect(location.x).toBeGreaterThan(16);
  expect(location.y).toBeGreaterThan(16);
  expect(location.x).toBeLessThan(location.width - 16);
  expect(location.y).toBeLessThan(location.height - 16);
  // Tapping a plan cell must leave the quick-review keyboard shortcuts usable.
  await page.keyboard.press("n");
  await expect(page.locator("#note")).toBeFocused();
});

test("small stress review mixes motifs and shows complete compact renders on a phone", async ({
  page,
}) => {
  await page.route(`**${API}`, (route) => route.fulfill({ json: [] }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await page.locator("#stage").selectOption("6");
  for (const family of [
    "Adjacent south edges",
    "Adjacent south edges · mirror",
    "Divider becomes exterior",
  ]) {
    await expect(page.locator("#case-name")).toContainText(family);
    const fits = await page.evaluate(() => {
      const canvas = document.querySelector("#render");
      const wrap = document.querySelector("#render-wrap");
      if (!canvas || !wrap) throw new Error("Missing render");
      const image = canvas.getBoundingClientRect();
      const viewport = wrap.getBoundingClientRect();
      return (
        image.left >= viewport.left &&
        image.right <= viewport.right &&
        image.top >= viewport.top &&
        image.bottom <= viewport.bottom
      );
    });
    expect(fits).toBe(true);
    await page.locator("#skip").click();
  }
});

for (const fixture of [
  {
    id: "review-5-97e616c",
    white: [
      [658, 620],
      [658, 638],
      [923, 505],
    ],
    exterior: [[944, 496]],
    noSpur: [
      [242, 514],
      [540, 514],
    ],
  },
  {
    id: "review-5-29624761",
    white: [
      [531, 12],
      [531, 63],
      [531, 66],
      [531, 95],
      [379, 706],
      [379, 707],
      [379, 716],
      [531, 720],
    ],
    exterior: [[975, 560]],
    noSpur: [],
  },
]) {
  test(`pinned joins keep connected rails and cut away exterior tails in ${fixture.id}`, async ({
    page,
  }) => {
    await page.route(`**${API}`, (route) => route.fulfill({ json: [] }));
    await page.addInitScript(
      ({ key, id }) =>
        localStorage.setItem(
          key,
          JSON.stringify({
            current: id,
            stage: "all",
            records: [],
            outbox: [],
            batch: [],
            paused: false,
            draft: "",
          }),
        ),
      { key: STORAGE, id: fixture.id },
    );
    await page.goto(URL);
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    await expect(page.locator("#case-id")).toHaveText(fixture.id);
    const samples = await page.locator("#render").evaluate((element, fixture) => {
      const ctx = (element as HTMLCanvasElement).getContext("2d");
      if (!ctx) throw new Error("Missing canvas");
      const sample = (points: number[][]) =>
        points.map(([x, y]) => {
          if (x === undefined || y === undefined) throw new Error("Missing point");
          return Array.from(ctx.getImageData(x, y, 1, 1).data);
        });
      return {
        white: sample(fixture.white),
        exterior: sample(fixture.exterior),
        noSpur: sample(fixture.noSpur),
      };
    }, fixture);
    for (const pixel of samples.white) {
      // The atlas uses both 248 and 253 for white trim. Verify continuous
      // opaque white, rather than requiring one shade at every connection.
      expect(pixel[0]).toBeGreaterThan(240);
      expect(pixel).toEqual([pixel[0], pixel[0], pixel[0], 255]);
    }
    for (const pixel of samples.exterior) expect(pixel).toEqual([23, 30, 42, 255]);
    for (const pixel of samples.noSpur) expect(pixel).not.toEqual([248, 248, 248, 255]);
  });
}

for (const fixture of [
  { id: "review-6-5eb4c067", railX: 155, faceX: 147, shade: 180, end: 192, joinY: 160 },
  { id: "review-6-2193d41b", railX: 155, faceX: 147, shade: 180, end: 160, joinY: 64 },
  { id: "review-6-77882b23", railX: 98, faceX: 108, shade: 161, end: 160, joinY: -10 },
  // Stop before the doorway end piece: its bevel intentionally changes shade.
  { id: "review-6-a516e52d", railX: 98, faceX: 108, shade: 161, end: 128, joinY: -10 },
]) {
  test(`rail and facing stay consistent through the exterior transition in ${fixture.id}`, async ({
    page,
  }) => {
    await page.route(`**${API}`, (route) => route.fulfill({ json: [] }));
    await page.addInitScript(
      ({ key, id }) =>
        localStorage.setItem(
          key,
          JSON.stringify({
            current: id,
            stage: "all",
            records: [],
            outbox: [],
            batch: [],
            paused: false,
            draft: "",
          }),
        ),
      { key: STORAGE, id: fixture.id },
    );
    await page.goto(URL);
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    await expect(page.locator("#case-id")).toHaveText(fixture.id);
    const strip = await page.locator("#render").evaluate((element, fixture) => {
      const ctx = (element as HTMLCanvasElement).getContext("2d");
      if (!ctx) throw new Error("Missing canvas");
      return Array.from({ length: fixture.end - 6 }, (_, i) =>
        Array.from(ctx.getImageData(fixture.railX, i + 6, 1, 1).data),
      );
    }, fixture);
    const face = await page.locator("#render").evaluate((element, fixture) => {
      const ctx = (element as HTMLCanvasElement).getContext("2d");
      if (!ctx) throw new Error("Missing canvas");
      // Check the handed shaded face as well as the rail: connected trim
      // alone did not catch the previous perspective reversal.
      return Array.from({ length: fixture.end - 32 }, (_, i) =>
        Array.from(ctx.getImageData(fixture.faceX, i + 32, 1, 1).data),
      );
    }, fixture);
    for (const pixel of face)
      expect(pixel).toEqual([fixture.shade, fixture.shade, fixture.shade, 255]);
    for (const [i, pixel] of strip.entries()) {
      const y = i + 6;
      if (y === fixture.joinY || y === fixture.joinY + 5)
        expect(pixel, `rail at y=${y}`).toEqual([58, 58, 80, 255]);
      else {
        expect(pixel[0], `rail at y=${y}`).toBeGreaterThan(240);
        expect(pixel).toEqual([pixel[0], pixel[0], pixel[0], 255]);
      }
    }
  });
}

function pixelLine(
  x: number,
  y: number,
  dx: number,
  dy: number,
  count: number,
): [number, number][] {
  return Array.from({ length: count }, (_, i) => [x + dx * i, y + dy * i]);
}
for (const fixture of [
  {
    id: "review-6-7c40a704",
    rail: pixelLine(82, 6, 0, 1, 31),
    face: [],
    shade: 180,
    outline: [[82, 37]],
  },
  {
    id: "review-6-e82607a",
    rail: [
      ...pixelLine(96, 80, 1, 0, 95),
      ...pixelLine(73, 65, 0, 1, 4),
      ...pixelLine(74, 69, 1, 0, 7),
      ...pixelLine(86, 96, 1, 0, 105),
    ],
    face: [],
    shade: 180,
    outline: [
      ...pixelLine(160, 64, 1, 0, 26),
      ...pixelLine(86, 101, 1, 0, 105),
      ...pixelLine(191, 65, 0, 1, 31),
    ],
    floorPairs: [
      [67, 170, 3],
      [67, 185, 3],
    ],
  },
  {
    id: "review-6-195a2d34",
    rail: [
      ...pixelLine(179, 166, 0, 1, 26),
      ...pixelLine(176, 65, 0, 1, 31),
      ...pixelLine(65, 96, 1, 0, 105),
    ],
    face: [],
    shade: 180,
    outline: [...pixelLine(65, 101, 1, 0, 105), ...pixelLine(182, 70, 0, 1, 25), [176, 64]],
    floorPairs: [
      [188, 170, 252],
      [188, 185, 252],
    ],
  },
  {
    id: "review-6-d3b5f76a",
    rail: [
      ...pixelLine(139, 32, 0, 1, 96),
      ...pixelLine(147, 32, 0, 1, 96),
      ...pixelLine(137, 1, 0, 1, 4),
      ...pixelLine(138, 5, 1, 0, 12),
    ],
    face: pixelLine(131, 96, 0, 1, 32),
    shade: 180,
    outline: [...pixelLine(128, 5, 1, 0, 10), ...pixelLine(137, 0, 1, 0, 14)],
    floorPairs: [[131, 170, 3]],
  },
  {
    id: "review-6-53ea6684",
    rail: [...pixelLine(118, 1, 0, 1, 4), ...pixelLine(106, 5, 1, 0, 12)],
    face: [],
    shade: 180,
    outline: [...pixelLine(118, 5, 1, 0, 10), ...pixelLine(105, 0, 1, 0, 14)],
  },
  {
    id: "review-3-678f99e7",
    rail: pixelLine(155, 134, 0, 1, 58),
    face: pixelLine(147, 144, 0, 1, 48),
    shade: 180,
    outline: [
      [155, 128],
      [155, 133],
    ],
    // The start bevel reveals room floor; a rectangular side face hid it.
    floorPairs: [[145, 132, 129]],
  },
  {
    id: "review-3-f356bc4b",
    rail: pixelLine(66, 134, 0, 1, 58),
    face: pixelLine(76, 144, 0, 1, 48),
    shade: 161,
    outline: [
      [66, 128],
      [66, 133],
    ],
    floorPairs: [[77, 132, 93]],
  },
  {
    id: "review-6-34930be7",
    rail: pixelLine(114, 70, 0, 1, 31),
    face: pixelLine(122, 80, 0, 1, 34),
    shade: 161,
    outline: [
      [114, 69],
      [114, 101],
    ],
  },
  {
    id: "review-6-b449b030",
    rail: pixelLine(82, 129, 0, 1, 31),
    face: pixelLine(92, 144, 0, 1, 16),
    shade: 161,
    outline: [[82, 128]],
  },
  {
    id: "review-6-510adc2d",
    rail: [
      ...pixelLine(91, 6, 0, 1, 95),
      ...pixelLine(91, 98, 1, 0, 30),
      ...pixelLine(123, 102, 0, 1, 90),
    ],
    face: [...pixelLine(83, 32, 0, 1, 64), ...pixelLine(115, 128, 0, 1, 64)],
    shade: 180,
    outline: [[121, 98]],
  },
  {
    id: "review-6-390b534",
    rail: pixelLine(130, 66, 1, 0, 30),
    face: pixelLine(130, 80, 1, 0, 30),
    shade: 204,
    outline: pixelLine(128, 65, 0, 1, 30),
  },
]) {
  test(`short wall rails and faces agree in ${fixture.id}`, async ({ page }) => {
    await page.route(`**${API}`, (route) => route.fulfill({ json: [] }));
    await page.addInitScript(
      ({ key, id }) =>
        localStorage.setItem(
          key,
          JSON.stringify({
            current: id,
            stage: "all",
            records: [],
            outbox: [],
            batch: [],
            paused: false,
            draft: "",
          }),
        ),
      { key: STORAGE, id: fixture.id },
    );
    await page.goto(URL);
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    await expect(page.locator("#case-id")).toHaveText(fixture.id);
    const samples = await page.locator("#render").evaluate((element, fixture) => {
      const ctx = (element as HTMLCanvasElement).getContext("2d");
      if (!ctx) throw new Error("Missing canvas");
      const pixels = (points: number[][]) =>
        points.map(([x, y]) => Array.from(ctx.getImageData(x ?? 0, y ?? 0, 1, 1).data));
      return {
        rail: pixels(fixture.rail),
        face: pixels(fixture.face),
        outline: pixels(fixture.outline),
        floorPairs: (fixture.floorPairs ?? []).map(([x, y, referenceX]) =>
          pixels([
            [x ?? 0, y ?? 0],
            [referenceX ?? 0, y ?? 0],
          ]),
        ),
      };
    }, fixture);
    for (const pixel of samples.rail) {
      expect(pixel[0]).toBeGreaterThan(240);
      expect(pixel).toEqual([pixel[0], pixel[0], pixel[0], 255]);
    }
    for (const pixel of samples.face)
      expect(pixel).toEqual([fixture.shade, fixture.shade, fixture.shade, 255]);
    for (const pixel of samples.outline) expect(pixel).toEqual([58, 58, 80, 255]);
    for (const [actual, reference] of samples.floorPairs) expect(actual).toEqual(reference);
  });
}

test("changed apartments reopen as compact related review cases", async ({ page }) => {
  await page.route(`**${API}`, (route) => route.fulfill({ json: [] }));
  await page.addInitScript(
    (key) =>
      localStorage.setItem(
        key,
        JSON.stringify({
          current: "review-5-29624761",
          stage: "5",
          records: [],
          outbox: [],
          paused: true,
          draft: "",
          batch: ["review-5-97e616c", "review-5-29624761"].map((id) => ({
            id,
            fingerprint: "0".repeat(64),
          })),
        }),
      ),
    STORAGE,
  );
  await page.goto(URL);
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#pause")).toBeHidden();
  await expect(page.locator("#case-id")).toHaveText("review-6-e82607a");
  await page.keyboard.press("Space");
  await expect(page.locator("#case-id")).toHaveText("review-6-195a2d34");
  await page.waitForTimeout(180); // Match the review's accidental-double-vote guard.
  await page.keyboard.press("x");
  await expect(page.locator("#case-id")).toHaveText("review-6-d3b5f76a");
  await page.waitForTimeout(180);
  await page.keyboard.press("x");
  await expect(page.locator("#pause")).toBeVisible();
});
