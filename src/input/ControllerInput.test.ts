import { describe, expect, it } from "vitest";
import { ControllerInput, controllerAxes } from "./ControllerInput.js";

function pad(buttons: number[] = [], axes = [0, 0, 0, 0], index = 0): Gamepad {
  return {
    connected: true,
    mapping: "standard",
    index,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: buttons.includes(i),
      touched: buttons.includes(i),
      value: buttons.includes(i) ? 1 : 0,
    })),
  } as unknown as Gamepad;
}
describe("controller session", () => {
  it("uses a radial dead zone and preserves browser/world Y direction", () => {
    expect(controllerAxes(0.1, 0.1)).toEqual({ dx: 0, dy: 0 });
    expect(controllerAxes(0, -1)).toEqual({ dx: 0, dy: -1 });
    expect(Math.hypot(...Object.values(controllerAxes(1, 1)))).toBeCloseTo(1);
  });
  it("emits edges once, repeats menu direction, and keeps gameplay held actions", () => {
    const session = new ControllerInput();
    session.sample([pad()], 0);
    expect(session.sample([pad([0, 2, 5, 7])], 10)).toEqual(["confirm", "throw"]);
    expect([...session.held]).toEqual(["jump", "throw", "honk", "sprint"]);
    expect(session.sample([pad([0, 2])], 20)).toEqual([]);
    session.uiActive = () => true;
    session.sample([pad()], 30);
    expect(session.sample([pad([13])], 40)).toEqual(["down"]);
    expect(session.sample([pad([13])], 300)).toEqual([]);
    expect(session.sample([pad([13])], 420)).toEqual(["down"]);
    expect([...session.held]).toEqual([]);
  });
  it("requires release after context changes, focus loss and reconnect", () => {
    const session = new ControllerInput();
    session.sample([pad()], 0);
    session.sample([pad([0], [0, -1, 0, 0])], 1);
    session.reset();
    expect(session.sample([pad([0], [0, -1, 0, 0])], 2)).toEqual([]);
    expect(session.movement.dy).toBe(0);
    session.sample([pad()], 3);
    expect(session.sample([pad([0])], 4)).toEqual(["confirm"]);
    session.sample([], 5);
    expect(session.sample([pad([0])], 6)).toEqual([]);
    session.reset();
    session.sample([pad([], [0, 0, 1, 0])], 7);
    expect(session.rightStick).toEqual({ dx: 0, dy: 0 });
    session.sample([pad()], 8);
    session.sample([pad([], [0, 0, 1, 0])], 9);
    expect(session.rightStick).toEqual({ dx: 1, dy: 0 });
  });
  it("ignores unmapped devices and chooses one active controller", () => {
    const session = new ControllerInput();
    const unknown = { ...pad(), mapping: "" } as unknown as Gamepad;
    session.sample([unknown, pad()], 0);
    session.sample([pad([], [0, -1, 0, 0]), pad([], [1, 0, 0, 0], 1)], 1);
    expect(session.movement).toMatchObject({ dx: 0, dy: -1 });
    session.sample([pad(), pad([], [1, 0, 0, 0], 1)], 2);
    expect(session.movement).toMatchObject({ dx: 0, dy: 0 }); // new source must release
    session.sample([pad(), pad([], [0, 0, 0, 0], 1)], 3);
    session.sample([pad(), pad([], [1, 0, 0, 0], 1)], 4);
    expect(session.movement).toMatchObject({ dx: 1, dy: 0 });
  });
});
