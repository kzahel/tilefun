import type { Entity, PositionComponent } from "../entities/Entity.js";
import { CORN, handItem } from "../inventory/Inventory.js";
import { gap } from "../shared/gap.js";
import { restoreFaunaPose, settleFauna } from "./faunaInteractions.js";
import type { WildlifeEnvironment } from "./WildlifeEnvironment.js";

const ACQUIRE = 96;
const RETAIN = 144;
const FOLLOW_GAP = 24;
const SPEED = 54;
const leaders = new WeakMap<Entity, number>();

function canFollow(hen: Entity, player: Entity, range: number): boolean {
  return (
    handItem(player) === CORN &&
    player.parentId === undefined &&
    Math.abs((player.wz ?? 0) - (hen.wz ?? 0)) < 8 &&
    gap(hen.position, player.position) <= range
  );
}

function stepToward(hen: Entity, player: Entity, environment: WildlifeEnvironment) {
  const { wx, wy } = hen.position;
  const x = player.position.wx - wx,
    y = player.position.wy - wy;
  const distance = Math.hypot(x, y);
  if (distance <= FOLLOW_GAP) return undefined;
  const extent = Math.min(16, distance - FOLLOW_GAP);
  const surface = hen.groundZ ?? hen.wz ?? 0;
  const clear = (point: PositionComponent) =>
    !environment.isWater(point) &&
    Math.abs((environment.surfaceZ?.(point) ?? surface) - surface) <= 4 &&
    environment.canOccupy(hen, point);
  const dx = (x / distance) * extent,
    dy = (y / distance) * extent;
  for (const direction of [
    { dx, dy },
    { dx, dy: 0 },
    { dx: 0, dy },
  ]) {
    if (Math.hypot(direction.dx, direction.dy) < 1) continue;
    if (
      [0.25, 0.5, 0.75, 1].every((t) =>
        clear({
          wx: wx + direction.dx * t,
          wy: wy + direction.dy * t,
        }),
      )
    )
      return { wx: wx + direction.dx, wy: wy + direction.dy };
  }
  return undefined;
}

/** Walk using ordinary fauna motion and ground collision, including a closed gate. */
export function lureChicken(
  hen: Entity,
  players: readonly Entity[],
  environment: WildlifeEnvironment,
  nearScatteredCorn: () => boolean,
  cancelWork: () => void,
): boolean {
  const ai = hen.fauna;
  if (!ai) return false;
  let carrier: Entity | undefined;
  const previous = leaders.get(hen);
  if (!nearScatteredCorn()) {
    carrier = players.find((player) => player.id === previous && canFollow(hen, player, RETAIN));
    if (!carrier) {
      let distance = ACQUIRE;
      for (const player of players) {
        if (!canFollow(hen, player, distance)) continue;
        carrier = player;
        distance = gap(hen.position, player.position);
      }
    }
  }
  if (!carrier) {
    if (!ai.lured) return false;
    leaders.delete(hen);
    delete ai.lured;
    const { wx, wy } = hen.position;
    const yard = ai.habitatBounds;
    const moved = yard
      ? wx < yard.minX || wx > yard.maxX || wy < yard.minY || wy > yard.maxY
      : gap(hen.position, ai.home) > ai.radius / 2;
    if (moved) {
      ai.home = ai.shelter = { wx, wy };
      delete ai.habitatBounds;
    }
    settleFauna(hen);
    return false;
  }
  if (!ai.lured) {
    delete ai.alarmFrom;
    cancelWork();
    if (ai.motion) settleFauna(hen);
  }
  ai.lured = true;
  leaders.set(hen, carrier.id);
  delete ai.alarmFrom;
  if (ai.motion) return true;
  const point = stepToward(hen, carrier, environment);
  if (!point) {
    if (ai.state !== "rest") settleFauna(hen);
    return true;
  }
  ai.state = "travel";
  ai.target = point;
  delete ai.actionElapsed;
  ai.motion = {
    elapsed: 0,
    duration: gap(hen.position, point) / SPEED + 0.04,
    escaping: false,
    workSpeed: SPEED,
  };
  if (hen.wanderAI) hen.wanderAI.state = "walking";
  restoreFaunaPose(hen);
  return true;
}
