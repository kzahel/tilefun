import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { worldGeometryRecipe } from "../scenarios/WorldGeometryRecipe.js";
import type { World } from "../world/World.js";
import { Camera } from "./Camera.js";
import { collectScene } from "./collectScene.js";
import type { TerrainPresentation } from "./TerrainPresentation.js";

it("projects shared scene shadows onto the occupied deck, but leaves lower actors below it", () => {
  const camera = new Camera();
  camera.setViewport(960, 640);
  const recipe = worldGeometryRecipe();
  for (const [feet, expectedShadow] of [
    [0, 0],
    [20, 0],
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
