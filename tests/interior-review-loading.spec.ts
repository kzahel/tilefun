import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { reviewCases } from "../src/interiors/review/ReviewCases.js";

const approved = JSON.parse(
  readFileSync(new URL("./fixtures/interior-approved/fingerprints.json", import.meta.url), "utf8"),
) as { id: string; name: string; fp: string }[];

test("review starts before verification finishes, uses only small sprites, and recomputes on reload", async ({
  page,
}) => {
  await page.route("**/api/interior-review", (route) => route.fulfill({ json: [] }));
  await page.addInitScript(() => {
    const probe = {
      hashes: 0,
      firstHashes: -1,
      ticks: 0,
      firstTicks: 0,
      lastTicks: 0,
      canvases: 0,
    };
    Object.assign(window, { reviewProbe: probe });
    const timer = setInterval(() => probe.ticks++, 0);
    const digest = SubtleCrypto.prototype.digest;
    SubtleCrypto.prototype.digest = async function (...args: Parameters<SubtleCrypto["digest"]>) {
      const result = await digest.apply(this, args);
      probe.hashes++;
      return result;
    };
    const create = Document.prototype.createElement;
    Document.prototype.createElement = function (tag: string, options?: ElementCreationOptions) {
      if (tag === "canvas") probe.canvases++;
      return create.call(this, tag, options);
    };
    new MutationObserver(() => {
      const app = document.querySelector<HTMLElement>("#app");
      if (app?.dataset.reviewReady && probe.firstHashes < 0) {
        probe.firstHashes = probe.hashes;
        probe.firstTicks = probe.ticks;
      }
      if (app?.dataset.ready) {
        probe.lastTicks = probe.ticks;
        clearInterval(timer);
      }
    }).observe(document, { subtree: true, attributes: true, childList: true });
  });
  for (let run = 0; run < 2; run++) {
    await page.goto("/tilefun/interior-review.html?stage=8");
    await expect(page.locator('#app[data-review-ready="true"]')).toBeVisible();
    if (run === 0) {
      // Category navigation remains usable while other cases are still checked.
      await page.locator("#stage").selectOption("7");
      await expect(page.locator("#case-id")).toHaveText("profile-straight-normal");
    }
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    const result = await page.evaluate(() => ({
      probe: (
        window as unknown as {
          reviewProbe: {
            hashes: number;
            firstHashes: number;
            firstTicks: number;
            lastTicks: number;
            canvases: number;
          };
        }
      ).reviewProbe,
      resources: performance
        .getEntriesByType("resource")
        .map((e) => ({ name: e.name, size: (e as PerformanceResourceTiming).decodedBodySize })),
      stored: Object.keys(JSON.parse(localStorage.getItem("tilefun.indoor-review.v1") ?? "{}")),
    }));
    expect(result.probe.hashes).toBe(reviewCases().length);
    expect(result.probe.firstHashes).toBeLessThan(10);
    expect(result.probe.lastTicks - result.probe.firstTicks).toBeGreaterThan(20);
    expect(result.probe.canvases).toBe(2); // active unmarked image + scratch, besides the HTML display canvas
    expect(result.resources.some((r) => r.name.includes("modern-interiors-atlas"))).toBe(false);
    const sprites = result.resources.filter((r) => r.name.includes("review-sprites"));
    expect(sprites.length).toBeGreaterThan(0);
    expect(sprites.reduce((n, r) => n + r.size, 0)).toBeLessThan(100_000);
    expect(result.stored.sort()).toEqual([
      "annotation",
      "batch",
      "current",
      "draft",
      "outbox",
      "paused",
      "records",
      "stage",
      "uncheckedOnly",
    ]);
  }
});

test("category counts verify old verdicts, distinguish wrong from unchecked, and follow undo", async ({
  page,
}) => {
  const records: Record<string, unknown>[] = approved
    .filter((r) => r.id !== "connection-south-tall")
    .map((r, i) => ({
      id: `approved-${i}`,
      caseId: r.id,
      name: r.name,
      sketch: "",
      fingerprint: r.id === "connection-straight" ? "0".repeat(64) : r.fp,
      verdict: "good",
      note: "",
      createdAt: "2026-09-29T00:00:00Z",
    }));
  await page.route("**/api/interior-review", async (route) => {
    if (route.request().method() === "POST") {
      const row = route.request().postDataJSON();
      const index = records.findIndex((r) => r.caseId === row.caseId);
      if (index >= 0) records.splice(index, 1);
      records.push(row);
      await route.fulfill({ json: { saved: true } });
    } else await route.fulfill({ json: records });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/interior-review.html?stage=8");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  const option = page.locator('#stage option[value="8"]');
  await expect(option).toHaveText("Thickness & end joins — 2 unchecked");
  await expect(page.locator('#stage option[value="0"]')).toHaveText("Tiny rooms — 0 unchecked · ✓");
  await page.locator("#stage").selectOption("8");
  await expect(page.locator("#case-id")).toHaveText("connection-straight");
  await page.locator("#good").click();
  await expect(option).toHaveText("Thickness & end joins — 1 unchecked");
  await page.locator("#undo").click();
  await expect(option).toHaveText("Thickness & end joins — 2 unchecked");
  await page.waitForTimeout(180);
  await page.locator("#wrong").click();
  await expect(option).toHaveText("Thickness & end joins — 1 unchecked · 1 wrong");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
