import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GameAssets } from "../assets/GameAssets.js";
import { createPlayer } from "../entities/Player.js";
import type { RenderPass } from "../rendering/RenderFrame.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

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
  step: vi.fn(() => true),
  command: vi.fn(async () => {}),
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
    view = { playerEntity: { position: { wx: 80, wy: 160 } }, props: [] };
    step = mocks.step;
    command = mocks.command;
    dispose = mocks.terminate;
  },
}));

import { ScenarioPresentationHost } from "./ScenarioPresentationHost.js";

const assets = { sheets: new Map(), blendSheets: [], variants: {} } as unknown as GameAssets;
const options = {
  width: 960,
  height: 600,
  cameraOffsetY: -12,
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
  const host = new ScenarioPresentationHost({} as HTMLCanvasElement, {} as ScenarioRecipe, options);
  await host.ready;
  expect(mocks.setAssets).toHaveBeenCalledWith(assets, expect.anything());
  expect(mocks.resize).toHaveBeenCalledWith(960, 600);
  expect([host.camera.x, host.camera.y]).toEqual([80, 148]);
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, "hidden", { value: true, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
  expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  Object.defineProperty(document, "hidden", { value: false });
  document.dispatchEvent(new Event("visibilitychange"));
  expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
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
  const host = new ScenarioPresentationHost({} as HTMLCanvasElement, {} as ScenarioRecipe, options);
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
  const host = new ScenarioPresentationHost({} as HTMLCanvasElement, {} as ScenarioRecipe, options);
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
    renderer: {
      assets: new Map(),
      submit: (_view: unknown, pass: RenderPass) => {
        passes.push(structuredClone(pass));
      },
    },
  });
  const host = new ScenarioPresentationHost({} as HTMLCanvasElement, {} as ScenarioRecipe, {
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
  expect(mocks.step).toHaveBeenCalled();
  expect(mocks.terrain).not.toHaveBeenCalled();
  expect(mocks.collect).toHaveBeenCalled();
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
    renderer: { assets: new Map(), submit: vi.fn() },
  });
  const host = new ScenarioPresentationHost({} as HTMLCanvasElement, {} as ScenarioRecipe, {
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
  expect(mocks.step).not.toHaveBeenCalled();
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
    [],
    false,
    undefined,
    undefined,
    expect.anything(),
  );
  cycle = false;
  vi.mocked(requestAnimationFrame).mock.calls.at(-1)?.[0]?.(start + 3100);
  expect(mocks.step).toHaveBeenCalled();
  expect(host.presentedPlayer).toBe(player);
  expect(player.sprite).toEqual(original.sprite);
  host.dispose();
});

it("resizes before readiness and during use without replacing the Worker", async () => {
  const host = new ScenarioPresentationHost({} as HTMLCanvasElement, {} as ScenarioRecipe, options);
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
