import { expect, test } from "@playwright/test";
import type { ScenarioResponse } from "../src/scenarios/ScenarioProtocol.js";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"] as const) {
  test(`shopping visits, paused reload and phone controls (${renderer})`, async ({ page }) => {
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/tilefun/workshop.html?renderer=${renderer}#/tool/parking-lab?play=1`);
    const canvas = page.getByLabel("Playable shopping center");
    await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 30000 });
    const status = async () =>
      JSON.parse((await canvas.getAttribute("data-parking")) ?? "null") as NonNullable<
        ScenarioResponse["parking"]
      > | null;
    const observed = new Set<string>();
    await expect
      .poll(
        async () => {
          const p = await status();
          if (!p) return false;
          expect(p.maneuvers).toBeLessThanOrEqual(2);
          for (const v of p.visits) observed.add(v.phase);
          return p.visits.some((v) => v.phase === "walking-to-shop");
        },
        { timeout: 60000, intervals: [200] },
      )
      .toBe(true);
    await page.getByRole("button", { name: "Pause trips", exact: true }).click();
    await expect
      .poll(async () => JSON.parse((await canvas.getAttribute("data-clock")) ?? "{}").running)
      .toBe(false);
    const before = await canvas.getAttribute("data-poses");
    await page.waitForTimeout(250);
    expect(await canvas.getAttribute("data-poses")).toBe(before);
    await page.getByRole("button", { name: "Save / reload trips", exact: true }).click();
    await expect(canvas).toHaveAttribute("data-reload-count", "1");
    await expect.poll(() => canvas.getAttribute("data-poses")).toBe(before);
    await canvas.screenshot({ path: `/tmp/tilefun-parking-visits-${renderer}.png` });
    await page.getByRole("button", { name: "Resume trips", exact: true }).click();
    await expect
      .poll(
        async () => {
          const p = await status();
          if (!p) return 0;
          expect(p.maneuvers).toBeLessThanOrEqual(2);
          for (const v of p.visits) observed.add(v.phase);
          return p.completed;
        },
        { timeout: 110000, intervals: [200] },
      )
      .toBeGreaterThan(0);
    for (const phase of [
      "arriving",
      "parked",
      "walking-to-shop",
      "shopping",
      "returning",
      "ready-to-leave",
      "leaving",
    ])
      expect(observed.has(phase)).toBe(true);
    await page.getByRole("button", { name: "Pause trips", exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(canvas).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
    await page.getByRole("button", { name: "Layout patterns", exact: true }).click();
    await expect(page.locator('[data-parking-ready="true"]')).toBeVisible();
    await expect(page.getByLabel("Shopping center parking layout")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("generated city uses 3D cars by default and keeps one road visitor through reload and departure", async ({
  page,
}) => {
  test.setTimeout(210000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/tilefun/workshop.html#/tool/parking-lab?play=1&city=1");
  const canvas = page.getByLabel("Playable shopping center");
  await expect(canvas).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await expect(canvas).toHaveAttribute("data-renderer", "gpu");
  await expect
    .poll(
      () =>
        canvas.evaluate(
          (c) =>
            (
              c as import("../src/workshop/ParkingPlay.js").ParkingCanvas
            ).__presentationDiagnostics?.().meshDraws ?? 0,
        ),
      { timeout: 30000 },
    )
    .toBeGreaterThan(0);
  const status = async () =>
    JSON.parse((await canvas.getAttribute("data-parking")) ?? "null") as NonNullable<
      ScenarioResponse["parking"]
    > | null;
  await expect
    .poll(
      async () => {
        const p = await status();
        if (p) expect(p.maneuvers).toBeLessThanOrEqual(1);
        return p?.visits[0]?.phase;
      },
      { timeout: 65000, intervals: [250] },
    )
    .toBe("walking-to-shop");
  await page.getByRole("button", { name: "Pause trips", exact: true }).click();
  await expect
    .poll(async () => JSON.parse((await canvas.getAttribute("data-clock")) ?? "{}").running)
    .toBe(false);
  const before = await canvas.getAttribute("data-poses");
  await page.getByRole("button", { name: "Save / reload trips", exact: true }).click();
  await expect(canvas).toHaveAttribute("data-reload-count", "1");
  await expect.poll(() => canvas.getAttribute("data-poses")).toBe(before);
  await canvas.screenshot({ path: "/tmp/tilefun-city-shopping-3d.png" });
  await page.getByRole("button", { name: "Resume trips", exact: true }).click();
  await expect
    .poll(async () => (await status())?.completed, { timeout: 120000, intervals: [250] })
    .toBe(1);
  await expect.poll(async () => (await status())?.visits.length).toBe(0);
  expect(errors).toEqual([]);
});

test("main-game handoff realizes shopping centers and native parked cars", async ({ page }) => {
  test.setTimeout(60000);
  await page.goto("/tilefun/workshop.html#/tool/parking-lab?play=1&city=1");
  const link = await page
    .getByRole("link", { name: "Play this city in a new world", exact: true })
    .getAttribute("href");
  if (!link) throw Error("Missing generated city handoff");
  await page.goto(link);
  await page.getByPlaceholder("World name...").fill("City shopping integration");
  await page.getByRole("button", { name: "New World", exact: true }).click();
  await expect(page.locator("#game")).toHaveAttribute("data-ready", "true", { timeout: 30000 });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const game = (
          document.querySelector("#game") as unknown as {
            __game: import("../src/client/GameClient.js").GameClient;
          }
        ).__game;
        return {
          shopping: game.stateView.props.some((p) => p.type.startsWith("prop-shopping-v1-")),
          cars: game.stateView.entities.filter((e) => e.type.startsWith("vehicle-v1:compact-"))
            .length,
        };
      }),
    )
    .toEqual({ shopping: true, cars: expect.any(Number) });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const game = (
          document.querySelector("#game") as unknown as {
            __game: import("../src/client/GameClient.js").GameClient;
          }
        ).__game;
        return game.stateView.entities.filter((e) => e.type.startsWith("vehicle-v1:compact-"))
          .length;
      }),
    )
    .toBeGreaterThan(3);
  await page.screenshot({ path: "/tmp/tilefun-main-game-shopping.png" });
});
