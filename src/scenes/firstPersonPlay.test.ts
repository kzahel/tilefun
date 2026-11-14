import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FirstPersonControl } from "../client/FirstPersonControl.js";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { GameContext } from "../core/GameScene.js";
import { Direction } from "../entities/Entity.js";
import { NEUTRAL_MOVEMENT, neutralSample, type SeatInput } from "../input/SeatInput.js";
import { NORTH_YAW } from "../rendering/firstperson/FirstPersonCamera.js";
import { ClientSeat } from "../session/ClientSeat.js";
import type { SeatFrame } from "../session/DeviceSeats.js";
import { followSeat, View } from "../session/View.js";
import { createVehicle } from "../traffic/Vehicle.js";
import {
  firstPersonAim,
  firstPersonMovement,
  firstPersonTick,
  turnGuestFrames,
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
  const view = new View(followSeat());
  const guest = new View(followSeat({ seat: 1 }), undefined, 1);
  const views = [view, guest];
  const cancelled = { tap: 0, hold: 0 };
  const gc = {
    firstPerson: control,
    carDriving,
    view,
    camera: view.camera,
    session: { views },
    tapMovement: { cancel: () => cancelled.tap++ },
    touchHold: { reset: () => cancelled.hold++ },
  } as unknown as GameContext;
  const sync = () => control.sync(views, new Set([0, 1]));
  return { control, gc, cancelled, view, guest, views, sync };
}

const forward = { dx: 0, dy: -1, sprinting: false, jump: false };

describe("first-person play input", () => {
  it("keeps ordinary controls until a frame was actually drawn in first person", () => {
    const { control, gc, cancelled, view, sync } = setup();
    view.camera.zoom = 2;
    control.setActive(true, 0); // facing east
    sync();
    // Chosen but still loading: the fixed view is shown.
    const hidden = firstPersonTick(gc, 1 / 60, undefined);
    expect(hidden).toBeUndefined();
    expect(firstPersonMovement(gc, hidden, undefined, forward)).toBe(forward);
    expect(firstPersonAim(gc, hidden)).toBeUndefined();
    expect(cancelled.tap).toBe(0);

    control.markDrawn(view);
    const shown = firstPersonTick(gc, 1 / 60, undefined);
    expect(shown).toBe(view);
    const turned = firstPersonMovement(gc, shown, undefined, forward);
    expect(turned.dx).toBeCloseTo(1, 9);
    expect(turned.dy).toBeCloseTo(0, 9);
    expect(firstPersonAim(gc, shown)?.x).toBeCloseTo(1, 9);
    expect(cancelled).toEqual({ tap: 1, hold: 1 });
    // Streaming interest is the view's own: the fixed camera's zoom is left alone.
    expect(view.camera.zoom).toBe(2);

    control.hideView(); // e.g. opened the editor
    expect(firstPersonTick(gc, 1 / 60, undefined)).toBeUndefined();
  });

  it("leaves steering cars on their vehicle axes", () => {
    const { control, gc, view, sync } = setup("steering");
    control.setActive(true, 0);
    sync();
    control.markDrawn(view);
    const car = createVehicle("compact-1", 0, 0, Direction.Right);
    const shown = firstPersonTick(gc, 1 / 60, car);
    expect(firstPersonMovement(gc, shown, car, forward)).toBe(forward);

    const direct = setup("direction");
    direct.control.setActive(true, 0);
    direct.sync();
    direct.control.markDrawn(direct.view);
    const turned = firstPersonMovement(direct.gc, direct.view, car, forward);
    expect(turned.dx).toBeCloseTo(1, 9);
  });

  it("forgets the drawn state and the look when switched off", () => {
    const { control, gc, view, sync } = setup();
    control.setActive(true, 0);
    sync();
    control.markDrawn(view);
    control.setActive(false);
    expect(view.look).toBeNull();
    control.setActive(true, 0);
    sync();
    expect(control.drawing).toBe(false);
    expect(view.look).toEqual({ yaw: 0, pitch: 0 });
    expect(firstPersonTick(gc, 1 / 60, undefined)).toBeUndefined();
  });
});

describe("a 3D view's streaming interest", () => {
  it("is the chosen view distance around the seat while the view is drawn in 3D", () => {
    const { control, view, sync } = setup();
    view.setRegion({ x: 0, y: 0, width: 1280, height: 720 });
    view.camera.snapTo(1000, 2000);
    const fixed = view.interestRange();
    control.setActive(true);
    sync();
    // Not drawn yet: the fixed view is on screen, so its rectangle is streamed.
    expect(view.interestRadius).toBeUndefined();
    expect(view.interestRange()).toEqual(fixed);
    for (const [distance, radius] of [
      ["near", 400],
      ["far", 1600],
    ] as const) {
      control.viewDistance = distance;
      control.markDrawn(view);
      sync();
      expect(view.interestRadius).toBe(radius);
      expect(view.interestRange()).toEqual({
        minCx: Math.floor((1000 - radius) / CHUNK_SIZE_PX),
        minCy: Math.floor((2000 - radius) / CHUNK_SIZE_PX),
        maxCx: Math.floor((1000 + radius) / CHUNK_SIZE_PX),
        maxCy: Math.floor((2000 + radius) / CHUNK_SIZE_PX),
      });
    }
    // The editor draws the fixed view and never syncs: the rectangle at once.
    control.hideView();
    expect(view.interestRange()).toEqual(fixed);
  });
});

