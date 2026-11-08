import { describe, expect, it, vi } from "vitest";
import { createVehicle } from "../traffic/Vehicle.js";
import type { ActionName } from "./ActionMap.js";
import { ActionSeatInput, NEUTRAL_MOVEMENT, neutralSample, type SeatActions } from "./SeatInput.js";

/** One action set (a keyboard scheme or a pad) as a guest seat reads it. */
function actions(held: ActionName[] = []) {
  let jump: (() => void) | undefined;
  let horn = false;
  const set = {
    getMovement: vi.fn((normalize: boolean) => ({
      dx: 1,
      dy: normalize ? 0 : 1,
      sprinting: false,
      jump: held.includes("jump"),
    })),
    isHeld: (action: ActionName) => held.includes(action),
    consumeHornPress: () => {
      const pressed = horn;
      horn = false;
      return pressed;
    },
    on: vi.fn((_action: "jump", callback: () => void) => {
      jump = callback;
      return () => {
        jump = undefined;
      };
    }),
    clearHeld: vi.fn(() => {
      held.length = 0;
    }),
    press: () => jump?.(),
    honk: () => {
      horn = true;
    },
  };
  return set satisfies SeatActions;
}

describe("ActionSeatInput", () => {
  it("samples movement, held presses and a latched jump from its action set", () => {
    const set = actions(["honk", "vehicle_lights"]);
    const seat = new ActionSeatInput(set);
    set.press();
    set.honk();
    const first = seat.sample(false, undefined);
    expect(first).toMatchObject({ honk: true, lights: true, hornPressed: true, jumpPressed: true });
    expect(first.manual).toEqual(first.steered);
    expect(set.getMovement).toHaveBeenLastCalledWith(true);
    expect(seat.sample(false, undefined)).toMatchObject({ hornPressed: false, jumpPressed: false });
    expect(seat.held("vehicle_lights")).toBe(true);
    expect(seat.held("vehicle_style")).toBe(false);
  });

  it("keeps raw axes for manual car steering and samples still movement while locked", () => {
    const set = actions(["honk"]);
    const car = createVehicle("compact-1", 0, 0);
    expect(new ActionSeatInput(set, true).sample(false, car).manual).toMatchObject({ dy: 1 });
    expect(new ActionSeatInput(set, false).sample(false, car).manual).toMatchObject({ dy: 0 });
    const seat = new ActionSeatInput(set);
    set.press();
    const locked = seat.sample(true, undefined);
    expect(locked).toMatchObject({ manual: NEUTRAL_MOVEMENT, jumpPressed: false, honk: true });
    // The jump pressed while locked is consumed, not saved for later.
    expect(seat.sample(false, undefined).jumpPressed).toBe(false);
  });

  it("clears held keys and latched presses, and removes its listener when the seat leaves", () => {
    const set = actions(["move_left"]);
    const seat = new ActionSeatInput(set);
    set.press();
    set.honk();
    seat.clear();
    expect(set.clearHeld).toHaveBeenCalledOnce();
    expect(seat.sample(false, undefined)).toMatchObject({ jumpPressed: false, hornPressed: false });
    seat.dispose();
    set.press();
    expect(seat.sample(false, undefined).jumpPressed).toBe(false);
  });
});

describe("neutralSample", () => {
  it("keeps held presses but drops movement and the jump press", () => {
    const held = {
      honk: true,
      lights: false,
      style: true,
      throw: true,
      reverse: false,
      hornPressed: true,
    };
    expect(neutralSample(held)).toEqual({
      ...held,
      manual: NEUTRAL_MOVEMENT,
      steered: NEUTRAL_MOVEMENT,
      jumpPressed: false,
    });
    expect(neutralSample()).toMatchObject({ honk: false, hornPressed: false, jumpPressed: false });
  });
});
