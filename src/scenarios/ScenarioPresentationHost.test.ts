import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GameAssets } from "../assets/GameAssets.js";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import type { RenderPass } from "../rendering/RenderFrame.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

const recipe: ScenarioRecipe = {
  version: 1,
  id: "presentation-host",
  generation: FLAT_SCENARIO,
  player: createPlayer(80, 128),
  props: [],
};

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  close: vi.fn(),
  terminate: vi.fn(),
  setAssets: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
  factory: vi.fn(),
  collect: vi.fn(() => []),
  terrain: vi.fn(),
  submitInput: vi.fn(() => true),
  submitPress: vi.fn(() => true),
  pump: vi.fn(),
  setRunning: vi.fn(),
  diagnostics: vi.fn(),
  command: vi.fn(async () => {}),
  beginPresentation: vi.fn(),
  endPresentation: vi.fn(),
  resetPresentationClock: vi.fn(),
}));
vi.mock("../assets/GameAssets.js", () => ({
  loadGameAssets: mocks.load,
  closeAssets: mocks.close,
}));
vi.mock("../rendering/SelectableRenderHost.js", () => ({
  selectableRenderHostFactory: async () => mocks.factory,
}));
vi.mock("../rendering/collectScene.js", () => ({ collectScene: mocks.collect }));
vi.mock("../rendering/OutdoorPresentation.js", () => ({ presentTerrain: mocks.terrain }));
vi.mock("./ScenarioClient.js", () => ({
  ScenarioClient: class {
    ready = Promise.resolve();
    view = {
      playerEntity: { id: 1, position: { wx: 80, wy: 160 } } as Entity,
      entities: [] as Entity[],
      get presentedPlayerEntity() {
        return this.playerEntity;
      },
      props: [],
      beginPresentation: mocks.beginPresentation,
      endPresentation: mocks.endPresentation,
      resetPresentationClock: mocks.resetPresentationClock,
      cameraPresentation: { time: 0, domain: "remote" },
    };
    submitInput = mocks.submitInput;
    submitPress = mocks.submitPress;
    pump = mocks.pump;
    setRunning = mocks.setRunning;
    getDiagnostics = mocks.diagnostics;
    command = mocks.command;
    dispose = mocks.terminate;
  },
}));

import { ScenarioPresentationHost } from "./ScenarioPresentationHost.js";

const assets = { sheets: new Map(), blendSheets: [], variants: {} } as unknown as GameAssets;
const options = {
  width: 960,
  height: 600,
  input: () => ({ dx: 0, dy: 0, jump: false, sprinting: false }),
  settings: () => ({ zoom: 0.75, paused: false, terrainPacing: "throughput" as const }),
  onError: vi.fn(),
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.load.mockResolvedValue(assets);
  mocks.setAssets.mockReset();
  mocks.factory.mockReturnValue({
    setAssets: mocks.setAssets,
    resize: mocks.resize,
    dispose: mocks.dispose,
  });
  vi.stubGlobal("document", Object.assign(new EventTarget(), { hidden: false }));
  vi.stubGlobal("location", { search: "" });
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});
afterEach(() => vi.unstubAllGlobals());

