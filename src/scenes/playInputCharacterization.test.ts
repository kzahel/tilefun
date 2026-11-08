/**
 * Characterization of single-player play input (tactical 226, slice 0).
 *
 * Pins what the real PlayScene and PlayInputController send for keyboard,
 * joystick and tap input before input composition moves out of PlayScene.
 * Only the authority, replica, audio and debug UI are faked; ActionManager,
 * the touch controls, tap movement and the camera are the production classes.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RemoteStateView } from "../client/ClientStateView.js";
import { PlayerPredictor } from "../client/PlayerPredictor.js";
import { PlayInputController, type PlayInputSettings } from "../client/PlayInputController.js";
import type { GameContext } from "../core/GameScene.js";
import type { Entity } from "../entities/Entity.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { ActionManager } from "../input/ActionManager.js";
import { controllerInput } from "../input/ControllerInput.js";
import type { SeatSample } from "../input/SeatComposer.js";
import { neutralSample, type SeatInput } from "../input/SeatInput.js";
import { Camera } from "../rendering/Camera.js";
import { ZOOM_PRESETS } from "../rendering/PresentationSettings.js";
import type { Requester } from "../session/DeviceSeats.js";
import { DeviceSession } from "../session/DeviceSession.js";
import { followSeat, View } from "../session/View.js";
import { quantizeAxis } from "../shared/binaryCodec.js";
import type { ClientMessage } from "../shared/protocol.js";
import { createVehicle } from "../traffic/Vehicle.js";
import type { IClientTransport } from "../transport/Transport.js";
import { PlayScene } from "./PlayScene.js";

const DT = 1 / 60;
type PlayerInput = Extract<ClientMessage, { type: "player-input" }>;

function fakeCanvas(): HTMLCanvasElement {
  return Object.assign(new EventTarget(), {
    width: 800,
    height: 600,
    dataset: {} as DOMStringMap,
    // Shown at half size with an offset, so CSS-to-canvas mapping is exercised.
    getBoundingClientRect: () => ({ left: 10, top: 20, width: 400, height: 300 }),
  }) as unknown as HTMLCanvasElement;
}

function silentAudio() {
  const noop = () => {};
  return {
    ready: false,
    stopHorns: noop,
    stopSirens: noop,
    stopTrains: noop,
    stopCarEngine: noop,
    stopCreatureCalls: noop,
    updateSirens: noop,
    updateCarEngine: noop,
    updateTrains: noop,
    updateCreatureCalls: noop,
    getBuffer: () => undefined,
    playOneShot: noop,
  };
}

interface HarnessOptions {
  movementMode?: PlayInputSettings["movementMode"];
  carDriving?: PlayInputSettings["carDriving"];
}

function playHarness(options: HarnessOptions = {}) {
  const sent: ClientMessage[] = [];
  const transport: IClientTransport = {
    send: (msg) => sent.push(msg),
    onMessage: () => {},
    close: () => {},
  };
  const player: Entity = { ...createPlayer(100, 100), id: 1 };
  const view = {
    playerEntity: player,
    entities: [player] as Entity[],
    serverPlayerEntity: { ...player, id: -1 },
    serverEntities: [] as Entity[],
    lastProcessedInputSeq: 0,
    stateAppliedThisTick: false,
    world: {},
    props: [],
    invincibilityTimer: 0,
    gemsCollected: 0,
    editorEnabled: false,
    setPredictor: () => {},
  };
  const camera = new Camera();
  const session = new DeviceSession(view as unknown as RemoteStateView);
  const seatView = new View(followSeat(), camera);
  seatView.setRegion({ x: 0, y: 0, width: 800, height: 600 }); // the whole canvas
  session.views.push(seatView);
  const audioManager = silentAudio();
  const actions = new ActionManager();
  const scene = new PlayScene();
  const host = {
    currentScene: scene,
    stateView: view as unknown as RemoteStateView,
    view: seatView,
    transport,
    audioManager: audioManager as never,
    doorBusy: false,
    storagePaused: false,
    menuOpen: false,
    zoom: 1,
  };
  const canvas = fakeCanvas();
  const input = new PlayInputController(canvas, actions, host, {
    movementMode: options.movementMode ?? "joystick",
    pinchZoom: false,
    carDriving: options.carDriving ?? "steering",
  });
  const visibleRanges: number[] = [];
  const debugStates: boolean[] = [];
  const zooms: number[] = [];
  const gc = {
    doorPresentation: {
      get busy() {
        return host.doorBusy;
      },
    },
    realmId: "world",
    get storagePaused() {
      return host.storagePaused;
    },
    get inputBlocked() {
      return input.inputBlocked;
    },
    get touchMovement() {
      return input.movementMode;
    },
    get carDriving() {
      return input.carDriving;
    },
    tapMovement: input.tapMovement,
    touchPinch: input.touchPinch,
    touchTap: input.touchTap,
    touchHold: input.touchHold,
    canvas,
    camera,
    session,
    view: seatView,
    actions,
    stateView: view,
    transport,
    audioManager,
    debugPanel: {
      zoom: 1,
      paused: false,
      observer: false,
      consumeBaseModeChange: () => false,
      consumeConvexChange: () => false,
      setPlayerInfo: () => {},
      setZoom: (zoom: number) => zooms.push(zoom),
    },
    touchJoystick: input.touchJoystick,
    touchButtons: input.touchButtons,
    console: { cvars: { get: () => undefined } },
    chatHUD: { update: () => {} },
    clientId: "local",
    profile: null,
    debugEnabled: false,
    editorButton: null,
    sendVisibleRange: () => visibleRanges.push(1),
    sendDebugState: (paused: boolean) => debugStates.push(paused),
  } as unknown as GameContext;

  scene.onEnter(gc);
  input.attachFocusListeners();
  input.attachPlayClicks();
  const entered = sent.splice(0);

  return {
    scene,
    gc,
    actions,
    input,
    host,
    view,
    player,
    camera,
    seatView,
    canvas,
    sent,
    entered,
    visibleRanges,
    debugStates,
    zooms,
    step(ticks = 1) {
      for (let i = 0; i < ticks; i++) scene.update(DT, gc);
    },
    /** Board `vehicle`, which becomes the player's parent. */
    board(vehicle: Entity) {
      player.parentId = vehicle.id;
      view.entities = [player, vehicle];
    },
    take(): ClientMessage[] {
      return sent.splice(0);
    },
    inputs(): PlayerInput[] {
      return sent.filter((m): m is PlayerInput => m.type === "player-input");
    },
    lastInput(): PlayerInput {
      const all = sent.filter((m): m is PlayerInput => m.type === "player-input");
      const last = all.at(-1);
      if (!last) throw new Error("no player-input sent");
      return last;
    },
  };
}

