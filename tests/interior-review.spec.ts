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
