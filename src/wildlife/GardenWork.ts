import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import type { AnimalWork } from "./AnimalWork.js";
import { restoreAnimalWorkPose } from "./AnimalWorkPose.js";
import type { AnimalWorkSystem, WorkContext } from "./AnimalWorkSystem.js";
import { actionSocket } from "./BehaviorArt.js";
import { faunaProfile } from "./Fauna.js";
import { createForageItem, restoreWorkItemPose, sourceType } from "./ForageResources.js";
import { restoreFaunaPose, startleFauna } from "./faunaInteractions.js";

const gap = (a: PositionComponent, b: PositionComponent) => Math.hypot(a.wx - b.wx, a.wy - b.wy);
function gardenKind(a: Entity) {
  const species = faunaProfile(a.type)?.species;
  return species === "chicken" || species === "bee"
    ? species
    : species === "ruby-throated-hummingbird"
      ? "hummingbird"
      : undefined;
}
export const isGardenWorker = (a: Entity) => !!gardenKind(a);

/** A paid cross-flower visit can advance one real crop, with a saved destination cap. */
export function pollinateFlower(
  a: Entity,
  flower: Entity,
  crops: readonly Entity[],
  c: WorkContext,
) {
  const t = a.animalWork,
    item = flower.workItem,
    id = durableId(flower);
  if (!t || !item) return;
  if (t.lastFlowerId && t.lastFlowerId !== id && !item.pollination?.remaining) {
    item.pollination = { remaining: 60, count: (item.pollination?.count ?? 0) + 1 };
    t.pollinated = (t.pollinated ?? 0) + 1;
    const crop = crops
      .filter(
        (e) =>
          e !== flower &&
          e.workItem?.growth &&
          [
            sourceType("fruit-tree"),
            sourceType("seed-plant"),
            sourceType("growing-plant"),
          ].includes(e.type) &&
          e.workItem.units < e.workItem.growth.capacity &&
          gap(e.position, flower.position) < 72 &&
          c.ready(e.position, 96),
      )
      .sort(
        (x, y) =>
          gap(x.position, flower.position) - gap(y.position, flower.position) ||
          durableId(x).localeCompare(durableId(y)),
      )[0];
    const growth = crop?.workItem?.growth;
    if (growth) growth.remaining -= Math.min(30, Math.max(0, growth.remaining - 1));
  }
  t.lastFlowerId = id;
  restoreWorkItemPose(flower);
}