function car(model: string, id = 7): Entity {
  return { ...createVehicle(model, 100, 100), id };
}

const neutral = { dx: 0, dy: 0, sprinting: false, jump: false };
/** 226 slice 5-i: a stop is one device packet, every seat still with explicit flags. */
const stillPacket = { ...neutral, jumpPressed: false, reversing: false, relativeDriving: false };

function gamepad(buttons: number[], axes: number[]): Gamepad {
  return {
    connected: true,
    mapping: "standard",
    index: 0,
    axes,
    buttons: Array.from({ length: 17 }, (_, i) => ({
      pressed: buttons.includes(i),
      touched: buttons.includes(i),
      value: buttons.includes(i) ? 1 : 0,
    })),
  } as unknown as Gamepad;
}

function setHidden(hidden: boolean): void {
  (document as unknown as { hidden: boolean }).hidden = hidden;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), { hidden: false, hasFocus: () => true }),
  );
  vi.stubGlobal("navigator", { maxTouchPoints: 0 });
});
afterEach(() => {
  controllerInput.sample([], 0); // no pads: clears the active pad and held state
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("play input characterization (pre-226 composition)", () => {
  it("sends one quantized player-input per tick with sprint and diagonal normalization", () => {
    const h = playHarness();
    h.actions.pressKey("KeyD");
    h.actions.pressKey("ShiftLeft");
    h.actions.pressKey("KeyR"); // reverse only applies in cars
    h.step();
    const first = h.lastInput();
    expect(first).toEqual({
      type: "player-input",
      seq: first.seq,
      dx: 1,
      dy: 0,
      sprinting: true,
      jump: false,
      jumpPressed: false,
      reversing: false,
      relativeDriving: false,
    });
    h.actions.pressKey("KeyW");
    h.step();
    const diagonal = h.lastInput();
    expect(diagonal.seq).toBe(first.seq + 1);
    expect(diagonal.dx).toBe(quantizeAxis(Math.SQRT1_2));
    expect(diagonal.dy).toBe(quantizeAxis(-Math.SQRT1_2));
    expect(h.scene.lastMovement.dx).toBeCloseTo(Math.SQRT1_2, 12);
    expect(h.inputs()).toHaveLength(2);
    expect(h.visibleRanges).toHaveLength(2);
    expect(h.debugStates).toEqual([false, false]);
  });

  it("latches a jump tapped between ticks and reports a held jump's press once", () => {
    const h = playHarness();
    h.actions.pressKey("Space");
    h.actions.releaseKey("Space");
    h.step();
    expect(h.lastInput()).toMatchObject({ jump: false, jumpPressed: true });
    h.step();
    expect(h.lastInput()).toMatchObject({ jump: false, jumpPressed: false });

    h.take();
    h.actions.pressKey("Space");
    h.step(3);
    expect(h.inputs().map((m) => [m.jump, m.jumpPressed])).toEqual([
      [true, true],
      [true, false],
      [true, false],
    ]);
  });

  // 226 slice 5-i: a menu or lost focus is stored as neutral input, since authority keeps
  // simulating; a storage pause or door transition holds the device still and is not.
  it.each([
    ["storage pause", (h: ReturnType<typeof playHarness>) => (h.host.storagePaused = true), 1],
    ["door transition", (h: ReturnType<typeof playHarness>) => (h.host.doorBusy = true), 1],
    ["open menu", (h: ReturnType<typeof playHarness>) => (h.host.menuOpen = true), 2],
  ])("a %s sends neutral input on the shared sequence", (_, lock, stored) => {
    const h = playHarness();
    const store = vi.spyOn(PlayerPredictor.prototype, "storeInput");
    h.actions.pressKey("KeyD");
    h.step();
    expect(store).toHaveBeenCalledTimes(1);
    const before = h.lastInput().seq;
    lock(h);
    h.step();
    expect(h.lastInput()).toMatchObject({ ...neutral, seq: before + 1, jumpPressed: false });
    // Door walk-through reads lastMovement; it stays still while locked.
    expect(h.scene.lastMovement).toEqual({ dx: 0, dy: 0 });
    expect(store).toHaveBeenCalledTimes(stored);
    if (stored === 2)
      expect(store).toHaveBeenLastCalledWith(before + 1, stillPacket, 1 / 60, undefined);
    expect(h.gc.touchButtons.enabled).toBe(false);
    expect(h.gc.touchJoystick.enabled).toBe(false);
    // Locks do not clear held keys: movement resumes when the lock lifts.
    h.host.storagePaused = h.host.doorBusy = h.host.menuOpen = false;
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 1, seq: before + 2 });
    expect(store).toHaveBeenCalledTimes(stored + 1);
  });

  it("window blur clears held input with an extra neutral command and locks until focus", () => {
    const h = playHarness();
    h.actions.pressKey("KeyD");
    h.step();
    const seq = h.lastInput().seq;
    h.take();
    window.dispatchEvent(new Event("blur"));
    expect(h.take()).toEqual([
      { type: "vehicle-horn", active: false },
      { type: "player-input", seq: seq + 1, ...stillPacket },
    ]);
    h.step();
    expect(h.lastInput()).toMatchObject({ ...neutral, seq: seq + 2 });
    window.dispatchEvent(new Event("focus"));
    h.step();
    // Blur released the held key, so focus alone does not resume movement.
    expect(h.lastInput()).toMatchObject({ dx: 0, seq: seq + 3 });
    expect(h.gc.touchButtons.enabled).toBe(true);
  });

  it("hiding the page clears held input with a neutral command and locks while hidden", () => {
    const h = playHarness();
    h.actions.pressKey("KeyA");
    h.step();
    const seq = h.lastInput().seq;
    h.take();
    setHidden(true);
    expect(h.take()).toEqual([
      { type: "vehicle-horn", active: false },
      { type: "player-input", seq: seq + 1, ...stillPacket },
    ]);
    expect(h.actions.isHeld("move_left")).toBe(false);
    h.step();
    expect(h.lastInput()).toMatchObject({ ...neutral, seq: seq + 2 });
    expect(h.gc.touchButtons.enabled).toBe(false);
    setHidden(false);
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 0, seq: seq + 3 });
    expect(h.gc.touchButtons.enabled).toBe(true);
  });

  it("steering cars send unnormalized relative axes, reverse, and never jump", () => {
    const h = playHarness({ carDriving: "steering" });
    h.board(car("compact-1"));
    h.actions.pressKey("KeyW");
    h.actions.pressKey("KeyD");
    h.actions.pressKey("KeyR");
    h.actions.pressKey("Space");
    h.step();
    expect(h.lastInput()).toMatchObject({
      dx: 1,
      dy: -1,
      jump: false,
      jumpPressed: false,
      reversing: true,
      relativeDriving: true,
    });
    expect(h.gc.touchButtons.driving).toBe(true);
  });

  it("direction-style cars send normalized world axes", () => {
    const h = playHarness({ carDriving: "direction" });
    h.board(car("compact-1"));
    h.actions.pressKey("KeyW");
    h.actions.pressKey("KeyD");
    h.step();
    expect(h.lastInput()).toMatchObject({
      dx: quantizeAxis(Math.SQRT1_2),
      dy: quantizeAxis(-Math.SQRT1_2),
      relativeDriving: false,
    });
  });

  it("holds the horn with a refresh every 0.2 s and releases it once", () => {
    const h = playHarness();
    h.actions.pressKey("KeyH");
    h.step(2);
    expect(h.take().filter((m) => m.type === "vehicle-horn")).toEqual([]);

    h.board(car("compact-1"));
    const horns: number[] = [];
    for (let tick = 0; tick < 30; tick++) {
      h.step();
      const sent = h.take().filter((m) => m.type === "vehicle-horn");
      expect(sent.length).toBeLessThanOrEqual(1);
      if (sent.length) horns.push(tick);
    }
    // The refresh cadence is about 0.2 s. Today it lands every 13th tick because
    // twelve 1/60 s additions sum to just under 0.2; 12 ticks is equally valid.
    expect(horns[0]).toBe(0);
    expect(horns.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < horns.length; i++)
      expect([12, 13]).toContain((horns[i] ?? 0) - (horns[i - 1] ?? 0));
    h.actions.releaseKey("KeyH");
    h.step(3);
    expect(h.take().filter((m) => m.type === "vehicle-horn")).toEqual([
      { type: "vehicle-horn", active: false },
    ]);
  });

  it("toggles sirens and style on press edges, ignoring keys held while boarding", () => {
    const h = playHarness();
    // Both keys go down and the player boards before any tick observes them.
    h.actions.pressKey("KeyL");
    h.actions.pressKey("KeyK");
    h.board(car("ambulance"));
    h.step(2);
    expect(h.take().filter((m) => m.type === "vehicle-emergency")).toEqual([]);

    h.actions.releaseKey("KeyL");
    h.actions.releaseKey("KeyK");
    h.step();
    h.actions.pressKey("KeyL");
    h.actions.pressKey("KeyK");
    h.step(3);
    expect(h.take().filter((m) => m.type === "vehicle-emergency")).toEqual([
      { type: "vehicle-emergency", action: "toggle" },
      { type: "vehicle-emergency", action: "style" },
    ]);
  });

  it("warning vehicles toggle beacons but have no siren style", () => {
    const h = playHarness();
    h.board(car("garbage-truck-green"));
    h.step();
    h.actions.pressKey("KeyL");
    h.actions.pressKey("KeyK");
    h.step();
    expect(h.take().filter((m) => m.type === "vehicle-emergency")).toEqual([
      { type: "vehicle-emergency", action: "toggle" },
    ]);
  });

  it("throws on release with force from charge time and direction from facing", () => {
    const h = playHarness();
    if (h.player.sprite) h.player.sprite.direction = Direction.Left;
    h.actions.pressKey("KeyB");
    h.step(30);
    expect(h.take().some((m) => m.type === "throw-ball")).toBe(false);
    h.actions.releaseKey("KeyB");
    h.step();
    const thrown = h.take().filter((m) => m.type === "throw-ball");
    expect(thrown).toEqual([{ type: "throw-ball", dirX: -1, dirY: 0, force: expect.any(Number) }]);
    expect((thrown[0] as { force: number }).force).toBeCloseTo(0.5, 6);

    h.actions.pressKey("KeyB");
    h.actions.pressKey("KeyS");
    h.step(90);
    h.actions.releaseKey("KeyB");
    h.step();
    expect(h.take().filter((m) => m.type === "throw-ball")).toEqual([
      { type: "throw-ball", dirX: 0, dirY: 1, force: 1 },
    ]);
  });

  it("does not throw from a vehicle", () => {
    const h = playHarness();
    h.board(car("compact-1"));
    h.actions.pressKey("KeyB");
    h.step(10);
    h.actions.releaseKey("KeyB");
    h.step();
    expect(h.take().some((m) => m.type === "throw-ball")).toBe(false);
  });

  it("drives the player from the touch joystick in joystick mode only", () => {
    const h = playHarness({ movementMode: "joystick" });
    h.gc.touchJoystick.simulateTouchStart(100, 300);
    h.gc.touchJoystick.simulateTouchMove(200, 300);
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 1, dy: 0 });
    h.input.setMovementMode("tap");
    h.step();
    expect(h.gc.touchJoystick.enabled).toBe(false);
  });

  it("tap destinations steer in world directions even when cars use relative steering", () => {
    const h = playHarness({ movementMode: "tap", carDriving: "steering" });
    h.gc.tapMovement?.setTarget({ wx: 300, wy: 100, wz: 0 });
    h.board(car("compact-1"));
    h.step();
    // Boarding cancels a destination chosen on foot.
    expect(h.lastInput()).toMatchObject({ dx: 0, dy: 0 });
    expect(h.gc.tapMovement?.target).toBeNull();
    h.gc.tapMovement?.setTarget({ wx: 300, wy: 100, wz: 0 });
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 1, dy: 0, relativeDriving: false });
    // Manual input replaces the destination.
    h.actions.pressKey("KeyA");
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: -1, relativeDriving: true });
    expect(h.gc.tapMovement?.target).toBeNull();
  });

  // 226 slice 5-i: the hit tick's own command is still, instead of an extra sequence
  // that would also stop the device's other seats.
  it("being hit cancels a tap destination with a neutral command on that tick", () => {
    const h = playHarness({ movementMode: "tap" });
    h.gc.tapMovement?.setTarget({ wx: 300, wy: 100, wz: 0 });
    h.step();
    const seq = h.lastInput().seq;
    h.take();
    h.view.invincibilityTimer = 1;
    h.step();
    expect(h.inputs().map((m) => ({ seq: m.seq, dx: m.dx }))).toEqual([{ seq: seq + 1, dx: 0 }]);
    expect(h.gc.tapMovement?.target).toBeNull();
  });

  it("pausing play stops the horn and sends neutral input", () => {
    const h = playHarness();
    h.board(car("compact-1"));
    h.actions.pressKey("KeyD");
    h.actions.pressKey("KeyH");
    h.step();
    const seq = h.lastInput().seq;
    h.take();
    h.scene.onPause(h.gc);
    expect(h.take()).toEqual([
      { type: "vehicle-horn", active: false },
      { type: "player-input", seq: seq + 1, ...stillPacket },
    ]);
    expect(h.actions.isHeld("move_right")).toBe(false);
  });

  it("leaves the editor on entering and resuming play", () => {
    const h = playHarness();
    expect(h.entered).toEqual([{ type: "set-editor-mode", enabled: false }]);
    h.scene.onPause(h.gc);
    h.take();
    h.scene.onResume(h.gc);
    expect(h.take()).toEqual([{ type: "set-editor-mode", enabled: false }]);
  });

  it("zoom hotkeys select presets until play pauses", () => {
    const h = playHarness();
    const preset = ZOOM_PRESETS.find((p) => p.action === "zoom_2");
    h.actions.pressKey("Digit2");
    expect(h.zooms).toEqual([preset?.zoom]);
    h.scene.onPause(h.gc);
    h.actions.releaseKey("Digit2");
    h.actions.pressKey("Digit2");
    expect(h.zooms).toHaveLength(1);
  });

  it("a desktop click interacts at the clicked world point, except just after a touch", () => {
    const h = playHarness();
    h.step(60);
    h.take();
    const click = () =>
      h.canvas.dispatchEvent(Object.assign(new Event("click"), { clientX: 110, clientY: 245 }));
    click();
    // (110 − 10) × 2, (245 − 20) × 2 in canvas pixels.
    const world = h.camera.screenToWorld(200, 450);
    expect(h.take()).toEqual([{ type: "player-interact", wx: world.wx, wy: world.wy }]);
    h.canvas.dispatchEvent(
      Object.assign(new Event("touchend"), { touches: [], changedTouches: [], targetTouches: [] }),
    );
    click();
    expect(h.take()).toEqual([]);
  });

  it("a standard gamepad stick and A button move and jump the player", () => {
    const h = playHarness();
    controllerInput.sample([gamepad([], [0, 0, 0, 0])], 0); // release fence
    controllerInput.sample([gamepad([0], [1, 0, 0, 0])], 16);
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 1, dy: 0, jump: true, jumpPressed: true });
    controllerInput.sample([gamepad([], [0, 0, 0, 0])], 32);
    h.step();
    expect(h.lastInput()).toMatchObject(neutral);
  });

  it("the camera follows a real player and waits for a placeholder", () => {
    const h = playHarness();
    h.player.id = -1;
    h.step(5);
    expect([h.camera.x, h.camera.y]).toEqual([0, 0]);
    h.player.id = 1;
    h.step(120);
    expect(h.camera.x).toBeCloseTo(100, 0);
    expect(h.camera.y).toBeCloseTo(100, 0);
  });

  it("reconciles new server state before predicting, resetting during a door transition", () => {
    const h = playHarness();
    const reconcile = vi.spyOn(h.gc.session, "reconcile").mockReturnValue(false);
    const predict = vi.spyOn(h.gc.session, "predict");
    h.step();
    expect(reconcile).not.toHaveBeenCalled(); // no new authoritative state this tick
    h.view.stateAppliedThisTick = true;
    h.step();
    // 226 slice 5-i: a reset seats the player on its parent (DeviceSession.test).
    expect(reconcile).toHaveBeenLastCalledWith(false);
    expect(reconcile.mock.invocationCallOrder.at(-1)).toBeLessThan(
      predict.mock.invocationCallOrder.at(-1) ?? 0,
    );
    h.host.doorBusy = true;
    h.step();
    expect(reconcile).toHaveBeenLastCalledWith(true);
  });
});

