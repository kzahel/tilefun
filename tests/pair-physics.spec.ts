import { expect, test } from "@playwright/test";

test.use({ channel: "chromium", viewport: { width: 1500, height: 1200 } });
test("ordinary two-session Worker lab routes either seat, fences delayed frames, reloads and tears down", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/workshop.html#/tool/physics");
  const host = page.getByLabel("Host physics view"),
    guest = page.getByLabel("Guest physics view");
  const x = async (seat: typeof host) => Number(await seat.getAttribute("data-x"));
  const tick = async (seat: typeof host) => Number(await seat.getAttribute("data-tick"));
  await expect(host).toHaveAttribute("data-ready", "true");
  await expect(guest).toHaveAttribute("data-ready", "true");
  expect(page.workers().some((worker) => worker.url().includes("scenario.worker"))).toBe(true);
  const start = await x(host);
  await host.focus();
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => (await x(host)) - start).toBeGreaterThan(10);
  await page.keyboard.up("ArrowRight");
  await page.getByRole("button", { name: "Guest RTT 200ms", exact: true }).click();
  const guestStart = await x(guest);
  await page.getByRole("button", { name: "Control guest", exact: true }).click();
  await page.keyboard.down("ArrowLeft");
  await expect.poll(async () => guestStart - (await x(guest))).toBeGreaterThan(8);
  await page.keyboard.up("ArrowLeft");
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect.poll(async () => Math.abs((await tick(host)) - (await tick(guest)))).toBe(0);
  await expect(host).toHaveAttribute("data-ready", "true");
  const paused = await tick(host);
  await page.getByRole("button", { name: "Step", exact: true }).click();
  await expect.poll(async () => (await tick(host)) - paused).toBe(1);
  await expect.poll(async () => (await tick(guest)) - paused).toBe(1);
  const epoch = await host.getAttribute("data-epoch");
  const saved = [await x(host), await x(guest)];
  await page.getByRole("button", { name: "Save / reload", exact: true }).click();
  await expect(host).not.toHaveAttribute("data-epoch", epoch ?? "");
  await expect(host).toHaveAttribute("data-ready", "true");
  await expect(guest).toHaveAttribute("data-ready", "true");
  expect(await x(host)).toBeCloseTo(saved[0] ?? Infinity, 1);
  expect(await x(guest)).toBeCloseTo(saved[1] ?? Infinity, 1);
  await page.screenshot({ path: test.info().outputPath("shared-coop.png"), fullPage: true });
  await page.getByRole("button", { name: "head", exact: true }).click();
  await expect(host).toHaveAttribute("data-ready", "true");
  await expect(guest).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(async () => await tick(host)).toBeGreaterThan(5);
  // Exercise real browser polling/focus routing with a standard synthetic pad.
  await guest.focus();
  await page.evaluate(() => {
    const pad = {
      connected: true,
      mapping: "standard",
      index: 0,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", { configurable: true, value: () => [pad] });
    (window as unknown as { physicsPad: typeof pad }).physicsPad = pad;
  });
  const padButton = async (index: number, pressed: boolean) =>
    page.evaluate(
      ({ index, pressed }) => {
        const button = (window as unknown as { physicsPad: { buttons: { pressed: boolean }[] } })
          .physicsPad.buttons[index];
        if (!button) throw Error("Missing synthetic controller button");
        button.pressed = pressed;
      },
      { index, pressed },
    );
  await page.waitForTimeout(50);
  const padStart = await x(guest);
  await page.evaluate(() => {
    (window as unknown as { physicsPad: { axes: number[] } }).physicsPad.axes[0] = 1;
  });
  await expect.poll(async () => (await x(guest)) - padStart).toBeGreaterThan(5);
  await page.evaluate(() => {
    (window as unknown as { physicsPad: { axes: number[] } }).physicsPad.axes[0] = 0;
  });
  await page.waitForTimeout(50);
  await padButton(9, true);
  await expect(page.getByRole("button", { name: "push", exact: true })).toBeFocused();
  await padButton(9, false);
  await page.waitForTimeout(50);
  await padButton(1, true);
  await expect(guest).toBeFocused();
  await padButton(1, false);
  // Touch: a drag on the guest pane is the game's joystick for that seat (226 slice 2).
  const touchStart = await x(guest);
  const box = await guest.boundingBox();
  if (!box) throw Error("Missing guest view");
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  const from = { x: box.x + box.width / 3, y: box.y + box.height / 2 };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: from.x + 60, y: from.y }],
  });
  await expect.poll(async () => (await x(guest)) - touchStart).toBeGreaterThan(5);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
  await page.goto("/tilefun/workshop.html#/tool/characters");
  await expect
    .poll(() => page.workers().filter((worker) => worker.url().includes("scenario.worker")).length)
    .toBe(0);
  expect(errors).toEqual([]);
});

test("delayed guest drives a fully rotating car seen by both ordinary client views", async ({
  page,
}) => {
  test.setTimeout(60000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/workshop.html?scene=vehicle#/tool/physics");
  const host = page.getByLabel("Host physics view"),
    guest = page.getByLabel("Guest physics view");
  await expect(host).toHaveAttribute("data-ready", "true");
  await expect(guest).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Guest RTT 200ms", exact: true }).click();
  await guest.focus();
  await page.keyboard.press("e");
  await expect(guest).not.toHaveAttribute("data-mount", "");
  await page.keyboard.down("ArrowUp");
  try {
    await expect
      .poll(async () => Number(await host.getAttribute("data-car-z")))
      .toBeGreaterThan(12);
    await expect
      .poll(async () => Number(await guest.getAttribute("data-car-z")))
      .toBeGreaterThan(12);
  } finally {
    await page.keyboard.up("ArrowUp");
  }
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect
    .poll(async () =>
      Math.abs(
        Number(await host.getAttribute("data-car-x")) -
          Number(await guest.getAttribute("data-car-x")),
      ),
    )
    .toBeLessThan(0.05);
  const rotations = await Promise.all(
    [host, guest].map(
      async (c) => JSON.parse((await c.getAttribute("data-car-rotation")) ?? "null") as number[],
    ),
  );
  expect(
    Math.abs(
      (rotations[0] ?? []).reduce((sum, value, i) => sum + value * (rotations[1]?.[i] ?? 0), 0),
    ),
  ).toBeCloseTo(1, 3);
  const epoch = await host.getAttribute("data-epoch");
  await page.getByRole("button", { name: "Save / reload", exact: true }).click();
  await expect(host).not.toHaveAttribute("data-epoch", epoch ?? "");
  await expect(guest).toHaveAttribute("data-ready", "true");
  await expect(guest).not.toHaveAttribute("data-mount", "");
  await page.screenshot({ path: test.info().outputPath("two-client-vehicle.png"), fullPage: true });
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  await expect
    .poll(() => page.workers().filter((w) => w.url().includes("scenario.worker")).length)
    .toBe(0);
  expect(errors).toEqual([]);
});
