import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirstPersonControl } from "../client/FirstPersonControl.js";
import { PIXEL_SCALE } from "../config/constants.js";
import type { GameContext } from "../core/GameScene.js";
import { Direction } from "../entities/Entity.js";
import { createVehicle } from "../traffic/Vehicle.js";
import {
  firstPersonDrawRadius,
  firstPersonMovement,
  firstPersonTick,
  streamedRadius,
  streamZoomFor,
} from "./firstPersonPlay.js";

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
    camera: { zoom: 2, viewportWidth: 1280, viewportHeight: 720 },
    tapMovement: { cancel: () => cancelled.tap++ },
    touchHold: { reset: () => cancelled.hold++ },
  } as unknown as GameContext;
  return { control, gc, cancelled };
}

const forward = { dx: 0, dy: -1, sprinting: false, jump: false };

describe("first-person play input", () => {
  it("keeps ordinary controls until a frame was actually drawn in first person", () => {
    const { control, gc, cancelled } = setup();
    control.setActive(true, 0); // facing east
    // Active but still loading or indoors: the fixed view is shown.
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
    // Medium (800 px) on a 720 px tall viewport: zoom out until 800 px is streamed.
    expect(gc.camera.zoom).toBeCloseTo(720 / (2 * PIXEL_SCALE * 800), 9);
    expect(cancelled).toEqual({ tap: 1, hold: 1 });

    control.hideView(); // e.g. opened the editor
    expect(firstPersonTick(gc, 1 / 60, undefined)).toBeUndefined();
  });

  it("leaves steering cars on their vehicle axes", () => {
    const { control, gc } = setup("steering");
    control.setActive(true, 0);
    control.markDrawn();
    const car = createVehicle("compact-1", 0, 0, Direction.Right);
    const shown = firstPersonTick(gc, 1 / 60, car);
    expect(firstPersonMovement(gc, shown, car, forward)).toBe(forward);

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

  it("streams the chosen view distance and never zooms back in", () => {
    const { control, gc } = setup();
    control.setActive(true, 0);
    control.markDrawn();
    for (const [distance, radius] of [
      ["near", 400],
      ["far", 1600],
    ] as const) {
      control.viewDistance = distance;
      gc.camera.zoom = 2;
      firstPersonTick(gc, 1 / 60, undefined);
      expect(streamedRadius(gc.camera)).toBeCloseTo(radius, 6);
    }
    gc.camera.zoom = 0.01; // already further out than needed: left alone
    firstPersonTick(gc, 1 / 60, undefined);
    expect(gc.camera.zoom).toBe(0.01);
  });
});

describe("first-person view distance", () => {
  const camera = { viewportWidth: 1920, viewportHeight: 1080, zoom: 1 };

  it("matches the camera's streamed rectangle, which includes the pixel scale", () => {
    // Camera.getVisibleChunkRange spans viewport / (PIXEL_SCALE · zoom) world pixels.
    expect(streamedRadius(camera)).toBeCloseTo(1080 / (2 * PIXEL_SCALE), 9);
    const zoom = streamZoomFor(800, camera);
    expect(zoom).toBeDefined();
    expect(streamedRadius({ ...camera, zoom: zoom ?? 1 })).toBeCloseTo(800, 9);
    expect(streamZoomFor(800, { ...camera, viewportHeight: 0 })).toBeUndefined();
  });

  it("fogs at the chosen distance, or earlier while less is streamed", () => {
    expect(firstPersonDrawRadius(800, { ...camera, zoom: 0.1 })).toBe(800);
    expect(firstPersonDrawRadius(800, camera)).toBeCloseTo(180, 9);
    expect(firstPersonDrawRadius(800, { ...camera, zoom: 100 })).toBe(160);
  });
});