/** Touch/mouse event stand-in for the canvas listeners. */
function pointerEvent(type: string, init: Record<string, unknown>): Event {
  return Object.assign(new Event(type, { cancelable: true }), init);
}

/** Settle the camera on the player, then record that view for tap/hold resolution. */
function framePlayer(h: ReturnType<typeof playHarness>): void {
  h.step(120);
  h.input.tapMovement.captureView(h.seatView, 0);
  h.take();
}

/** Client pixels of a ground point (the canvas is shown at half size, offset 10, 20). */
function at(h: ReturnType<typeof playHarness>, wx: number, wy: number) {
  const s = h.camera.worldToScreen(wx, wy);
  return { clientX: 10 + s.sx / 2, clientY: 20 + s.sy / 2 };
}

function befriendable(wx: number, wy: number): Entity {
  return {
    ...createPlayer(wx, wy),
    id: 5,
    type: "wildlife-dog-v1",
    wanderAI: { befriendable: true },
  } as unknown as Entity;
}

/** A short touch that drifts `drift` client px right before lifting (taps allow 20). */
function touchTap(
  h: ReturnType<typeof playHarness>,
  point: ReturnType<typeof at>,
  id = 3,
  drift = 0,
) {
  const finger = { identifier: id, ...point };
  const lifted = { ...finger, clientX: finger.clientX + drift };
  h.canvas.dispatchEvent(
    pointerEvent("touchstart", { touches: [finger], changedTouches: [finger], targetTouches: [] }),
  );
  h.canvas.dispatchEvent(
    pointerEvent("touchend", { touches: [], changedTouches: [lifted], targetTouches: [] }),
  );
}

