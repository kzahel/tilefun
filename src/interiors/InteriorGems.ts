import { aabbOverlapsPropWalls } from "../entities/collision.js";
import { createProp } from "../entities/PropFactories.js";
import { gemPlacement, ownsGem } from "../generation/ExplorationGems.js";
import type { WorldGenerator } from "../generation/Generator.js";
import { edgeHash } from "../generation/RoadGenerator.js";
import { buildingDoor } from "./BuildingDoors.js";
import type { InteriorIdentity } from "./GameplayInterior.js";
import { compileGameplayRoom, type GameplayRoomState } from "./GameplayRoom.js";

/** A small cache on reachable floor, away from doors and furniture. No timed respawns. */
export function withInteriorGems(
  generator: WorldGenerator,
  identity: InteriorIdentity,
  state: GameplayRoomState,
): WorldGenerator {
  const room = compileGameplayRoom(identity, state);
  const props = generator.placements(0, 0, new Set()).placements;
  // Fixtures may extend beyond the first chunk in the larger room recipes.
  const fixtures = new Map(props.map((p) => [p.featureId, p]));
  for (let cy = 0; cy <= Math.floor(room.height / 256); cy++)
    for (let cx = 0; cx <= Math.floor(room.width / 256); cx++)
      for (const p of generator.placements(cx, cy, new Set()).placements)
        fixtures.set(p.featureId, p);
  const furniture = [...fixtures.values()].map((p) => createProp(p.propType, p.wx, p.wy));
  const start = buildingDoor(identity).arrival;
  const clear = (wx: number, wy: number) => {
    const box = { left: wx - 7, right: wx + 7, top: wy - 10, bottom: wy + 2 };
    return (
      room.onFloor({ x: box.left, y: box.top, width: 14, height: 12 }) &&
      !furniture.some((p) => aabbOverlapsPropWalls(box, p.position, p, 0, 12))
    );
  };
  const seen = new Set<string>([`${start.wx},${start.wy}`]);
  const reachable = [start];
  for (let i = 0; i < reachable.length; i++) {
    const p = reachable[i];
    if (!p) continue;
    for (const [dx, dy] of [
      [8, 0],
      [-8, 0],
      [0, 8],
      [0, -8],
    ] as const) {
      const wx = p.wx + dx,
        wy = p.wy + dy,
        key = `${wx},${wy}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (clear(wx, wy)) reachable.push({ wx, wy });
    }
  }
  let salt = generator.descriptor.seed;
  for (const c of identity.featureId) salt = (Math.imul(salt, 31) + c.charCodeAt(0)) | 0;
  const choices = reachable.filter(
    (p) =>
      clear(p.wx, p.wy) &&
      room.furnitureFloor({ x: p.wx - 7, y: p.wy - 10, width: 14, height: 12 }) &&
      room.doors.every((d) => Math.hypot(p.wx - d.arrival.wx, p.wy - d.arrival.wy) >= 32),
  );
  choices.sort((a, b) => edgeHash(a.wx, a.wy, salt) - edgeHash(b.wx, b.wy, salt));
  const gems: ReturnType<typeof gemPlacement>[] = [];
  for (const p of choices) {
    if (gems.some((g) => Math.hypot(g.wx - p.wx, g.wy - p.wy) < 40)) continue;
    gems.push(gemPlacement(`interior:${gems.length}`, p.wx, p.wy));
    if (gems.length === 5) break;
  }
  return {
    ...generator,
    actors: (cx, cy) => [
      ...(generator.actors?.(cx, cy) ?? []),
      ...gems.filter((p) => ownsGem(p, cx, cy)),
    ],
    actorAdditions: (cx, cy) => gems.filter((p) => ownsGem(p, cx, cy)),
  };
}
