import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
// @ts-expect-error pngjs has no bundled declarations
import pngjs from "pngjs";
import { captureReviewRenders } from "./helpers/interior-review.js";

const baseline = JSON.parse(
  readFileSync(new URL("./fixtures/interior-approved/fingerprints.json", import.meta.url), "utf8"),
) as { id: string }[];

const visualOptions = { threshold: 0.01, maxDiffPixels: 0 };

test("visual comparison tolerates color rounding but rejects missing geometry and size changes", () => {
  const { PNG } = pngjs;
  const image = PNG.sync.read(
    readFileSync(new URL("./fixtures/interior-approved/profile-arch.png", import.meta.url)),
  );
  // A one-channel rounding difference is harmless, even under a zero-pixel budget.
  image.data[0] += 1;
  expect(PNG.sync.write(image)).toMatchSnapshot("profile-arch.png", visualOptions);
  // A large color change inside a flat region must still count as a mismatch.
  const offset = (10 * image.width + 10) * 4;
  const original = image.data[offset];
  image.data[offset] = 255;
  expect(PNG.sync.write(image)).not.toMatchSnapshot("profile-arch.png", visualOptions);
  image.data[offset] = original;
  // Removing the arch entirely must fail, without consuming a percentage budget.
  for (let y = 81; y < 136; y++)
    for (let x = 96; x < 128; x++) {
      const offset = (y * image.width + x) * 4;
      image.data[offset] = 23;
      image.data[offset + 1] = 30;
      image.data[offset + 2] = 42;
    }
  expect(PNG.sync.write(image)).not.toMatchSnapshot("profile-arch.png", visualOptions);
  const resized = new PNG({ width: image.width + 1, height: image.height });
  expect(PNG.sync.write(resized)).not.toMatchSnapshot("profile-arch.png", visualOptions);
});

for (const [id, x, y, expected] of [
  ["interaction-two-rooms-mirror", 5, 94, 204],
  ["interaction-offset-hall", 278, 182, 180],
] as const)
  test(`shell-relative height and occlusion in ${id}`, async ({ page }) => {
    await page.route("**/api/interior-review", (route) => route.fulfill({ json: [] }));
    await page.addInitScript((current) => {
      localStorage.setItem(
        "tilefun.indoor-review.v1",
        JSON.stringify({
          current,
          stage: "11",
          records: [],
          outbox: [],
          batch: [],
          draft: "",
        }),
      );
    }, id);
    await page.goto("/tilefun/interior-review.html?stage=11");
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    await expect(page.locator("#case-id")).toHaveText(id);
    const pixel = await page.locator("#render").evaluate(
      (el, { x, y }) => {
        const ctx = (el as HTMLCanvasElement).getContext("2d");
        if (!ctx) throw new Error("Missing canvas");
        return Array.from(ctx.getImageData(x, y, 1, 1).data);
      },
      { x, y },
    );
    // The tall face covers the rail; the low end reveals the shell behind it.
    expect(pixel).toEqual([expected, expected, expected, 255]);
  });

for (const [id, stage, top, side, x] of [
  ["interaction-thick-shell-mirror", "9", 88, "east", 249],
  ["interaction-three-rooms", "11", 96, "east", 249],
  ["interaction-three-rooms", "11", 96, "west", 6],
  ["interaction-offset-hall", "11", 88, "west", 6],
] as const)
  test(`normal-height ${side} cap joins the room rail in ${id}`, async ({ page }) => {
    await page.route("**/api/interior-review", (route) => route.fulfill({ json: [] }));
    await page.addInitScript(
      ({ id, stage }) =>
        localStorage.setItem(
          "tilefun.indoor-review.v1",
          JSON.stringify({
            current: id,
            stage,
            records: [],
            outbox: [],
            batch: [],
            paused: false,
            draft: "",
            annotation: null,
          }),
        ),
      { id, stage },
    );
    await page.goto(`/tilefun/interior-review.html?stage=${stage}`);
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    await expect(page.locator("#case-id")).toHaveText(id);
    const cap = await page.locator("#render").evaluate(
      (el, { top, x }) => {
        const ctx = (el as HTMLCanvasElement).getContext("2d");
        if (!ctx) throw new Error("Missing render");
        return Array.from({ length: 103 - top }, (_, i) =>
          Array.from(ctx.getImageData(x, top + 1 + i, 1, 1).data),
        );
      },
      { top, x },
    );
    expect(cap).toEqual(Array(103 - top).fill([248, 248, 248, 255]));
  });

test(`all ${baseline.length} approved interiors match their visual references`, async ({
  page,
}) => {
  await page.route("**/api/interior-review", (route) => route.fulfill({ json: [] }));
  const renders = await captureReviewRenders(
    page,
    baseline.map((r) => r.id),
    true,
  );
  for (const { id, png } of renders) {
    // Compare native canvas pixels, not CSS-scaled screenshots. Allow only tiny
    // perceived color changes from platform shadow blending; no larger changes.
    expect
      .soft(Buffer.from(png.split(",")[1] ?? "", "base64"), id)
      .toMatchSnapshot(`${id}.png`, visualOptions);
  }
});

