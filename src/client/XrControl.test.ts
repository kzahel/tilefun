import * as THREE from "three";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NORTH_YAW } from "../rendering/firstperson/FirstPersonCamera.js";
import type { ImmersiveOutput, View3dXr } from "../rendering/View3dHost.js";
import type { ViewEye } from "../session/ViewEye.js";
import { roomToWorld, SNAP_TURN, TABLE_DEAD_ZONE } from "../xr/XrRig.js";
import { EYE_PIXELS_PER_METRE, type XrClient, XrControl } from "./XrControl.js";

/** A head pose as a session reports it: yaw to the right, then pitch up. */
function headPose(x: number, y: number, z: number, yawRight = 0, pitchUp = 0): number[] {
  const m = new THREE.Matrix4().makeRotationFromEuler(
    new THREE.Euler(pitchUp, -yawRight, 0, "YXZ"),
  );
  m.setPosition(x, y, z);
  return m.toArray();
}

/** A session, a browser that grants it, and the client around the control. */
function harness() {
  const events: string[] = [];
  let frame: XRFrameRequestCallback | undefined;
  let end: (() => void) | undefined;
  const state = {
    playing: true,
    held: undefined as number | undefined,
    reach: undefined as number | undefined,
    pose: headPose(0, 1.2, 0),
    posed: true,
    time: 0,
    requests: [] as XRSessionInit[],
  };
  const session = {
    inputSources: [] as unknown[],
    supportedFrameRates: new Float32Array([72, 90]),
    addEventListener(type: string, listener: () => void) {
      if (type === "end") end = listener;
    },
    updateTargetFrameRate: vi.fn(async () => {}),
    end: vi.fn(async () => {
      events.push("session ended");
      end?.();
    }),
  };
  const output: View3dXr = {
    async immersive(_session, callback): Promise<ImmersiveOutput> {
      events.push("immersive");
      frame = callback;
      return { space: {} as XRReferenceSpace, draw: () => true };
    },
    async screen(_session, callback) {
      events.push("screen");
      frame = callback;
      return { space: {} as XRReferenceSpace };
    },
  };
  const client: XrClient = {
    output,
    loop: {
      start: () => events.push("page loop on"),
      stop: () => events.push("page loop off"),
      externalTick: (now) => events.push(`tick ${now}`),
    },
    firstPerson: {
      hold(heading) {
        state.held = heading;
      },
      unhold() {
        state.held = undefined;
      },
      get reach() {
        return state.reach;
      },
      set reach(value) {
        state.reach = value;
      },
    },
    controller: { headset: null, poll: () => events.push("poll") },
    playing: () => state.playing,
    heading: () => 0, // the player faces east
    restored: () => events.push("restored"),
  };
  vi.stubGlobal("navigator", {
    userAgent:
      "Mozilla/5.0 (X11; Linux x86_64; Quest 3) OculusBrowser/156.0 Chrome/156.0 VR Safari/537.36",
    userActivation: { isActive: false },
    xr: {
      isSessionSupported: async () => true,
      requestSession: async (_mode: string, init: XRSessionInit) => {
        state.requests.push(init);
        return session;
      },
    },
  });
  const control = new XrControl(client);
  /** One headset frame, 1/90 s after the last. */
  const step = () => {
    state.time += 1000 / 90;
    frame?.(state.time, {
      getViewerPose: () => (state.posed ? { transform: { matrix: state.pose } } : null),
    } as unknown as XRFrame);
  };
  return { control, client, session, state, events, step };
}

const player: ViewEye = { x: 500, y: 300, z: 20, yaw: 0, pitch: 0, own: 7 };

beforeEach(() => vi.stubGlobal("performance", { now: () => 0 }));
afterEach(() => vi.unstubAllGlobals());

