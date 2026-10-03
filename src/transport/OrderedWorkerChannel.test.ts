import { describe, expect, it } from "vitest";
import { type ChannelEnvelope, OrderedWorkerChannel } from "./OrderedWorkerChannel.js";

type Packet = { buffer?: ArrayBuffer; id: number };
const turn = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe("ordered Worker channel", () => {
  it("transfers owned buffers, preserves FIFO and waits for consumption credit", async () => {
    const wire: ChannelEnvelope<Packet>[] = [];
    const sender = new OrderedWorkerChannel<Packet>((m, transfer) =>
      wire.push(structuredClone(m, { transfer })),
    );
    const receiver = new OrderedWorkerChannel<Packet>((m) => sender.receive(m));
    const buffer = new ArrayBuffer(8);
    sender.send({ id: 1, buffer });
    await turn();
    expect(buffer.byteLength).toBe(0);
    sender.send({ id: 2 });
    await turn();
    expect(wire).toHaveLength(1);
    const first = wire.shift();
    if (!first) throw Error("Missing batch");
    receiver.receive(first);
    const received: number[] = [];
    receiver.pump((p) => received.push(p.id));
    await turn();
    const second = wire.shift();
    if (!second) throw Error("Missing second batch");
    receiver.receive(second);
    receiver.pump((p) => received.push(p.id));
    expect(received).toEqual([1, 2]);
    expect(sender.diagnostics().inFlight).toBe(0);
  });

  it("keeps a partially consumed batch ahead of later work", async () => {
    let envelope: ChannelEnvelope<Packet> | undefined;
    const sender = new OrderedWorkerChannel<Packet>((m) => {
      envelope = m;
    });
    const credits: ChannelEnvelope<Packet>[] = [];
    const receiver = new OrderedWorkerChannel<Packet>((m) => credits.push(m));
    for (let id = 0; id < 4; id++) sender.send({ id });
    await turn();
    if (!envelope) throw Error("Missing batch");
    receiver.receive(envelope);
    const received: number[] = [];
    receiver.pump((p) => received.push(p.id), 0);
    expect(credits).toEqual([]);
    expect(receiver.diagnostics().incoming).toBe(3);
    receiver.pump((p) => received.push(p.id), Infinity);
    expect(received).toEqual([0, 1, 2, 3]);
    expect(credits).toEqual([{ kind: "credit" }]);
  });

  it("bounds queued ownership and discards scheduled sends on close", async () => {
    let posted = 0;
    const channel = new OrderedWorkerChannel<Packet>(() => posted++);
    for (let id = 0; id < 1024; id++) channel.send({ id });
    expect(() => channel.send({ id: 1024 })).toThrow(/bound/);
    channel.close();
    await turn();
    expect(posted).toBe(0);
    expect(channel.diagnostics().queued).toBe(0);
  });

  it("rejects unsolicited credits and overlapping inbound batches", () => {
    const channel = new OrderedWorkerChannel<Packet>(() => {});
    expect(() => channel.receive({ kind: "credit" })).toThrow(/credit/);
    channel.receive({ kind: "batch", items: [{ id: 1 }] });
    expect(() => channel.receive({ kind: "batch", items: [{ id: 2 }] })).toThrow(/credit/);
  });
});
