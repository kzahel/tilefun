import { CHUNK_SIZE_PX, TILE_SIZE } from "../config/constants.js";
import { aabbOverlapsPropWalls } from "../entities/collision.js";
import { createProp } from "../entities/PropFactories.js";
import { Chunk } from "../world/Chunk.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { ActorPlacement } from "./Generator.js";
import { edgeHash } from "./RoadGenerator.js";
import { type NaturalPond, naturalHabitat } from "./regional/NaturalLandscape.js";
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
  for (const district of terrain.districts.query(bounds)) {
    for (const block of district.blocks.filter((b) => b.kind === "park")) {
      const x = (block.bounds.minX + block.bounds.maxX) / 2;
      const y = (block.bounds.minY + block.bounds.maxY) / 2;
      for (const [i, dx] of [-3, 3].entries())
        candidates.push(gemPlacement(`${block.id}:green:${i}`, (x + dx) * 16 + 8, y * 16 + 12));
    }
    for (const center of district.shoppingCenters ?? [])
      for (const [i, [dx, dy]] of (
        [
          [600, 216],
          [600, 552],
        ] as const
      ).entries())
        candidates.push(gemPlacement(`${center.id}:parking:${i}`, center.wx + dx, center.wy + dy));
  }
  for (const farm of terrain.nature.farms.query(bounds)) {
    for (const [id, x, y] of [
      ["yard", farm.center.x, farm.center.y - 3],
      ["crops", farm.crops.maxX + 2, farm.crops.maxY - 2],
      ["pasture", farm.pasture.maxX - 4, farm.pasture.maxY - 4],
    ] as const)
      candidates.push(gemPlacement(`${farm.id}:${id}`, x * 16 + 8, y * 16 + 12));
  }
  for (const glade of [
    terrain.nature.rabbitGlade(Math.floor(cx / 4), Math.floor(cy / 4)),
    terrain.nature.deerGlade(Math.floor(cx / 4), Math.floor(cy / 4)),
  ])
    if (glade)
      candidates.push(
        gemPlacement(
          `${glade.id}:clearing`,
          Math.floor(glade.x) * 16 + 8,
          Math.floor(glade.y + 2) * 16 + 12,
        ),
      );
  for (const line of terrain.railways.query(bounds))
    for (const station of line.stations)
      candidates.push(
        gemPlacement(`${station.id}:platform`, station.x * 16 + 8, (station.y - 5) * 16 + 12),
      );
  for (const track of terrain.racetracks.query(bounds))
    for (const [i, dx] of [-12, 12].entries())
      candidates.push(
        gemPlacement(
          `${track.id}:picnic:${i}`,
          (track.center.x + dx) * 16 + 8,
          (track.center.y - 39) * 16 + 12,
        ),
      );

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
  // One sparse woodland find per selected chunk, with a bounded search for a
  // clear path/edge among actual trees. Solid thicket interiors remain intact.
  const woodland: ActorPlacement[] = [];
  if (edgeHash(cx, cy, terrain.world.seed + 41603) < 0.5) {
    for (let ly = 2; ly < 16; ly += 4)
      for (let lx = 2; lx < 16; lx += 4) {
        const x = cx * 16 + lx,
          y = cy * 16 + ly;
        if (naturalHabitat(terrain.world, terrain.nature.profile, x, y).habitat === "meadow")
          continue;
        if (terrain.nature.reserved(x, y, 1)) continue;
        woodland.push(gemPlacement(`woodland:${cx}:${cy}`, x * 16 + 8, y * 16 + 12));
      }
    woodland.sort(
      (a, b) =>
        edgeHash(a.wx, a.wy, terrain.world.seed + 41609) -
        edgeHash(b.wx, b.wy, terrain.world.seed + 41609),
    );
  }
  if (!owned.length && !woodland.length) return [];
  const chunk = new Chunk();
  terrain.generate(chunk, cx, cy);
  const props = terrain.placements(cx, cy).map((p) => createProp(p.propType, p.wx, p.wy));
  const clear = (p: ActorPlacement) => {
    const box = { left: p.wx - 8, right: p.wx + 8, top: p.wy - 12, bottom: p.wy + 2 };
    for (let ty = Math.floor(box.top / 16); ty < Math.ceil(box.bottom / 16); ty++)
      for (let tx = Math.floor(box.left / 16); tx < Math.ceil(box.right / 16); tx++) {
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
  };
  const result = owned.filter(clear);
  const trees = props.filter(
    (p) => p.type === "prop-oak-tree" || p.type.startsWith("pattern:forest-thicket-v1:"),
  );
  const forestFind = woodland.find(
    (p) =>
      clear(p) &&
      result.every((other) => Math.hypot(other.wx - p.wx, other.wy - p.wy) >= 64) &&
      trees.some((tree) => {
        const halfWidth = tree.sprite.spriteWidth / 2;
        return (
          Math.abs(tree.position.wx - p.wx) <= halfWidth + 48 &&
          p.wy >= tree.position.wy - tree.sprite.spriteHeight - 16 &&
          p.wy <= tree.position.wy + 64
        );
      }),
  );
  if (forestFind) result.push(forestFind);
  return result;
}