describe("a headset session (252)", () => {
  it("drives the game loop from its frames and gives it back when it ends", async () => {
    const { control, client, session, state, events, step } = harness();
    expect(await control.detect()).toBe(true);
    // No quad layers in this browser: no headset screen.
    expect(control.modes).toEqual(["eye", "tabletop"]);
    expect(await control.enter("eye")).toBe(true);
    expect(events).toEqual(["page loop off", "immersive"]);
    expect(control.mode).toBe("eye");
    expect(control.immersive).toBe(true);
    // Seat 0 is held in the 3D scene, facing the way the player faces.
    expect(state.held).toBe(0);
    expect(client.controller.headset).toBeTypeOf("function");
    events.length = 0;
    step();
    // Controllers are read before the tick that uses them.
    expect(events).toEqual(["poll", `tick ${1000 / 90}`]);
    control.exit();
    expect(session.end).toHaveBeenCalledOnce();
    expect(events.slice(-3)).toEqual(["session ended", "restored", "page loop on"]);
    expect(control.mode).toBeNull();
    expect(control.immersive).toBe(false);
    expect(state.held).toBeUndefined();
    expect(client.controller.headset).toBeNull();
    // The player left by choice: nothing to resume.
    expect(control.resume).toBeNull();
  });

  it("does not list a phone's cardboard mode in the menu", async () => {
    const { control } = harness();
    (navigator as { userAgent: string }).userAgent =
      "Mozilla/5.0 (Linux; Android 16; Pixel 7a) AppleWebKit/537.36 Chrome/156.0 Mobile Safari/537.36";
    expect(await control.detect()).toBe(true);
    expect(control.modes).toEqual([]);
    // Asked for by name (the console), it still starts.
    expect(await control.enter("eye")).toBe(true);
  });

  it("gives the tabletop's reach back with the seat", async () => {
    const { control, client, state, step } = harness();
    await control.enter("tabletop");
    step();
    control.tick({ yaw: 0, pitch: 0 }, 1 / 60, { dx: 0, dy: 0 });
    expect(client.firstPerson.reach).toBeGreaterThan(0);
    control.exit();
    expect(state.held).toBeUndefined();
    expect(client.firstPerson.reach).toBeUndefined();
  });

  it("leaves nothing held when the headset's output cannot start", async () => {
    const { control, client, session, state, events } = harness();
    (client.output as { immersive: unknown }).immersive = async () => {
      throw Error("no layers today");
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await control.enter("eye")).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
    expect(session.end).toHaveBeenCalledOnce();
    expect(control.mode).toBeNull();
    expect(state.held).toBeUndefined();
    expect(client.controller.headset).toBeNull();
    expect(events.at(-1)).toBe("page loop on");
  });

  it("ends a session whose eyes never get a picture", async () => {
    const { control, session, step } = harness();
    let now = 0;
    vi.stubGlobal("performance", { now: () => now });
    await control.enter("eye");
    step();
    expect(session.end).not.toHaveBeenCalled();
    // Play is on top, but nothing drew: the scene failed to load, say.
    now = 5000;
    step();
    expect(session.end).toHaveBeenCalledOnce();
    // One that draws stays.
    const drawing = harness();
    await drawing.control.enter("eye");
    drawing.step();
    expect(drawing.control.draw(() => {})).toBe(true);
    now = 10_000;
    drawing.step();
    expect(drawing.session.end).not.toHaveBeenCalled();
    // A frame without a pose has last frame's eyes: it is not drawn.
    drawing.state.posed = false;
    drawing.step();
    expect(drawing.control.draw(() => {})).toBe(false);
  });

  it("does not start the page's loop again for a client that is going away", async () => {
    const { control, session, events } = harness();
    await control.enter("eye");
    events.length = 0;
    control.dispose();
    expect(session.end).toHaveBeenCalledOnce();
    expect(events).toEqual(["session ended"]);
    expect(control.resume).toBeNull();
  });

  it("ends when a menu covers play, and enters again on the gesture that resumes", async () => {
    const { control, session, state, step } = harness();
    await control.enter("eye");
    step();
    state.playing = false;
    step();
    expect(session.end).toHaveBeenCalledOnce();
    expect(control.mode).toBeNull();
    expect(control.resume).toBe("eye");
    // Play resumes from a click: the gesture a session needs.
    state.playing = true;
    (navigator.userActivation as { isActive: boolean }).isActive = true;
    control.resumeInPlay();
    await vi.waitFor(() => expect(control.mode).toBe("eye"));
    expect(state.requests).toHaveLength(2);
    expect(control.resume).toBeNull();
  });

  it("stays on the page when the menu closes without a gesture", async () => {
    const { control, state, step } = harness();
    await control.enter("eye");
    step();
    state.playing = false;
    step();
    expect(control.resume).toBe("eye");
    // A gesture while the menu is still open changes nothing.
    control.resumeInPlay();
    expect(control.resume).toBe("eye");
    // Closed with a pad or Escape: play is back without a gesture a session
    // accepts, and no later click starts one.
    state.playing = true;
    control.resumeInPlay();
    expect(control.resume).toBeNull();
    (navigator.userActivation as { isActive: boolean }).isActive = true;
    control.resumeInPlay();
    expect(state.requests).toHaveLength(1);
    expect(control.mode).toBeNull();
  });

  it("asks for layers only for the screen, and does not wait on the display rate", async () => {
    const { control, session, state, events } = harness();
    control.frameRate = 72;
    session.updateTargetFrameRate.mockReturnValue(new Promise(() => {}));
    await control.enter("screen");
    expect(state.requests[0]).toEqual({
      requiredFeatures: ["layers"],
      optionalFeatures: ["local-floor"],
    });
    expect(session.updateTargetFrameRate).toHaveBeenCalledWith(72);
    expect(events).toContain("screen");
    expect(control.immersive).toBe(false);
  });

  it("goes back to the page when a frame throws", async () => {
    const { control, client, session, events, step } = harness();
    await control.enter("eye");
    client.loop.externalTick = () => {
      throw Error("broken frame");
    };
    expect(step).toThrow("broken frame");
    // Not a frozen picture in the headset with the page's loop stopped.
    expect(session.end).toHaveBeenCalledOnce();
    expect(events.at(-1)).toBe("page loop on");
    expect(control.mode).toBeNull();
  });

  it("reports frame pacing", async () => {
    const { control, step } = harness();
    await control.enter("eye");
    for (let i = 0; i < 10; i++) step();
    const pacing = control.pacing();
    expect(pacing.frames).toBe(9);
    expect(pacing.interval.p50).toBeCloseTo(1000 / 90, 6);
    expect(pacing.missed).toBe(0);
  });
});

