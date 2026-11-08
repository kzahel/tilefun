import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GameAssets } from "../assets/GameAssets.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { OverlayFrame } from "../rendering/OverlayFrame.js";
import type { RenderHost } from "../rendering/RenderHost.js";
import { RecordingBackend } from "../rendering/testing/RecordingBackend.js";
import { LabInput } from "../scenarios/LabInput.js";
import { RecipeWorldAuthority } from "../scenarios/RecipeWorldAuthority.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "../scenarios/ScenarioRecipe.js";
import { inProcessWorker } from "../server/testing/InProcessWorker.js";
import { fixedCamera } from "../session/View.js";

/** What each frame hands the shared lab draw, captured while it is presented. */
const drawn = vi.hoisted(
  () =>
    [] as {
      options: import("./LabScene.js").LabSceneOptions;
      presented: import("../entities/Entity.js").Entity;
      physics: import("../entities/Entity.js").Entity;
    }[],
);
vi.mock("./LabScene.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./LabScene.js")>();
  return {
    ...actual,
    drawLabFrame: (...args: Parameters<typeof actual.drawLabFrame>) => {
      const [, , device, , options] = args;
      drawn.push({
        options,
        presented: device.replica.presentedPlayerEntity,
        physics: device.replica.playerEntity,
      });
      actual.drawLabFrame(...args);
    },
  };
});

import { LabView, type LabViewOptions } from "./LabView.js";

const recipe: ScenarioRecipe = {
  version: 1,
  id: "lab-view",
  generation: FLAT_SCENARIO,
  player: createPlayer(0, 0),
  props: scenarioWalls(-400, -400, 400, 400),
  gravity: 0.5,
};
/** An asset set with one sheet, so closing it is observable. */
const gameAssets = () =>
  ({
    sheets: new Map([["sheet", { image: {} }]]),
    blendSheets: [],
    variants: {},
  }) as unknown as GameAssets;
const removed = vi.fn();
function element(): Record<string, unknown> {
  return {
    style: {},
    dataset: {},
    hidden: false,
    disabled: false,
    textContent: "",
    append() {},
    setAttribute() {},
    remove: removed,
  };
}