it("configures full gameplay assets, starts at the fixture and detaches visibility lifecycle", async () => {
  const host = new ScenarioPresentationHost({} as HTMLCanvasElement, recipe, options);
  await host.ready;
  expect(mocks.setAssets).toHaveBeenCalledWith(assets, expect.anything());
  expect(mocks.resize).toHaveBeenCalledWith(960, 600);
  expect([host.camera.x, host.camera.y]).toEqual([80, 160]);
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  expect(mocks.setRunning).toHaveBeenLastCalledWith(true);
  Object.defineProperty(document, "hidden", { value: true, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  expect(mocks.setRunning).toHaveBeenLastCalledWith(false);
  Object.defineProperty(document, "hidden", { value: false });
  document.dispatchEvent(new Event("visibilitychange"));
  expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  expect(mocks.setRunning).toHaveBeenLastCalledWith(true);
  expect(mocks.resetPresentationClock).toHaveBeenCalledTimes(3);
  host.dispose();
  host.dispose();
  document.dispatchEvent(new Event("visibilitychange"));
  expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  expect(mocks.dispose).toHaveBeenCalledTimes(1);
  expect(mocks.terminate).toHaveBeenCalledTimes(1);
  expect(mocks.close).toHaveBeenCalledWith(assets);
});

it("closes late asset arrivals without creating a renderer or restarting a disposed lab", async () => {
  let finish!: (assets: GameAssets) => void;
  mocks.load.mockReturnValue(
    new Promise<GameAssets>((resolve) => {
      finish = resolve;
    }),
  );
  const host = new ScenarioPresentationHost({} as HTMLCanvasElement, recipe, options);
  host.dispose();
  finish(assets);
  await host.ready;
  expect(mocks.close).toHaveBeenCalledTimes(1);
  expect(mocks.factory).not.toHaveBeenCalled();
  expect(requestAnimationFrame).not.toHaveBeenCalled();
  expect(mocks.terminate).toHaveBeenCalledTimes(1);
});

it("releases renderer, assets and Worker if asset configuration fails", async () => {
  mocks.setAssets.mockImplementation(() => {
    throw Error("configuration failed");
  });
  const host = new ScenarioPresentationHost({} as HTMLCanvasElement, recipe, options);
  await expect(host.ready).rejects.toThrow("configuration failed");
  expect(mocks.dispose).toHaveBeenCalledTimes(1);
  expect(mocks.close).toHaveBeenCalledWith(assets);
  expect(mocks.terminate).toHaveBeenCalledTimes(1);
  expect(requestAnimationFrame).not.toHaveBeenCalled();
});

it("keeps diagnostic framing through ticks/commands and submits overlays around the replicated scene", async () => {
  const passes: RenderPass[] = [];
  const customLoad = vi.fn(async () => assets);
  mocks.factory.mockReturnValue({
    setAssets: mocks.setAssets,
    resize: mocks.resize,
    dispose: mocks.dispose,
    beginFrame: vi.fn(),
    beginWorld: vi.fn(),
    endWorld: vi.fn(),
    renderer: {
      assets: new Map(),
      submit: (_view: unknown, pass: RenderPass) => {
        passes.push(structuredClone(pass));
      },
    },
  });
  const host = new ScenarioPresentationHost({} as HTMLCanvasElement, recipe, {
    ...options,
    fixedCamera: { wx: 0, wy: -32 },
    terrain: false,
    loadAssets: customLoad,
    underlay: (frame) => frame.line(0, 0, 10, 10, "green"),
    overlay: (frame) => frame.rect(4, 5, 6, 7, "", "red"),
  });
  await host.ready;
  expect(mocks.load).not.toHaveBeenCalled();
  const tick = vi.mocked(requestAnimationFrame).mock.calls.at(-1)?.[0];
  tick?.(performance.now() + 25);
  expect(mocks.submitInput).toHaveBeenCalled();
  expect(mocks.terrain).not.toHaveBeenCalled();
  expect(mocks.collect).toHaveBeenCalled();
  expect(mocks.beginPresentation).toHaveBeenCalled();
  expect(mocks.endPresentation).toHaveBeenCalled();
  expect(passes.map((p) => p.kind)).toEqual(["clear", "overlay", "scene", "overlay"]);
  expect(passes[1]).toMatchObject({ items: [{ kind: "line", stroke: "green" }] });
  expect(passes[3]).toMatchObject({ items: [{ kind: "rect", stroke: "red" }] });
  expect([host.camera.x, host.camera.y]).toEqual([0, -32]);
  await host.command({ kind: "teleport", position: { wx: 1000, wy: 2000 } });
  expect([host.camera.x, host.camera.y]).toEqual([0, -32]);
  host.dispose();
  expect(mocks.close).toHaveBeenCalledWith(assets);
});

it("cycles a presentation-only pose while authority is paused, then restores the replica pose", async () => {
  let cycle = true;
  mocks.factory.mockReturnValue({
    setAssets: mocks.setAssets,
    resize: mocks.resize,
    dispose: mocks.dispose,
    beginFrame: vi.fn(),
    beginWorld: vi.fn(),
    endWorld: vi.fn(),
    renderer: { assets: new Map(), submit: vi.fn() },
  });
  const host = new ScenarioPresentationHost({} as HTMLCanvasElement, recipe, {
    ...options,
    terrain: false,
    fixedCamera: { wx: 0, wy: -12 },
    poseCycle: () => (cycle ? { fps: 4, frameCount: 4 } : undefined),
  });
  const player = createPlayer(0, 8);
  const original = structuredClone(player);
  Object.assign(host.session.view, { playerEntity: player, entities: [player] });
  await host.ready;
  const start = performance.now();
  for (let i = 1; i <= 30; i++) {
    vi.mocked(requestAnimationFrame).mock.calls.at(-1)?.[0]?.(start + i * 100);
  }
  expect(mocks.submitInput).not.toHaveBeenCalled();
  expect(mocks.setRunning).toHaveBeenLastCalledWith(false);
  expect(host.presentedPlayer.sprite).toMatchObject({ direction: 1, frameRow: 1, moving: true });
  expect(host.presentedPlayer).not.toBe(player);
  expect(player).toEqual(original);
  expect(mocks.collect).toHaveBeenLastCalledWith(
    [host.presentedPlayer],
    [],
    undefined,
    host.camera,
    expect.anything(),
    1,
    expect.anything(),
    expect.objectContaining({ collectItems: expect.any(Function) }),
    false,
    undefined,
    expect.anything(),
    { observer: player, visibility: "auto" },
  );
  cycle = false;
  vi.mocked(requestAnimationFrame).mock.calls.at(-1)?.[0]?.(start + 3100);
  expect(mocks.submitInput).toHaveBeenCalled();
  expect(mocks.setRunning).toHaveBeenLastCalledWith(true);
  expect(host.presentedPlayer).toBe(player);
  expect(player.sprite).toEqual(original.sprite);
  host.dispose();
});

it("resizes before readiness and during use without replacing the Worker", async () => {
  const host = new ScenarioPresentationHost({} as HTMLCanvasElement, recipe, options);
  host.resize(288, 192);
  await host.ready;
  expect(mocks.resize).toHaveBeenLastCalledWith(288, 192);
  host.resize(1152, 768);
  expect(mocks.resize).toHaveBeenLastCalledWith(1152, 768);
  expect([host.camera.viewportWidth, host.camera.viewportHeight]).toEqual([1152, 768]);
  expect(mocks.terminate).not.toHaveBeenCalled();
  expect(mocks.factory).toHaveBeenCalledTimes(1);
  host.dispose();
});

it("uses the moving diagnostic camera for streaming as well as drawing", async () => {
  let x = 1000;
  const host = new ScenarioPresentationHost({} as HTMLCanvasElement, recipe, {
    ...options,
    fixedCamera: () => ({ wx: x, wy: 0 }),
  });
  const player = createPlayer(0, 0);
  Object.assign(host.session.view, { playerEntity: player, entities: [player] });
  await host.ready;
  x = 5000;
  const start = performance.now();
  for (let i = 1; i <= 3; i++)
    vi.mocked(requestAnimationFrame).mock.calls.at(-1)?.[0]?.(start + i * 100);
  expect(mocks.submitInput).toHaveBeenCalled();
  expect(mocks.submitInput).toHaveBeenLastCalledWith(
    expect.anything(),
    expect.objectContaining({ minCx: 18 }),
  );
  host.dispose();
});

it("without its own input, a lab plays with the game's controls while its canvas has focus", async () => {
  const win = new EventTarget();
  const canvas = Object.assign(new EventTarget(), {
    tagName: "CANVAS",
    width: 960,
    height: 600,
    contains: (node: unknown) => node === canvas,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 600 }),
  });
  vi.stubGlobal("window", win);
  vi.stubGlobal("navigator", { maxTouchPoints: 0 });
  Object.assign(document, { activeElement: canvas, hasFocus: () => true });
  mocks.factory.mockReturnValue({
    setAssets: mocks.setAssets,
    resize: mocks.resize,
    dispose: mocks.dispose,
    beginFrame: vi.fn(),
    beginWorld: vi.fn(),
    endWorld: vi.fn(),
    renderer: { assets: new Map(), submit: vi.fn() },
  });
  const { input: _scripted, ...gameControls } = options;
  const host = new ScenarioPresentationHost(canvas as never, recipe, {
    ...gameControls,
    terrain: false,
  });
  await host.ready;
  const key = (code: string, target: unknown = canvas) => {
    const event = Object.assign(new Event("keydown", { cancelable: true }), { code, key: "" });
    Object.defineProperty(event, "target", { value: target });
    win.dispatchEvent(event);
  };
  let now = performance.now();
  const tick = () => {
    now += 17; // exactly one 1/60 s update per frame for the next few frames
    vi.mocked(requestAnimationFrame).mock.calls.at(-1)?.[0]?.(now);
  };
  key("KeyD");
  key("KeyW", { tagName: "SELECT" }); // a Workshop field keeps its keys
  tick();
  expect(mocks.submitInput).toHaveBeenLastCalledWith(
    expect.objectContaining({ dx: 1, dy: 0, relativeDriving: false }),
    expect.anything(),
  );
  // Seated in a car, the horn rides along with movement as an ordered press.
  const car = { ...createVehicle("compact-1", 80, 160), id: 7 };
  host.session.view.playerEntity.parentId = 7;
  Object.assign(host.session.view, { entities: [host.session.view.playerEntity, car] });
  key("KeyH");
  key("KeyW");
  tick();
  expect(mocks.submitPress).toHaveBeenCalledWith({ type: "vehicle-horn", active: true });
  // Presses precede the movement command of the same tick.
  expect(mocks.submitPress.mock.invocationCallOrder.at(-1)).toBeLessThan(
    mocks.submitInput.mock.invocationCallOrder.at(-1) ?? 0,
  );
  // Steering keeps raw diagonal axes in a car.
  expect(mocks.submitInput).toHaveBeenLastCalledWith(
    expect.objectContaining({ dx: 1, dy: -1, jump: false, relativeDriving: true }),
    expect.anything(),
  );
  // A held horn stays on (no release) on the next tick.
  mocks.submitPress.mockClear();
  tick();
  expect(mocks.submitPress).not.toHaveBeenCalledWith({ type: "vehicle-horn", active: false });
  host.dispose();
});

