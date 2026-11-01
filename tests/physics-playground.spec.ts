import { expect, test } from "@playwright/test";

test.use({ channel: "chromium", viewport: { width: 1440, height: 1100 } });

test("physics Worker, real input, long-bridge culling and teardown work in Chromium", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/workshop.html#/tool/physics?mode=single");
  const stage = page.locator(".physics-stage"),
    canvas = stage.locator("canvas");
  const value = async (key: string) => Number(await stage.getAttribute(`data-${key}`));
  await expect(stage).toHaveAttribute("data-ready", "true");
  expect(page.workers().some((worker) => worker.url().includes("physics.worker"))).toBe(true);
  await canvas.focus();
  await page.keyboard.down("ArrowRight");
  await expect.poll(() => value("x"), { timeout: 6000 }).toBeGreaterThan(0.5);
  await page.keyboard.up("ArrowRight");
  await expect.poll(() => value("feet")).toBeGreaterThan(2.45);
  await page.screenshot({ path: test.info().outputPath("deck.png"), fullPage: true });

  await page.getByRole("button", { name: "Under bridge", exact: true }).click();
  await expect.poll(() => value("z")).toBeGreaterThan(4.5);
  await expect.poll(() => value("feet")).toBeLessThan(0.1);
  await page.keyboard.down("ArrowUp");
  await expect.poll(() => value("z")).toBeLessThan(0.4);
  await page.keyboard.up("ArrowUp");
  expect(await value("feet")).toBeLessThan(0.1);
  await page.getByRole("button", { name: "See through deck" }).click();
  await page.screenshot({ path: test.info().outputPath("underpass.png"), fullPage: true });

  // Pointer capture routes a real held movement button and stops after release.
  const right = stage.getByRole("button", { name: "→", exact: true });
  const bounds = await right.boundingBox();
  if (!bounds) throw Error("Missing movement button");
  const beforeTouch = await value("x");
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  await page.mouse.down();
  await expect.poll(() => value("x")).toBeGreaterThan(beforeTouch + 0.3);
  await page.mouse.up();

  await page.getByRole("button", { name: "1024 m bridge", exact: true }).click();
  await expect(stage).toHaveAttribute("data-sections", "256");
  await expect.poll(() => value("total")).toBeGreaterThan(1000);
  await expect.poll(() => value("draws")).toBeLessThan(60);
  await page.getByRole("button", { name: "Far end", exact: true }).click();
  await expect.poll(() => value("x")).toBeGreaterThan(1030);
  await expect.poll(() => value("draws")).toBeLessThan(60);
  await page.getByRole("button", { name: "Drop 25 objects · X", exact: true }).click();
  await expect.poll(() => value("bodies")).toBe(35);

  // Standard controller movement and menu confirm/back use the same actions.
  await page.evaluate(() => {
    const state = { x: 0, buttons: Array.from({ length: 17 }, () => false) };
    Object.assign(window, { physicsPad: state });
    Object.defineProperty(navigator, "getGamepads", {
      configurable: true,
      value: () => [
        {
          connected: true,
          axes: [state.x, 0],
          buttons: state.buttons.map((pressed) => ({ pressed, value: Number(pressed) })),
        },
      ],
    });
    state.x = -1;
  });
  const controllerX = await value("x");
  await expect.poll(() => value("x")).toBeLessThan(controllerX - 0.3);
  const pad = async (index: number, pressed: boolean) =>
    page.evaluate(
      ({ index, pressed }) => {
        const state = Reflect.get(window, "physicsPad") as { x: number; buttons: boolean[] };
        state.x = 0;
        state.buttons[index] = pressed;
      },
      { index, pressed },
    );
  await pad(9, true);
  await expect(page.getByRole("button", { name: "Ramp start", exact: true })).toBeFocused();
  await pad(9, false);
  await pad(0, true);
  await expect.poll(() => value("x")).toBeLessThan(0);
  await pad(0, false);
  await pad(1, true);
  await expect(canvas).toBeFocused();
  await pad(1, false);

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(stage.getByRole("status")).toHaveText("Paused");
  await page.waitForTimeout(150);
  const paused = await value("tick");
  await page.waitForTimeout(200);
  expect(await value("tick")).toBe(paused);
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(() => value("tick")).toBeGreaterThan(paused);
  await page.screenshot({ path: test.info().outputPath("long-bridge.png"), fullPage: true });
  await test.info().attach("diagnostics", {
    body: await page.locator(".physics-stats").innerText(),
    contentType: "text/plain",
  });
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  await expect(stage).toHaveCount(0);
  await expect
    .poll(() => page.workers().filter((worker) => worker.url().includes("physics.worker")).length)
    .toBe(0);
  expect(errors).toEqual([]);
});

