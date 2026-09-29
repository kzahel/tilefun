import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const baseline = JSON.parse(
  readFileSync(new URL("./fixtures/interior-approved/fingerprints.json", import.meta.url), "utf8"),
) as { id: string; fp: string }[];

test(`all ${baseline.length} approved interiors retain their exact rendered pixels`, async ({
  page,
}) => {
  await page.route("**/api/interior-review", (route) => route.fulfill({ json: [] }));
  await page.goto("/tilefun/interior-review.html");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  const actual = await page.evaluate(
    async (ids) => {
      const wanted = new Set(ids),
        visited = new Set<string>();
      const results: { id: string; fp: string }[] = [];
      while (results.length < wanted.size) {
        const canvas = document.querySelector<HTMLCanvasElement>("#render");
        const id = document.querySelector("#case-id")?.textContent;
        const sketch = document.querySelector("#sketch")?.textContent;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx || !id || !sketch) throw new Error("Missing review canvas");
        if (visited.has(id)) throw new Error("An approved case disappeared from the review pool");
        visited.add(id);
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const header = new TextEncoder().encode(`${sketch}\n${canvas.width},${canvas.height}\n`);
        const bytes = new Uint8Array(header.length + pixels.length);
        bytes.set(header);
        bytes.set(pixels, header.length);
        const fp = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        if (wanted.has(id)) results.push({ id, fp });
        document.querySelector<HTMLButtonElement>("#skip")?.click();
      }
      return results;
    },
    baseline.map((r) => r.id),
  );
  expect(actual).toEqual(baseline.map(({ id, fp }) => ({ id, fp })));
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
    const seam = await page.locator("#render").evaluate((element, x) => {
      const ctx = (element as HTMLCanvasElement).getContext("2d");
      if (!ctx) throw new Error("Missing canvas");
      return [190, 200, 224, 225].map((y) =>
        Array.from(ctx.getImageData(y >= 224 ? 114 : x, y, 1, 1).data),
      );
    }, capX);
    expect(seam[0]).toEqual([248, 248, 248, 255]);
    if (height === "low") expect(seam[1]).toEqual([248, 248, 248, 255]);
    else expect(seam[1]?.[0]).toBeLessThan(248);
    expect(seam.slice(2)).toEqual(Array(2).fill([248, 248, 248, 255]));
  });