test("height sampler is compact and preserves the two-failure review cycle", async ({ page }) => {
  const posted: Record<string, unknown>[] = [];
  await page.route("**/api/interior-review", async (route) => {
    if (route.request().method() === "POST") {
      posted.push(route.request().postDataJSON());
      await route.fulfill({ json: { ok: true } });
    } else await route.fulfill({ json: [] });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/interior-review.html?stage=7");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#case-id")).toHaveText("profile-straight-normal");
  const dimensions = await page.locator("#render").evaluate((c) => ({
    width: c.getBoundingClientRect().width,
    overflow: document.documentElement.scrollWidth > innerWidth,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(288);
  expect(dimensions.overflow).toBe(false);
  await page.locator("#wrong").click();
  await page.waitForTimeout(180);
  await page.locator("#wrong").click();
  await expect(page.locator("#pause")).toBeVisible();
  await expect.poll(() => posted.length).toBe(2);
  expect(posted[0]?.profiles).toBeTruthy();
  expect(posted[0]?.fingerprint).not.toBe(posted[1]?.fingerprint);
});

test("thickness round exposes eight compact cases and saves widths in the quick review cycle", async ({
  page,
}) => {
  const posted: { profiles?: { walls: { thickness?: string }[] } }[] = [];
  await page.route("**/api/interior-review", async (route) => {
    if (route.request().method() === "POST") {
      posted.push(route.request().postDataJSON());
      await route.fulfill({ json: { ok: true } });
    } else await route.fulfill({ json: [] });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/interior-review.html?stage=8");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#position")).toContainText("1 of 8");
  await expect(page.locator("#case-id")).toHaveText("connection-straight");
  await expect(page.locator("#plan .thick-wall")).toHaveCount(2);
  await expect(page.locator("#legend")).toContainText("Outlined = thick");
  const ids: string[] = [];
  for (let i = 0; i < 8; i++) {
    ids.push((await page.locator("#case-id").textContent()) ?? "");
    const fits = await page
      .locator("#render")
      .evaluate(
        (c) =>
          c.getBoundingClientRect().width <= 288 &&
          document.documentElement.scrollWidth <= innerWidth,
      );
    expect(fits).toBe(true);
    await page.locator("#skip").click();
  }
  expect(ids).toEqual([
    "connection-straight",
    "connection-bend",
    "connection-tee",
    "connection-door",
    "connection-north-low",
    "connection-north-tall",
    "connection-south-low",
    "connection-south-tall",
  ]);
  await page.locator("#wrong").click();
  await expect(page.locator("#case-id")).toHaveText("connection-bend");
  // The UI briefly ignores voting to prevent an accidental double tap.
  await page.waitForTimeout(180);
  await page.locator("#wrong").click();
  await expect(page.locator("#pause")).toBeVisible();
  await expect.poll(() => posted.length).toBe(2);
  expect(posted[0]?.profiles?.walls.map((w) => w.thickness)).toEqual(["thin", "thick", "thick"]);
});

for (const fixture of [
  { id: "profile-door-false", cap: [20, 116], floor: [20, 98, 52] },
  { id: "profile-door-true", cap: [20, 84], floor: [] },
  { id: "profile-door-east-low", cap: [230, 116], floor: [232, 98, 200] },
  { id: "profile-door-east-tall", cap: [246, 84], floor: [] },
])
  test(`profile attaches to the room shell in ${fixture.id}`, async ({ page }) => {
    await page.route("**/api/interior-review", (route) => route.fulfill({ json: [] }));
    await page.addInitScript(
      (id) =>
        localStorage.setItem(
          "tilefun.indoor-review.v1",
          JSON.stringify({
            current: id,
            stage: "7",
            records: [],
            outbox: [],
            batch: [],
            paused: false,
            draft: "",
            annotation: null,
          }),
        ),
      fixture.id,
    );
    await page.goto("/tilefun/interior-review.html?stage=7");
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    await expect(page.locator("#case-id")).toHaveText(fixture.id);
    const pixels = await page.locator("#render").evaluate((element, fixture) => {
      const ctx = (element as HTMLCanvasElement).getContext("2d");
      if (!ctx) throw new Error("Missing canvas");
      const pixel = (x = 0, y = 0) => Array.from(ctx.getImageData(x, y, 1, 1).data);
      return {
        cap: pixel(...fixture.cap),
        floor: fixture.floor.length
          ? [pixel(fixture.floor[0], fixture.floor[1]), pixel(fixture.floor[2], fixture.floor[1])]
          : [],
      };
    }, fixture);
    expect(pixels.cap[0]).toBeGreaterThan(240);
    expect(pixels.cap).toEqual([pixels.cap[0], pixels.cap[0], pixels.cap[0], 255]);
    if (pixels.floor.length) expect(pixels.floor[0]).toEqual(pixels.floor[1]);
  });

for (const [height, capX] of [
  ["low", 114],
  ["tall", 106],
] as const)
  test(`${height} south partition preserves the height step at the cutaway`, async ({ page }) => {
    await page.route("**/api/interior-review", (route) => route.fulfill({ json: [] }));
    await page.addInitScript(
      (height) =>
        localStorage.setItem(
          "tilefun.indoor-review.v1",
          JSON.stringify({
            current: `connection-south-${height}`,
            stage: "8",
            records: [],
            outbox: [],
            batch: [],
            paused: false,
            draft: "",
            annotation: null,
          }),
        ),
      height,
    );
    await page.goto("/tilefun/interior-review.html?stage=8");
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    await expect(page.locator("#case-id")).toHaveText(`connection-south-${height}`);
    const seam = await page.locator("#render").evaluate(
      (element, { x, joinX }) => {
        const ctx = (element as HTMLCanvasElement).getContext("2d");
        if (!ctx) throw new Error("Missing canvas");
        return [190, 216, 224, 225].map((y) =>
          Array.from(ctx.getImageData(y >= 224 ? joinX : x, y, 1, 1).data),
        );
      },
      { x: capX, joinX: height === "low" ? 114 : 110 },
    );
    expect(seam[0]).toEqual([248, 248, 248, 255]);
    if (height === "low") expect(seam[1]).toEqual([248, 248, 248, 255]);
    else expect(seam[1]?.[0]).toBeLessThan(248);
    expect(seam.slice(2)).toEqual(Array(2).fill([248, 248, 248, 255]));
  });