describe("first person in a headset", () => {
  it("puts the resting head at the player's eye, looking the way the player faces", async () => {
    const { control, state, step } = harness();
    // The headset's own forward is wherever it was last set: here the head is
    // turned 50° right of it and stands off the room's origin.
    state.pose = headPose(0.4, 1.5, -0.2, 0.87);
    await control.enter("eye");
    step();
    const seen = control.seen(
      { seat: 0 },
      () => player,
      () => undefined,
      800,
    );
    expect(seen?.eye.x).toBeCloseTo(500, 6);
    expect(seen?.eye.y).toBeCloseTo(300, 6);
    expect(seen?.eye.z).toBeCloseTo(20, 6);
    expect(seen?.eye.yaw).toBeCloseTo(0, 6);
    expect(seen?.eye.own).toBe(7);
    expect(seen?.drawRadius).toBe(800);
    expect(seen?.headset.rig.pixelsPerMetre).toBe(EYE_PIXELS_PER_METRE);
    expect(seen?.headset.table).toBeUndefined();
    // Leaning 20 cm to the head's right moves the eye that far to the player's right (south).
    const right = { x: Math.cos(0.87) * 0.2, z: Math.sin(0.87) * 0.2 };
    state.pose = headPose(0.4 + right.x, 1.5, -0.2 + right.z, 0.87);
    step();
    const leaned = control.seen(
      { seat: 0 },
      () => player,
      () => undefined,
      800,
    );
    expect(leaned?.eye.x).toBeCloseTo(500, 6);
    expect(leaned?.eye.y).toBeCloseTo(300 + 0.2 * EYE_PIXELS_PER_METRE, 6);
  });

  it("looks where the head turns and snap-turns with the stick", async () => {
    const { control, state, step } = harness();
    await control.enter("eye");
    step();
    const look = { yaw: 0, pitch: 0 };
    control.tick(look, 1 / 60, { dx: 0, dy: 0 });
    expect(look.yaw).toBeCloseTo(0, 9);
    state.pose = headPose(0, 1.2, 0, 0.5, -0.2);
    step();
    control.tick(look, 1 / 60, { dx: 0, dy: 0 });
    expect(look.yaw).toBeCloseTo(0.5, 6);
    expect(look.pitch).toBeCloseTo(-0.2, 6);
    control.tick(look, 1 / 60, { dx: 1, dy: 0 });
    expect(look.yaw).toBeCloseTo(0.5 + SNAP_TURN, 6);
    // Holding the stick turns no further.
    control.tick(look, 1 / 60, { dx: 1, dy: 0 });
    expect(look.yaw).toBeCloseTo(0.5 + SNAP_TURN, 6);
    expect(control.walking).toBe(true);
  });

  it("keeps the eye and the look through the headset's own recentre", async () => {
    const { control, state, step } = harness();
    state.pose = headPose(0.5, 1.4, 0.2, 0.3);
    await control.enter("eye");
    step();
    // The player turns their head a little, then the headset recentres: the
    // room's origin and forward jump to wherever the head is.
    state.pose = headPose(0.5, 1.4, 0.2, 0.7);
    step();
    const before = control.seen(
      { seat: 0 },
      () => player,
      () => undefined,
      800,
    );
    control.recentre();
    state.pose = headPose(0, 1.4, 0, 0);
    step();
    const after = control.seen(
      { seat: 0 },
      () => player,
      () => undefined,
      800,
    );
    expect(after?.eye.x).toBeCloseTo(before?.eye.x ?? NaN, 6);
    expect(after?.eye.y).toBeCloseTo(before?.eye.y ?? NaN, 6);
    expect(after?.eye.yaw).toBeCloseTo(before?.eye.yaw ?? NaN, 6);
    expect(after?.eye.yaw).toBeCloseTo(0.4, 6);
  });

  it("asks the camera policy for the room's heading, not the head's", async () => {
    const { control, state, step } = harness();
    await control.enter("eye");
    step();
    state.pose = headPose(0, 1.2, 0, 1.1);
    step();
    const asked: number[] = [];
    control.seen(
      { seat: 0 },
      (look) => {
        asked.push(look.yaw);
        return player;
      },
      () => undefined,
      800,
    );
    // A chase camera behind a vehicle must not swing when the head turns.
    expect(asked[0]).toBeCloseTo(0, 6);
  });

  it("shows nothing before the player's body is known, or for another seat", async () => {
    const { control, step } = harness();
    await control.enter("eye");
    step();
    expect(
      control.seen(
        { seat: 0 },
        () => undefined,
        () => undefined,
        800,
      ),
    ).toBeUndefined();
    expect(
      control.seen(
        { seat: 1 },
        () => player,
        () => undefined,
        800,
      ),
    ).toBeUndefined();
  });
});

