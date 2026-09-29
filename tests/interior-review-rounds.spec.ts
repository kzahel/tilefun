import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { reviewCases } from "../src/interiors/review/ReviewCases.js";

const approved = JSON.parse(
  readFileSync(new URL("./fixtures/interior-approved/fingerprints.json", import.meta.url), "utf8"),
) as { id: string; name: string; fp: string }[];
const superseded = JSON.parse(
  readFileSync(
    new URL("./fixtures/interior-approved/superseded-fingerprints.json", import.meta.url),
    "utf8",
  ),
) as { id: string; name: string; fp: string }[];

test("changed side connections reopen their historical approvals", async ({ page }) => {
  await page.route("**/api/interior-review", (route) =>
    route.fulfill({
      json: superseded.map((r) => ({
        id: `historical-${r.id}`,
        caseId: r.id,
        name: r.name,
        sketch: "",
        fingerprint: r.fp,
        verdict: "good",
        note: "",
        createdAt: "2026-09-29T00:00:00Z",
      })),
    }),
  );
  const reopened = [
    ["interaction-thick-shell", "9"],
    ["interaction-two-rooms", "11"],
    ["profile-door-true", "7"],
    ["profile-door-east-low", "7"],
    ["profile-door-east-tall", "7"],
  ] as const;
  await page.addInitScript((cases) => {
    const stage = new URL(location.href).searchParams.get("stage");
    const current =
      new URL(location.href).searchParams.get("testCase") ??
      cases.find(([, s]) => s === stage)?.[0];
    localStorage.setItem(
      "tilefun.indoor-review.v1",
      JSON.stringify({ current, stage, records: [], outbox: [], batch: [], draft: "" }),
    );
  }, reopened);
  for (const [current, stage] of reopened) {
    await page.goto(`/tilefun/interior-review.html?stage=${stage}&unchecked=1&testCase=${current}`);
    await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
    await expect(page.locator("#case-id")).toHaveText(current);
    await expect(page.locator("#verdict")).toContainText("Changed since your last verdict");
    await expect(page.locator("#good")).toBeEnabled();
  }
});

function approvedRecords(includeInteractions = false) {
  // Keep this scenario's three new rounds ungraded as the real baseline grows.
  return approved
    .filter((r) => includeInteractions || !r.id.startsWith("interaction-"))
    .map((r, i) => ({
      id: `approved-${i}`,
      caseId: r.id,
      name: r.name,
      sketch: "",
      fingerprint: r.fp,
      verdict: "good",
      note: "",
      createdAt: "2026-09-29T00:00:00Z",
    }));
}

