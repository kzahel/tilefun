import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TerrainId } from "../autotile/TerrainId.js";
import { FirstPersonControl } from "../client/FirstPersonControl.js";
import { XR_WALK } from "../client/XrControl.js";
import { CHUNK_SIZE_PX, PIXEL_SCALE } from "../config/constants.js";
import type { GameContext } from "../core/GameScene.js";
import { Direction } from "../entities/Entity.js";
import { ActionManager } from "../input/ActionManager.js";
import { NEUTRAL_MOVEMENT, neutralSample, type SeatInput } from "../input/SeatInput.js";
import { NORTH_YAW } from "../rendering/firstperson/FirstPersonCamera.js";
import type {
  FirstPersonFrame,
  FirstPersonView,
} from "../rendering/firstperson/FirstPersonView.js";
import { ClientSeat } from "../session/ClientSeat.js";
import type { SeatFrame } from "../session/DeviceSeats.js";
import { followSeat, View } from "../session/View.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { Chunk } from "../world/Chunk.js";
import {
  firstPersonAim,
  firstPersonMovement,
  firstPersonTick,
  renderFirstPerson,
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
  const actions = new ActionManager();
  actions.disableGamepad();
  const gc = {
    actions,
    firstPerson: control,
    carDriving,
    view,
    camera: view.camera,
    session: { views },
    tapMovement: { cancel: () => cancelled.tap++ },
    touchHold: { reset: () => cancelled.hold++ },
  } as unknown as GameContext;
  const sync = () => control.sync(views, new Set([0, 1]));
  return { control, gc, cancelled, view, guest, views, sync, actions };
}

const forward = { dx: 0, dy: -1, sprinting: false, jump: false };
const pick = (m: { dx: number; dy: number }) => ({ dx: m.dx, dy: m.dy });

