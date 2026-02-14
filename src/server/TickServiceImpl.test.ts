import { describe, expect, it, vi } from "vitest";
import { TickServiceImpl } from "./TickServiceImpl.js";

describe("TickServiceImpl", () => {
  it("onPreSimulation callback fires on firePre", () => {
    const tick = new TickServiceImpl();
    const cb = vi.fn();
    tick.onPreSimulation(cb);
    tick.firePre(0.016);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(0.016);
  });

  it("onPostSimulation callback fires on firePost", () => {
    const tick = new TickServiceImpl();
    const cb = vi.fn();
    tick.onPostSimulation(cb);
    tick.firePost(0.016);
    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith(0.016);
  });

  it("unsubscribe removes the callback", () => {
    const tick = new TickServiceImpl();
    const cb = vi.fn();
    const unsub = tick.onPreSimulation(cb);
    unsub();
    tick.firePre(0.016);
    expect(cb).not.toHaveBeenCalled();
  });

  it("multiple callbacks fire in registration order", () => {
    const tick = new TickServiceImpl();
    const order: number[] = [];
    tick.onPostSimulation(() => order.push(1));
    tick.onPostSimulation(() => order.push(2));
    tick.onPostSimulation(() => order.push(3));
    tick.firePost(0.016);
    expect(order).toEqual([1, 2, 3]);
  });

  it("error in one callback does not prevent others from firing", () => {
    const tick = new TickServiceImpl();
    const cb1 = vi.fn();
    const cb2 = vi.fn(() => {
      throw new Error("boom");
    });
    const cb3 = vi.fn();
    tick.onPreSimulation(cb1);
    tick.onPreSimulation(cb2);
    tick.onPreSimulation(cb3);

    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    tick.firePre(0.016);
    spy.mockRestore();

    expect(cb1).toHaveBeenCalledOnce();
    expect(cb2).toHaveBeenCalledOnce();
    expect(cb3).toHaveBeenCalledOnce();
  });

  it("pre and post callbacks are independent", () => {
    const tick = new TickServiceImpl();
    const pre = vi.fn();
    const post = vi.fn();
    tick.onPreSimulation(pre);
    tick.onPostSimulation(post);

    tick.firePre(0.016);
    expect(pre).toHaveBeenCalledOnce();
    expect(post).not.toHaveBeenCalled();

    tick.firePost(0.016);
    expect(post).toHaveBeenCalledOnce();
  });

  it("clear removes all callbacks", () => {
    const tick = new TickServiceImpl();
    const pre = vi.fn();
    const post = vi.fn();
    tick.onPreSimulation(pre);
    tick.onPostSimulation(post);
    tick.clear();
    tick.firePre(0.016);
    tick.firePost(0.016);
    expect(pre).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
  });

  it("firePre with no callbacks is a no-op", () => {
    const tick = new TickServiceImpl();
    expect(() => tick.firePre(0.016)).not.toThrow();
  });
});
