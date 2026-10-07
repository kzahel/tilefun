import { expect, test } from "@playwright/test";
import type { TrafficCanvas } from "../src/workshop/TrafficPage.js";

test.use({ channel: "chromium" });
for (const renderer of ["canvas", "gpu"]) {
  test(`preview authority survives a stalled client and explicit lifecycle fences (${renderer})`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/tilefun/workshop.html?renderer=${renderer}#/tool/traffic`);
    const canvas = page.getByLabel("Generated traffic playground");
    await expect(canvas).toHaveAttribute("data-ready", "true");
    const diagnostic = () => canvas.evaluate((c: TrafficCanvas) => c.__presentationDiagnostics?.());
    await expect.poll(async () => (await diagnostic())?.authority.clock?.running).toBe(true);
    await expect.poll(async () => (await diagnostic())?.steps ?? 0).toBeGreaterThan(10);
    const before = await diagnostic();
    if (!before?.authority.clock) throw Error("Missing clock diagnostics");
    const beforeTicks = before.authority.clock.ticks;
    // Deliberately block only the renderer thread. An explicit-step lab would
    // advance authority by exactly the same capped catch-up inputs as the client.
    await page.evaluate(() => {
      const end = performance.now() + 650;
      while (performance.now() < end) {
        /* intentional client stall */
      }
    });
    await expect
      .poll(async () => {
        const now = await diagnostic();
        return (
          (now?.authority.clock?.ticks ?? 0) - beforeTicks - ((now?.steps ?? 0) - before.steps)
        );
      })
      .toBeGreaterThan(10);
    expect((await diagnostic())?.authority.channel.highWaterCount).toBeLessThan(1024);

    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect.poll(async () => (await diagnostic())?.authority.clock?.running).toBe(false);
    const paused = await diagnostic();
    await page.waitForTimeout(250);
    expect((await diagnostic())?.authority.clock?.ticks).toBe(paused?.authority.clock?.ticks);
    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect
      .poll(async () => (await diagnostic())?.authority.clock?.ticks ?? 0)
      .toBeGreaterThan(paused?.authority.clock?.ticks ?? 0);

    // Exercise the visibility handler without depending on headless browser tab
    // focus policy. This proves the lifecycle contract, not OS background timing.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", { configurable: true, value: true });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(async () => (await diagnostic())?.authority.clock?.running).toBe(false);
    const hidden = await diagnostic();
    await page.waitForTimeout(350);
    expect((await diagnostic())?.authority.clock?.ticks).toBe(hidden?.authority.clock?.ticks);
    await page.evaluate(() => {
      Reflect.deleteProperty(document, "hidden");
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect.poll(async () => (await diagnostic())?.authority.clock?.running).toBe(true);
    await expect
      .poll(async () => (await diagnostic())?.steps ?? 0)
      .toBeGreaterThan(hidden?.steps ?? 0);
    await page.getByRole("link", { name: "All tools", exact: true }).click();
    await expect.poll(() => page.workers().length).toBe(0);
    expect(errors).toEqual([]);
  });
}
