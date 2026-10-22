import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { createTrain } from "../railway/Train.js";
import { railCrossingRecipe } from "../scenarios/RailCrossingRecipe.js";
import type { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { collectScene } from "./collectScene.js";
import { presentSurfaceScene, surfaceSceneOrder } from "./presentSurfaceScene.js";
import { SceneFrame } from "./SceneFrame.js";
import type { TerrainPresentation } from "./TerrainPresentation.js";
import { RecordingBackend } from "./testing/RecordingBackend.js";

it("places the bridge between a lower train and upper pedestrian regardless of observer height", () => {
  const props = railCrossingRecipe().props;
  const train = createTrain(0, 0),
    player = createPlayer(0, 8);
  player.wz = 64;
  const camera = new Camera();
  camera.setViewport(960, 720);
  const items = collectScene(
    [train, player],
    props,
    { getHeightAt: () => 0 } as unknown as World,
    camera,
    { minCx: -3, maxCx: 3, minCy: -2, maxCy: 2 },
    1,
    { collectElevationItems: () => [] } as unknown as TerrainPresentation,
    [],
    false,
  );
  const trainIndex = items.findIndex((i) => i.kind === "sprite" && i.sheetKey === train.type);
  const playerIndex = items.findIndex((i) => i.kind === "sprite" && i.sheetKey === "player");
  expect(trainIndex).toBeGreaterThanOrEqual(0);
  for (const z of [0, 64]) {
    const observer = createPlayer(100, 100);
    observer.wz = z;
    const order = surfaceSceneOrder(items, props, observer, "all", 1);
    expect(order.indexOf(trainIndex)).toBeLessThan(order.indexOf("road-bridge"));
    expect(order.indexOf(playerIndex)).toBeGreaterThan(order.indexOf("road-bridge"));
    const backend = new RecordingBackend(new Map());
    presentSurfaceScene(backend, camera, new SceneFrame(), items, props, observer, "all", 1);
    const flattened = backend.passes.flatMap<number | string>((p) =>
      p.kind === "scene" ? [...p.order] : p.kind === "overlay" ? [p.cacheKey ?? ""] : [],
    );
    const expected = order.flatMap((node) => {
      const item = typeof node === "number" ? items[node] : undefined;
      return typeof node === "number" &&
        item?.kind === "sprite" &&
        item.hasShadow &&
        !item.flashHidden
        ? [-node - 1, node]
        : [node];
    });
    expect(flattened).toEqual(expected);
    const overlays = backend.passes.filter((p) => p.kind === "overlay").length;
    const runs = backend.passes.filter((p) => p.kind === "scene");
    expect(runs.length).toBeLessThanOrEqual(overlays + 1);
    expect(runs.some((p) => p.kind === "scene" && p.order.length > 1)).toBe(true);
  }
});