describe("play pointer characterization (226 slice 2, before composition moves)", () => {
  // The player stands at (100, 100) and the camera is settled on it.
  it("hold mode walks toward the held point until manual input or a lock releases it", () => {
    const h = playHarness({ movementMode: "hold" });
    framePlayer(h);
    h.canvas.dispatchEvent(pointerEvent("mousedown", { button: 0, ...at(h, 160, 100) }));
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 1, dy: 0, relativeDriving: false });
    expect(h.scene.lastMovement.dx).toBeCloseTo(1, 6);
    // Manual input wins and drops the hold.
    h.actions.pressKey("KeyS");
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 0, dy: 1 });
    h.actions.releaseKey("KeyS");
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 0, dy: 0 });

    h.canvas.dispatchEvent(pointerEvent("mousedown", { button: 0, ...at(h, 100, 40) }));
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 0, dy: -1 });
    h.host.storagePaused = true;
    h.step();
    h.host.storagePaused = false;
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 0, dy: 0 });
  });

  it("hold mode in a steering car aims in world space and slows within 24 px", () => {
    const h = playHarness({ movementMode: "hold", carDriving: "steering" });
    h.board(car("compact-1"));
    framePlayer(h);
    h.canvas.dispatchEvent(pointerEvent("mousedown", { button: 0, ...at(h, 112, 100) }));
    h.step();
    expect(h.lastInput()).toMatchObject({
      dx: quantizeAxis(12 / 24),
      dy: 0,
      relativeDriving: false,
    });
  });

  it("a tap-mode click sets a destination instead of interacting", () => {
    const h = playHarness({ movementMode: "tap" });
    framePlayer(h);
    h.canvas.dispatchEvent(pointerEvent("click", at(h, 160, 160)));
    expect(h.take()).toEqual([]);
    expect(h.gc.tapMovement?.target?.wx).toBeCloseTo(160, 6);
    expect(h.gc.tapMovement?.target?.wy).toBeCloseTo(160, 6);
    h.step();
    expect(h.lastInput()).toMatchObject({
      dx: quantizeAxis(Math.SQRT1_2),
      dy: quantizeAxis(Math.SQRT1_2),
    });
  });

  it("tapping a befriendable animal on foot befriends it instead of walking there", () => {
    const h = playHarness({ movementMode: "tap" });
    h.view.entities = [h.player, befriendable(160, 100)];
    framePlayer(h);
    h.gc.tapMovement?.setTarget({ wx: 50, wy: 50, wz: 0 });
    h.canvas.dispatchEvent(pointerEvent("click", at(h, 170, 100)));
    expect(h.take()).toEqual([
      { type: "player-interact", wx: expect.closeTo(170, 6), wy: expect.closeTo(100, 6) },
    ]);
    expect(h.gc.tapMovement?.target).toBeNull();
    // Outside the befriend radius it is an ordinary destination.
    h.canvas.dispatchEvent(pointerEvent("click", at(h, 190, 100)));
    expect(h.take()).toEqual([]);
    expect(h.gc.tapMovement?.target?.wx).toBeCloseTo(190, 6);
  });

  it("drivers cannot befriend: a tap on the animal becomes a destination", () => {
    const h = playHarness({ movementMode: "tap" });
    h.board(car("compact-1"));
    h.view.entities.push(befriendable(160, 100));
    framePlayer(h);
    h.canvas.dispatchEvent(pointerEvent("click", at(h, 160, 100)));
    expect(h.take()).toEqual([]);
    expect(h.gc.tapMovement?.target?.wx).toBeCloseTo(160, 6);
  });

  it("hold mode befriends on a tap but never sets a destination", () => {
    const h = playHarness({ movementMode: "hold" });
    h.view.entities = [h.player, befriendable(160, 100)];
    framePlayer(h);
    h.canvas.dispatchEvent(pointerEvent("click", at(h, 160, 100)));
    expect(h.take()).toEqual([
      { type: "player-interact", wx: expect.closeTo(160, 6), wy: expect.closeTo(100, 6) },
    ]);
    h.canvas.dispatchEvent(pointerEvent("click", at(h, 200, 100)));
    expect(h.take()).toEqual([]);
    expect(h.gc.tapMovement?.target).toBeNull();
  });

  it("a completed touch tap in tap mode keeps the destination resolved at touch start", () => {
    const h = playHarness({ movementMode: "tap" });
    framePlayer(h);
    // The finger drifts 12 client px (8 world px) before lifting; the start point wins.
    touchTap(h, at(h, 40, 100), 3, 12);
    expect(h.gc.tapMovement?.target?.wx).toBeCloseTo(40, 6);
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: -1, dy: 0 });
    h.canvas.dispatchEvent(pointerEvent("click", at(h, 160, 100)));
    expect(h.gc.tapMovement?.target?.wx).toBeCloseTo(40, 6);
  });

  it.each([
    ["storage pause", (h: ReturnType<typeof playHarness>) => (h.host.storagePaused = true)],
    ["door transition", (h: ReturnType<typeof playHarness>) => (h.host.doorBusy = true)],
    ["open menu", (h: ReturnType<typeof playHarness>) => (h.host.menuOpen = true)],
    ["another scene", (h: ReturnType<typeof playHarness>) => (h.host.currentScene = {} as never)],
  ])("a %s ignores clicks, destination taps and befriend taps", (_, lock) => {
    for (const movementMode of ["joystick", "tap", "hold"] as const) {
      const h = playHarness({ movementMode });
      h.view.entities = [h.player, befriendable(160, 100)];
      framePlayer(h);
      lock(h);
      h.canvas.dispatchEvent(pointerEvent("click", at(h, 160, 100)));
      h.canvas.dispatchEvent(pointerEvent("click", at(h, 40, 100)));
      expect(h.take(), movementMode).toEqual([]);
      touchTap(h, at(h, 160, 100));
      touchTap(h, at(h, 40, 100), 4);
      expect(h.take(), movementMode).toEqual([]);
      expect(h.gc.tapMovement?.target, movementMode).toBeNull();
    }
    // A tap that began before the lock and ends after it is dropped too.
    const h = playHarness({ movementMode: "tap" });
    h.view.entities = [h.player, befriendable(160, 100)];
    framePlayer(h);
    const finger = { identifier: 5, ...at(h, 160, 100) };
    h.canvas.dispatchEvent(
      pointerEvent("touchstart", {
        touches: [finger],
        changedTouches: [finger],
        targetTouches: [],
      }),
    );
    lock(h);
    h.canvas.dispatchEvent(
      pointerEvent("touchend", { touches: [], changedTouches: [finger], targetTouches: [] }),
    );
    expect(h.take()).toEqual([]);
  });

  it("a short joystick-mode touch tap interacts at the touched point", () => {
    const h = playHarness({ movementMode: "joystick" });
    framePlayer(h);
    touchTap(h, at(h, 160, 120), 4);
    expect(h.take()).toEqual([
      { type: "player-interact", wx: expect.closeTo(160, 6), wy: expect.closeTo(120, 6) },
    ]);
  });
});