describe("a tabletop in a headset", () => {
  it("sets the player's place on a table in front of the head, north away", async () => {
    const { control, client, state, step } = harness();
    state.pose = headPose(1, 1.6, 2, 0.6);
    await control.enter("tabletop");
    step();
    const focus = { x: 500, y: 300, z: 0 };
    const seen = control.seen(
      { seat: 0 },
      () => player,
      () => focus,
      800,
    );
    const table = seen?.headset.table;
    expect(table).toMatchObject({ x: 500, y: 300 });
    const rig = seen?.headset.rig;
    if (!rig || !table) throw Error("no tabletop");
    // The table's middle is 0.6 m ahead of the head and 0.5 m below it.
    const ahead = { x: 1 + Math.sin(0.6) * 0.6, y: 1.1, z: 2 - Math.cos(0.6) * 0.6 };
    const middle = roomToWorld(rig, ahead);
    expect(middle.x).toBeCloseTo(500, 6);
    expect(middle.y).toBeCloseTo(300, 6);
    expect(middle.z).toBeCloseTo(0, 6);
    // Farther along the head's forward is north on the table.
    const far = roomToWorld(rig, {
      x: ahead.x + Math.sin(0.6) * 0.1,
      y: 1.1,
      z: ahead.z - Math.cos(0.6) * 0.1,
    });
    expect(far.x).toBeCloseTo(500, 6);
    expect(far.y).toBeLessThan(300);
    expect(seen?.eye.yaw).toBeCloseTo(NORTH_YAW, 6);
    // The player's body is on the table: nothing is hidden.
    expect(seen?.eye.own).toBeUndefined();
    // What is drawn and streamed reaches the table's corners.
    expect(seen?.drawRadius).toBeCloseTo(table.half * Math.SQRT2, 6);
    control.tick({ yaw: 0, pitch: 0 }, 1 / 60, { dx: 0, dy: 0 });
    // Streaming reaches them from a player standing off the middle.
    expect(client.firstPerson.reach).toBeCloseTo(table.half * (Math.SQRT2 + TABLE_DEAD_ZONE), 6);
    expect(control.walking).toBe(false);
  });

  it("follows a player who walks off the middle", async () => {
    const { control, step } = harness();
    await control.enter("tabletop");
    step();
    const at = (x: number) =>
      control.seen(
        { seat: 0 },
        () => player,
        () => ({ x, y: 300, z: 0 }),
        800,
      )?.headset.table?.x;
    expect(at(500)).toBe(500);
    // A few steps: inside the dead zone the table stays.
    expect(at(540)).toBe(500);
    for (let i = 0; i < 90; i++) at(700);
    // It settles within a world pixel of the player.
    expect(Math.abs((at(700) ?? 0) - 700)).toBeLessThan(1);
  });
});