it.each([
  [0, false],
  [5, true],
])(
  "lab touch buttons take mouse clicks only on touch screens (maxTouchPoints %i)",
  async (points, jumps) => {
    const win = new EventTarget();
    const canvas = Object.assign(new EventTarget(), {
      tagName: "CANVAS",
      width: 960,
      height: 600,
      contains: (node: unknown) => node === canvas,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 600 }),
    });
    vi.stubGlobal("window", win);
    vi.stubGlobal("navigator", { maxTouchPoints: points });
    Object.assign(document, { activeElement: canvas, hasFocus: () => true });
    mocks.factory.mockReturnValue({
      setAssets: mocks.setAssets,
      resize: mocks.resize,
      dispose: mocks.dispose,
      beginFrame: vi.fn(),
      beginWorld: vi.fn(),
      endWorld: vi.fn(),
      renderer: { assets: new Map(), submit: vi.fn() },
    });
    const { input: _scripted, ...gameControls } = options;
    const host = new ScenarioPresentationHost(canvas as never, recipe, {
      ...gameControls,
      terrain: false,
    });
    await host.ready;
    // The Jump button's centre: 960 − 24 − 28, 600 − 24 − 28 (CSS px of the canvas).
    const press = Object.assign(new Event("mousedown", { cancelable: true }), {
      button: 0,
      clientX: 908,
      clientY: 548,
    });
    canvas.dispatchEvent(press);
    vi.mocked(requestAnimationFrame).mock.calls.at(-1)?.[0]?.(performance.now() + 17);
    expect(press.defaultPrevented).toBe(jumps);
    expect(mocks.submitInput).toHaveBeenLastCalledWith(
      expect.objectContaining({ jump: jumps }),
      expect.anything(),
    );
    host.dispose();
  },
);