/** Shared saved authority for ground scratching and finite flower visits. */
export class GardenWork {
  constructor(
    private readonly manager: EntityManager,
    private readonly work: AnimalWorkSystem,
  ) {}
  private find(id?: string) {
    return id ? this.manager.entities.find((e) => e.persistentId === id) : undefined;
  }
  private nearby(a: Entity) {
    const p = a.position;
    return this.manager.spatialHash
      .queryRange(
        Math.floor((p.wx - 180) / 256),
        Math.floor((p.wy - 180) / 256),
        Math.floor((p.wx + 180) / 256),
        Math.floor((p.wy + 180) / 256),
      )
      .filter((e) => gap(e.position, p) < 180);
  }
  private enter(a: Entity, state: AnimalWork["state"]) {
    const t = a.animalWork;
    if (!t) return;
    t.state = state;
    t.elapsed = 0;
    if (!a.fauna?.motion) {
      if (a.velocity) a.velocity.vx = a.velocity.vy = 0;
      if (a.wanderAI) a.wanderAI.state = "idle";
      restoreFaunaPose(a);
    }
    restoreAnimalWorkPose(a);
  }
  private stop(a: Entity, cooldown = 3) {
    this.work.cancel(a, cooldown);
  }
  private contactPoint(
    a: Entity,
    food: Entity,
    kind: NonNullable<ReturnType<typeof gardenKind>>,
    direction: Direction,
  ) {
    const socket = actionSocket(a, kind === "chicken" ? "peck" : "sip", -1, direction);
    return socket
      ? {
          wx: food.position.wx - (socket[0] ?? 0),
          wy: food.position.wy + (kind === "chicken" ? 5 : -8) - (socket[1] ?? 0),
        }
      : undefined;
  }
  update(a: Entity, dt: number, c: WorkContext, planning?: AiPlanningScheduler): boolean {
    const kind = gardenKind(a),
      ai = a.fauna;
    if (!kind || !ai) return false;
    a.animalWork ??= {
      kind,
      state: "idle",
      elapsed: 0,
      cooldown: 0,
      deliveries: 0,
      eaten: 0,
      retrieved: 0,
    };
    const t = a.animalWork,
      prior = t.elapsed;
    t.elapsed += dt;
    t.cooldown = Math.max(0, t.cooldown - dt);
    const target = this.find(t.targetId),
      held = this.find(t.heldId);
    if (
      a.parentId !== undefined ||
      a.wanderAI?.following ||
      a.wanderAI?.state === "ridden" ||
      ai.alarmFrom ||
      ["startle", "flee", "recover"].includes(ai.state)
    ) {
      this.stop(a);
      return false;
    }
    if (target && !c.ready(target.position, 96)) {
      t.elapsed = prior;
      if (ai.motion) ai.motion.workPaused = true;
      if (a.velocity) a.velocity.vx = a.velocity.vy = 0;
      return true;
    }
    if (ai.motion) delete ai.motion.workPaused;
    if (
      t.state !== "idle" &&
      (!target?.workItem ||
        target.parentId !== undefined ||
        target.workItem.claimedBy !== a.persistentId)
    ) {
      this.stop(a);
      return false;
    }
    if (ai.motion) return t.state !== "idle";
    if (target && ["scratch", "sip", "guard"].includes(t.state)) {
      const point = this.contactPoint(a, target, kind, t.facing ?? Direction.Right),
        z = c.environment.surfaceZ?.(target.position) ?? 0;
      if (
        !point ||
        gap(a.position, point) > 3 ||
        Math.abs((target.wz ?? 0) - z) > 4 ||
        Math.abs((a.wz ?? 0) - (target.wz ?? 0)) > 4
      ) {
        this.stop(a);
        return false;
      }
    }
    if (t.state === "peck" || t.state === "eat") {
      if (!held || held.parentId !== a.id || held.workItem?.claimedBy !== a.persistentId) {
        this.stop(a);
        return false;
      }
      if (t.elapsed < (t.state === "peck" ? 0.8 : 1.2)) return true;
      if (t.state === "peck") {
        this.enter(a, "eat");
        return true;
      }
      delete t.heldId;
      this.manager.remove(held.id);
      t.eaten++;
      this.stop(a, 4);
      return false;
    }
    if (t.state === "scratch") {
      if (t.elapsed < 1.8) return true;
      if (!target?.workItem || target.workItem.units <= 0) {
        this.stop(a);
        return false;
      }
      const seed = createForageItem("seed", a.position.wx, a.position.wy);
      seed.wz = a.wz ?? 0;
      this.manager.spawn(seed);
      if (!this.work.hold(a, seed)) {
        this.manager.remove(seed.id);
        this.stop(a);
        return false;
      }
      target.workItem.units--;
      t.uncovered = (t.uncovered ?? 0) + 1;
      restoreWorkItemPose(target);
      this.enter(a, "peck");
      return true;
    }
    if (t.state === "sip") {
      if (t.elapsed < 1.2) return true;
      if (!target?.workItem || target.workItem.units <= 0) {
        this.stop(a);
        return false;
      }
      target.workItem.units--;
      t.eaten++;
      if (kind === "bee") pollinateFlower(a, target, this.nearby(a), c);
      restoreWorkItemPose(target);
      if (kind === "hummingbird") {
        t.guardWarned = false;
        this.enter(a, "guard");
        return true;
      }
      this.stop(a, 1);
      return false;
    }
    if (t.state === "guard") {
      if (t.elapsed >= 6) {
        this.stop(a, 4);
        return false;
      }
      if (!t.guardWarned && t.elapsed > 0.8 && (!planning || planning.claim(a, false))) {
        const rival = this.nearby(a)
          .filter(
            (e) =>
              e !== a &&
              gardenKind(e) === "hummingbird" &&
              gap(e.position, target?.position ?? a.position) < 32 &&
              !e.wanderAI?.following &&
              e.wanderAI?.state !== "ridden" &&
              e.parentId === undefined &&
              !e.fauna?.alarmFrom,
          )
          .sort((x, y) => durableId(x).localeCompare(durableId(y)))[0];
        if (rival) {
          startleFauna(rival, a.position);
          t.guardWarned = true;
          t.warnings = (t.warnings ?? 0) + 1;
        }
      }
      return true;
    }
    if (t.state === "idle" && t.cooldown) return false;
    if (planning && !planning.claim(a, false)) return t.state !== "idle";
    if (t.state === "seek") {
      const point = t.sitePosition;
      if (!point || t.elapsed > 30) {
        this.stop(a);
        return false;
      }
      if (gap(a.position, point) <= 1.5) {
        if (a.sprite && t.facing !== undefined) {
          a.sprite.direction = t.facing;
          a.sprite.frameRow = t.facing;
        }
        this.enter(a, kind === "chicken" ? "scratch" : "sip");
      } else if (!this.work.go(a, point, point.z, c, planning)) this.stop(a);
      return true;
    }
    const sources = this.nearby(a)
      .filter(
        (e) =>
          e.type === sourceType(kind === "chicken" ? "scratch-patch" : "nectar-flower") &&
          e.workItem &&
          e.workItem.units > 0 &&
          e.parentId === undefined &&
          c.ready(e.position, 96) &&
          gap(e.position, ai.home) < ai.radius + 48,
      )
      .sort(
        (x, y) =>
          Number(x.persistentId === t.lastFlowerId) * 1000 -
            Number(y.persistentId === t.lastFlowerId) * 1000 +
            gap(x.position, a.position) -
            gap(y.position, a.position) || durableId(x).localeCompare(durableId(y)),
      );
    for (const food of sources.slice(0, 8)) {
      if (planning && !planning.candidate(a)) break;
      const item = food.workItem;
      if (!item) continue;
      if (item.claimedBy) {
        const owner = this.find(item.claimedBy);
        if (owner?.animalWork?.targetId === food.persistentId) continue;
        delete item.claimedBy;
      }
      const z = c.environment.surfaceZ?.(food.position) ?? 0;
      if (Math.abs((food.wz ?? 0) - z) > 4) continue;
      for (const direction of [Direction.Right, Direction.Left, Direction.Up, Direction.Down]) {
        const point = this.contactPoint(a, food, kind, direction);
        if (!point) continue;
        const standZ = c.environment.surfaceZ?.(point) ?? z;
        if (Math.abs(standZ - z) > 4 || !this.work.go(a, point, standZ, c, planning)) continue;
        item.claimedBy = durableId(a);
        t.targetId = durableId(food);
        t.sitePosition = { ...point, z: standZ };
        t.facing = direction;
        this.enter(a, "seek");
        return true;
      }
    }
    t.cooldown = 2;
    return false;
  }
}
