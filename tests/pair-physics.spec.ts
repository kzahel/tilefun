import { expect, test } from "@playwright/test";

test.use({ channel: "chromium", viewport: { width: 1500, height: 1200 } });
test("two predicted views share a Worker Realm, step scripts, accept either seat and tear down", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tilefun/workshop.html#/tool/physics");
  const views = page.locator(".pair-stage"),
    host = views.nth(0),
    guest = views.nth(1);
  const value = async (seat: number, key: string) =>
    Number(await views.nth(seat).getAttribute(`data-${key}`));
  await expect(host).toHaveAttribute("data-ready", "true");
  await expect(guest).toHaveAttribute("data-ready", "true");
  expect(page.workers().some((worker) => worker.url().includes("pair.worker"))).toBe(true);
  await expect(guest).not.toHaveAttribute("data-first-push-gap", "");
  const firstContact = await guest.evaluate((element) => ({
    gap: Number(element.dataset.firstPushGap),
    playerTick: element.dataset.remoteDisplayTick,
    cubeTick: element.dataset.cubeDisplayTick,
    playerSource: element.dataset.remoteSource,
    cubeSource: element.dataset.cubeSource,
  }));
  expect(firstContact.gap).toBeLessThan(0.15);
  expect(firstContact.playerTick).toBe(firstContact.cubeTick);
  expect(firstContact.playerSource).toBe(firstContact.cubeSource);
  console.log("first visible contact", JSON.stringify(firstContact));
  await test.info().attach("first-visible-contact", {
    body: JSON.stringify(firstContact),
    contentType: "application/json",
  });
  await page.screenshot({
    path: test.info().outputPath("first-visible-contact.png"),
    fullPage: true,
  });
  await expect.poll(() => value(0, "tick")).toBeGreaterThan(160);
  await expect.poll(() => value(1, "compared-tick")).toBeGreaterThan(150);
  await expect.poll(() => value(1, "correction")).toBeLessThan(0.001);
  expect(await value(1, "prediction-tick")).toBeGreaterThan(await value(0, "prediction-tick"));
  expect(await value(1, "replica-ack")).toBeGreaterThan(100);
  await expect(guest).not.toHaveAttribute("data-first-push-gap", "");
  expect(await value(1, "first-push-gap")).toBeLessThan(0.15);
  await expect(guest).toHaveAttribute("data-cube-source", "buffered");
  expect(
    await guest.evaluate(
      (element) => element.dataset.cubeDisplayTick === element.dataset.remoteDisplayTick,
    ),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath("two-client-push.png"), fullPage: true });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.waitForTimeout(150);
  const paused = await value(0, "tick");
  await page.waitForTimeout(100);
  expect(await value(0, "tick")).toBe(paused);
  await page.getByRole("button", { name: "Step one tick", exact: true }).click();
  await expect.poll(() => value(0, "tick")).toBe(paused + 1);
  await page.getByRole("button", { name: "Resume", exact: true }).click();

  // A delayed guest responds locally before its authority replica receives the input.
  await page.getByRole("button", { name: "Control guest", exact: true }).first().click();
  await guest.locator("canvas").focus();
  const before = await value(1, "x");
  await page.keyboard.down("ArrowRight");
  await expect.poll(() => value(1, "x"), { intervals: [5, 10, 20] }).toBeGreaterThan(before + 0.12);
  expect(await value(1, "authority-x")).toBeLessThan(before + 0.08);
  await page.keyboard.up("ArrowRight");
  await expect.poll(() => value(1, "authority-x")).toBeGreaterThan(before + 0.12);
  await page.getByRole("button", { name: "Control host", exact: true }).first().click();
  await host.locator("canvas").focus();
  const hostBefore = await value(0, "x");
  await page.keyboard.down("ArrowLeft");
  await expect.poll(() => value(0, "x")).toBeLessThan(hostBefore - 0.15);
  await page.keyboard.up("ArrowLeft");

  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Shared lift and jump", exact: true }).click();
  await expect(host).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Replay script", exact: true }).click();
  await expect.poll(() => value(0, "tick")).toBe(0);
  await expect(host).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(() => value(0, "tick")).toBeGreaterThan(195);
  await page.getByRole("button", { name: "Authority ghost", exact: true }).click();
  await page.screenshot({ path: test.info().outputPath("two-client-lift.png"), fullPage: true });
  await test.info().attach("diagnostics", {
    body: await page.locator(".physics-stats").innerText(),
    contentType: "text/plain",
  });
  // The two-seat input router also accepts a standard controller and touch.
  await page.evaluate(() => {
    const state = { x: 0, buttons: Array.from({ length: 17 }, () => false) };
    Object.assign(window, { pairPad: state });
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
    state.buttons[3] = true;
  });
  await expect(page.locator(".pair-lab > p[role=status]")).toContainText("Controlling host");
  const pad = async (index: number, pressed: boolean, x = 0) =>
    page.evaluate(
      ({ index, pressed, x }) => {
        const state = Reflect.get(window, "pairPad") as { x: number; buttons: boolean[] };
        state.x = x;
        state.buttons[index] = pressed;
      },
      { index, pressed, x },
    );
  await pad(3, false);
  await pad(2, true);
  await expect(page.locator(".pair-lab > p[role=status]")).toContainText("Controlling guest");
  const padBefore = await value(1, "x");
  await pad(2, false, -1);
  await expect.poll(() => value(1, "x")).toBeLessThan(padBefore - 0.15);
  await pad(9, true);
  await expect(page.getByRole("button", { name: "Push while watched", exact: true })).toBeFocused();
  await pad(9, false);
  await pad(1, true);
  await expect(guest.locator("canvas")).toBeFocused();
  await pad(1, false);
  const left = page.locator(".pair-touch").getByRole("button", { name: "←", exact: true });
  const box = await left.boundingBox();
  if (!box) throw Error("Missing touch control");
  const touchBefore = await value(1, "x");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => value(1, "x")).toBeLessThan(touchBefore - 0.15);
  await page.mouse.up();
  // Browser boundary: the buffered path drives actual mesh positions, and
  // presentation comparisons do not replace/restart the authority Worker.
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Remote start / stop", exact: true }).click();
  await page.getByRole("button", { name: "Replay script", exact: true }).click();
  await expect.poll(() => value(0, "tick")).toBe(0);
  await expect(host).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(host).toHaveAttribute("data-ready", "true");
  await expect.poll(() => value(0, "tick")).toBeGreaterThan(140);
  await expect(guest).toHaveAttribute("data-remote-source", "buffered");
  expect(await value(1, "max-current-correction")).toBeGreaterThan(1);
  expect(await value(1, "max-displayed-step")).toBeLessThan(0.3);
  expect(await value(1, "displayed-remote-z")).toBeGreaterThan(2);
  await page.screenshot({
    path: test.info().outputPath("buffered-start-stop.png"),
    fullPage: true,
  });
  const workersBefore = page.workers();
  await page.getByRole("button", { name: "Remote: predicted", exact: true }).click();
  await expect(guest).toHaveAttribute("data-remote-source", "predicted");
  await page.getByRole("button", { name: "Corrections: smooth", exact: true }).click();
  await expect(page.getByRole("button", { name: "Corrections: raw", exact: true })).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.getByRole("button", { name: "Corrections: raw", exact: true }).click();
  await page.getByRole("button", { name: "Remote: buffered when clear", exact: true }).click();
  await expect(guest).toHaveAttribute("data-remote-source", "buffered");
  expect(page.workers()).toEqual(workersBefore);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Quick left / right", exact: true }).click();
  await page.getByRole("button", { name: "Replay script", exact: true }).click();
  await expect.poll(() => value(0, "tick")).toBe(0);
  await expect(host).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(() => value(0, "tick")).toBeGreaterThan(190);
  expect(await value(1, "max-current-correction")).toBeGreaterThan(1);
  expect(await value(1, "max-displayed-step")).toBeLessThan(0.5);
  await expect(guest).toHaveAttribute("data-cube-source", "buffered");
  expect(
    await guest.evaluate(
      (element) => element.dataset.cubeDisplayTick === element.dataset.remoteDisplayTick,
    ),
  ).toBe(true);
  await page.screenshot({ path: test.info().outputPath("quick-reversal.png"), fullPage: true });
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await page.getByRole("button", { name: "Players glancing / release", exact: true }).click();
  await page.getByRole("button", { name: "Replay script", exact: true }).click();
  await expect.poll(() => value(0, "tick")).toBe(0);
  await expect(host).toHaveAttribute("data-ready", "true");
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await expect.poll(() => value(0, "tick")).toBeGreaterThan(65);
  await page.screenshot({
    path: test.info().outputPath("players-glancing-contact.png"),
    fullPage: true,
  });
  await expect.poll(() => value(0, "tick")).toBeGreaterThan(140);
  const released = [await value(0, "authority-x"), await value(1, "authority-x")];
  await expect.poll(() => value(0, "tick")).toBeGreaterThan(220);
  for (const seat of [0, 1])
    expect(Math.abs((await value(seat, "authority-x")) - (released[seat] ?? 0))).toBeLessThan(
      0.002,
    );
  await page.screenshot({
    path: test.info().outputPath("players-glancing-released.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "All tools", exact: true }).click();
  await expect(views).toHaveCount(0);
  await expect
    .poll(() => page.workers().filter((worker) => worker.url().includes("pair.worker")).length)
    .toBe(0);
  expect(errors).toEqual([]);
});