test("eight boundary cases are the only unchecked cases and fit a phone", async ({ page }) => {
  const records = approvedRecords(true);
  await page.route("**/api/interior-review", (route) => route.fulfill({ json: records }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/interior-review.html?stage=12&unchecked=1");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator('#stage option[value="all"]')).toHaveText(
    "Small → complex — 8 unchecked",
  );
  await expect(page.locator('#stage option[value="12"]')).toHaveText(
    "North & south attachments — 8 unchecked",
  );
  await expect(page.locator("#unsupported-label")).toHaveText("0 cases excluded by the compiler");
  const visited = new Set<string>();
  for (let i = 0; i < 8; i++) {
    const id = (await page.locator("#case-id").textContent()) ?? "";
    expect(id).toMatch(/^boundary-(north|south)-(low|normal|tall)-(thin|thick)$/);
    expect(visited.has(id)).toBe(false);
    visited.add(id);
    const size = await page.locator("#render").evaluate((el) => ({
      width: (el as HTMLCanvasElement).width,
      height: (el as HTMLCanvasElement).height,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    expect(size).toEqual({ width: 224, height: 198, overflow: false });
    if (id.startsWith("boundary-north-normal")) {
      const seam = await page.locator("#render").evaluate((el) => {
        const ctx = (el as HTMLCanvasElement).getContext("2d");
        if (!ctx) throw new Error("Missing canvas");
        return Array.from(ctx.getImageData(110, 5, 1, 1).data);
      });
      expect(seam).toEqual([248, 248, 248, 255]);
    }
    await page.locator("#skip").click();
  }
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#case-id")).toHaveText("boundary-north-normal-thin");
});

test("unchecked position updates after background verification without changing categories", async ({
  page,
}) => {
  const caseId = "interaction-mixed-step";
  const records = approvedRecords(true).filter((r) => r.caseId !== caseId);
  await page.route("**/api/interior-review", (route) => route.fulfill({ json: records }));
  await page.addInitScript((current) => {
    localStorage.setItem(
      "tilefun.indoor-review.v1",
      JSON.stringify({ current, stage: "10", records: [], outbox: [], batch: [], draft: "" }),
    );
  }, caseId);
  await page.goto("/tilefun/interior-review.html?stage=10&unchecked=1");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#case-id")).toHaveText(caseId);
  await expect(page.locator("#position")).toContainText("1 of 1");
});

test("unchecked filter hides completed categories, supports browsing grades, and survives reload", async ({
  page,
}) => {
  await page.route("**/api/interior-review", (route) => route.fulfill({ json: approvedRecords() }));
  await page.goto("/tilefun/interior-review.html?stage=9");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#unchecked-only")).toBeChecked();
  await page.locator("#stage").selectOption("8");
  await expect(page.locator("#case")).toBeHidden();
  await expect(page.locator("#position")).toContainText("No unchecked cases");
  await page.locator("#unchecked-only").uncheck();
  await expect(page.locator("#case-id")).toHaveText("connection-straight");
  await expect(page.locator("#verdict")).toContainText("Marked right");
  await page.goto("/tilefun/interior-review.html");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#unchecked-only")).not.toBeChecked();
  await expect(page.locator("#case-id")).toHaveText("connection-straight");
  await page.locator("#unchecked-only").check();
  await expect(page.locator("#case")).toBeHidden();
  await page.locator("#stage").selectOption("9");
  await expect(page.locator("#case-id")).toHaveText("interaction-bend-reverse-mirror");
  await page.reload();
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator("#unchecked-only")).toBeChecked();
});

test("three new eight-case rounds fit a phone and preserve the two-report pause", async ({
  page,
}) => {
  const records: Record<string, unknown>[] = approvedRecords();
  const posts: Record<string, unknown>[] = [];
  await page.route("**/api/interior-review", async (route) => {
    if (route.request().method() === "POST") {
      const row = route.request().postDataJSON();
      posts.push(row);
      records.push(row);
      await route.fulfill({ json: { saved: true } });
    } else await route.fulfill({ json: records });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tilefun/interior-review.html?stage=9&unchecked=1");
  await expect(page.locator('#app[data-ready="true"]')).toBeVisible();
  await expect(page.locator('#stage option[value="all"]')).toHaveText(
    `Small → complex — ${reviewCases().length - records.length} unchecked`,
  );
  await expect(page.locator("#unsupported-label")).toHaveText("0 cases excluded by the compiler");
  const visited = new Set<string>();
  for (const stage of ["9", "10", "11"]) {
    await page.locator("#stage").selectOption(stage);
    await expect(page.locator("#position")).toContainText("1 of 8");
    for (let i = 0; i < 8; i++) {
      const id = (await page.locator("#case-id").textContent()) ?? "";
      expect(visited.has(id)).toBe(false);
      visited.add(id);
      const size = await page.locator("#render").evaluate((el) => ({
        width: (el as HTMLCanvasElement).width,
        height: (el as HTMLCanvasElement).height,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      expect(size.width).toBeLessThanOrEqual(288);
      expect(size.height).toBeLessThanOrEqual(288);
      expect(size.overflow).toBe(false);
      await page.locator("#skip").click();
    }
  }
  expect(visited.size).toBe(24);
  await page.locator("#stage").selectOption("9");
  await page.locator("#wrong").click();
  await expect(page.locator('#stage option[value="9"]')).toContainText("7 unchecked · 1 wrong");
  await page.waitForTimeout(180);
  await page.locator("#wrong").click();
  await expect(page.locator("#pause")).toBeVisible();
  await expect.poll(() => posts.length).toBe(2);
  expect(posts.every((p) => p.profiles && p.screenshot)).toBe(true);
});
