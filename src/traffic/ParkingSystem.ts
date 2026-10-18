import { required } from "../art/ArtCatalog.js";
import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { createPerson1 } from "../entities/Person.js";
import type { PropManager } from "../entities/PropManager.js";
import type { World } from "../world/World.js";
import { DRIVE_SPEED, drivenCarPose } from "./Driving.js";
import { carryMovingPassengers, planMovingPassengers } from "./MovingSupport.js";
import { createVehicle } from "./Vehicle.js";

type Point = PositionComponent;
export interface ParkingVisit {
  id: string;
  bayId: string;
  /** Conflicting cars AND crossing pedestrians share this aisle reservation. */
  aisle: string;
  model: string;
  arrival: Point[];
  departure: Point[];
  /** Begins safely beside the car and ends at the shop doorway. */
  walk: Point[];
  shopSeconds: number;
  delay: number;
}
export interface ParkingLot {
  id: string;
  bounds: { left: number; top: number; right: number; bottom: number };
  visits: ParkingVisit[];
}
export type ParkingPhase =
  | "waiting"
  | "arriving"
  | "parked"
  | "walking-to-shop"
  | "shopping"
  | "returning"
  | "ready-to-leave"
  | "leaving";
interface VisitState {
  phase: ParkingPhase;
  index: number;
  remaining: number;
  completed: number;
  car?: Entity;
  shopper?: Entity;
}
export interface SavedParking {
  version: 1;
  visits: VisitState[];
}
const movingCar = (p: ParkingPhase) => p === "arriving" || p === "leaving";
const crossing = (p: ParkingPhase) => p === "walking-to-shop" || p === "returning";
const ownsAisle = (p: ParkingPhase) => movingCar(p) || crossing(p);
const stop = (e: Entity) => {
  e.velocity = { vx: 0, vy: 0 };
  if (e.sprite) e.sprite.moving = false;
};
/** Bounded Realm service. Recipes supply routes; native motion/collision,
 * animation, replication and persistence remain shared with the game. */