/** A guest's scripted devices: fixed movement, and a throw key it can hold. */
function guestDevices(movement = { dx: -1, dy: 0, sprinting: false, jump: false }) {
  const devices = {
    steering: false,
    throwing: false,
    held: () => false,
    sample(locked: boolean): SeatSample {
      const presses = { ...neutralSample(), throw: devices.throwing };
      return locked ? neutralSample(presses) : { ...presses, manual: movement, steered: movement };
    },
    clear: vi.fn(),
    dispose: vi.fn(),
    on: () => () => {},
    hint: () => "",
  };
  return devices satisfies SeatInput;
}

/** Seat a guest beside the player, as authority and the frame seat list would. */
async function seatGuest(h: ReturnType<typeof playHarness>, devices = guestDevices()) {
  const guest: Entity = { ...createPlayer(140, 100), id: 2 };
  Object.assign(h.view, {
    seats: {
      entities: new Map([
        [0, 1],
        [1, 2],
      ]),
    },
    serverEntities: [h.player, guest],
  });
  const answer = (async (msg: { requestId: number; seat: number }) => ({
    type: "seat-joined",
    requestId: msg.requestId,
    seat: msg.seat,
    entityId: 2,
  })) as unknown as Requester;
  await h.gc.session.seats.join(answer, 1, 1, devices);
  return devices;
}

