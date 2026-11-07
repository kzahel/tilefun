import { CHUNK_SIZE_PX } from "../config/constants.js";
import type { Entity, PositionComponent } from "../entities/Entity.js";
import { createPerson1 } from "../entities/Person.js";
import type { MotionIntent } from "../physics/PhysicsState.js";
import { CONTROL_HOLD_TICKS } from "../physics/PlayerControls.js";
import { angleDifference } from "../physics/VehicleMotor.js";
import { path, samplePath } from "./LaneGraph.js";
import { projectRoad } from "./RoadProjection.js";
import { type ShoppingCenter, shoppingLot } from "./ShoppingCenter.js";
import { vehicleNoseHeading, vehicleTurningRadius } from "./Vehicle.js";
import type { VehicleRegistry, VehicleState } from "./VehicleRegistry.js";

/** One quiet shopping trip at a generated center, as in 132, on the shared world:
 * a passing road compact turns in, parks, its shopper walks into a shop and back
 * on an ordinary route, then the car rejoins the boulevard. One visitor per
 * center; the trip phase is durable, the shopper is a transient pedestrian. */
export type VisitPhase = "arriving" | "parked" | "walking" | "shopping" | "returning" | "leaving";
export interface ShoppingVisit {
  center: string;
  phase: VisitPhase;
  index: number;
  remaining: number;
}
export interface ShoppingSource {
  shoppingCenters?(wx: number, wy: number): readonly ShoppingCenter[];
}
const PHASES: readonly VisitPhase[] = [
  "arriving",
  "parked",
  "walking",
  "shopping",
  "returning",
  "leaving",
];
const VISITORS = /^vehicle-v1:compact-[1-6]$/;
/** Seconds before the same car may shop again. */
const COOLDOWN = 120;
const SPEED = 40;

const shoppers = new WeakMap<VehicleState, Entity>();
const cooldowns = new WeakMap<VehicleState, number>();

export function validShoppingVisit(visit: unknown): boolean {
  if (visit === undefined) return true;
  const v = visit as Partial<ShoppingVisit>;
  return (
    !!v &&
    typeof v.center === "string" &&
    v.center.length > 0 &&
    v.center.length <= 512 &&
    PHASES.includes(v.phase as VisitPhase) &&
    Number.isInteger(v.index) &&
    (v.index ?? -1) >= 0 &&
    (v.index ?? 64) < 64 &&
    Number.isFinite(v.remaining) &&
    (v.remaining ?? -1) >= 0 &&
    (v.remaining ?? 301) <= 300
  );
}
/** A restored trip resumes without its transient pedestrian: someone who was
 * walking is inside the shop, and comes back out of the door. */
export function restoredShoppingVisit(visit: ShoppingVisit): ShoppingVisit {
  return visit.phase === "walking" || visit.phase === "returning"
    ? { ...visit, phase: "shopping", index: 0, remaining: visit.phase === "walking" ? 12 : 0 }
    : { ...visit };
}

function centerFor(r: VehicleRegistry, id: string, at: PositionComponent) {
  return (r.source as ShoppingSource).shoppingCenters?.(at.wx, at.wy).find((c) => c.id === id);
}
function loaded(r: VehicleRegistry, c: ShoppingCenter) {
  const b = shoppingLot(c, "compact-1").bounds;
  for (
    let y = Math.floor(b.top / CHUNK_SIZE_PX);
    y <= Math.floor((b.bottom - 1) / CHUNK_SIZE_PX);
    y++
  )
    for (
      let x = Math.floor(b.left / CHUNK_SIZE_PX);
      x <= Math.floor((b.right - 1) / CHUNK_SIZE_PX);
      x++
    )
      if (!r.world.getChunkIfLoaded(x, y)) return false;
  return true;
}

/** A westbound road compact at a center's entrance, with no other visitor there. */
function startVisit(r: VehicleRegistry, state: VehicleState, dt: number): boolean {
  const e = state.entity,
    cooldown = Math.max(0, (cooldowns.get(state) ?? 0) - dt);
  cooldowns.set(state, cooldown);
  if (cooldown || !VISITORS.test(e.type) || !state.route) return false;
  for (const c of (r.source as ShoppingSource).shoppingCenters?.(e.position.wx, e.position.wy) ??
    []) {
    if (
      Math.hypot(e.position.wx - c.wx - 1176, e.position.wy - c.roadY + 32) > 12 ||
      Math.abs(angleDifference(vehicleNoseHeading(e), Math.PI)) > Math.PI / 6 ||
      [...r.states.values()].some((s) => s.visit?.center === c.id) ||
      !loaded(r, c)
    )
      continue;
    state.visit = { center: c.id, phase: "arriving", index: 1, remaining: 0 };
    delete state.route;
    r.onChange?.(state, false);
    return true;
  }
  return false;
}

/** Pure pursuit along the lot's route polyline: corners are cut on the car's own
 * turning circle instead of orbiting a waypoint it cannot reach. */
