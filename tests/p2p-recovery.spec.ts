import type { Server } from "node:http";
import { type Browser, expect, type Page, test } from "@playwright/test";
import { PeerServer } from "peer";
import type { DataConnection } from "peerjs";
import type { RemoteStateView } from "../src/client/ClientStateView.js";
import type { Camera } from "../src/rendering/Camera.js";

// Full bundled Chromium exercises native SCTP limits rather than a mocked channel model.
test.use({ channel: "chromium" });
interface Game {
  camera: Camera;
  stateView: RemoteStateView;
  netEmulatedTransport: { base: { conn: DataConnection | null } };
}
interface Wire {
  maxSent: number;
  sendFailures: number;
  maxLogical: number;
}
type Canvas = HTMLCanvasElement & { __game: Game };
type ProbeWindow = Window & { p2pWire: Wire };

async function installProbe(page: Page) {
  await page.addInitScript(() => {
    const wire: Wire = { maxSent: 0, sendFailures: 0, maxLogical: 0 };
    (window as ProbeWindow).p2pWire = wire;
    const send = RTCDataChannel.prototype.send;
    RTCDataChannel.prototype.send = function (data) {
      const bytes =
        typeof data === "string" ? data.length : data instanceof Blob ? data.size : data.byteLength;
      wire.maxSent = Math.max(wire.maxSent, bytes);
      try {
        send.call(this, data);
      } catch (error) {
        wire.sendFailures++;
        throw error;
      }
    };
  });
}
async function state(page: Page) {
  return page.evaluate(() => {
    const game = (document.querySelector("#game") as Canvas).__game;
    return {
      tick: game.stateView.serverTick,
      playerId: game.stateView.playerEntity.id,
      chunks: [...game.stateView.world.chunks.entries()].length,
      zoom: game.camera.zoom,
      open: game.netEmulatedTransport.base.conn?.open ?? false,
      maxMessageSize:
        game.netEmulatedTransport.base.conn?.peerConnection?.sctp?.maxMessageSize ?? 0,
    };
  });
}
async function advancing(page: Page) {
  const before = (await state(page)).tick;
  await expect.poll(async () => (await state(page)).tick).toBeGreaterThan(before + 5);
}

async function session(browser: Browser) {
  let broker!: Server;
  PeerServer({ port: 0, host: "127.0.0.1", path: "/peerjs" }, (server) => {
    broker = server;
  });
  await expect.poll(() => broker?.listening).toBe(true);
  const address = broker.address();
  if (!address || typeof address === "string") throw Error("Missing broker port");
  const peerServer = encodeURIComponent(`http://127.0.0.1:${address.port}/peerjs`);
  const hostContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const guestContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  const dispose = async () => {
    await Promise.all([hostContext.close(), guestContext.close()]);
    broker.close();
    broker.closeAllConnections();
  };
  try {
    await Promise.all([installProbe(host), installProbe(guest)]);
    const generation = encodeURIComponent(
      JSON.stringify({ type: "flat", version: "flat-v1", seed: 42, preset: "grass" }),
    );
    const hostId = `recovery-${crypto.randomUUID()}`;
    await host.goto(
      `/tilefun/?host&desktop=1&nogamepad&playerid=${hostId}&peerServer=${peerServer}&generation=${generation}`,
    );
    await expect(host.getByText("Hosting as Player 1", { exact: true })).toBeVisible();
    await host.getByRole("button", { name: "Back", exact: true }).click();
    await host.getByRole("button", { name: "Worlds", exact: true }).click();
    await host.getByRole("button", { name: "Create new world", exact: true }).click();
    await host.getByRole("button", { name: "New World", exact: true }).click();
    await expect(host.getByTestId("world-menu")).toBeHidden();
    await expect.poll(async () => (await state(host)).playerId).toBeGreaterThan(0);
    await host.keyboard.press("1");
    await expect.poll(async () => (await state(host)).chunks).toBeGreaterThan(50);
    await guest.goto(`/tilefun/?join=${hostId}&peerServer=${peerServer}&nogamepad`);
    await expect(guest.locator("#game")).toHaveAttribute("data-ready", "true", { timeout: 30_000 });
    await expect.poll(async () => (await state(guest)).playerId).toBeGreaterThan(0);
    await advancing(guest);
    return { host, guest, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
}

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
