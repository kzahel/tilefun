import { expect, type Page, test } from "@playwright/test";
import { advancing, type Canvas, session, state } from "./helpers/p2pSession.js";

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
          window.p2pWire.maxLogical = Math.max(window.p2pWire.maxLogical, data.byteLength);
      });
    });
    await guest.keyboard.press("1");
    await expect.poll(async () => (await state(guest)).zoom).toBe(0.25);
    await expect.poll(async () => (await state(guest)).chunks).toBeGreaterThan(50);
    const limit = (await state(guest)).maxMessageSize;
    expect(limit).toBeGreaterThan(0);
    await expect.poll(() => guest.evaluate(() => window.p2pWire.maxLogical)).toBeGreaterThan(limit);
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
    const wire = await host.evaluate(() => window.p2pWire);
    expect(wire.sendFailures).toBe(0);
    expect(wire.maxSent).toBeGreaterThan(0);
    expect(wire.maxSent).toBeLessThanOrEqual(limit);
    expect(errors).toEqual([]);
  } finally {
    await dispose();
  }
});

/** Close the native channel through all five 2 s retries until the failure overlay shows. */
async function exhaust(guest: Page) {
  const attempts: string[] = [];
  guest.on("console", (message) => {
    if (message.text().includes("P2P reconnecting in")) attempts.push(message.text());
  });
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
  await expect(guest.getByRole("button", { name: "Back", exact: true })).toBeVisible();
  await expect(guest.getByText(/^Disconnected:/)).toHaveCount(0);
}

// Each case spends ten seconds in the product's fixed retry delays; Retry and Back
// each get their own exhausted guest instead of exhausting one guest twice.
test("short-lived P2P connections exhaust retries and Retry reloads a working guest", async ({
  browser,
}) => {
  test.setTimeout(90_000);
  const { guest, dispose } = await session(browser);
  try {
    await exhaust(guest);
    await Promise.all([
      guest.waitForEvent("load"),
      guest.getByRole("button", { name: "Retry", exact: true }).click(),
    ]);
    await expect(guest.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect.poll(async () => (await state(guest)).open).toBe(true);
    await advancing(guest);
    await expect(guest.getByText("Connection failed", { exact: true })).toBeHidden();
  } finally {
    await dispose();
  }
});

test("exhausted P2P retries leave a working Back control", async ({ browser }) => {
  test.setTimeout(90_000);
  const { guest, dispose } = await session(browser);
  try {
    await exhaust(guest);
    await guest.getByRole("button", { name: "Back", exact: true }).click();
    await expect(guest).not.toHaveURL(/join=/);
    await expect(guest.locator("#game")).toHaveAttribute("data-ready", "true");
    await expect(guest.getByText("Connection failed", { exact: true })).toBeHidden();
  } finally {
    await dispose();
  }
});
