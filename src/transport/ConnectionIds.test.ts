import { EventEmitter } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { PeerHostTransport } from "./PeerHostTransport.js";
import { isConnectionId } from "./Transport.js";
import { WebRtcServerTransport } from "./WebRtcServerTransport.js";
import { WebSocketServerTransport } from "./WebSocketServerTransport.js";
import type { WorkerClientTransport } from "./WorkerClientTransport.js";

// A connection id names a device; `#` separates a device from its seats (226), so the
// server transports close a connection whose id holds one.

const peers = vi.hoisted(() => [] as EventEmitter[]);
vi.mock("./peerOptions.js", () => ({ peerOptions: () => ({ debug: 1 }) }));
vi.mock("peerjs", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    default: class extends EventEmitter {
      options = {};
      destroy = vi.fn();
      constructor() {
        super();
        peers.push(this);
      }
    },
  };
});

const cleanups: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

it("accepts device ids and refuses empty ones and seat addresses", () => {
  expect(["dev-b", "local", "9f1c-uuid"].map(isConnectionId)).toEqual([true, true, true]);
  expect(["", "dev-b#1", "#", undefined, 7].map(isConnectionId)).toEqual([
    false,
    false,
    false,
    false,
    false,
  ]);
});

describe("server transports", () => {
  it("closes a WebSocket whose uuid holds the seat separator", async () => {
    const server = createServer();
    const transport = new WebSocketServerTransport({ server });
    cleanups.push(
      () => new Promise<void>((done) => server.close(() => done())),
      () => transport.close(),
    );
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const { port } = server.address() as AddressInfo;
    const connected = vi.fn();
    transport.onConnect(connected);
    const closeCode = (uuid: string) =>
      new Promise<number>((done) => {
        const socket = new WebSocket(`ws://127.0.0.1:${port}/?uuid=${encodeURIComponent(uuid)}`);
        socket.on("open", () => setTimeout(() => socket.close(1000), 20));
        socket.on("close", (code) => done(code));
      });
    expect(await closeCode("dev-b#1")).toBe(4000);
    expect(connected).not.toHaveBeenCalled();
    expect(await closeCode("dev-b")).toBe(1000);
    expect(connected).toHaveBeenCalledWith("dev-b");
  });

  it("closes a WebRTC signaling socket whose uuid holds the seat separator", async () => {
    const server = createServer();
    const transport = await WebRtcServerTransport.create({ server });
    cleanups.push(
      () => new Promise<void>((done) => server.close(() => done())),
      () => transport.close(),
    );
    await new Promise<void>((done) => server.listen(0, "127.0.0.1", done));
    const { port } = server.address() as AddressInfo;
    const connected = vi.fn();
    transport.onConnect(connected);
    const code = await new Promise<number>((done) => {
      const socket = new WebSocket(`ws://127.0.0.1:${port}/?uuid=${encodeURIComponent("dev-b#1")}`);
      socket.on("close", (closed) => done(closed));
    });
    expect(code).toBe(4000);
    expect(connected).not.toHaveBeenCalled();
  });

  it("closes a peer connection whose uuid holds the seat separator", () => {
    const attachPeer = vi.fn((_id: string) => ({ close: vi.fn() }));
    const host = new PeerHostTransport({ attachPeer } as unknown as WorkerClientTransport);
    cleanups.push(() => host.close());
    const peer = peers.at(-1);
    const connection = (uuid: string) =>
      Object.assign(new EventEmitter(), { metadata: { uuid }, open: true, close: vi.fn() });
    const refused = connection("dev-b#1");
    peer?.emit("connection", refused);
    refused.emit("open");
    expect(refused.close).toHaveBeenCalled();
    const accepted = connection("dev-b");
    peer?.emit("connection", accepted);
    accepted.emit("open");
    expect(accepted.close).not.toHaveBeenCalled();
    expect(attachPeer.mock.calls.map(([id]) => id)).toEqual(["dev-b"]);
  });
});
