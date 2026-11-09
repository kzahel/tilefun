import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { createTrain } from "../railway/Train.js";
import { railCrossingRecipe } from "../scenarios/RailCrossingRecipe.js";
import { worldGeometryRecipe } from "../scenarios/WorldGeometryRecipe.js";
import type { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { collectScene } from "./collectScene.js";
import { presentSurfaceScene } from "./presentSurfaceScene.js";
import { SceneFrame, type SurfaceFades } from "./SceneFrame.js";
import { REVEAL_FADE_SECONDS, REVEAL_OPACITY } from "./SurfacePresentation.js";
import { surfaceSceneOrder } from "./SurfaceSceneOrder.js";
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

it("draws a revealed deck after the covered observer, fading it as one group", () => {
  const props = worldGeometryRecipe().props;
  const player = createPlayer(80, -80);
  player.wz = 0;
  const camera = new Camera();
  camera.setViewport(960, 640);
  const items = collectScene(
    [player],
    props,
    { getHeightAt: () => 0 } as unknown as World,
    camera,
    { minCx: -2, maxCx: 2, minCy: -2, maxCy: 2 },
    1,
    { collectElevationItems: () => [] } as unknown as TerrainPresentation,
    [],
    false,
  );
  const playerIndex = items.findIndex((i) => i.kind === "sprite" && i.sheetKey === "player");
  const order = surfaceSceneOrder(items, props, player, "auto", 1);
  expect(order.indexOf(playerIndex)).toBeLessThan(order.indexOf("deck"));

  const frame = new SceneFrame();
  const fades: SurfaceFades = new Map();
  const present = (seconds: number, observer = player, mode: "auto" | "all" = "auto") => {
    const backend = new RecordingBackend(new Map());
    frame.fadeSeconds = seconds;
    presentSurfaceScene(backend, camera, frame, items, props, observer, mode, 1, false, fades);
    const deck = backend.passes.find((p) => p.kind === "overlay" && p.cacheKey === "deck");
    if (deck?.kind !== "overlay") throw new Error("Missing deck pass");
    expect(deck.items.length).toBeGreaterThan(1); // The deck itself, not an outline.
    return deck.opacity;
  };
  expect(present(10)).toBeUndefined();
  expect(present(10 + REVEAL_FADE_SECONDS / 2)).toBeCloseTo((1 + REVEAL_OPACITY) / 2, 5);
  expect(present(10 + REVEAL_FADE_SECONDS)).toBeCloseTo(REVEAL_OPACITY, 5);
  const clear = createPlayer(80, -140);
  clear.wz = 0;
  const out = 10 + REVEAL_FADE_SECONDS;
  expect(present(out + REVEAL_FADE_SECONDS / 2, clear)).toBeCloseTo((1 + REVEAL_OPACITY) / 2, 5);
  expect(present(out + REVEAL_FADE_SECONDS, clear)).toBeUndefined();
  expect(fades.size).toBe(0);
  // Manual inspection views switch instantly rather than fading back.
  present(20);
  expect(present(20 + REVEAL_FADE_SECONDS)).toBeCloseTo(REVEAL_OPACITY, 5);
  expect(present(20 + REVEAL_FADE_SECONDS, player, "all")).toBeUndefined();
  expect(fades.size).toBe(0);
});

it("keeps each split view's slab fade while another view of the frame skips the slab", () => {
  const props = worldGeometryRecipe().props;
  const player = createPlayer(80, -80);
  const camera = new Camera();
  camera.setViewport(960, 640);
  const items = collectScene(
    [player],
    props,
    { getHeightAt: () => 0 } as unknown as World,
    camera,
    { minCx: -2, maxCx: 2, minCy: -2, maxCy: 2 },
    1,
    { collectElevationItems: () => [] } as unknown as TerrainPresentation,
    [],
    false,
  );
  // Both views share one device SceneFrame; the second view shows no surfaces.
  const frame = new SceneFrame();
  const frameOf = (seconds: number, own: [SurfaceFades, SurfaceFades]) => {
    frame.fadeSeconds = seconds;
    const backend = new RecordingBackend(new Map());
    presentSurfaceScene(backend, camera, frame, items, props, player, "auto", 1, false, own[0]);
    presentSurfaceScene(backend, camera, frame, [], [], player, "auto", 1, false, own[1]);
    const deck = backend.passes.find((p) => p.kind === "overlay" && p.cacheKey === "deck");
    return deck?.kind === "overlay" ? deck.opacity : "missing";
  };
  const own: [SurfaceFades, SurfaceFades] = [new Map(), new Map()];
  expect(frameOf(10, own)).toBeUndefined();
  expect(frameOf(10 + REVEAL_FADE_SECONDS / 2, own)).toBeCloseTo((1 + REVEAL_OPACITY) / 2, 5);
  expect(frameOf(10 + REVEAL_FADE_SECONDS, own)).toBeCloseTo(REVEAL_OPACITY, 5);
  // Sharing one fade map, the second view deletes the record and the fade restarts.
  const shared = new Map();
  expect(frameOf(20, [shared, shared])).toBeUndefined();
  expect(frameOf(20 + REVEAL_FADE_SECONDS / 2, [shared, shared])).toBeUndefined();
  // A view that stops presenting the slab forgets its own fade.
  const [mine] = own;
  expect(mine.has("deck")).toBe(true);
  const surfaces = (p: (typeof props)[number]) => p.walls ?? (p.collider ? [p.collider] : []);
  const withoutDeck = props.filter((p) => !surfaces(p).some((c) => c.surface?.id === "deck"));
  const backend = new RecordingBackend(new Map());
  presentSurfaceScene(backend, camera, frame, items, withoutDeck, player, "auto", 1, false, mine);
  expect(mine.has("deck")).toBe(false);
});