describe("first person per seat", () => {
  const input = (look?: { dx: number; dy: number }): SeatInput => ({
    steering: true,
    held: () => false,
    sample: () => neutralSample(),
    clear: () => {},
    dispose: () => {},
    on: () => () => {},
    hint: () => "",
    ...(look ? { look: () => look } : {}),
  });
  const frame = (
    seat: ClientSeat,
    dx: number,
    dy: number,
    vehicle?: SeatFrame["situation"]["vehicle"],
  ) =>
    ({
      seat,
      sample: {
        ...neutralSample(),
        manual: { ...NEUTRAL_MOVEMENT, dx, dy },
        steered: { ...NEUTRAL_MOVEMENT, dx, dy },
      },
      situation: { vehicle, locked: false, steering: true, joystick: false },
    }) satisfies SeatFrame;

  it("turns a guest's movement by its own view, not seat 0's", () => {
    const { control, gc, view, guest, sync } = setup();
    control.setSeat(1, true, 0); // the guest faces east; seat 0 stays top-down
    sync();
    control.markDrawn(guest);
    expect(view.look).toBeNull();
    expect(guest.look).toEqual({ yaw: 0, pitch: 0 });

    const seat = new ClientSeat(1, input({ dx: 0, dy: 0 }));
    const [turned] = turnGuestFrames(gc, [frame(seat, 0, -1)], 1 / 60);
    expect(turned?.sample.manual.dx).toBeCloseTo(1, 9);
    expect(turned?.sample.steered).toBe(turned?.sample.manual);
    expect(turned?.situation.look?.x).toBeCloseTo(1, 9);
    // Seat 0 keeps ordinary top-down controls.
    expect(firstPersonTick(gc, 1 / 60, undefined)).toBeUndefined();
  });

  it("looks with a pad's right stick", () => {
    const { control, gc, guest, sync } = setup();
    control.setSeat(1, true, NORTH_YAW);
    sync();
    control.markDrawn(guest);
    const seat = new ClientSeat(1, input({ dx: 1, dy: 0 }));
    turnGuestFrames(gc, [frame(seat, 0, 0)], 0.1);
    expect(guest.look?.yaw).toBeGreaterThan(NORTH_YAW); // turned right
  });

  it("turns a keyboard guest with left and right instead of strafing", () => {
    const { control, gc, guest, sync } = setup();
    control.setSeat(1, true, NORTH_YAW);
    sync();
    control.markDrawn(guest);
    const seat = new ClientSeat(1, input());
    const [turned] = turnGuestFrames(gc, [frame(seat, 1, -1)], 0.1);
    expect(guest.look?.yaw).toBeGreaterThan(NORTH_YAW);
    // No sideways step: the rest of the input walks along the new heading.
    const yaw = guest.look?.yaw ?? 0;
    expect(turned?.sample.manual.dx).toBeCloseTo(Math.cos(yaw), 9);
    expect(turned?.sample.manual.dy).toBeCloseTo(Math.sin(yaw), 9);
  });

  it("leaves a guest's steering car on its vehicle axes", () => {
    const { control, gc, guest, sync } = setup();
    control.setSeat(1, true, 0);
    sync();
    control.markDrawn(guest);
    const car = createVehicle("compact-1", 0, 0, Direction.Right);
    const seat = new ClientSeat(1, input());
    const [driven] = turnGuestFrames(gc, [frame(seat, 1, -1, car)], 0.1);
    expect(driven?.sample.manual).toMatchObject({ dx: 1, dy: -1 });
  });

  it("leaves top-down guests and guests whose 3D view is not on screen alone", () => {
    const { control, gc, sync } = setup();
    const seat = new ClientSeat(1, input());
    const plain = frame(seat, 1, -1);
    expect(turnGuestFrames(gc, [plain], 0.1)[0]?.sample).toBe(plain.sample);
    control.setSeat(1, true, 0);
    sync(); // chosen, but its scene has not drawn
    expect(turnGuestFrames(gc, [plain], 0.1)[0]?.sample).toBe(plain.sample);
  });

  it("switches a guest back to the fixed view at once and frees its 3D scene", async () => {
    const { control, guest, sync } = setup();
    control.setSeat(1, true, 0);
    sync();
    // The scene module loads on first use; then the guest's view has a scene.
    await vi.waitFor(() => expect(control.scene(guest)).toBeDefined());
    const scene = control.scene(guest);
    const dispose = vi.spyOn(scene as NonNullable<typeof scene>, "dispose");
    control.markDrawn(guest);
    // From a menu over play: no tick runs before the next display frame.
    control.setSeat(1, false);
    expect(guest.look).toBeNull();
    expect(guest.drawn3d).toBe(false);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(control.scene(guest)).toBeUndefined(); // the next frame builds nothing
    sync();
    expect(control.scene(guest)).toBeUndefined();
  });

  it("resumes a guest's heading when its view is made again after leaving play", () => {
    const { control, guest, view } = setup();
    control.setSeat(1, true, 0);
    control.sync([view, guest], new Set([0, 1]));
    control.markDrawn(guest);
    control.turn(guest, 1, 0);
    control.sync([view, guest], new Set([0, 1]));
    const again = new View(followSeat({ seat: 1 }), undefined, 1);
    control.sync([view, again], new Set([0, 1]));
    expect(again.look?.yaw).toBeCloseTo(1, 9);
  });

  it("forgets a seat's choice when the seat leaves", () => {
    const { control, guest, views } = setup();
    control.setSeat(1, true, 0);
    control.sync(views, new Set([0, 1]));
    expect(guest.look).not.toBeNull();
    control.sync(views, new Set([0])); // the guest left; a new guest starts top-down
    expect(control.seatActive(1)).toBe(false);
    expect(guest.look).toBeNull();
  });
});
