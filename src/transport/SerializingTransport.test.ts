import { describe, expect, it, vi } from "vitest";
import { SerializingTransport } from "./SerializingTransport.js";

describe("SerializingTransport", () => {
  it("client send dispatches to server handler", () => {
    const transport = new SerializingTransport();
    const handler = vi.fn();
    transport.serverSide.onMessage(handler);

    transport.clientSide.send({
      type: "player-input",
      seq: 1,
      dx: 1,
      dy: 0,
      sprinting: false,
      jump: false,
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith("local", {
      type: "player-input",
      seq: 1,
      dx: 1,
      dy: 0,
      sprinting: false,
      jump: false,
    });
  });

  it("server send dispatches to client handler", () => {
    const transport = new SerializingTransport();
    const handler = vi.fn();
    transport.clientSide.onMessage(handler);

    transport.serverSide.send("local", {
      type: "player-assigned",
      entityId: 42,
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({
      type: "player-assigned",
      entityId: 42,
    });
  });

  it("server broadcast dispatches to client handler", () => {
    const transport = new SerializingTransport();
    const handler = vi.fn();
    transport.clientSide.onMessage(handler);

    transport.serverSide.broadcast({
      type: "player-assigned",
      entityId: 7,
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it("messages are deep copies (no shared references)", () => {
    const transport = new SerializingTransport();
    let received: unknown = null;
    transport.serverSide.onMessage((_clientId, msg) => {
      received = msg;
    });

    const original = {
      type: "player-input" as const,
      seq: 1,
      dx: 1,
      dy: 0,
      sprinting: false,
      jump: false,
    };
    transport.clientSide.send(original);

    expect(received).toEqual(original);
    expect(received).not.toBe(original);
  });

  it("triggerConnect fires connect handler with 'local' client ID", () => {
    const transport = new SerializingTransport();
    const handler = vi.fn();
    transport.serverSide.onConnect(handler);

    transport.triggerConnect();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith("local");
  });

  it("triggerDisconnect fires disconnect handler", () => {
    const transport = new SerializingTransport();
    const handler = vi.fn();
    transport.serverSide.onDisconnect(handler);

    transport.triggerDisconnect();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith("local");
  });

  it("close() prevents further messages", () => {
    const transport = new SerializingTransport();
    const handler = vi.fn();
    transport.serverSide.onMessage(handler);

    transport.clientSide.close();
    transport.clientSide.send({
      type: "player-input",
      seq: 1,
      dx: 1,
      dy: 0,
      sprinting: false,
      jump: false,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("messages are delivered synchronously", () => {
    const transport = new SerializingTransport();
    const order: string[] = [];

    transport.serverSide.onMessage(() => {
      order.push("received");
    });

    order.push("before");
    transport.clientSide.send({
      type: "player-input",
      seq: 1,
      dx: 0,
      dy: 0,
      sprinting: false,
      jump: false,
    });
    order.push("after");

    expect(order).toEqual(["before", "received", "after"]);
  });
});
