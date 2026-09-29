import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const baseline = JSON.parse(
  readFileSync(new URL("./fixtures/interior-approved/fingerprints.json", import.meta.url), "utf8"),
) as { id: string; fp: string }[];

test("all 163 approved interiors retain their exact rendered pixels", async ({ page }) => {
  await page.route("**/api/interior-review", (route) => route.fulfill({ json: [] }));
  await page.goto("/tilefun/interior-review.html");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  const actual = await page.evaluate(async (count) => {
    const results: { id: string; fp: string }[] = [];
    for (let i = 0; i < count; i++) {
      const canvas = document.querySelector<HTMLCanvasElement>("#render");
      const id = document.querySelector("#case-id")?.textContent;
      const sketch = document.querySelector("#sketch")?.textContent;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx || !id || !sketch) throw new Error("Missing review canvas");
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      const header = new TextEncoder().encode(`${sketch}\n${canvas.width},${canvas.height}\n`);
      const bytes = new Uint8Array(header.length + pixels.length);
      bytes.set(header);
      bytes.set(pixels, header.length);
      const fp = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      results.push({ id, fp });
      document.querySelector<HTMLButtonElement>("#skip")?.click();
    }
    return results;
  }, baseline.length);
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