describe("device seats on the play path (226 slice 5-i)", () => {
  it("sends a guest's command and presses with seat 0's on one sequence; a lock stills the guest too", async () => {
    const h = playHarness();
    const devices = await seatGuest(h);
    h.actions.pressKey("KeyD");
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 1, seats: [{ seat: 1, dx: -1 }] });
    h.host.menuOpen = true;
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 0, seats: [{ seat: 1, dx: 0 }] });
    h.host.menuOpen = false;
    devices.throwing = true;
    h.step(10);
    h.take();
    devices.throwing = false;
    h.step();
    expect(h.take().find((m) => m.type === "seat")).toMatchObject({
      type: "seat",
      seat: 1,
      message: { type: "throw-ball" },
    });
  });

  it("pausing play releases every seat's horn and stops every seat at once", async () => {
    const h = playHarness();
    const devices = await seatGuest(h);
    h.step();
    const seq = h.lastInput().seq;
    h.take();
    h.scene.onPause(h.gc);
    expect(h.take()).toEqual([
      { type: "vehicle-horn", active: false },
      { type: "seat", seat: 1, message: { type: "vehicle-horn", active: false } },
      { type: "player-input", seq: seq + 1, ...stillPacket, seats: [{ seat: 1, ...stillPacket }] },
    ]);
    expect(devices.clear).toHaveBeenCalled();
  });

  it("lost focus forgets a jump latched before it", () => {
    const h = playHarness();
    h.actions.pressKey("Space");
    h.actions.releaseKey("Space");
    window.dispatchEvent(new Event("blur"));
    window.dispatchEvent(new Event("focus"));
    h.step();
    expect(h.lastInput()).toMatchObject({ jump: false, jumpPressed: false });
  });

  it("a hit stops a hold-mode walk on that tick even with a key held, then keys move again", () => {
    const h = playHarness({ movementMode: "hold" });
    h.actions.pressKey("KeyD");
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 1 });
    h.view.invincibilityTimer = 1;
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 0 });
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 1 });
  });

  it("a new play scene starts its seats afresh: keys held while boarding toggle nothing", () => {
    const h = playHarness();
    h.board(car("ambulance"));
    h.step();
    h.scene.onExit(h.gc);
    h.actions.pressKey("KeyL");
    const next = new PlayScene();
    next.onEnter(h.gc);
    next.update(DT, h.gc);
    next.update(DT, h.gc);
    expect(h.take().filter((m) => m.type === "vehicle-emergency")).toEqual([]);
  });
});