let win: EventTarget;
let canvas: EventTarget & { parentElement: { append: ReturnType<typeof vi.fn> } };
beforeEach(() => {
  // Rapier's bindings read timing from `window` when one exists.
  win = Object.assign(new EventTarget(), { performance: globalThis.performance });
  const parent = { append: vi.fn() };
  canvas = Object.assign(new EventTarget(), {
    tagName: "CANVAS",
    width: 960,
    height: 640,
    parentElement: parent,
    contains: (node: unknown) => node === canvas,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 640 }),
  });
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", { maxTouchPoints: 0 });
  vi.stubGlobal("location", { search: "" });
  vi.stubGlobal(
    "document",
    Object.assign(new EventTarget(), {
      hidden: false,
      activeElement: canvas,
      hasFocus: () => true,
      createElement: element,
      body: element(),
    }),
  );
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  vi.stubGlobal("ImageBitmap", class {});
  removed.mockClear();
  drawn.length = 0;
});
const labs: LabView[] = [];
afterEach(() => {
  for (const lab of labs.splice(0)) lab.dispose();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function recordingHost() {
  const renderer = new RecordingBackend(new Map());
  return {
    renderer,
    uiContext: {} as CanvasRenderingContext2D,
    setAssets: vi.fn(),
    resize: vi.fn(),
    beginFrame: vi.fn(),
    beginWorld: vi.fn(),
    endWorld: vi.fn(),
    beginView: vi.fn(),
    endView: vi.fn(),
    dispose: vi.fn(),
  } satisfies RenderHost;
}

/** A lab on a focused 960×640 canvas, its recipe world on an in-process Worker. */
function open(options: Partial<LabViewOptions> = {}, world = recipe) {
  const worker = inProcessWorker((transport) => new RecipeWorldAuthority(transport));
  const host = recordingHost();
  const assets = gameAssets();
  const factory = vi.fn(() => host);
  const settings = { paused: false, zoom: 1 };
  const onError = vi.fn();
  const onFrame = vi.fn();
  const lab = new LabView(canvas as never, world, {
    width: 960,
    height: 640,
    terrain: false,
    settings: () => ({ ...settings, terrainPacing: "throughput" }),
    onError,
    onFrame,
    loadAssets: async () => assets,
    renderHost: factory,
    worker: () => worker.endpoint,
    ...options,
  });
  labs.push(lab);
  let now = performance.now();
  /** One display frame; the loop runs one fixed update per frame. */
  const frame = () => {
    now = Math.max(now + 17, performance.now());
    vi.mocked(requestAnimationFrame).mock.calls.at(-1)?.[0]?.(now);
  };
  /** A display frame with no fixed update: render only. */
  const redraw = () => vi.mocked(requestAnimationFrame).mock.calls.at(-1)?.[0]?.(now);
  const key = (code: string, type = "keydown") => {
    const event = Object.assign(new Event(type, { cancelable: true }), { code, key: "" });
    Object.defineProperty(event, "target", { value: canvas });
    win.dispatchEvent(event);
  };
  return { lab, worker, host, assets, factory, settings, onError, onFrame, frame, redraw, key };
}

/** Frames until the condition holds: the authority answers between them. */
async function until(frame: () => void, check: () => void, timeout = 1000) {
  await vi.waitFor(
    () => {
      frame();
      check();
    },
    { timeout },
  );
}

function hide(hidden: boolean) {
  Object.defineProperty(document, "hidden", { value: hidden, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

it("opens the recipe world on the game's view, pauses while hidden and releases everything", async () => {
  const listen = vi.spyOn(document, "addEventListener");
  const unlisten = vi.spyOn(document, "removeEventListener");
  const inputs = vi.spyOn(LabInput.prototype, "dispose");
  const { lab, worker, host, assets, frame } = open();
  const scheduled = () => vi.mocked(requestAnimationFrame).mock.calls.length;
  await lab.ready;
  expect(host.setAssets).toHaveBeenCalledWith(assets, expect.anything());
  expect(host.resize).toHaveBeenCalledWith(960, 640);
  expect([lab.camera.x, lab.camera.y]).toEqual([0, 0]);
  expect(scheduled()).toBe(1);
  await until(frame, () => expect(lab.client.clock?.running).toBe(true));
  const presentationClock = vi.spyOn(lab.client.replica, "resetPresentationClock");
  hide(true);
  expect(presentationClock).toHaveBeenCalledWith(); // a fresh presentation clock
  expect(cancelAnimationFrame).toHaveBeenCalled();
  const stopped = scheduled();
  await until(frame, () => {
    expect(lab.client.clock?.running).toBe(false);
    expect(worker.runtime.diagnostics().hidden).toBe(true);
  });
  expect(scheduled()).toBe(stopped); // the stopped loop schedules no frames
  hide(false);
  expect(scheduled()).toBe(stopped + 1);
  await until(frame, () => {
    expect(lab.client.clock?.running).toBe(true);
    expect(worker.runtime.diagnostics().hidden).toBe(false);
  });
  lab.dispose();
  lab.dispose();
  const disposed = scheduled();
  hide(false);
  expect(scheduled()).toBe(disposed);
  expect(host.dispose).toHaveBeenCalledTimes(1);
  expect(inputs).toHaveBeenCalledTimes(1);
  expect(assets.sheets.size).toBe(0); // closed
  const visibility = listen.mock.calls.find(([type]) => type === "visibilitychange")?.[1];
  expect(unlisten).toHaveBeenCalledWith("visibilitychange", visibility);
  await vi.waitFor(() => expect(worker.terminated).toBe(1));
});

it("takes the page's camera options: pixel snap and 3D meshes for every car", async () => {
  vi.stubGlobal("location", { search: "?pixelsnap=1&allcars3d" });
  const { lab } = open();
  await lab.ready;
  expect(lab.getDiagnostics()).toMatchObject({ pixelSnap: true, carMeshOverride: true });
});

it("closes assets that arrive after disposal without creating a renderer", async () => {
  let arrive!: (assets: GameAssets) => void;
  const late = gameAssets();
  const { lab, factory, worker } = open({
    loadAssets: () =>
      new Promise((resolve) => {
        arrive = resolve;
      }),
  });
  await lab.client.ready;
  hide(false); // before the view exists the clock stays stopped
  await new Promise((resolve) => setTimeout(resolve, 50));
  expect(lab.client.clock?.running).toBe(false);
  lab.dispose();
  arrive(late);
  await lab.ready;
  expect(late.sheets.size).toBe(0);
  expect(factory).not.toHaveBeenCalled();
  expect(requestAnimationFrame).not.toHaveBeenCalled();
  await vi.waitFor(() => expect(worker.terminated).toBe(1));
});

it("plays with the game's controls: predicted steps, a following camera and the camera's range", async () => {
  const draw = vi.spyOn(LabInput.prototype, "draw");
  const { lab, host, frame, key, onFrame } = open({
    terrain: true,
    surfaceVisibility: () => "lower",
  });
  await lab.ready;
  const begin = vi.spyOn(lab.client.replica, "beginPresentation");
  const end = vi.spyOn(lab.client.replica, "endPresentation");
  await until(frame, () => expect(lab.client.clock?.running).toBe(true));
  const submit = vi.spyOn(lab.client, "submitInput");
  key("KeyD");
  for (let i = 0; i < 12; i++) frame();
  expect(submit).toHaveBeenCalledWith(
    expect.objectContaining({ dx: 1, dy: 0 }),
    lab.camera.getVisibleChunkRange(),
  );
  const { replica } = lab.client;
  expect(replica.playerEntity.position.wx).toBeGreaterThan(0); // predicted ahead
  expect(lab.camera.x).toBeGreaterThan(0); // follows after the predicted step
  await until(frame, () => expect(replica.serverPlayerEntity.position.wx).toBeGreaterThan(8));
  key("KeyD", "keyup");
  const diagnostics = lab.getDiagnostics();
  expect(diagnostics.steps).toBeGreaterThan(10);
  expect(diagnostics.authority.clock?.running).toBe(true);
  expect(diagnostics.cameraX).toBeGreaterThan(0);
  expect(diagnostics.playerGrounded).toBe(true);
  expect(onFrame).toHaveBeenCalledWith(lab);
  // Drawn through the shared lab frame: terrain prepared, a clear, terrain, the
  // replicated scene, then the touch controls on the UI layer.
  expect(host.beginFrame).toHaveBeenCalled();
  expect(host.beginView).toHaveBeenCalledWith(lab.camera, { x: 0, y: 0, width: 960, height: 640 });
  expect(host.renderer.preparations).toBeGreaterThan(0);
  const kinds = host.renderer.passes.map((pass) => pass.kind);
  expect(kinds[0]).toBe("clear");
  expect(kinds).toContain("scene");
  expect(draw).toHaveBeenCalledWith(host.uiContext);
  // Each frame presents the replica and ends it; the draw sees the presented
  // player as its collect observer, the page's visibility and the lab's light time.
  expect(end).toHaveBeenCalledTimes(begin.mock.calls.length);
  const last = drawn.at(-1);
  expect(last?.options.collectObserver).toBe(last?.presented);
  expect(last?.presented).not.toBe(last?.physics);
  expect(last?.options).toMatchObject({
    terrain: true,
    visibility: "lower",
    pixelExactShadows: false,
  });
  expect(last?.options.presentationTime).toBeGreaterThan(0.1);
  // A throw is released after that tick's movement.
  const press = vi.spyOn(lab.client, "submitPress");
  key("KeyB");
  for (let i = 0; i < 10; i++) frame();
  key("KeyB", "keyup");
  frame();
  expect(press).toHaveBeenCalledWith(expect.objectContaining({ type: "throw-ball" }));
});

it("streams the camera's range while paused and drops presses made meanwhile", async () => {
  const { lab, settings, frame, key } = open();
  await lab.ready;
  await until(frame, () => expect(lab.client.clock?.running).toBe(true));
  settings.paused = true;
  await until(frame, () => expect(lab.client.clock?.running).toBe(false));
  const range = vi.spyOn(lab.client, "setVisibleRange");
  const submit = vi.spyOn(lab.client, "submitInput");
  const near = lab.camera.getVisibleChunkRange();
  settings.zoom = 0.25;
  frame();
  const far = lab.camera.getVisibleChunkRange();
  expect(range).toHaveBeenLastCalledWith(far);
  expect(far.maxCx - far.minCx).toBeGreaterThan(near.maxCx - near.minCx); // zoomed out
  const light = drawn.at(-1)?.options.presentationTime;
  key("Space");
  key("Space", "keyup");
  frame();
  expect(submit).not.toHaveBeenCalled();
  expect(lab.getDiagnostics().alpha).toBe(1); // a paused frame is not interpolated
  expect(drawn.at(-1)?.options.presentationTime).toBe(light);
  settings.paused = false;
  await until(frame, () => expect(submit).toHaveBeenCalled());
  expect(submit.mock.calls[0]?.[0]).toMatchObject({ jump: false, jumpPressed: false });
});

it("snaps the camera after commands; reload and reset clear the renderer's world caches", async () => {
  const { lab, host, frame, redraw, key } = open();
  await lab.ready;
  await until(frame, () => expect(lab.client.clock?.running).toBe(true));
  key("KeyD");
  for (let i = 0; i < 4; i++) frame();
  key("KeyD", "keyup");
  const clear = vi.spyOn(host.renderer, "clear");
  // The camera snaps to the seat's pose once the answer's snapshot is applied:
  // inputs sent before the command still replay after it, as at the authority.
  const snapped = (wx: number, wy: number) => {
    const { position } = lab.client.replica.playerEntity;
    expect([lab.camera.x, lab.camera.y]).toEqual([position.wx, position.wy]);
    expect(Math.hypot(position.wx - wx, position.wy - wy)).toBeLessThan(16);
  };
  await lab.command({ kind: "teleport", position: { wx: 320, wy: 64 } });
  snapped(320, 64);
  redraw(); // a frame before the next step shows the snapped pose
  expect(lab.getDiagnostics().alpha).toBe(1);
  expect(clear).not.toHaveBeenCalled();
  lab.camera.snapTo(-500, -500);
  lab.view.fades.set("deck", { opacity: 0.4, time: 1 }); // an old world's slab fade
  await lab.reload();
  expect(clear).toHaveBeenCalledTimes(1);
  expect(lab.view.fades.size).toBe(0);
  snapped(320, 64); // the saved world
  await lab.reload(true);
  expect(clear).toHaveBeenCalledTimes(2);
  snapped(0, 0); // the recipe restaged
  await until(frame, () => expect(lab.client.clock?.running).toBe(true));
});

it("a diagnostic camera policy frames the lab before input and through commands", async () => {
  // A framing that tracks the player across, at a fixed height.
  const camera = fixedCamera((player) => ({ wx: player.position.wx, wy: -32 }));
  const { lab, frame, key, host } = open({ camera });
  await lab.ready;
  expect([lab.camera.x, lab.camera.y]).toEqual([0, -32]);
  await until(frame, () => expect(lab.client.clock?.running).toBe(true));
  // Each tick's input finds the camera placed from the pose before it, and
  // streams what that placement frames (however many ticks a frame runs).
  const { client } = lab;
  const submit = client.submitInput.bind(client);
  const sent: { camera: number; player: number; range: unknown; framed: unknown }[] = [];
  vi.spyOn(client, "submitInput").mockImplementation((movement, range) => {
    const player = client.replica.playerEntity.position.wx;
    sent.push({ camera: lab.camera.x, player, range, framed: lab.camera.getVisibleChunkRange() });
    return submit(movement, range);
  });
  key("KeyD");
  for (let i = 0; i < 7; i++) frame();
  expect(sent.length).toBeGreaterThanOrEqual(7);
  for (const tick of sent) {
    expect(tick.camera).toBe(tick.player);
    expect(tick.range).toEqual(tick.framed);
  }
  expect(sent.at(-1)?.camera).toBeGreaterThan(0);
  // Nothing places it after the step: it stays a tick behind the walking player.
  expect(lab.camera.x).toBe(sent.at(-1)?.camera);
  expect(client.replica.playerEntity.position.wx).toBeGreaterThan(lab.camera.x);
  expect(lab.camera.y).toBe(-32);
  // Commands snap it from the predicted pose: the teleport plus any input
  // still to replay (the walk is held through the command).
  await lab.command({ kind: "teleport", position: { wx: 600, wy: 600 } });
  expect(lab.camera.x).toBe(client.replica.playerEntity.position.wx);
  expect(lab.camera.x - 600).toBeGreaterThanOrEqual(0);
  expect(lab.camera.x - 600).toBeLessThan(16);
  expect(lab.camera.y).toBe(-32);
  expect(host.renderer.preparations).toBe(0); // no terrain in this lab
});

it("draws the page's underlay over the terrain and overlay over the scene, then releases them", async () => {
  const frames: OverlayFrame[] = [];
  const seen: { lab: LabView; player: unknown; alpha: number; x: number }[] = [];
  let grid = true;
  const { lab, host, frame, key } = open({
    // A framing from the presented pose, so the presented camera is not the actual one.
    camera: fixedCamera((player) => ({ wx: player.position.wx + 40, wy: -20 })),
    pixelExactShadows: true,
    underlay: (overlay) => {
      frames.push(overlay);
      if (grid) overlay.line(0, 0, 960, 0, "#afc0ad");
    },
    overlay: (overlay, view) => {
      frames.push(overlay);
      seen.push({
        lab: view,
        player: view.presentedPlayer,
        alpha: view.presentationAlpha,
        x: view.camera.x,
      });
      overlay.rect(1, 2, 3, 4, "", "#3472aa");
      overlay.rect(5, 6, 7, 8, "#f4b032");
    },
  });
  await lab.ready;
  await until(frame, () => expect(lab.client.clock?.running).toBe(true));
  key("KeyD");
  for (let i = 0; i < 4; i++) frame();
  const { passes, views } = host.renderer;
  /** One frame's passes, each with the camera it was submitted for. */
  const drawFrame = () => {
    const start = passes.length;
    frame();
    return passes.slice(start).map((pass, i) => ({ pass, view: views[start + i] }));
  };
  const walking = drawFrame();
  expect(walking.map(({ pass }) => pass.kind)).toEqual(["clear", "overlay", "scene", "overlay"]);
  const [, under, , over] = walking;
  expect(under?.pass).toMatchObject({ items: [{ kind: "line", width: 960, stroke: "#afc0ad" }] });
  // Each hook starts from an empty frame.
  expect(over?.pass).toMatchObject({
    items: [
      { kind: "rect", x: 1, height: 4, stroke: "#3472aa" },
      { kind: "rect", x: 5, height: 8, fill: "#f4b032" },
    ],
  });
  // The hooks see the frame's presented camera, player and sub-tick fraction.
  const shown = drawn.at(-1);
  const last = seen.at(-1);
  expect(last?.lab).toBe(lab);
  expect(last?.player).toBe(shown?.presented);
  expect(shown?.presented).not.toBe(shown?.physics);
  expect(last?.alpha).toBe(shown?.options.alpha);
  expect(last?.alpha).toBeLessThan(1);
  expect(last?.x).toBe((shown?.presented.position.wx ?? Number.NaN) + 40);
  expect(over?.view).toMatchObject({ x: last?.x, y: -20 });
  expect(shown?.options.pixelExactShadows).toBe(true);
  // An empty collection submits nothing.
  grid = false;
  expect(drawFrame().map(({ pass }) => pass.kind)).toEqual(["clear", "scene", "overlay"]);
  // One owned frame, released after each display frame and cleared on dispose.
  const [owned] = frames;
  expect(new Set(frames)).toEqual(new Set([owned]));
  expect(owned?.items).toHaveLength(0);
  const clear = vi.spyOn(owned as OverlayFrame, "clear");
  lab.dispose();
  expect(clear).toHaveBeenCalledTimes(1);
});

it("reports an authority failure once and releases the view", async () => {
  const { lab, worker, host, frame, onError } = open();
  await lab.ready;
  await until(frame, () => expect(lab.client.clock?.running).toBe(true));
  worker.rejectUnhandled(new Error("authority lost"));
  await until(frame, () => expect(onError).toHaveBeenCalledTimes(1));
  expect(String(onError.mock.calls[0]?.[0])).toContain("authority lost");
  expect(host.dispose).toHaveBeenCalledTimes(1);
  frame();
  hide(false);
  expect(onError).toHaveBeenCalledTimes(1);
});

it("a refused world never creates a renderer", async () => {
  const unlisten = vi.spyOn(document, "removeEventListener");
  const guest: ScenarioRecipe = { ...recipe, guest: createPlayer(32, 0) };
  const { lab, worker, factory, assets } = open({}, guest);
  await expect(lab.ready).rejects.toThrow("Two-seat recipes");
  expect(factory).not.toHaveBeenCalled();
  expect(assets.sheets.size).toBe(0);
  expect(unlisten).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
  expect(requestAnimationFrame).not.toHaveBeenCalled();
  await vi.waitFor(() => expect(worker.terminated).toBe(1));
});

it("mounts the shared vehicle control for parked cars, enters through a lab command and removes it", async () => {
  const cars: ScenarioRecipe = {
    ...recipe,
    parkedVehicles: [{ name: "car", model: "compact-1", wx: 40, wy: 0, facing: Direction.Down }],
  };
  const { lab, frame, key, settings } = open({}, cars);
  await lab.ready;
  expect(canvas.parentElement.append).toHaveBeenCalledTimes(1);
  await until(frame, () => expect(lab.client.clock?.running).toBe(true));
  const command = vi.spyOn(lab, "command");
  const enter = () => {
    frame(); // the control sees the nearby car and the lab's state
    key("KeyE");
    key("KeyE", "keyup");
  };
  // Paused, or with a lab command in flight, the control is locked.
  settings.paused = true;
  enter();
  settings.paused = false;
  await until(frame, () => expect(lab.client.busy).toBe(false)); // the clock runs again
  const moving = lab.command({ kind: "teleport", position: { wx: 0, wy: 0 } });
  enter();
  await moving;
  expect(command).toHaveBeenCalledTimes(1);
  await until(frame, () => expect(lab.client.busy).toBe(false));
  enter();
  const car = lab.client.handles.car;
  expect(command).toHaveBeenLastCalledWith({ kind: "enter-vehicle", entityId: car });
  await until(frame, () => expect(lab.client.replica.playerEntity.parentId).toBe(car));
  // Seated, the horn rides ahead of that tick's movement on the ordered path.
  frame();
  const press = vi.spyOn(lab.client, "submitPress");
  const submit = vi.spyOn(lab.client, "submitInput");
  key("KeyH");
  frame(); // the press edge fires in this frame's first update, before its movement
  expect(press).toHaveBeenCalledWith({ type: "vehicle-horn", active: true });
  const horn = press.mock.invocationCallOrder[0] ?? Infinity;
  expect(submit).toHaveBeenCalled();
  expect(submit.mock.invocationCallOrder.every((order) => order > horn)).toBe(true);
  key("KeyH", "keyup");
  lab.dispose();
  expect(removed).toHaveBeenCalledTimes(3);
});

it("F rights an overturned car through the shared equipment control", async () => {
  const flipped: ScenarioRecipe = {
    ...recipe,
    parkedVehicles: [
      {
        name: "car",
        model: "compact-1",
        wx: 28,
        wy: 0,
        z: 24,
        facing: Direction.Down,
        rotation: [1, 0, 0, 0],
      },
    ],
  };
  const { lab, frame, key } = open({}, flipped);
  await lab.ready;
  const command = vi.spyOn(lab, "command");
  const car = lab.client.handles.car;
  await until(
    frame,
    () => {
      key("KeyF");
      key("KeyF", "keyup");
      expect(command).toHaveBeenCalledWith({ kind: "recover-vehicle", entityId: car });
    },
    5000,
  );
});
