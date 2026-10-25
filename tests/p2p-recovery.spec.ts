import { expect, test } from "@playwright/test";
import { advancing, type Canvas, type ProbeWindow, session, state } from "./helpers/p2pSession.js";

// Full bundled Chromium exercises native SCTP rather than a mocked channel model.
test.use({ channel: "chromium" });

test("large P2P zoom transfers and reconnect baselines remain fragmented and playable", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const { host, guest, dispose } = await session(browser);
  const errors: string[] = [];
  for (const page of [host, guest]) page.on("pageerror", (error) => errors.push(error.message));
  try {
    await guest.evaluate(() => {
      const conn = (document.querySelector("#game") as Canvas).__game.netEmulatedTransport.base
        .conn;
      conn?.on("data", (data) => {
        if (data instanceof ArrayBuffer || ArrayBuffer.isView(data))
          (window as ProbeWindow).p2pWire.maxLogical = Math.max(
            (window as ProbeWindow).p2pWire.maxLogical,
            data.byteLength,
          );
      });
    });
    await guest.keyboard.press("1");
    await expect.poll(async () => (await state(guest)).zoom).toBe(0.25);
    await expect.poll(async () => (await state(guest)).chunks).toBeGreaterThan(50);
    const limit = (await state(guest)).maxMessageSize;
    expect(limit).toBeGreaterThan(0);
    await expect
      .poll(() => guest.evaluate(() => (window as ProbeWindow).p2pWire.maxLogical))
      .toBeGreaterThan(limit);
    await advancing(guest);
    // Close the real native channel, then require fresh authoritative replication.
    await guest.evaluate(() =>
      (
        document.querySelector("#game") as Canvas
      ).__game.netEmulatedTransport.base.conn?.dataChannel.close(),
    );
    await expect(guest.getByText("Reconnecting to host...", { exact: true })).toBeVisible();
    await expect.poll(async () => (await state(guest)).open).toBe(true);
    await expect(guest.getByText("Reconnecting to host...", { exact: true })).toBeHidden();
    await expect.poll(async () => (await state(guest)).chunks).toBeGreaterThan(50);
    await advancing(guest);
    expect((await state(guest)).zoom).toBe(0.25);
    const wire = await host.evaluate(() => (window as ProbeWindow).p2pWire);
    expect(wire.sendFailures).toBe(0);
    expect(wire.maxSent).toBeGreaterThan(0);
    expect(wire.maxSent).toBeLessThanOrEqual(limit);
    expect(errors).toEqual([]);
  } finally {
    await dispose();
  }
});

test("short-lived P2P connections exhaust retries and leave a working Retry and Back overlay", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const { guest, dispose } = await session(browser);
  try {
    const attempts: string[] = [];
    guest.on("console", (message) => {
      if (message.text().includes("P2P reconnecting in")) attempts.push(message.text());
    });
    const exhaust = async () => {
      attempts.length = 0;
      for (let n = 0; n <= 5; n++) {
        await expect.poll(async () => (await state(guest)).open).toBe(true);
        await guest.evaluate(() =>
          (
            document.querySelector("#game") as Canvas
          ).__game.netEmulatedTransport.base.conn?.dataChannel.close(),
        );
        if (n < 5) await expect.poll(() => attempts.length).toBe(n + 1);
      }
      expect(attempts.map((message) => message.match(/attempt (\d\/5)/)?.[1])).toEqual([
        "1/5",
        "2/5",
        "3/5",
        "4/5",
        "5/5",
      ]);
      await expect(guest.getByText("Connection failed", { exact: true })).toBeVisible();
    };
    await exhaust();
    await expect(guest.getByText("Connection failed", { exact: true })).toBeVisible();
    await expect(guest.getByRole("button", { name: "Back", exact: true })).toBeVisible();
    await expect(guest.getByText(/^Disconnected:/)).toHaveCount(0);
    await Promise.all([
      guest.waitForEvent("load"),
      guest.getByRole("button", { name: "Retry", exact: true }).click(),
    ]);
    await expect(guest.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect.poll(async () => (await state(guest)).open).toBe(true);
    await advancing(guest);
    await expect(guest.getByText("Connection failed", { exact: true })).toBeHidden();
    await exhaust();
    await guest.getByRole("button", { name: "Back", exact: true }).click();
    await expect(guest).not.toHaveURL(/join=/);
    await expect(guest.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect(guest.getByText("Connection failed", { exact: true })).toBeHidden();
  } finally {
    await dispose();
  }
});
