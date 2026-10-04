import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { GameAssets } from "../assets/GameAssets.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  close: vi.fn(),
  terminate: vi.fn(),
  setAssets: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
  factory: vi.fn(),
}));
vi.mock("../assets/GameAssets.js", () => ({
  loadGameAssets: mocks.load,
  closeAssets: mocks.close,
}));
vi.mock("../rendering/SelectableRenderHost.js", () => ({
  selectableRenderHostFactory: async () => mocks.factory,
}));
vi.mock("./ScenarioClient.js", () => ({
  ScenarioClient: class {
    ready = Promise.resolve();
    view = { playerEntity: { position: { wx: 80, wy: 160 } } };
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
