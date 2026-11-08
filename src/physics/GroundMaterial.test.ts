import { expect, it } from "vitest";
import { TerrainId } from "../autotile/TerrainId.js";
import { ELEVATION_PX, TILE_SIZE } from "../config/constants.js";
import { RoadType } from "../road/RoadType.js";
import { Chunk } from "../world/Chunk.js";
import { groundMaterialAt } from "./GroundMaterial.js";

function source() {
  const chunk = new Chunk();
  chunk.subgrid.fill(TerrainId.Grass);
  return {
    chunk,
    getChunkIfLoaded: (cx: number, cy: number) => (cx === 0 && cy === 0 ? chunk : undefined),
  };
}

it("reads half-tile terrain, with roads over terrain and off-plane props as pavement", () => {
  const s = source();
  // Tile (2,3): sand at its centre subgrid point; light dirt at tile (5,3)'s centre.
  s.chunk.setSubgrid(5, 7, TerrainId.Sand);
  s.chunk.setSubgrid(11, 7, TerrainId.DirtLight);
  s.chunk.setSubgrid(15, 7, TerrainId.ShallowWater);
  const centre = (tx: number) => tx * TILE_SIZE + TILE_SIZE / 2;
  const y = 3 * TILE_SIZE + TILE_SIZE / 2;
  expect(groundMaterialAt(s, centre(2), y, 0)).toBe("sand");
  expect(groundMaterialAt(s, centre(5), y, 0)).toBe("dirt");
  expect(groundMaterialAt(s, centre(7), y, 0)).toBe("water");
  expect(groundMaterialAt(s, centre(9), y, 0)).toBe("grass");
  s.chunk.setRoad(2, 3, RoadType.CityAsphalt);
  expect(groundMaterialAt(s, centre(2), y, 0)).toBe("paved");
  // Ramp/bridge decks above the terrain and excavated floors (garages) below it
  // are authored surfaces: the collision compiler clips the terrain away there.
  expect(groundMaterialAt(s, centre(5), y, 12)).toBe("paved");
  expect(groundMaterialAt(s, centre(9), y, -8)).toBe("paved");
  s.chunk.setHeight(5, 3, 1);
  expect(groundMaterialAt(s, centre(5), y, ELEVATION_PX)).toBe("dirt");
  // Presentation samples a body point that moves with suspension travel.
  expect(groundMaterialAt(s, centre(5), y, ELEVATION_PX - 3)).toBe("paved");
  expect(groundMaterialAt(s, centre(5), y, ELEVATION_PX - 3, 4)).toBe("dirt");
  // Unloaded chunks drive as pavement rather than guessing.
  expect(groundMaterialAt(s, -40, y, 0)).toBe("paved");
});
