import { describe, expect, it, vi } from "vitest";
import { EventBusImpl } from "./EventBusImpl.js";

describe("EventBusImpl", () => {
  it("on + emit calls listener with data", () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();
    bus.on("test", cb);
    bus.emit("test", { foo: 42 });
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith({ foo: 42 });
  });

  it("emit with no listeners is a no-op", () => {
    const bus = new EventBusImpl();
    expect(() => bus.emit("nonexistent")).not.toThrow();
  });

  it("on returns unsubscribe that removes the listener", () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();
    const unsub = bus.on("test", cb);
    unsub();
    bus.emit("test");
    expect(cb).not.toHaveBeenCalled();
  });

  it("once fires callback only once", () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();
    bus.once("test", cb);
    bus.emit("test", "a");
    bus.emit("test", "b");
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith("a");
  });

  it("once unsubscribe works before event fires", () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();
    const unsub = bus.once("test", cb);
    unsub();
    bus.emit("test");
    expect(cb).not.toHaveBeenCalled();
  });

  it("multiple listeners fire in registration order", () => {
    const bus = new EventBusImpl();
    const order: number[] = [];
    bus.on("test", () => order.push(1));
    bus.on("test", () => order.push(2));
    bus.on("test", () => order.push(3));
    bus.emit("test");
    expect(order).toEqual([1, 2, 3]);
  });

  it("error in one listener does not prevent others from firing", () => {
    const bus = new EventBusImpl();
    const cb1 = vi.fn();
    const cb2 = vi.fn(() => {
      throw new Error("boom");
    });
    const cb3 = vi.fn();
    bus.on("test", cb1);
    bus.on("test", cb2);
    bus.on("test", cb3);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    bus.emit("test");
    spy.mockRestore();

    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
    expect(cb3).toHaveBeenCalledOnce();
  });

  it("clear removes all listeners", () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();
    bus.on("test", cb);
    bus.on("other", cb);
    bus.clear();
    bus.emit("test");
    bus.emit("other");
    expect(cb).not.toHaveBeenCalled();
  });

  it("emit with no data passes undefined", () => {
    const bus = new EventBusImpl();
    const cb = vi.fn();
    bus.on("test", cb);
    bus.emit("test");
    expect(cb).toHaveBeenCalledWith(undefined);
  });
});
