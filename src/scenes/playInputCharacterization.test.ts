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
import { Camera } from "../rendering/Camera.js";
import { ZOOM_PRESETS } from "../rendering/PresentationSettings.js";
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
  camera.setViewport(800, 600);
  const audioManager = silentAudio();
  const actions = new ActionManager();
  const scene = new PlayScene();
  const host = {
    currentScene: scene,
    stateView: view as unknown as RemoteStateView,
    camera,
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
    trainTapMovement: input.trainTapMovement,
    touchPinch: input.touchPinch,
    touchTap: input.touchTap,
    touchHold: input.touchHold,
    canvas,
    camera,
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
    xrActive: false,
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

  it.each([
    ["storage pause", (h: ReturnType<typeof playHarness>) => (h.host.storagePaused = true)],
    ["door transition", (h: ReturnType<typeof playHarness>) => (h.host.doorBusy = true)],
    ["open menu", (h: ReturnType<typeof playHarness>) => (h.host.menuOpen = true)],
  ])("a %s sends neutral input on the shared sequence without predicting it", (_, lock) => {
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
    // Slice 2 intends to store locked ticks as neutral input (226 corrections),
    // which will deliberately change this prediction assertion.
    expect(store).toHaveBeenCalledTimes(1);
    expect(h.gc.touchButtons.enabled).toBe(false);
    expect(h.gc.touchJoystick.enabled).toBe(false);
    // Locks do not clear held keys: movement resumes when the lock lifts.
    h.host.storagePaused = h.host.doorBusy = h.host.menuOpen = false;
    h.step();
    expect(h.lastInput()).toMatchObject({ dx: 1, seq: before + 2 });
    expect(store).toHaveBeenCalledTimes(2);
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
      { type: "player-input", seq: seq + 1, ...neutral },
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
      { type: "player-input", seq: seq + 1, ...neutral },
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

  it("being hit cancels a tap destination with an extra neutral command", () => {
    const h = playHarness({ movementMode: "tap" });
    h.gc.tapMovement?.setTarget({ wx: 300, wy: 100, wz: 0 });
    h.step();
    const seq = h.lastInput().seq;
    h.take();
    h.view.invincibilityTimer = 1;
    h.step();
    expect(h.inputs().map((m) => ({ seq: m.seq, dx: m.dx }))).toEqual([
      { seq: seq + 1, dx: 1 },
      { seq: seq + 2, dx: 0 },
    ]);
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
      { type: "player-input", seq: seq + 1, ...neutral },
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
});
