import { describe, expect, it } from "vitest";
import { PadAssignment } from "./PadAssignment.js";

const pad = (index: number, state: "idle" | "stick" | "press" | "gone" = "idle") => ({
  index,
  connected: state !== "gone",
  pressed: state === "press",
  active: state === "press" || state === "stick",
});

describe("pad assignment (226)", () => {
  it("seat 0 keeps the first pad it uses, by stick or button; until then no pad joins", () => {
    const pads = new PadAssignment();
    expect(pads.update([pad(0), pad(1)])).toEqual({ joins: [], lost: [] });
    expect(pads.hostPad).toBeUndefined();
    // Unclaimed pads may still become seat 0's; nothing is excluded but joiners.
    expect(pads.excluded([pad(0), pad(1)])).toEqual(new Set());
    expect(pads.update([pad(0), pad(1, "stick")]).joins).toEqual([]);
    expect(pads.hostPad).toBe(1);
    expect(pads.excluded([pad(0), pad(1)])).toEqual(new Set([0]));
  });

  it("another pad's button press asks to join, once, and keeps its seat until it disconnects", () => {
    const pads = new PadAssignment();
    pads.update([pad(0, "press"), pad(2)]);
    expect(pads.update([pad(0), pad(2, "stick")]).joins).toEqual([]); // sticks never join
    expect(pads.update([pad(0), pad(2, "press")]).joins).toEqual([2]);
    expect(pads.update([pad(0), pad(2, "press")]).joins).toEqual([]); // pending
    pads.assign(2, 1);
    expect([pads.seatOf(2), pads.padOf(1)]).toEqual([1, 2]);
    expect(pads.update([pad(0), pad(2, "press"), pad(3, "press")]).joins).toEqual([3]);
    pads.assign(3, 2);
    expect(pads.excluded([pad(0), pad(2), pad(3)])).toEqual(new Set([2, 3]));
    expect(pads.update([pad(0), pad(2, "gone"), pad(3)])).toEqual({ joins: [], lost: [1] });
    expect(pads.seatOf(2)).toBeUndefined();
  });

  it("a pad pressed as seat 0 claims its own (a pad listed twice) waits for a fresh press", () => {
    const pads = new PadAssignment();
    expect(pads.update([pad(0, "press"), pad(1, "press")]).joins).toEqual([]);
    expect(pads.hostPad).toBe(0);
    expect(pads.update([pad(0, "press"), pad(1, "press")]).joins).toEqual([]); // still held
    expect(pads.update([pad(0), pad(1)]).joins).toEqual([]);
    expect(pads.update([pad(0), pad(1, "press")]).joins).toEqual([1]);
  });

  it("a refused or released pad must let go before it asks again", () => {
    const pads = new PadAssignment();
    pads.update([pad(0, "press")]);
    expect(pads.update([pad(0), pad(1, "press")]).joins).toEqual([1]);
    pads.wait(1); // refused (not in play, or no free seat)
    expect(pads.update([pad(0), pad(1, "press")]).joins).toEqual([]);
    pads.update([pad(0), pad(1)]);
    expect(pads.update([pad(0), pad(1, "press")]).joins).toEqual([1]);
    pads.assign(1, 1);
    pads.release(1); // the guest left from the menu with the button still down
    expect(pads.seatOf(1)).toBeUndefined();
    expect(pads.update([pad(0), pad(1, "press")]).joins).toEqual([]);
    expect(pads.update([pad(0), pad(1)]).joins).toEqual([]);
    expect(pads.update([pad(0), pad(1, "press")]).joins).toEqual([1]);
  });

  it("seat 0's pad disconnecting frees it; the next pad used becomes seat 0's", () => {
    const pads = new PadAssignment();
    pads.update([pad(0, "stick"), pad(1)]);
    pads.update([pad(0, "gone"), pad(1)]);
    expect(pads.hostPad).toBeUndefined();
    pads.update([pad(1, "press")]);
    expect(pads.hostPad).toBe(1);
  });

  it("guests' pads never drive seat 0, even while seat 0 has no pad of its own", () => {
    const pads = new PadAssignment();
    pads.update([pad(0, "press"), pad(1)]);
    pads.update([pad(0), pad(1, "press")]);
    pads.assign(1, 1);
    pads.update([pad(0, "gone"), pad(1), pad(2)]);
    expect(pads.hostPad).toBeUndefined();
    expect(pads.excluded([pad(1), pad(2)])).toEqual(new Set([1]));
    expect(pads.update([pad(1, "stick"), pad(2)]).joins).toEqual([]);
    expect(pads.hostPad).toBeUndefined(); // a guest's stick does not claim seat 0
  });
});
