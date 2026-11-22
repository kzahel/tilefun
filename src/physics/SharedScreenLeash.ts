import { isTrain } from "../railway/Train.js";
import type { SharedScreenSpan } from "../shared/SharedScreenSpan.js";
import { PHYSICS_DT, PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";
import type { SharedScreenGroup } from "./PhysicsState.js";
import type { SceneBody } from "./SceneBody.js";

interface Travel {
  body: SceneBody["body"];
  start: ReturnType<SceneBody["body"]["translation"]>;
  x: number;
  y: number;
  nextX: number;
  nextY: number;
}

interface GroupTravel {
  members: Travel[];
  span: SharedScreenSpan;
}

const STEP = PHYSICS_DT * SCALE;

/** Brake after the motors, including wheel impulses, and before contact solving. */
export function prepareSharedScreenTravel(
  bodies: ReadonlyMap<number, SceneBody>,
  groups: readonly SharedScreenGroup[],
): GroupTravel[] {
  const prepared: GroupTravel[] = [];
  for (const { ids, span } of groups) {
    const group: Travel[] = [];
    const unique = new Set(ids);
    for (const id of unique) {
      const entry = bodies.get(id);
      // Rail services control a whole consist on a prescribed trajectory.
      if (!entry || entry.held || isTrain(entry.entity)) break;
      const { x, y } = entry.state;
      const velocity = entry.body.linvel();
      group.push({
        body: entry.body,
        start: entry.body.translation(),
        x,
        y,
        nextX: x + velocity.x * STEP,
        nextY: y + velocity.z * STEP,
      });
    }
    if (group.length !== unique.size || group.length < 2) continue;
    // Contacts can change the relative travel even when the motors fit.
    prepared.push({ members: group, span });
    if (!limitSpread(group, span)) continue;
    for (const { body, x, y, nextX, nextY } of group) {
      const velocity = body.linvel();
      const vx = (nextX - x) / STEP;
      const vz = (nextY - y) / STEP;
      if (Math.abs(vx - velocity.x) > 1e-6 || Math.abs(vz - velocity.z) > 1e-6)
        body.setLinvel({ x: vx, y: velocity.y, z: vz }, true);
    }
  }
  return prepared;
}

/** A collision can stop the player who was making room, or push another one
 * outward. Trim any resulting excess before publishing this tick's poses. */
export function settleSharedScreenTravel(groups: readonly GroupTravel[]): boolean {
  let adjusted = false;
  for (const { members: group, span } of groups) {
    const positions = group.map(({ body }) => body.translation());
    group.forEach((member, i) => {
      const p = positions[i] as Travel["start"];
      member.nextX = member.x + (p.x - member.start.x) * SCALE;
      member.nextY = member.y + (p.z - member.start.z) * SCALE;
    });
    const travel = group.map(({ nextX, nextY }) => ({ nextX, nextY }));
    if (!limitSpread(group, span)) continue;
    group.forEach(({ body, nextX, nextY }, i) => {
      const p = positions[i] as Travel["start"];
      const end = travel[i] as (typeof travel)[number];
      const dx = (nextX - end.nextX) / SCALE;
      const dz = (nextY - end.nextY) / SCALE;
      if (Math.abs(dx) < 1e-6 && Math.abs(dz) < 1e-6) return;
      const v = body.linvel();
      body.setTranslation({ x: p.x + dx, y: p.y, z: p.z + dz }, true);
      body.setLinvel({ x: dx * v.x < 0 ? 0 : v.x, y: v.y, z: dz * v.z < 0 ? 0 : v.z }, true);
      adjusted = true;
    });
  }
  return adjusted;
}

function limitSpread(group: Travel[], span: SharedScreenSpan): boolean {
  const x = limitAxis(group, "x", "nextX", span.x);
  const y = limitAxis(group, "y", "nextY", span.y);
  return x || y;
}

function limitAxis(
  group: Travel[],
  axis: "x" | "y",
  next: "nextX" | "nextY",
  limit: number,
): boolean {
  const start = group.map((body) => body[axis]);
  const end = group.map((body) => body[next]);
  const left = Math.min(...start);
  const right = Math.max(...start);
  const nextLeft = Math.min(...end);
  const nextRight = Math.max(...end);
  // An already-spread party can move inward without snapping anyone into place.
  const span = Math.max(limit, right - left);
  const excess = nextRight - nextLeft - span;
  if (excess <= 0) return false;
  const leftGrowth = Math.max(0, left - nextLeft);
  const rightGrowth = Math.max(0, nextRight - right);
  const min = nextLeft + (excess * leftGrowth) / (leftGrowth + rightGrowth);
  const max = min + span;
  for (const body of group) body[next] = Math.max(min, Math.min(max, body[next]));
  return true;
}
