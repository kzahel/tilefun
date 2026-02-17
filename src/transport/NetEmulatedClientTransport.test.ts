import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import { NetEmulatedClientTransport } from "./NetEmulatedClientTransport.js";
import type { IClientTransport } from "./Transport.js";

class MockClientTransport implements IClientTransport {
  sent: ClientMessage[] = [];
  closed = false;
  bytesReceived = 1234;
  private handler: ((msg: ServerMessage) => void) | null = null;

  send(msg: ClientMessage): void {
    this.sent.push(msg);
  }

  onMessage(handler: (msg: ServerMessage) => void): void {
    this.handler = handler;
  }

  emit(msg: ServerMessage): void {
    this.handler?.(msg);
  }

  close(): void {
    this.closed = true;
  }
}

function makeClientMsg(seq: number): ClientMessage {
  return { type: "player-input", seq, dx: 1, dy: 0, sprinting: false, jump: false };
}

function makeServerMsg(entityId: number): ServerMessage {
  return { type: "player-assigned", entityId };
}

describe("NetEmulatedClientTransport", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("passes through immediately when disabled", () => {
    const base = new MockClientTransport();
    const netem = new NetEmulatedClientTransport(base);
    const onMsg = vi.fn();
    netem.onMessage(onMsg);

    netem.send(makeClientMsg(1));
    base.emit(makeServerMsg(7));

    expect(base.sent).toHaveLength(1);
    expect(onMsg).toHaveBeenCalledTimes(1);
    expect(onMsg).toHaveBeenCalledWith({ type: "player-assigned", entityId: 7 });
  });

  it("drops tx packets according to configured loss", () => {
    const base = new MockClientTransport();
    const netem = new NetEmulatedClientTransport(base);
    netem.setConfig({ enabled: true, txLossPct: 100 });

    netem.send(makeClientMsg(1));
    netem.send(makeClientMsg(2));

    expect(base.sent).toHaveLength(0);
  });

  it("applies rx latency before delivering message", () => {
    const base = new MockClientTransport();
    const netem = new NetEmulatedClientTransport(base);
    const onMsg = vi.fn();
    netem.onMessage(onMsg);
    netem.setConfig({ enabled: true, rxLatencyMs: 120 });

    base.emit(makeServerMsg(9));
    expect(onMsg).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(119);
    expect(onMsg).toHaveBeenCalledTimes(0);

    vi.advanceTimersByTime(1);
    expect(onMsg).toHaveBeenCalledTimes(1);
    expect(onMsg).toHaveBeenCalledWith({ type: "player-assigned", entityId: 9 });
  });

  it("applies jitter symmetrically around base delay", () => {
    const base = new MockClientTransport();
    const netem = new NetEmulatedClientTransport(base);
    netem.setConfig({ enabled: true, txLatencyMs: 100, txJitterMs: 40, txLossPct: 0 });

    const rng = vi.spyOn(Math, "random");
    rng.mockReturnValue(0.5); // no drop check
    rng.mockReturnValue(1); // max positive jitter => +40ms
    netem.send(makeClientMsg(1));
    expect(base.sent).toHaveLength(0);
    vi.advanceTimersByTime(139);
    expect(base.sent).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(base.sent).toHaveLength(1);

    rng.mockRestore();
  });

  it("proxies bytesReceived and clears pending timers on close", () => {
    const base = new MockClientTransport();
    const netem = new NetEmulatedClientTransport(base);
    const onMsg = vi.fn();
    netem.onMessage(onMsg);
    netem.setConfig({ enabled: true, rxLatencyMs: 200 });

    expect(netem.bytesReceived).toBe(1234);
    base.emit(makeServerMsg(11));
    netem.close();
    vi.advanceTimersByTime(1000);

    expect(base.closed).toBe(true);
    expect(onMsg).toHaveBeenCalledTimes(0);
  });
});
