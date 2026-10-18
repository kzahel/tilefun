import type { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeServerMessage } from "../shared/binaryCodec.js";
import type { ServerMessage } from "../shared/protocol.js";
import { PeerGuestTransport } from "./PeerGuestTransport.js";

interface Connection extends EventEmitter {
  open: boolean;
  send(buffer: ArrayBuffer): void;
  close(): void;
}
interface MockPeer extends EventEmitter {
  connections: Connection[];
  connect: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}
const state = vi.hoisted(() => ({ peers: [] as MockPeer[] }));
vi.mock("./peerOptions.js", () => ({ peerOptions: () => ({ debug: 1 }) }));
vi.mock("peerjs", async () => {
  const { EventEmitter } = await import("node:events");
  return {
    default: class extends EventEmitter {
      open = true;
      id = "guest";
      connections: Connection[] = [];
      disconnected = false;
      destroy = vi.fn();
      reconnect = vi.fn();
      connect = vi.fn(() => {
        const conn = Object.assign(new EventEmitter(), {
          open: false,
          send: vi.fn(),
          close: vi.fn(() => {
            conn.open = false;
            conn.emit("close");
          }),
        });
        this.connections.push(conn);
        return conn;
      });
      constructor() {
        super();
        state.peers.push(this);
      }
    },
  };
});

function at<T>(items: T[], index: number): T {
  const item = items.at(index);
  if (!item) throw new Error(`Missing test item ${index}`);
  return item;
}

function open(conn: Connection) {
  conn.open = true;
  conn.emit("open");
}
function frame(conn: Connection, serverTick: number) {
  conn.emit(
    "data",
    encodeServerMessage({ type: "frame", serverTick, lastProcessedInputSeq: 0, playerEntityId: 7 }),
  );
}
async function connected() {
  const transport = new PeerGuestTransport("host", "player");
  const status = vi.fn();
  const messages = vi.fn<(msg: ServerMessage) => void>();
  transport.onStatus = status;
  transport.onMessage(messages);
  const ready = transport.ready();
  const peer = at(state.peers, -1);
  open(at(peer.connections, 0));
  await ready;
  return { transport, status, messages, peer };
}
const reconnects = (status: ReturnType<typeof vi.fn>) =>
  status.mock.calls.filter(([value]) => value === "reconnecting").map(([, detail]) => detail);

describe("PeerJS guest recovery", () => {
  beforeEach(() => {
    state.peers.length = 0;
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockImplementation(() => Date.now());
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("negotiates fragmentation and waits for server state after channel open", async () => {
    const { transport, peer, status } = await connected();
    expect(peer.connect).toHaveBeenCalledWith("host", {
      metadata: { uuid: "player" },
      reliable: true,
      serialization: "binary",
    });
    expect(status).not.toHaveBeenCalledWith("receiving-state", undefined);
    frame(at(peer.connections, 0), 1);
    expect(status).toHaveBeenCalledWith("receiving-state", undefined);
    transport.close();
  });

  it("bounds repeated open-then-close failures and leaves the recovery UI in control", async () => {
    const { transport, peer, status, messages } = await connected();
    at(peer.connections, 0).close();
    for (let attempt = 1; attempt <= 5; attempt++) {
      await vi.advanceTimersByTimeAsync(2000);
      const conn = at(peer.connections, attempt);
      open(conn);
      frame(conn, attempt);
      conn.close();
    }
    expect(reconnects(status)).toEqual([1, 2, 3, 4, 5].map((n) => `Attempt ${n}/5`));
    expect(status).toHaveBeenLastCalledWith("failed", expect.stringContaining("Retry or go back"));
    expect(messages.mock.calls.some(([m]) => m.type === "kicked")).toBe(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(peer.connect).toHaveBeenCalledTimes(6);
    expect(vi.getTimerCount()).toBe(0);
    transport.close();
  });

  it("ignores late data, ICE, errors and duplicate closes from an obsolete connection", async () => {
    const { transport, peer, status, messages } = await connected();
    const disconnect = vi.fn();
    transport.onDisconnect(disconnect);
    const old = at(peer.connections, 0);
    old.close();
    old.emit("error", new Error("late error"));
    old.emit("close");
    await vi.advanceTimersByTimeAsync(2000);
    open(at(peer.connections, 1));
    status.mockClear();
    old.emit("iceStateChanged", "checking");
    old.emit("open");
    frame(old, 500);
    old.emit("close");
    expect(status).not.toHaveBeenCalled();
    expect(messages).not.toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(peer.connect).toHaveBeenCalledTimes(2);
    transport.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("resets the budget only after ten seconds of advancing replication", async () => {
    const { transport, peer, status } = await connected();
    at(peer.connections, 0).close();
    await vi.advanceTimersByTimeAsync(2000);
    const conn = at(peer.connections, 1);
    open(conn);
    frame(conn, 1);
    for (let tick = 2; tick <= 11; tick++) {
      await vi.advanceTimersByTimeAsync(1000);
      frame(conn, tick);
    }
    conn.close();
    expect(reconnects(status)).toEqual(["Attempt 1/5", "Attempt 1/5"]);
    transport.close();
  });

  it("does not mistake a long open channel, repeated ticks or a long frame gap for health", async () => {
    const { transport, peer, status } = await connected();
    at(peer.connections, 0).close();
    await vi.advanceTimersByTimeAsync(2000);
    const conn = at(peer.connections, 1);
    open(conn);
    frame(conn, 1);
    await vi.advanceTimersByTimeAsync(11_000);
    frame(conn, 1);
    frame(conn, 2);
    conn.close();
    expect(reconnects(status)).toEqual(["Attempt 1/5", "Attempt 2/5"]);
    transport.close();
  });

  it("retries an attempt that never opens or emits close", async () => {
    const { transport, peer, status } = await connected();
    at(peer.connections, 0).close();
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(at(peer.connections, 1).close).toHaveBeenCalled();
    expect(reconnects(status)).toEqual(["Attempt 1/5", "Attempt 2/5"]);
    transport.close();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(peer.connect).toHaveBeenCalledTimes(2);
  });

  it("resolves initial readiness when a failed offer recovers on a subsequent attempt", async () => {
    const transport = new PeerGuestTransport("host", "player");
    const ready = transport.ready();
    const peer = at(state.peers, 0);
    peer.emit("error", Object.assign(new Error("missing host"), { type: "peer-unavailable" }));
    await vi.advanceTimersByTimeAsync(2000);
    open(at(peer.connections, 1));
    await expect(ready).resolves.toBeUndefined();
    transport.close();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("honors an already aborted join and cleans up pending readiness on close", async () => {
    const abort = new AbortController();
    abort.abort();
    const transport = new PeerGuestTransport("host", "player");
    await expect(transport.ready(30_000, abort.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
    expect(at(state.peers, 0).connect).not.toHaveBeenCalled();
    const pending = transport.ready();
    const rejected = expect(pending).rejects.toThrow("connection closed");
    transport.close();
    await rejected;
    expect(vi.getTimerCount()).toBe(0);
  });
});