test("predicted Realm movement responds ahead of delayed authority and recovers from stalls", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/workshop.html#/tool/physics?mode=single");
  const stage = page.locator(".physics-stage");
  const number = async (name: string) => Number(await stage.getAttribute(`data-${name}`));
  await expect(stage).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Under bridge", exact: true }).click();
  await expect.poll(() => number("z")).toBeGreaterThan(4.5);
  await page.getByRole("button", { name: "200 ms RTT + jitter", exact: true }).click();
  await page.getByRole("button", { name: "Authority ghost", exact: true }).click();
  const before = await number("x");
  await stage.locator("canvas").focus();
  await page.keyboard.down("ArrowRight");
  await expect
    .poll(() => number("predicted-x"), { intervals: [5, 10, 20], timeout: 1000 })
    .toBeGreaterThan(before + 0.1);
  expect(await number("x")).toBeLessThan(before + 0.03);
  await page.keyboard.up("ArrowRight");
  await expect.poll(() => number("x")).toBeGreaterThan(before + 0.1);
  await expect
    .poll(async () => Math.abs((await number("engine-x")) / 16 - (await number("x"))))
    .toBeLessThan(0.01);
  await expect.poll(async () => (await number("engine-ack")) - (await number("ack"))).toBe(0);
  await expect.poll(() => number("pending")).toBeLessThan(40);

  await page.getByRole("button", { name: "Moving lift", exact: true }).click();
  await expect.poll(() => number("z")).toBeGreaterThan(6.5);
  await page.waitForTimeout(1000);
  expect(await number("feet")).toBeGreaterThan(0.1);
  await page.screenshot({ path: test.info().outputPath("predicted-lift.png"), fullPage: true });

  const recovery = await number("recovery"),
    sent = await number("sent");
  await page.getByRole("button", { name: "Stall client 500 ms", exact: true }).click();
  await expect.poll(() => number("recovery")).toBeGreaterThan(recovery);
  await expect(stage).toHaveAttribute("data-prediction-status", "ready");
  expect(await number("sent")).toBeGreaterThanOrEqual(sent);
  const tick = await number("tick");
  await page.getByRole("button", { name: "Stall authority 500 ms", exact: true }).click();
  await expect.poll(() => number("tick"), { timeout: 5000 }).toBeGreaterThan(tick + 20);
  await expect.poll(() => number("pending")).toBeLessThan(80);
  await page.getByRole("button", { name: "Resync now", exact: true }).click();
  await expect.poll(() => number("pending")).toBeLessThan(20);
  await expect(stage).toHaveAttribute("data-prediction-status", "ready");
  await page.getByRole("button", { name: "View: predicted", exact: true }).click();
  await expect
    .poll(async () => Math.abs((await number("display-x")) - (await number("x"))))
    .toBeLessThan(0.001);
  await page.getByRole("button", { name: "View: authority", exact: true }).click();
  await test.info().attach("prediction diagnostics", {
    body: await page.locator(".physics-stats").innerText(),
    contentType: "text/plain",
  });
  expect(errors).toEqual([]);
});
