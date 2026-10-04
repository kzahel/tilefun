import { expect, it } from "vitest";
import { getEntityAABB } from "../entities/collision.js";
import { createPlayer } from "../entities/Player.js";
import { querySurfacePatch } from "../physics/SurfacePatch.js";
import { worldGeometryRecipe } from "../scenarios/WorldGeometryRecipe.js";
import type { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { collectScene } from "./collectScene.js";
import { OverlayFrame } from "./OverlayFrame.js";
import {
  collectSurfacePresentation,
  surfacePresentationState,
  surfaceVisibility,
} from "./SurfacePresentation.js";
import type { TerrainPresentation } from "./TerrainPresentation.js";

it("projects shared scene shadows onto the occupied deck, but leaves lower actors below it", () => {
  const camera = new Camera();
  camera.setViewport(960, 640);
  const recipe = worldGeometryRecipe();
  for (const [feet, expectedShadow] of [
    [0, 0],
    [20, 0],
    [40, 0],
    [48, 48],
    [64, 48],
  ]) {
    const player = createPlayer(80, 8);
    player.wz = feet ?? 0;
    const items = collectScene(
      [player],
      recipe.props,
      { getHeightAt: () => 0 } as unknown as World,
      camera,
      { minCx: -1, maxCx: 1, minCy: -1, maxCy: 1 },
      1,
      { collectElevationItems: () => [] } as unknown as TerrainPresentation,
      [],
      false,
    );
    const sprite = items.find((i) => i.kind === "sprite" && i.sheetKey === "player");
    expect(sprite).toMatchObject({ shadowTerrainZ: expectedShadow, zOffset: feet });
  }
});

function fixture(id: string) {
  const prop = worldGeometryRecipe().props.find((p) => p.collider?.surface?.id === id);
  if (!prop?.collider?.surface) throw new Error(`Missing ${id}`);
  return { patch: prop.collider.surface, bounds: getEntityAABB(prop.position, prop.collider) };
}

it.each([
  [80, -80, 0, false, "north of the footprint but covered on screen"],
  [80, 60, 0, true, "under the south end but visible in perspective"],
  [80, 38, 0, false, "covered only by the south fascia"],
  [80, -140, 0, true, "clear beyond the projected north edge"],
  [180, -80, 0, true, "clear of the projected east edge"],
  [80, 8, 48, true, "standing on the deck"],
  [80, 8, 60, true, "jumping above the deck"],
])("cuts away by projected sprite overlap: %s,%s,%s (%s; %s)", (x, y, z, visible) => {
  const { patch, bounds } = fixture("deck");
  const player = createPlayer(x, y);
  player.wz = z;
  expect(surfaceVisibility(patch, bounds, player, "auto")).toBe(visible);
  expect(surfaceVisibility(patch, bounds, player, "all")).toBe(true);
  expect(surfaceVisibility(patch, bounds, player, "upper")).toBe(true);
  expect(surfaceVisibility(patch, bounds, player, "lower")).toBe(false);
});

it("uses the sloped silhouette at the sprite's X interval, including draw offset", () => {
  const { patch, bounds } = fixture("ramp");
  const player = createPlayer(-176, -60);
  player.wz = 0;
  // Inside the full ramp bounding box, outside its local projected silhouette.
  expect(surfaceVisibility(patch, bounds, player, "auto")).toBe(true);
  player.position.wx = -16;
  expect(surfaceVisibility(patch, bounds, player, "auto")).toBe(false);
  if (!player.sprite) throw new Error("Missing sprite");
  player.sprite.drawOffsetY = -40;
  expect(surfaceVisibility(patch, bounds, player, "auto")).toBe(true);
});

it("keeps ramp support behind the sprite despite subpixel height noise in every mode", () => {
  const { patch, bounds } = fixture("ramp");
  const camera = new Camera();
  const frame = new OverlayFrame();
  for (const x of [-195, -190, -176, -96, -6, 1]) {
    const player = createPlayer(x, 8);
    if (!player.collider) throw new Error("Missing collider");
    const support = querySurfacePatch(
      patch,
      bounds,
      getEntityAABB(player.position, player.collider),
    );
    if (!support) throw new Error("Missing support");
    for (const noise of [-0.00001, 0, 0.00001]) {
      player.wz = support.topMax + noise;
      for (const mode of ["auto", "all", "upper"] as const) {
        expect(surfacePresentationState(patch, bounds, player, mode)).toEqual({
          visible: true,
          above: false,
        });
        frame.begin();
        collectSurfacePresentation(
          frame,
          camera,
          worldGeometryRecipe().props.slice(0, 1),
          player,
          mode,
          "above",
        );
        expect(frame.items).toHaveLength(0);
      }
    }
  }
});

it("uses the displayed XY and Z at every interpolation fraction without changing simulation", () => {
  const { patch, bounds } = fixture("deck");
  const player = createPlayer(80, -80);
  player.prevPosition = { wx: 80, wy: -140 };
  player.wz = 0;
  const before = structuredClone(player);
  expect(surfaceVisibility(patch, bounds, player, "auto", 0)).toBe(true);
  expect(surfaceVisibility(patch, bounds, player, "auto", 1)).toBe(false);
  expect(player).toEqual(before);
  player.position.wy = 8;
  player.prevPosition = { ...player.position };
  player.prevWz = 48;
  expect(surfacePresentationState(patch, bounds, player, "auto", 0)).toEqual({
    visible: true,
    above: false,
  });
  expect(surfacePresentationState(patch, bounds, player, "auto", 1)).toEqual({
    visible: false,
    above: true,
  });
});

it("keeps the low ramp entrance visible before the feet collider reaches it", () => {
  const { patch, bounds } = fixture("ramp");
  const player = createPlayer(-196, 8);
  player.prevPosition = { wx: -200, wy: 8 };
  player.prevWz = 0;
  player.wz = 0.25;
  for (const alpha of [0.125, 0.25, 0.5, 0.75, 0.875, 1]) {
    expect(surfacePresentationState(patch, bounds, player, "auto", alpha)).toEqual({
      visible: true,
      above: false,
    });
  }
});

it.each([
  [-199, 8, 0, 48, 0],
  [7, 8, 48, -48, 0],
  [-96, 39, 48, 0, -48],
])("uses the nearby low edge for either slope direction: %s,%s", (x, y, z, riseX, riseY) => {
  const { patch, bounds } = fixture("ramp");
  const player = createPlayer(x, y);
  player.wz = 0;
  expect(surfacePresentationState({ ...patch, z, riseX, riseY }, bounds, player, "auto")).toEqual({
    visible: true,
    above: false,
  });
});

it("retains the elevated shadow across an interpolated ramp/deck join in both directions", () => {
  const camera = new Camera();
  camera.setViewport(960, 640);
  const recipe = worldGeometryRecipe();
  for (const reverse of [false, true]) {
    const player = createPlayer(reverse ? -5.8 : -4.6, 8);
    player.prevPosition = { wx: reverse ? -4.6 : -5.8, wy: 8 };
    player.prevWz = reverse ? 48 : 47.8;
    player.wz = reverse ? 47.8 : 48;
    for (const alpha of [0, 0.125, 0.25, 0.5, 0.75, 0.875, 1]) {
      const items = collectScene(
        [player],
        recipe.props,
        { getHeightAt: () => 0 } as unknown as World,
        camera,
        { minCx: -1, maxCx: 1, minCy: -1, maxCy: 1 },
        alpha,
        { collectElevationItems: () => [] } as unknown as TerrainPresentation,
        [],
        false,
      );
      const sprite = items.find((item) => item.kind === "sprite" && item.sheetKey === "player");
      if (sprite?.kind !== "sprite") throw new Error("Missing rendered player");
      expect(sprite.shadowTerrainZ).toBeGreaterThanOrEqual(47.8);
      expect(sprite.shadowTerrainZ).toBeLessThanOrEqual(sprite.zOffset);
    }
  }
});
