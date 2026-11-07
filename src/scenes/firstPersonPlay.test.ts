import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirstPersonControl } from "../client/FirstPersonControl.js";
import type { GameContext } from "../core/GameScene.js";
import { Direction } from "../entities/Entity.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { firstPersonMovement, firstPersonTick } from "./firstPersonPlay.js";

const listeners = () => ({ addEventListener() {}, removeEventListener() {} });

beforeEach(() => {
  vi.stubGlobal("location", { search: "" });
  vi.stubGlobal("document", { ...listeners(), pointerLockElement: null, exitPointerLock() {} });
});
afterEach(() => vi.unstubAllGlobals());

function setup(carDriving: GameContext["carDriving"] = "steering") {
  const canvas = { ...listeners(), dataset: {} } as unknown as HTMLCanvasElement;
  const control = new FirstPersonControl(
    () => canvas,
    () => new Map(),
  );
  const cancelled = { tap: 0, hold: 0 };
  const gc = {
    firstPerson: control,
    carDriving,
    camera: { zoom: 2 },
    tapMovement: { cancel: () => cancelled.tap++ },
    trainTapMovement: { cancel() {} },
    touchHold: { reset: () => cancelled.hold++ },
  } as unknown as GameContext;
  return { control, gc, cancelled };
}

const forward = { dx: 0, dy: -1, sprinting: false, jump: false };

describe("first-person play input", () => {
  it("keeps ordinary controls until a frame was actually drawn in first person", () => {
    const { control, gc, cancelled } = setup();
    control.setActive(true, 0); // facing east
    // Active but still loading, indoors or on legacy Canvas: the fixed view is shown.
    const hidden = firstPersonTick(gc, 1 / 60, undefined);
    expect(hidden).toBeUndefined();
    expect(firstPersonMovement(gc, hidden, undefined, forward)).toBe(forward);
    expect(gc.camera.zoom).toBe(2);
    expect(cancelled.tap).toBe(0);

    control.markDrawn();
    const shown = firstPersonTick(gc, 1 / 60, undefined);
    expect(shown).toBe(control);
    const turned = firstPersonMovement(gc, shown, undefined, forward);
    expect(turned.dx).toBeCloseTo(1, 9);
    expect(turned.dy).toBeCloseTo(0, 9);
    expect(gc.camera.zoom).toBe(0.5);
    expect(cancelled).toEqual({ tap: 1, hold: 1 });

    control.hideView(); // e.g. walked indoors or opened the editor
    expect(firstPersonTick(gc, 1 / 60, undefined)).toBeUndefined();
  });

  it("leaves steering cars and trains on their vehicle axes", () => {
    const { control, gc } = setup("steering");
    control.setActive(true, 0);
    control.markDrawn();
    const car = createVehicle("compact-1", 0, 0, Direction.Right);
    const shown = firstPersonTick(gc, 1 / 60, car);
    expect(firstPersonMovement(gc, shown, car, forward)).toBe(forward);
    const train = { ...car, type: "train-curve-proof-v1" };
    expect(firstPersonMovement(gc, shown, train, forward)).toBe(forward);

    const direct = setup("direction");
    direct.control.setActive(true, 0);
    direct.control.markDrawn();
    const turned = firstPersonMovement(direct.gc, direct.control, car, forward);
    expect(turned.dx).toBeCloseTo(1, 9);
  });

  it("forgets the drawn state when switched off", () => {
    const { control, gc } = setup();
    control.setActive(true, 0);
    control.markDrawn();
    control.setActive(false);
    control.setActive(true, 0);
    expect(control.drawing).toBe(false);
    expect(firstPersonTick(gc, 1 / 60, undefined)).toBeUndefined();
  });
});
