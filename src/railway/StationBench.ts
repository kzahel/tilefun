import { getEntityAABB } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";

/** Shared prompt/authority range: beside the bench or standing on its 12px seat. */
export function besideStationBench(player: Entity, bench: Prop): boolean {
  if (
    bench.type !== "prop-rail-bench" ||
    !bench.proceduralId?.includes(":bench:") ||
    !bench.collider ||
    player.parentId !== undefined ||
    (player.wz ?? 0) < 0 ||
    (player.wz ?? 0) > 16
  )
    return false;
  const box = getEntityAABB(bench.position, bench.collider);
  return (
    Math.hypot(
      Math.max(box.left - player.position.wx, player.position.wx - box.right, 0),
      Math.max(box.top - player.position.wy, player.position.wy - box.bottom, 0),
    ) <= 32
  );
}

export function nearestStationBench(player: Entity, props: readonly Prop[]): Prop | undefined {
  return props
    .filter((bench) => besideStationBench(player, bench))
    .sort(
      (a, b) =>
        Math.hypot(a.position.wx - player.position.wx, a.position.wy - player.position.wy) -
          Math.hypot(b.position.wx - player.position.wx, b.position.wy - player.position.wy) ||
        a.id - b.id,
    )[0];
}