function drive(
  e: Entity,
  points: readonly PositionComponent[],
  visit: ShoppingVisit,
  tick: number,
  following: (speed: number) => number,
): MotionIntent {
  const route = path(points.map((p) => ({ x: p.wx, y: p.wy })));
  const remaining = route.length - projectRoad(route, e.position.wx, e.position.wy).progress;
  if (remaining <= 6) {
    visit.index = points.length;
    return { vx: 0, vy: 0, driveSpeed: 0 };
  }
  const rolling = Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0);
  const lookahead = Math.max(24, Math.min(64, 24 + rolling * 0.4));
  const aim = samplePath(route, route.length - remaining + lookahead);
  const error = angleDifference(
    Math.atan2(aim.y - e.position.wy, aim.x - e.position.wx),
    vehicleNoseHeading(e),
  );
  const speed = following(
    Math.min(SPEED, Math.max(12, remaining), Math.abs(error) > 0.6 ? 20 : SPEED),
  );
  return {
    vx: 0,
    vy: 0,
    controlUntil: tick + CONTROL_HOLD_TICKS,
    driveSpeed: speed,
    steering: Math.max(
      -1,
      Math.min(1, (2 * vehicleTurningRadius(e.type) * Math.sin(error)) / lookahead),
    ),
  };
}

function spawnShopper(r: VehicleRegistry, route: readonly PositionComponent[]) {
  const [start, ...rest] = route;
  if (!start) return undefined;
  if (
    r.entities.entities.some(
      (e) => e.collider && Math.hypot(e.position.wx - start.wx, e.position.wy - start.wy) < 14,
    )
  )
    return undefined;
  const shopper = createPerson1(start.wx, start.wy);
  shopper.tags = new Set(["parking-visit"]);
  shopper.routeAI = {
    points: rest.map((p) => ({ ...p, waitSeconds: 0 })),
    index: 0,
    pause: 0,
    blocked: 0,
    last: { ...start },
  };
  r.entities.spawn(shopper);
  return shopper;
}

type Plan = NonNullable<ReturnType<typeof shoppingLot>["visits"][number]>;

/** A parked car's door, or the shop door, releases the shopper when clear. */
function startWalk(r: VehicleRegistry, state: VehicleState, visit: ShoppingVisit, plan: Plan) {
  if (visit.remaining) return;
  const outbound = visit.phase === "parked";
  const shopper = spawnShopper(r, outbound ? plan.walk : [...plan.walk].reverse());
  if (!shopper) return;
  shoppers.set(state, shopper);
  Object.assign(visit, { phase: outbound ? "walking" : "returning", index: 0 });
}
/** The shopper reached the shop door (going in) or the car (coming back). */
function finishWalk(r: VehicleRegistry, state: VehicleState, visit: ShoppingVisit, plan: Plan) {
  const shopper = shoppers.get(state),
    walking = visit.phase === "walking",
    end = (walking ? plan.walk.at(-1) : plan.walk[0]) ?? state.entity.position;
  if (
    shopper &&
    r.entities.byId.has(shopper.id) &&
    Math.hypot(shopper.position.wx - end.wx, shopper.position.wy - end.wy) > 3
  )
    return;
  if (shopper) r.entities.remove(shopper.id, false);
  shoppers.delete(state);
  Object.assign(
    visit,
    walking ? { phase: "shopping", remaining: plan.shopSeconds } : { phase: "leaving", index: 1 },
  );
}
function visitPlan(r: VehicleRegistry, state: VehicleState): Plan | undefined {
  const visit = state.visit,
    e = state.entity;
  const center = visit && centerFor(r, visit.center, e.position);
  const plan =
    center && VISITORS.test(e.type) ? shoppingLot(center, e.type.slice(11)).visits[0] : undefined;
  if (!plan) {
    delete state.visit;
    r.onChange?.(state, false);
  }
  return plan;
}

/** Run an active trip, or begin one at an entrance. Returns the car's intent
 * while a trip owns it; otherwise ordinary lane traffic continues. */
export function planShoppingVisit(
  r: VehicleRegistry,
  state: VehicleState,
  dt: number,
  tick: number,
  following: (speed: number) => number,
): MotionIntent | undefined {
  if (!state.visit && !startVisit(r, state, dt)) return undefined;
  const plan = visitPlan(r, state),
    visit = state.visit;
  if (!plan || !visit) return undefined;
  const before = visit.phase;
  let intent: MotionIntent = { vx: 0, vy: 0, driveSpeed: 0 };
  visit.remaining = Math.max(0, visit.remaining - dt);
  if (visit.phase === "arriving") {
    intent = drive(state.entity, plan.arrival, visit, tick, following);
    if (visit.index >= plan.arrival.length) Object.assign(visit, { phase: "parked", remaining: 1 });
  } else if (visit.phase === "parked" || visit.phase === "shopping")
    startWalk(r, state, visit, plan);
  else if (visit.phase === "walking" || visit.phase === "returning")
    finishWalk(r, state, visit, plan);
  else {
    intent = drive(state.entity, plan.departure, visit, tick, following);
    if (visit.index >= plan.departure.length) {
      // Back on the boulevard: ordinary lane traffic reacquires its lane.
      delete state.visit;
      cooldowns.set(state, COOLDOWN);
      r.onChange?.(state, false);
      return undefined;
    }
  }
  if (visit.phase !== before) r.onChange?.(state, false);
  return intent;
}

/** The visiting car's pedestrian, admitted to simulation with its car. */
export const visitShopper = (state: VehicleState) => shoppers.get(state);

/** A driver taking over, or deletion, ends the trip and its pedestrian. */
export function endShoppingVisit(r: VehicleRegistry, state: VehicleState) {
  const shopper = shoppers.get(state);
  if (shopper) r.entities.remove(shopper.id, false);
  shoppers.delete(state);
  delete state.visit;
}
