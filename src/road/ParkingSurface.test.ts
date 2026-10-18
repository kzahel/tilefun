import { expect, it } from "vitest";
import { createProp } from "../entities/PropFactories.js";
import { isParkingObject, parkingLayout } from "../generation/regional/ParkingLayout.js";
import { shoppingScenery } from "../generation/regional/ShoppingScenery.js";
import { applyChunkSnapshot, serializeChunk } from "../shared/serialization.js";
import { Chunk } from "../world/Chunk.js";
import {
  isParkingSurface,
  PARKING_SURFACE_COUNT,
  parkingSurfaceAt,
  parkingSurfacePieces,
} from "./ParkingSurface.js";
import { surfaceCell, surfaceCellKey } from "./SurfaceCells.js";

it("persists native ground cells with paint/curb layers across chunk boundaries", () => {
  const ground = parkingLayout("shopping").pieces.filter((p) => !isParkingObject(p.label));
  expect(PARKING_SURFACE_COUNT).toBeLessThanOrEqual(256 - 79);
  for (const [x, y] of [
    [0, 0],
    [15, 15],
    [16, 15],
    [35, 20],
    [36, 21],
    [37, 21],
    [12, 20],
    [66, 40],
    [79, 59],
  ] as const) {
    const id = parkingSurfaceAt(x, y);
    expect(isParkingSurface(id)).toBe(true);
    const actual = parkingSurfacePieces(id, x, y).map((p) => ({
      ...p,
      x: p.x - x * 16,
      y: p.y - y * 16,
    }));
    expect(surfaceCellKey(actual)).toBe(
      surfaceCellKey(ground.flatMap((p) => surfaceCell([p], x, y))),
    );
    const chunk = new Chunk();
    chunk.setRoad(x % 16, y % 16, id);
    const copy = new Chunk();
    applyChunkSnapshot(copy, serializeChunk(0, 0, chunk));
    expect(copy.getRoad(x % 16, y % 16)).toBe(id);
  }
});
it("generates only object props and makes retired pavement records inert", () => {
  expect(shoppingScenery).toHaveLength(20);
  expect(shoppingScenery.every((p) => !p.sprite.parts && p.sortOffsetY === undefined)).toBe(true);
  for (let i = 20; i < 40; i++) {
    const p = createProp(`prop-shopping-v1-${i}`, 100, 200);
    expect(p.sprite.parts).toBeUndefined();
    expect(p.sprite.spriteWidth).toBe(0);
    expect(p.collider).toBeNull();
  }
});