export class ParkingSystem {
  readonly states: VisitState[];
  private ready = false;
  private supported = false;
  constructor(
    readonly lot: ParkingLot,
    private readonly world: World,
    private readonly entities: EntityManager,
    private readonly props: PropManager,
    private changed: () => void,
    saved?: SavedParking,
    private readonly externalCar = false,
  ) {
    const point = (p: Point) => [p.wx, p.wy].every(Number.isFinite);
    if (
      !lot.id ||
      !Object.values(lot.bounds).every(Number.isFinite) ||
      lot.bounds.right <= lot.bounds.left ||
      lot.bounds.bottom <= lot.bounds.top ||
      (lot.bounds.right - lot.bounds.left) * (lot.bounds.bottom - lot.bounds.top) > 2097152 ||
      lot.visits.length > 12 ||
      new Set(lot.visits.map((v) => v.id)).size !== lot.visits.length ||
      new Set(lot.visits.map((v) => v.bayId)).size !== lot.visits.length ||
      lot.visits.some(
        (v) =>
          !v.id ||
          !v.bayId ||
          !v.aisle ||
          ![v.arrival, v.departure, v.walk].every(
            (r) =>
              r.length >= 2 &&
              r.length <= 64 &&
              r.every(
                (p) =>
                  point(p) &&
                  p.wx >= lot.bounds.left &&
                  p.wx < lot.bounds.right &&
                  p.wy >= lot.bounds.top &&
                  p.wy < lot.bounds.bottom,
              ),
          ) ||
          ![v.delay, v.shopSeconds].every((n) => Number.isFinite(n) && n >= 0 && n <= 300),
      )
    )
      throw new Error("Invalid parking lot");
    if (saved && (saved.version !== 1 || saved.visits.length !== lot.visits.length))
      throw new Error("Invalid saved parking lot");
    this.states = structuredClone(
      saved?.visits ??
        lot.visits.map((v) => ({
          phase: "waiting" as const,
          index: 0,
          remaining: v.delay,
          completed: 0,
        })),
    );
    for (const [i, s] of this.states.entries()) {
      const v = required(lot.visits[i]);
      if (
        ![
          "waiting",
          "arriving",
          "parked",
          "walking-to-shop",
          "shopping",
          "returning",
          "ready-to-leave",
          "leaving",
        ].includes(s.phase) ||
        !Number.isInteger(s.index) ||
        s.index < 0 ||
        s.index >= 64 ||
        ![s.remaining, s.completed].every((n) => Number.isFinite(n) && n >= 0) ||
        (s.phase !== "waiting" && !s.car) ||
        (crossing(s.phase) && !s.shopper) ||
        [s.car, s.shopper].some((e) => e && (!point(e.position) || !e.sprite || !e.velocity)) ||
        (s.car && s.car.type !== `vehicle-v1:${v.model}`)
      )
        throw new Error("Invalid saved parking visit");
    }
    const owners = this.states.flatMap((s, i) =>
      ownsAisle(s.phase) ? [required(lot.visits[i]).aisle] : [],
    );
    if (new Set(owners).size !== owners.length || this.maneuvers > 2)
      throw new Error("Conflicting saved parking reservations");
  }
  get maneuvers() {
    return this.states.filter((s) => movingCar(s.phase)).length;
  }
  get diagnostics() {
    return {
      maneuvers: this.maneuvers,
      completed: this.states.reduce((n, s) => n + s.completed, 0),
      visits: this.states.map((s, i) => ({
        id: required(this.lot.visits[i]).id,
        bayId: required(this.lot.visits[i]).bayId,
        phase: s.phase,
        carId: s.car?.id,
        shopperId: s.shopper?.id,
      })),
    };
  }
  snapshot(): SavedParking {
    // Service-owned actors have no generic actor records. Keep native pose clocks
    // with the trip, so replacing a Realm cannot duplicate occupants or cars.
    return JSON.parse(JSON.stringify({ version: 1, visits: this.states })) as SavedParking;
  }
  sync() {
    this.supported = false;
    const b = this.lot.bounds;
    for (let y = Math.floor(b.top / 256); y <= Math.floor((b.bottom - 1) / 256); y++)
      for (let x = Math.floor(b.left / 256); x <= Math.floor((b.right - 1) / 256); x++)
        if (!this.world.getChunkIfLoaded(x, y)) return;
    this.supported = true;
    if (this.ready) return;
    for (const s of this.states) {
      if (s.car && !this.externalCar) this.spawn(s.car);
      if (s.shopper) this.spawn(s.shopper);
    }
    this.ready = true;
  }
  /** Road traffic keeps its own identity, durable owner and native body. */
  bindCar(car: Entity, changed?: () => void) {
    if (changed) this.changed = changed;
    if (!this.externalCar || this.states.length !== 1)
      throw new Error("External visit requires one bay");
    const s = required(this.states[0]);
    if (s.phase === "waiting") {
      s.phase = "arriving";
      s.index = 1;
      s.remaining = 0;
    }
    if (s.car) {
      car.velocity = s.car.velocity;
      car.sprite = s.car.sprite;
      car.collider = s.car.collider;
    }
    s.car = car;
  }
  dispose() {
    for (const s of this.states) if (s.shopper) this.entities.remove(s.shopper.id, false);
  }
  private spawn(e: Entity) {
    e.tags = new Set(["parking-visit"]);
    this.entities.spawn(e);
  }
  /** All owned car bodies are stepped once, by this service, never generic NPC physics. */
  skipCars(ids: Set<number>) {
    for (const s of this.states) if (s.car) ids.add(s.car.id);
  }
  admitShoppers(dts: Map<Entity, number>, dt: number) {
    if (!this.supported) return;
    for (const s of this.states) if (s.shopper) dts.set(s.shopper, dt);
  }
  private available(v: ParkingVisit, cars: boolean) {
    return (
      (!cars || this.maneuvers < 2) &&
      !this.states.some(
        (s, i) => ownsAisle(s.phase) && required(this.lot.visits[i]).aisle === v.aisle,
      )
    );
  }
  private walk(s: VisitState, points: Point[], dt: number): boolean {
    const e = required(s.shopper),
      target = points[s.index];
    if (!target) {
      stop(e);
      return true;
    }
    const dx = target.wx - e.position.wx,
      dy = target.wy - e.position.wy;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.7) {
      s.index++;
      stop(e);
      return s.index >= points.length;
    }
    const speed = Math.min(38, distance / dt);
    e.velocity = { vx: (dx / distance) * speed, vy: (dy / distance) * speed };
    if (e.sprite) {
      e.sprite.moving = true;
      e.sprite.direction =
        Math.abs(dx) > Math.abs(dy)
          ? dx > 0
            ? Direction.Right
            : Direction.Left
          : dy > 0
            ? Direction.Down
            : Direction.Up;
      e.sprite.frameRow = e.sprite.direction;
    }
    return false;
  }
  private drive(s: VisitState, points: Point[], dt: number, excluded?: ReadonlySet<number>) {
    const car = required(s.car),
      target = points[s.index];
    if (!target) {
      stop(car);
      return true;
    }
    const dx = target.wx - car.position.wx,
      dy = target.wy - car.position.wy;
    const distance = Math.hypot(dx, dy);
    if (distance <= 0.7) {
      s.index++;
      stop(car);
      return s.index >= points.length;
    }
    const speed = Math.min(40, distance / dt);
    // Route steering requests ordinary drive speed. Clamp residual momentum at
    // a waypoint, retaining the native full-body swept collision check.
    const velocity = required(car.velocity);
    const oldSpeed = Math.hypot(velocity.vx, velocity.vy);
    if (oldSpeed > speed)
      car.velocity = { vx: (velocity.vx / oldSpeed) * speed, vy: (velocity.vy / oldSpeed) * speed };
    const pose = drivenCarPose(
      car,
      { dx: ((dx / distance) * speed) / DRIVE_SPEED, dy: ((dy / distance) * speed) / DRIVE_SPEED },
      dt,
      this.world,
      this.props.props,
      this.entities.entities,
    );
    if (!pose) {
      stop(car);
      return false;
    }
    const riders = planMovingPassengers(car, pose, this.entities, this.props, this.world, excluded);
    if (!riders) {
      stop(car);
      return false;
    }
    car.position = pose.position;
    car.velocity = pose.velocity;
    car.collider = pose.collider;
    car.sprite = pose.sprite;
    car.sortOffsetY = pose.sortOffsetY ?? 0;
    car.wz = pose.wz ?? 0;
    car.groundZ = pose.groundZ ?? 0;
    this.entities.spatialHash.update(car);
    carryMovingPassengers(riders, this.entities);
    return false;
  }
  /** Before generic NPC physics: only shoppers receive velocity here. */
  tick(dt: number, excluded?: ReadonlySet<number>) {
    this.sync();
    if (!this.supported) return;
    for (const [i, s] of this.states.entries()) {
      const v = required(this.lot.visits[i]);
      if (s.phase === "waiting") {
        if (this.externalCar) continue;
        s.remaining = Math.max(0, s.remaining - dt);
        if (!s.remaining && this.available(v, true)) {
          s.car = createVehicle(v.model, required(v.arrival[0]).wx, required(v.arrival[0]).wy);
          // Spawn admission is a collision test, including players at the entrance.
          s.car.id = -1;
          if (
            !drivenCarPose(
              s.car,
              { dx: 0, dy: 0 },
              dt,
              this.world,
              this.props.props,
              this.entities.entities,
            )
          ) {
            delete s.car;
            continue;
          }
          this.spawn(s.car);
          s.phase = "arriving";
          s.index = 1;
        }
      } else if (s.phase === "arriving" || s.phase === "leaving") {
        if (this.drive(s, s.phase === "arriving" ? v.arrival : v.departure, dt, excluded)) {
          if (s.phase === "arriving") {
            s.phase = "parked";
            s.remaining = 1;
          } else {
            // Do not despawn an occupied roof. Leave only once the rider steps off.
            if (
              !this.externalCar &&
              this.entities.entities.some(
                (e) =>
                  e.type === "player" &&
                  Math.hypot(
                    e.position.wx - required(s.car).position.wx,
                    e.position.wy - required(s.car).position.wy,
                  ) < 40 &&
                  (e.wz ?? 0) > 1,
              )
            )
              continue;
            if (!this.externalCar) this.entities.remove(required(s.car).id, false);
            delete s.car;
            s.completed++;
            s.phase = "waiting";
            s.remaining = 5 + i;
            s.index = 0;
          }
        }
      } else if (s.phase === "parked") {
        s.remaining = Math.max(0, s.remaining - dt);
        if (!s.remaining && this.available(v, false)) {
          const start = required(v.walk[0]);
          const shopper = createPerson1(start.wx, start.wy);
          shopper.wanderAI = null;
          // The car door must be clear before the occupant steps outside.
          if (
            this.entities.entities.some(
              (e) =>
                e.collider && Math.hypot(e.position.wx - start.wx, e.position.wy - start.wy) < 14,
            )
          )
            continue;
          this.spawn(shopper);
          s.shopper = shopper;
          s.phase = "walking-to-shop";
          s.index = 1;
        }
      } else if (s.phase === "walking-to-shop" || s.phase === "returning") {
        const returning = s.phase === "returning";
        if (this.walk(s, returning ? [...v.walk].reverse() : v.walk, dt)) {
          this.entities.remove(required(s.shopper).id, false);
          delete s.shopper;
          s.phase = returning ? "ready-to-leave" : "shopping";
          s.remaining = returning ? 1 : v.shopSeconds;
          s.index = 0;
        }
      } else if (s.phase === "shopping") {
        s.remaining = Math.max(0, s.remaining - dt);
        if (!s.remaining && this.available(v, false)) {
          const door = required(v.walk.at(-1));
          if (
            this.entities.entities.some(
              (e) =>
                e.collider && Math.hypot(e.position.wx - door.wx, e.position.wy - door.wy) < 14,
            )
          )
            continue;
          s.shopper = createPerson1(door.wx, door.wy);
          s.shopper.wanderAI = null;
          this.spawn(s.shopper);
          s.phase = "returning";
          s.index = 1;
        }
      } else if (s.phase === "ready-to-leave") {
        s.remaining = Math.max(0, s.remaining - dt);
        if (!s.remaining && this.available(v, true)) {
          s.phase = "leaving";
          s.index = 1;
        }
      }
    }
    this.changed();
  }
}
