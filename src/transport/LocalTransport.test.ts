import { describe, expect, it, vi } from "vitest";
import { LocalTransport } from "./LocalTransport.js";

describe("LocalTransport", () => {
  it("client send dispatches to server handler synchronously", () => {
    const transport = new LocalTransport();
    const handler = vi.fn();
    transport.serverSide.onMessage(handler);

    transport.clientSide.send({
      type: "player-input",
      dx: 1,
      dy: 0,
      sprinting: false,
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith("local", {
      type: "player-input",
      dx: 1,
      dy: 0,
      sprinting: false,
    });
  });

  it("server send dispatches to client handler", () => {
    const transport = new LocalTransport();
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
    const transport = new LocalTransport();
    const handler = vi.fn();
    transport.clientSide.onMessage(handler);

    transport.serverSide.broadcast({
      type: "player-assigned",
      entityId: 7,
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it("triggerConnect fires connect handler with 'local' client ID", () => {
    const transport = new LocalTransport();
    const handler = vi.fn();
    transport.serverSide.onConnect(handler);

    transport.triggerConnect();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith("local");
  });

  it("triggerDisconnect fires disconnect handler", () => {
    const transport = new LocalTransport();
    const handler = vi.fn();
    transport.serverSide.onDisconnect(handler);

    transport.triggerDisconnect();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith("local");
  });

  it("close() prevents further messages", () => {
    const transport = new LocalTransport();
    const handler = vi.fn();
    transport.serverSide.onMessage(handler);

    transport.clientSide.close();
    transport.clientSide.send({
      type: "player-input",
      dx: 1,
      dy: 0,
      sprinting: false,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("messages are delivered synchronously", () => {
    const transport = new LocalTransport();
    const order: string[] = [];

    transport.serverSide.onMessage(() => {
      order.push("received");
    });

    order.push("before");
    transport.clientSide.send({
      type: "player-input",
      dx: 0,
      dy: 0,
      sprinting: false,
    });
    order.push("after");

    expect(order).toEqual(["before", "received", "after"]);
  });
});
