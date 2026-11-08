import { describe, expect, it } from "vitest";
import { PadActions, type PadReading } from "./PadActions.js";
import { ActionSeatInput } from "./SeatInput.js";

function pad(buttons: number[] = [], axes: number[] = [0, 0], connected = true): PadReading {
  return {
    connected,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: buttons.includes(i) })),
  };
}

describe("a guest's pad actions (226)", () => {
  it("acts only once the joining press is released, then follows seat 0's pad bindings", () => {
    const actions = new PadActions(1);
    const jumps: number[] = [];
    actions.on("jump", () => jumps.push(1));
    actions.poll(pad([0], [1, 0]), false); // still holding the press that joined
    expect([actions.getMovement().dx, actions.isHeld("jump"), jumps.length]).toEqual([0, false, 0]);
    actions.poll(pad([], [1, 0]), false);
    expect(actions.getMovement()).toMatchObject({ dx: 1, dy: 0, sprinting: false });
    actions.poll(pad([0, 7], [0, -1]), false);
    expect(actions.getMovement()).toMatchObject({ dx: 0, dy: -1, sprinting: true, jump: true });
    expect([actions.isHeld("jump"), actions.isHeld("sprint"), jumps.length]).toEqual([
      true,
      true,
      1,
    ]);
    actions.poll(pad([0, 7]), false); // held, not pressed again
    expect(jumps.length).toBe(1);
  });

  it("presses fire on a fresh press: enter, menu, equipment and a latched horn", () => {
    const actions = new PadActions(2);
    const fired: string[] = [];
    for (const press of ["enter_place", "toggle_menu", "vehicle_recover"] as const)
      actions.on(press, () => fired.push(press));
    actions.poll(pad(), false);
    actions.poll(pad([3, 9, 5, 13]), false);
    actions.poll(pad([3, 9, 5, 13]), false);
    expect(fired).toEqual(["enter_place", "toggle_menu", "vehicle_recover"]);
    // Its prompts label seat 0's pad buttons.
    expect([actions.hint("enter_place"), actions.hint("vehicle_recover")]).toEqual(["Y", "D↓"]);
    expect([
      actions.isHeld("honk"),
      actions.consumeHornPress(),
      actions.consumeHornPress(),
    ]).toEqual([true, true, false]);
  });

  it("a menu, a clear or a lost pad stops it until every button is released", () => {
    const actions = new PadActions(1);
    const jumps: number[] = [];
    actions.on("jump", () => jumps.push(1));
    actions.poll(pad(), false);
    actions.poll(pad([0], [1, 0]), true); // a menu has focus
    expect([actions.getMovement().dx, jumps.length]).toEqual([0, 0]);
    actions.poll(pad([0], [1, 0]), false); // still held from the menu
    expect([actions.getMovement().dx, jumps.length]).toEqual([0, 0]);
    actions.poll(pad([], [1, 0]), false);
    expect(actions.getMovement().dx).toBe(1);
    actions.clearHeld();
    actions.poll(pad([2], [1, 0]), false);
    expect([actions.getMovement().dx, actions.isHeld("throw")]).toEqual([0, false]);
    actions.poll(pad(), false);
    actions.poll(pad([2]), false);
    expect(actions.isHeld("throw")).toBe(true);
    actions.poll(undefined, false);
    expect(actions.isHeld("throw")).toBe(false);
  });

  it("drives a seat through the action-set adapter, releasing the pad on dispose", () => {
    const actions = new PadActions(1);
    let released = 0;
    const input = new ActionSeatInput(actions, true, () => released++);
    actions.poll(pad(), false);
    actions.poll(pad([0], [0.6, 0.8]), false);
    const sample = input.sample(false, undefined);
    expect(sample.jumpPressed).toBe(true);
    expect(Math.hypot(sample.manual.dx, sample.manual.dy)).toBeCloseTo(1, 1);
    expect(input.sample(true, undefined).manual).toMatchObject({ dx: 0, dy: 0 });
    input.dispose();
    expect(released).toBe(1);
    actions.poll(pad(), false);
    actions.poll(pad([0]), false);
    expect(input.sample(false, undefined).jumpPressed).toBe(false); // listener removed
  });
});