describe("split screen on the play path (226 slice 5-ii-a)", () => {
  async function splitHarness() {
    const h = playHarness();
    await seatGuest(h);
    const guest = (h.view.serverEntities as Entity[])[1] as Entity;
    h.view.entities = [h.player, guest];
    Object.assign((h.view as unknown as { seats: object }).seats, { session: () => undefined });
    const guestView = new View(followSeat({ seat: 1 }), undefined, 1);
    guestView.setRegion({ x: 400, y: 0, width: 400, height: 600 });
    h.gc.session.views.push(guestView);
    return { ...h, guestView };
  }

  it("a menu pauses the whole device while guests play; one player keeps playing", async () => {
    const solo = playHarness();
    solo.host.menuOpen = true;
    solo.step();
    expect(solo.debugStates.at(-1)).toBe(false); // unchanged for one player
    const h = await splitHarness();
    h.step();
    expect(h.debugStates.at(-1)).toBe(false);
    h.host.menuOpen = true;
    h.step();
    expect(h.debugStates.at(-1)).toBe(true);
    h.host.menuOpen = false;
    h.step();
    expect(h.debugStates.at(-1)).toBe(false);
    // The world menu, map or catalogs push over play: the device pauses at once.
    h.scene.onPause(h.gc);
    expect(h.debugStates.at(-1)).toBe(true);
    const before = solo.debugStates.length;
    solo.scene.onPause(solo.gc);
    expect(solo.debugStates).toHaveLength(before);
  });

  it("every view's camera steps at its own zoom; a guest's follows it and sends its range", async () => {
    const h = await splitHarness();
    h.guestView.zoomScale = 0.75;
    (h.gc.debugPanel as { zoom: number }).zoom = 2;
    h.take();
    h.step();
    expect([h.camera.zoom, h.guestView.camera.zoom]).toEqual([2, 1.5]);
    expect([h.guestView.camera.x, h.guestView.camera.y]).toEqual([140, 100]);
    const range = h.guestView.camera.getVisibleChunkRange();
    expect(h.take().filter((m) => m.type === "seat")).toEqual([
      { type: "seat", seat: 1, message: { type: "visible-range", ...range } },
    ]);
    expect(h.visibleRanges.length).toBeGreaterThan(0); // seat 0's range is the page's
  });

  it("leaving play shows seat 0 alone (the editor keeps one view)", async () => {
    const h = await splitHarness();
    const layout = vi.spyOn(h.gc.session, "layoutViews");
    h.scene.onExit(h.gc);
    expect(layout).toHaveBeenLastCalledWith(h.canvas.width, h.canvas.height, false);
  });
});

