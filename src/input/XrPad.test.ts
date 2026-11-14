import { afterEach, describe, expect, it, vi } from "vitest";
import { ControllerInput } from "./ControllerInput.js";
import { padFocus, padsAway } from "./PadAssignment.js";
import { XR_PAD_INDEX, type XrPadSource, xrPad } from "./XrPad.js";

/** A Touch controller: `xr-standard` buttons and thumbstick axes. */
function controller(
  handedness: "left" | "right",
  pressed: number[] = [],
  stick: [number, number] = [0, 0],
): XrPadSource {
  return {
    handedness,
    gamepad: {
      mapping: "xr-standard",
      buttons: Array.from({ length: 7 }, (_, i) => ({
        pressed: pressed.includes(i),
        value: pressed.includes(i) ? 1 : 0,
      })),
      axes: [0, 0, ...stick],
    },
  };
}
const pressed = (pad: Gamepad | undefined) =>
  pad?.buttons.flatMap((button, index) => (button.pressed ? [index] : [])) ?? [];

afterEach(() => {
  vi.unstubAllGlobals();
  padFocus.headset = false;
});

describe("a headset's controllers as one standard pad (252)", () => {
  it("moves with the left stick and looks with the right", () => {
    const pad = xrPad(
      [controller("left", [], [0.5, -1]), controller("right", [], [-0.25, 0.75])],
      7,
    );
    expect(pad).toMatchObject({ index: XR_PAD_INDEX, mapping: "standard", connected: true });
    expect(pad?.axes).toEqual([0.5, -1, -0.25, 0.75]);
    expect(pad?.buttons).toHaveLength(17);
  });

  it("puts play's actions on the buttons a hand reaches", () => {
    const both = (left: number[], right: number[]) =>
      pressed(xrPad([controller("left", left), controller("right", right)], 0));
    expect(both([], [4])).toEqual([0]); // A: jump
    expect(both([], [5])).toEqual([9]); // B: menu, which ends the session
    expect(both([4], [])).toEqual([2]); // X: throw
    expect(both([5], [])).toEqual([3]); // Y: enter a place
    expect(both([0], [])).toEqual([6]); // left trigger: reverse
    expect(both([], [0])).toEqual([7]); // right trigger: sprint
    expect(both([], [1])).toEqual([5]); // right grip: horn
    // The left grip is free: the pad's button 4 opens the editor.
    expect(both([1], [])).toEqual([]);
  });

  it("is absent without a controller, and works with one hand", () => {
    expect(xrPad([], 0)).toBeUndefined();
    // Tracked hands and gaze have no `xr-standard` gamepad.
    expect(
      xrPad([{ handedness: "left", gamepad: null }, { handedness: "none" }], 0),
    ).toBeUndefined();
    const right = xrPad([controller("right", [4], [1, 0])], 0);
    expect(pressed(right)).toEqual([0]);
    expect(right?.axes).toEqual([0, 0, 1, 0]);
  });

  it("drives the game's controller collector through its ordinary bindings", () => {
    const input = new ControllerInput();
    const poll = (now: number, ...sources: XrPadSource[]) =>
      input.sample([xrPad(sources, now) as Gamepad], now);
    expect(poll(0, controller("left"), controller("right"))).toEqual([]);
    expect(poll(16, controller("left", [], [0, -1]), controller("right", [4, 0], [1, 0]))).toEqual([
      "confirm",
    ]);
    expect(input.movement).toMatchObject({ dx: 0, dy: -1, sprinting: true, jump: true });
    expect(input.rightStick.dx).toBeCloseTo(1, 9);
    expect(poll(32, controller("left"), controller("right", [5]))).toEqual(["menu"]);
  });

  it("keeps input when the page loses focus, as it does for a whole session", () => {
    // A session takes the page's focus on the headset; the document stays visible.
    vi.stubGlobal("document", { hidden: false, hasFocus: () => false });
    const idle = [xrPad([controller("left"), controller("right")], 0) as Gamepad];
    const pushed = [xrPad([controller("left", [], [1, 0]), controller("right")], 0) as Gamepad];
    const away = new ControllerInput();
    away.sample(idle, 0);
    away.sample(pushed, 16);
    // Without a session an unfocused page reads no pad.
    expect(away.movement.dx).toBe(0);
    expect(padsAway()).toBe(true);
    padFocus.headset = true;
    expect(padsAway()).toBe(false);
    const input = new ControllerInput();
    input.sample(idle, 0);
    input.sample(pushed, 16);
    expect(input.movement.dx).toBe(1);
  });
});