describe("first-person play input", () => {
  it("touch look turns right, looks up and clamps pitch in either keyboard scheme", () => {
    const { control, view, sync } = setup();
    control.setActive(true, NORTH_YAW);
    sync();
    control.touchLook(0.1, -0.1); // loading: ordinary controls
    expect(view.look).toEqual({ yaw: NORTH_YAW, pitch: 0 });
    control.markDrawn(view);
    control.touchLook(0.1, -0.1);
    expect(view.look?.yaw).toBeCloseTo(NORTH_YAW + 0.24);
    expect(view.look?.pitch).toBeCloseTo(0.24);
    control.controls = "mouse";
    control.touchLook(0.1, -100);
    expect(view.look?.yaw).toBeCloseTo(NORTH_YAW + 0.48);
    expect(view.look?.pitch).toBeLessThan(Math.PI / 2);
    control.hideView();
    const before = { ...view.look };
    control.touchLook(1, 1);
    expect(view.look).toEqual(before);
  });

  it("simple keyboard turns and walks in a level curve at full walking speed", () => {
    const { control, gc, view, sync, actions } = setup();
    control.setActive(true, NORTH_YAW);
    sync();
    control.markDrawn(view);
    if (view.look) view.look.pitch = 0.5;
    actions.pressKey("KeyW");
    actions.pressKey("KeyD");
    const movement = firstPersonMovement(gc, view, undefined, actions.getMovement(), 0.1);
    expect(view.look?.yaw).toBeGreaterThan(NORTH_YAW);
    expect(view.look?.pitch).toBe(0);
    expect(Math.hypot(movement.dx, movement.dy)).toBeCloseTo(1, 9);
    expect(movement.dx).toBeCloseTo(Math.cos(view.look?.yaw ?? 0), 9);
    actions.releaseKey("KeyW");
    expect(pick(firstPersonMovement(gc, view, undefined, actions.getMovement(), 0.1))).toEqual({
      dx: 0,
      dy: 0,
    });
  });

  it("mouse mode strafes with keys, while controller movement still strafes in simple mode", () => {
    const { control, gc, view, sync, actions } = setup();
    control.setActive(true, NORTH_YAW);
    sync();
    control.markDrawn(view);
    control.controls = "mouse";
    actions.pressKey("KeyD");
    const strafe = firstPersonMovement(gc, view, undefined, actions.getMovement(), 0.1);
    expect(strafe.dx).toBeCloseTo(1, 9);
    expect(view.look?.yaw).toBe(NORTH_YAW);
    actions.releaseKey("KeyD");
    control.controls = "simple";
    const pad = firstPersonMovement(gc, view, undefined, { ...forward, dx: 1, dy: 0 }, 0.1);
    expect(pad.dx).toBeCloseTo(1, 9);
    expect(view.look?.yaw).toBe(NORTH_YAW);
  });

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
      // Already, before any tick: a menu over play draws frames without ticking.
      expect(view.interestRadius).toBe(radius);
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

  it("switches a guest from first person to top-down and reuses its scene", async () => {
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
    expect(dispose).not.toHaveBeenCalled();
    expect(control.scene(guest)).toBe(scene); // top-down reuses the same scene
    sync();
    expect(control.scene(guest)).toBe(scene);
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

  it("a headset holds seat 0 in 3D whatever the seat chooses, then gives its choice back (252)", async () => {
    const { control, view, guest, sync } = setup();
    sync();
    control.hold(0);
    expect(view.look).toEqual({ yaw: 0, pitch: 0 });
    expect(guest.look).toBeNull();
    // The seat's own choice is not the headset's: it stays off.
    expect(control.active).toBe(false);
    await vi.waitFor(() => expect(control.scene(view)).toBeDefined());
    const scene = control.scene(view) as FirstPersonView;
    const dispose = vi.spyOn(scene, "dispose");
    // Switching first person on and off during the session keeps the scene.
    control.setActive(true, 1);
    control.setActive(false);
    sync();
    expect(view.look).not.toBeNull();
    expect(control.scene(view)).toBe(scene);
    expect(dispose).not.toHaveBeenCalled();
    control.unhold();
    expect(view.look).toBeNull();
    expect(dispose).not.toHaveBeenCalled();
    // A seat that chose first person keeps it, and its scene, after the session.
    control.setActive(true, 1);
    sync();
    control.hold(0);
    control.unhold();
    expect(control.active).toBe(true);
    expect(view.look).not.toBeNull();
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

describe("top-down play in the 3D scene", () => {
  it("keeps top-down controls and streaming interest", () => {
    const { control, gc, cancelled, view, sync } = setup();
    view.setRegion({ x: 0, y: 0, width: 1280, height: 720 });
    view.camera.snapTo(1000, 2000);
    const fixed = view.interestRange();
    sync();
    control.markTopDown(view);
    expect(view.topDown3d).toBe(true);
    expect(control.drawing3d).toBe(true);
    // Not first person: no camera-relative movement, look, or cancelled taps.
    expect(view.drawn3d).toBe(false);
    expect(control.drawing).toBe(false);
    expect(firstPersonTick(gc, 1 / 60, undefined)).toBeUndefined();
    expect(cancelled.tap).toBe(0);
    sync();
    expect(view.interestRadius).toBeUndefined();
    expect(view.interestRange()).toEqual(fixed);
    // An unavailable frame clears the last presented camera state.
    control.hide(view);
    expect(view.topDown3d).toBe(false);
    expect(control.drawing3d).toBe(false);
  });

  it("lets a seat go to first person and back in the same scene", async () => {
    const { control, view, guest, sync } = setup();
    sync();
    await vi.waitFor(() => expect(control.scene(view)).toBeDefined());
    const scene = control.scene(view) as FirstPersonView;
    const dispose = vi.spyOn(scene, "dispose");
    control.markTopDown(view);
    control.setActive(true, 0);
    expect(view.look).toEqual({ yaw: 0, pitch: 0 });
    control.markDrawn(view);
    expect(view.topDown3d).toBe(false);
    control.setActive(false);
    // Back to top-down at once, still in 3D: the scene and its chunks are kept.
    expect(view.look).toBeNull();
    expect(view.drawn3d).toBe(false);
    expect(control.scene(view)).toBe(scene);
    expect(dispose).not.toHaveBeenCalled();
    // Every view of the device follows the choice.
    expect(control.scene(guest)).toBeDefined();
    control.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(control.scene(view)).toBeUndefined();
    expect(control.scene(guest)).toBeUndefined();
  });

  /** The replica's clock: none, until a test gives it a night. */
  const sky: { now?: object } = {};
  function drawable(interior?: object) {
    delete sky.now;
    const made = setup();
    const { control, view } = made;
    const frames: FirstPersonFrame[] = [];
    vi.spyOn(control, "scene").mockReturnValue({
      render: (frame: FirstPersonFrame) => frames.push(frame),
    } as unknown as FirstPersonView);
    // One lawn chunk everywhere: the top-down view collects its grass blades.
    const lawn = new Chunk();
    lawn.blendBase.fill(TerrainId.Grass);
    lawn.autotileComputed = true;
    const gc = {
      ...made.gc,
      spriteCatalog: new Map([["grass-blades", {}]]),
      stateView: {
        entities: [],
        props: [],
        world: { getChunkIfLoaded: () => lawn },
        interior,
        sky,
        editorEnabled: false,
      },
      view3d: {
        draw(_region: unknown, draw: (target: object) => void) {
          draw({});
          return true;
        },
      },
    } as unknown as GameContext;
    view.setRegion({ x: 0, y: 0, width: 1200, height: 600 });
    view.camera.snapTo(500, 300);
    view.camera.zoom = 0.5;
    return { ...made, gc, frames };
  }

  it("draws through the view's own top-down camera", () => {
    const { gc, view, frames, sync } = drawable();
    sync();
    expect(renderFirstPerson(gc, view, 1)).toBe(true);
    expect(view.topDown3d).toBe(true);
    const scale = PIXEL_SCALE * 0.5;
    expect(frames[0]?.topDown).toEqual({ scale });
    expect(frames[0]?.eye).toMatchObject({ x: 500, y: 300 });
    expect(frames[0]?.interior).toBeUndefined();
    // The fixed view's grass for this camera, at full opacity from zoom 0.5 up.
    const ground = view.camera.screenToWorld(0, 0);
    expect(frames[0]?.grass?.length).toBeGreaterThan(100);
    expect(frames[0]?.grass?.every((b) => b.alpha === undefined && b.wx >= ground.wx - 30)).toBe(
      true,
    );
    // An overview zoom has none.
    view.camera.zoom = 0.2;
    expect(renderFirstPerson(gc, view, 1)).toBe(true);
    expect(frames[1]?.grass).toEqual([]);
  });

  it("shows the world's sky in play, and plain daylight without a clock or while building", () => {
    const { gc, view, frames, sync } = drawable();
    sync();
    renderFirstPerson(gc, view, 1);
    expect(frames[0]?.atmosphere).toBeUndefined();
    // Midnight of day 2 in a storm.
    sky.now = { seed: 42, time: 24 * 60, held: "storm" };
    renderFirstPerson(gc, view, 1);
    expect(frames[1]?.atmosphere).toMatchObject({ rain: 1 });
    expect(frames[1]?.atmosphere?.tint[0]).toBeLessThan(0.5);
    (gc.stateView as { editorEnabled: boolean }).editorEnabled = true;
    renderFirstPerson(gc, view, 1);
    expect(frames[2]?.atmosphere).toBeUndefined();
  });

  it("draws seat 0 to a headset's eyes and uses the unified scene for every view (252)", () => {
    const { control, gc: base, view, guest, frames, sync } = drawable();
    const rig = { x: 480, y: 290, z: 0, yaw: 0, pixelsPerMetre: 18 };
    const xr = {
      immersive: true,
      walking: true,
      seen: (seen: View) =>
        seen.seat === 0
          ? {
              eye: { x: 500, y: 300, z: 20, yaw: 0.5, pitch: 0.1, own: 9 },
              cull: { left: 0, right: 1000, top: 0, bottom: 600 },
              drawRadius: 640,
              headset: { rig },
            }
          : undefined,
      draw: vi.fn((draw: (target: object) => void) => {
        draw({});
        return true;
      }),
      tick: vi.fn((look: { yaw: number }) => {
        look.yaw = Math.PI / 2; // the head faces south
      }),
    };
    const gc = { ...base, xr } as unknown as GameContext;
    control.setActive(true, 0);
    sync();
    expect(renderFirstPerson(gc, view, 1)).toBe(true);
    expect(xr.draw).toHaveBeenCalledOnce();
    expect(frames[0]).toMatchObject({ headset: { rig }, drawRadius: 640 });
    expect(frames[0]?.eye).toMatchObject({ x: 500, y: 300, z: 20, yaw: 0.5 });
    expect(view.drawn3d).toBe(true);
    // A guest has no eyes in the headset, and the fixed view must not draw it.
    expect(renderFirstPerson(gc, guest, 1)).toBe(true);
    expect(frames).toHaveLength(1);
    // Nor when the headset cannot be drawn to this frame.
    xr.draw.mockReturnValue(false);
    expect(renderFirstPerson(gc, view, 1)).toBe(true);
    expect(view.drawn3d).toBe(true);

    // The headset turns the look in place of the stick, and the player walks.
    const shown = firstPersonTick(gc, 1 / 60, undefined);
    expect(xr.tick).toHaveBeenCalledOnce();
    const moved = firstPersonMovement(gc, shown, undefined, forward);
    expect(moved.dx).toBeCloseTo(0, 9);
    expect(moved.dy).toBeCloseTo(XR_WALK, 9);
    // Driving keeps full input.
    const car = createVehicle("compact-1", 0, 0, Direction.Right);
    expect(
      Math.hypot(
        ...Object.values(
          pick(
            firstPersonMovement(
              { ...gc, carDriving: "direction" } as GameContext,
              shown,
              car,
              forward,
            ),
          ),
        ),
      ),
    ).toBeCloseTo(1, 9);
  });

  it("clears drawn state when the host cannot draw the scene (graphics lost)", () => {
    const { control, gc, view, sync } = drawable();
    sync();
    expect(renderFirstPerson(gc, view, 1)).toBe(true);
    (gc.view3d as { draw: unknown }).draw = () => false;
    expect(renderFirstPerson(gc, view, 1)).toBe(false);
    expect(view.topDown3d).toBe(false);
    expect(control.drawing3d).toBe(false);
  });

  it("follows guests who join and leave, the editor and dispose", async () => {
    const { control, view, guest, views, sync } = setup();
    sync();
    await vi.waitFor(() => expect(control.scene(guest)).toBeDefined());
    const scene = control.scene(guest) as FirstPersonView;
    const dispose = vi.spyOn(scene, "dispose");
    control.markTopDown(view);
    control.markTopDown(guest);
    // A scene over play releases active camera state for every seat.
    control.hideView();
    expect([view.topDown3d, guest.topDown3d]).toEqual([false, false]);
    control.markTopDown(guest);
    // The guest leaves: its view is gone from the layout and its scene is freed.
    control.sync([view], new Set([0]));
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(guest.topDown3d).toBe(false);
    // Disposing the control frees every remaining scene.
    const host = control.scene(view) as FirstPersonView;
    const hostDispose = vi.spyOn(host, "dispose");
    control.dispose();
    expect(hostDispose).toHaveBeenCalledTimes(1);
    expect(control.scene(view)).toBeUndefined();
    expect(views).toHaveLength(2);
  });

  it("draws rooms through the unified scene", () => {
    const room = {
      version: "interior-v1",
      parentWorldId: "world-1",
      featureId: "settlement:0:0:block:1:1:lot:0",
      buildingType: "prop-regional-apartment-2",
      floor: 0,
      returnX: 1,
      returnY: 2,
    };
    const { gc, view, frames, sync } = drawable(room);
    sync();
    expect(renderFirstPerson(gc, view, 1)).toBe(true);
    expect(view.topDown3d).toBe(true);
    // The top-down camera over the room; rooms have no grass.
    expect(frames[0]?.topDown).toBeDefined();
    expect(frames[0]?.interior?.map).toBeDefined();
    expect(frames[0]?.grass).toBeUndefined();
    expect(frames).toHaveLength(1);
  });
});