describe("seat 0's region on the play path (226 slice 5-ii-b)", () => {
  /** Two players side by side: seat 0 keeps the left half of the 800×600 canvas. */
  function leftHalf(options: HarnessOptions = {}) {
    const h = playHarness(options);
    h.seatView.setRegion({ x: 0, y: 0, width: 400, height: 600 });
    framePlayer(h);
    return h;
  }
  /** Client pixels of a canvas pixel (the canvas is shown at half size, offset 10, 20). */
  const client = (x: number, y: number) => ({ clientX: 10 + x / 2, clientY: 20 + y / 2 });

  it("a click in a guest's region does nothing; one in seat 0's resolves through its view", () => {
    const h = leftHalf();
    h.canvas.dispatchEvent(pointerEvent("click", client(600, 300)));
    expect(h.take()).toEqual([]);
    h.canvas.dispatchEvent(pointerEvent("click", client(200, 300)));
    const world = h.camera.screenToWorld(200, 300);
    expect(h.take()).toEqual([{ type: "player-interact", wx: world.wx, wy: world.wy }]);
    // Seat 0's view is centred on its player in its own half, not the canvas.
    expect(world.wx).toBeCloseTo(100, 0);
  });

  it("taps and holds that start in a guest's region set no destination", () => {
    const tap = leftHalf({ movementMode: "tap" });
    tap.canvas.dispatchEvent(pointerEvent("click", client(600, 300)));
    expect(tap.gc.tapMovement?.target).toBeNull();
    tap.canvas.dispatchEvent(pointerEvent("click", client(300, 300)));
    expect(tap.gc.tapMovement?.target?.wx).toBeGreaterThan(100);

    const hold = leftHalf({ movementMode: "hold" });
    hold.canvas.dispatchEvent(pointerEvent("mousedown", { button: 0, ...client(700, 300) }));
    hold.step();
    expect(hold.lastInput()).toMatchObject({ dx: 0, dy: 0 });
    hold.canvas.dispatchEvent(pointerEvent("mouseup", { button: 0, ...client(700, 300) }));
    hold.canvas.dispatchEvent(pointerEvent("mousedown", { button: 0, ...client(300, 300) }));
    hold.step();
    expect(hold.lastInput()).toMatchObject({ dx: 1, dy: 0 });
    // A hold that started in seat 0's view keeps steering when it drifts out of it
    // (as one dragged off an embedded lab's canvas always has).
    window.dispatchEvent(pointerEvent("mousemove", { buttons: 1, ...client(700, 300) }));
    hold.step();
    expect(hold.lastInput()).toMatchObject({ dx: 1, dy: 0 });
  });
});
