import type { Server } from "node:http";
import { type Browser, expect, type Page } from "@playwright/test";
import { PeerServer } from "peer";
import type { DataConnection } from "peerjs";
import type { RemoteStateView } from "../../src/client/ClientStateView.js";
import type { Camera } from "../../src/rendering/Camera.js";

export interface Game {
  camera: Camera;
  stateView: RemoteStateView;
  netEmulatedTransport: { base: { conn: DataConnection | null } };
}
export interface Wire {
  maxSent: number;
  sendFailures: number;
  maxLogical: number;
}
export type Canvas = HTMLCanvasElement & { __game: Game };
export type ProbeWindow = Window & { p2pWire: Wire };

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
export async function state(page: Page) {
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
export async function advancing(page: Page) {
  const before = (await state(page)).tick;
  await expect.poll(async () => (await state(page)).tick).toBeGreaterThan(before + 5);
}

export async function session(browser: Browser, overview = true) {
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
    if (overview) {
      await host.keyboard.press("1");
      await expect.poll(async () => (await state(host)).chunks).toBeGreaterThan(50);
    }
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
