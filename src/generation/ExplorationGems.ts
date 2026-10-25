import { CHUNK_SIZE_PX, TILE_SIZE } from "../config/constants.js";
import { aabbOverlapsPropWalls } from "../entities/collision.js";
import { createProp } from "../entities/PropFactories.js";
import { Chunk } from "../world/Chunk.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { ActorPlacement } from "./Generator.js";
import type { NaturalPond } from "./regional/NaturalLandscape.js";
import type { NaturalStrategy } from "./regional/NaturalStrategy.js";

export function gemPlacement(featureId: string, wx: number, wy: number): ActorPlacement {
  return { featureId: `gem:${featureId}`, type: "gem", wx, wy, route: [] };
}
export function ownsGem(p: ActorPlacement, cx: number, cy: number): boolean {
  return Math.floor(p.wx / CHUNK_SIZE_PX) === cx && Math.floor(p.wy / CHUNK_SIZE_PX) === cy;
}

/** Sparse, finite outdoor finds. Existing habitat/traffic RNG and identities are untouched. */
export function outdoorGems(terrain: NaturalStrategy, cx: number, cy: number): ActorPlacement[] {
  const bounds = { minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 };
  const candidates: ActorPlacement[] = [];
  for (const district of terrain.districts.query(bounds))
    for (const center of district.shoppingCenters ?? [])
      for (const [i, [dx, dy]] of (
        [
          [600, 216],
          [600, 552],
        ] as const
      ).entries())
        candidates.push(gemPlacement(`${center.id}:parking:${i}`, center.wx + dx, center.wy + dy));

  const shore = (pond: NaturalPond | null) => {
    if (!pond) return;
    // Two dry bank finds per refuge; the northern lake beach is open and connected.
    for (const [i, dx] of [-2, 2].entries()) {
      const wx = Math.floor(pond.x + dx) * TILE_SIZE + 8;
      const wy = Math.floor(pond.y - pond.ry - 2) * TILE_SIZE + 12;
      candidates.push(gemPlacement(`${pond.id}:shore:${i}`, wx, wy));
    }
  };
  shore(terrain.nature.pond(Math.floor(cx / 8), Math.floor(cy / 8)));
  shore(terrain.nature.lagoon(Math.floor(cx / 16), Math.floor(cy / 16)));
  shore(terrain.nature.lake(Math.floor(cx / 32), Math.floor(cy / 32)));
  const owned = candidates.filter((p) => ownsGem(p, cx, cy));
  if (!owned.length) return [];
  const chunk = new Chunk();
  terrain.generate(chunk, cx, cy);
  const props = terrain.placements(cx, cy).map((p) => createProp(p.propType, p.wx, p.wy));
  return owned.filter((p) => {
    const box = { left: p.wx - 8, right: p.wx + 8, top: p.wy - 12, bottom: p.wy + 2 };
    for (let ty = Math.floor(box.top / 16); ty <= Math.floor(box.bottom / 16); ty++)
      for (let tx = Math.floor(box.left / 16); tx <= Math.floor(box.right / 16); tx++) {
        const lx = tx - cx * 16,
          ly = ty - cy * 16;
        if (lx < 0 || lx >= 16 || ly < 0 || ly >= 16) return false;
        if (chunk.getCollision(lx, ly) & (CollisionFlag.Solid | CollisionFlag.Water)) return false;
        if (
          chunk.getHeight(lx, ly) !==
          chunk.getHeight(Math.floor(p.wx / 16) - cx * 16, Math.floor(p.wy / 16) - cy * 16)
        )
          return false;
      }
    return !props.some((prop) => aabbOverlapsPropWalls(box, prop.position, prop, 0, 12));
  });
}
