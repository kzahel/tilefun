import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import type { AnimalWork, FoodKind } from "./AnimalWork.js";
import { restoreAnimalWorkPose } from "./AnimalWorkPose.js";
import { carrySocket } from "./BehaviorArt.js";
import { faunaProfile } from "./Fauna.js";
import { createForageItem, restoreWorkItemPose } from "./ForageResources.js";
import { restoreFaunaPose, settleFauna } from "./faunaInteractions.js";
import { GardenWork, isGardenWorker } from "./GardenWork.js";
import { isMeadowWorker, MeadowWork } from "./MeadowWork.js";
import type { WildlifeEnvironment } from "./mallardAI.js";
import { isPastureWorker, PastureWork } from "./PastureWork.js";
import { isWoodlandWorker, WoodlandWork } from "./WoodlandWork.js";

const gap = (a: PositionComponent, b: PositionComponent) => Math.hypot(a.wx - b.wx, a.wy - b.wy);
export interface WorkPlayer {
  identity: string;
  entity: Entity;
}
export interface WorkContext {
  environment: WildlifeEnvironment;
  players: readonly WorkPlayer[];
  /** Includes actor readiness, not merely terrain being generated. */
  ready(point: PositionComponent, radius: number): boolean;
}
function workerKind(e: Entity): AnimalWork["kind"] | undefined {
  const p = faunaProfile(e.type);
  return p?.species === "dog" || p?.variantOf === "dog"
    ? "dog"
    : p?.species === "crow"
      ? "crow"
      : p?.species === "red-squirrel"
        ? "squirrel"
        : undefined;
}
const homeKey = (e: Entity) => e.naturalSpawnId ?? e.proceduralId ?? durableId(e);
const carrying = (e: Entity) => !!e.animalWork?.heldId;

/** Shared production authority; all durable state lives on ordinary saved actors. */
export class AnimalWorkSystem {
  private readonly garden: GardenWork;
  private readonly meadow: MeadowWork;
  private readonly woodland: WoodlandWork;
  private readonly pasture: PastureWork;
  constructor(private readonly manager: EntityManager) {
    this.garden = new GardenWork(manager, this);
    this.meadow = new MeadowWork(manager);
    this.woodland = new WoodlandWork(manager, this);
    this.pasture = new PastureWork(manager, this);
    manager.removalListeners.add((removed, destroyed) => {
      if (!destroyed) return; // Residency eviction is not a death or a resource deletion.
      if (removed.animalWork) this.cancel(removed, 3);
      for (const animal of manager.entities) {
        const task = animal.animalWork;
        if (!task) continue;
        if (task.targetId === removed.persistentId || task.heldId === removed.persistentId)
          this.cancel(animal, 2);
        if (task.siteId === removed.persistentId) {
          this.cancel(animal, 4);
          delete task.siteId;
          delete task.sitePosition;
        }
      }
    });
  }
  private find(id: string | undefined): Entity | undefined {
    return id ? this.manager.entities.find((e) => e.persistentId === id) : undefined;
  }
  private enter(task: AnimalWork, state: AnimalWork["state"]) {
    task.state = state;
    task.elapsed = 0;
  }
  drop(animal: Entity) {
    const task = animal.animalWork,
      item = this.find(task?.heldId);
    if (task) delete task.heldId;
    if (!item || item.workItem?.claimedBy !== animal.persistentId) return;
    delete item.parentId;
    delete item.localOffsetX;
    delete item.localOffsetY;
    delete item.jumpZ;
    delete item.jumpVZ;
    item.wz = animal.groundZ ?? 0;
    if (item.workItem) delete item.workItem.claimedBy;
    if (item.velocity) item.velocity = { vx: 0, vy: 0 };
    item.noShadow = false;
    if (item.type === "ball" && !item.workItem?.owner) item.deathTimer = 35;
  }
  cancel(animal: Entity, cooldown: number) {
    const task = animal.animalWork;
    if (!task) return;
    this.drop(animal);
    const target = this.find(task.targetId);
    if (target?.workItem && target.workItem.claimedBy === animal.persistentId)
      delete target.workItem.claimedBy;
    delete task.targetId;
    task.cooldown = cooldown;
    this.enter(task, "idle");
    // A current scare retains its existing physical escape instead of being reset.
    if (animal.fauna && !animal.fauna.alarmFrom) settleFauna(animal);
  }
  private site(
    animal: Entity,
    context: WorkContext,
    planning?: AiPlanningScheduler,
  ): Entity | undefined {
    const task = animal.animalWork;
    if (!task) return;
    if (task.siteId) return this.find(task.siteId);
    const ai = animal.fauna;
    if (!ai || !context.ready(ai.home, ai.radius + 32)) return;
    const kind = task.kind === "crow" ? "nest" : "cache";
    const existing = this.manager.entities.find(
      (e) => e.workItem?.kind === kind && e.workItem.owner === homeKey(animal),
    );
    if (existing) {
      task.siteId = durableId(existing);
      task.sitePosition = { ...existing.position, z: existing.wz ?? 0 };
      return existing;
    }
    const candidates =
      task.kind === "crow"
        ? (context.environment.perches?.(ai.home, ai.radius) ?? []).slice(0, 8)
        : [
            {
              wx: ai.home.wx + 24,
              wy: ai.home.wy + 16,
              z: context.environment.surfaceZ?.(ai.home) ?? 0,
            },
            {
              wx: ai.home.wx - 24,
              wy: ai.home.wy,
              z: context.environment.surfaceZ?.(ai.home) ?? 0,
            },
          ];
    for (const point of candidates) {
      if (planning && !planning.candidate(animal)) return;
      if (
        gap(point, ai.home) > ai.radius ||
        !context.ready(point, 24) ||
        this.manager.entities.some(
          (e) => e.workItem?.kind === kind && gap(e.position, point) < 20,
        ) ||
        !context.environment.canOccupy({ ...animal, wz: point.z }, point)
      )
        continue;
      const item = createForageItem(kind, point.wx, point.wy);
      item.wz = point.z;
      if (item.workItem) item.workItem.owner = homeKey(animal);
      this.manager.spawn(item);
      task.siteId = durableId(item);
      task.sitePosition = { ...point };
      return item;
    }
  }
  go(
    animal: Entity,
    point: PositionComponent,
    z: number,
    context: WorkContext,
    planning?: AiPlanningScheduler,
  ): boolean {
    const p = faunaProfile(animal.type),
      ai = animal.fauna;
    if (!p || !ai || !context.ready(point, p.body[0]) || gap(point, ai.home) > ai.radius + 80)
      return false;
    const distance = gap(animal.position, point),
      startZ = animal.wz ?? 0;
    const samples = Math.max(1, Math.ceil(distance / 4));
    if (samples > 96 || (planning && !planning.path(animal, samples))) return false;
    const flight = ["crow", "bee", "hummingbird"].includes(animal.animalWork?.kind ?? "");
    const lift = animal.animalWork?.kind === "crow" ? 24 : (p.hop?.height ?? 0);
    for (let i = 1; i <= samples; i++) {
      const t = i / samples,
        pos = {
          wx: animal.position.wx + (point.wx - animal.position.wx) * t,
          wy: animal.position.wy + (point.wy - animal.position.wy) * t,
        };
      const height = flight
        ? startZ + (z - startZ) * t + Math.sin(Math.PI * t) * lift
        : (context.environment.surfaceZ?.(pos) ?? startZ);
      if (
        !context.ready(pos, p.body[0]) ||
        context.environment.isWater(pos) ||
        (!flight && Math.abs(height - startZ) > 4) ||
        !context.environment.canOccupy({ ...animal, wz: height }, pos)
      )
        return false;
    }
    ai.state = "travel";
    ai.target = { ...point };
    delete ai.actionElapsed;
    ai.motion = {
      elapsed: 0,
      duration: p.hop ? Math.max(p.hop.duration, distance / 40) : distance / p.speed + 0.05,
      escaping: false,
      ...(p.hop ? { startZ, endZ: z, ...(flight ? { lift } : {}) } : {}),
    };
    if (animal.wanderAI) animal.wanderAI.state = "walking";
    restoreFaunaPose(animal);
    return true;
  }
  hold(animal: Entity, item: Entity): boolean {
    if (item.workItem?.growth) {
      if (
        item.workItem.units <= 0 ||
        item.workItem.claimedBy ||
        gap(animal.position, item.position) > 15 ||
        Math.abs((animal.wz ?? 0) - (item.wz ?? 0)) > 6
      )
        return false;
      const food = item.workItem.growth.food;
      if (food !== "fruit" && food !== "nut") return false;
      const loose = createForageItem(food, item.position.wx, item.position.wy);
      loose.wz = item.wz ?? 0;
      this.manager.spawn(loose);
      if (!this.hold(animal, loose)) {
        this.manager.remove(loose.id);
        return false;
      }
      item.workItem.units--;
      restoreWorkItemPose(item);
      return true;
    }
    if (
      !item.workItem ||
      item.parentId !== undefined ||
      item.workItem.claimedBy ||
      gap(animal.position, item.position) > (animal.animalWork?.kind === "dog" ? 20 : 15) ||
      Math.abs((item.wz ?? 0) - (animal.wz ?? 0)) > 6
    )
      return false;
    const task = animal.animalWork;
    if (!task) return false;
    item.workItem.claimedBy = durableId(animal);
    item.parentId = animal.id;
    item.jumpZ = 10;
    delete item.jumpVZ;
    delete item.deathTimer;
    delete item.ballThrowerId;
    if (item.velocity) item.velocity = { vx: 0, vy: 0 };
    item.noShadow = true;
    task.heldId = durableId(item);
    this.sync(animal);
    return true;
  }
  update(
    animal: Entity,
    dt: number,
    context: WorkContext,
    planning?: AiPlanningScheduler,
  ): boolean {
    if (isGardenWorker(animal)) return this.garden.update(animal, dt, context, planning);
    if (isPastureWorker(animal)) return this.pasture.update(animal, dt, context, planning);
    if (isWoodlandWorker(animal)) return this.woodland.update(animal, dt, context, planning);
    if (isMeadowWorker(animal)) return this.meadow.update(animal, dt, context, planning);
    const kind = workerKind(animal),
      ai = animal.fauna;
    if (!kind || !ai) return false;
    animal.animalWork ??= {
      kind,
      state: "idle",
      elapsed: 0,
      cooldown: 0,
      deliveries: 0,
      eaten: 0,
      retrieved: 0,
    };
    const task = animal.animalWork;
    task.cooldown = Math.max(0, task.cooldown - dt);
    task.elapsed += dt;
    if (kind === "crow" && task.siteId) {
      task.supportCheck = Math.max(0, (task.supportCheck ?? 0) - dt);
      const site = this.find(task.siteId);
      if (!task.supportCheck && site && context.ready(site.position, 96)) {
        task.supportCheck = 0.5;
        const supported = context.environment
          .perches?.(site.position, 8)
          .some((p) => gap(p, site.position) < 1 && Math.abs(p.z - (site.wz ?? 0)) < 1);
        if (!supported) {
          // A deleted/moved tree leaves a real fallen nest rather than floating art.
          site.wz = context.environment.surfaceZ?.(site.position) ?? 0;
          if (site.workItem) delete site.workItem.owner;
          delete task.siteId;
          delete task.sitePosition;
          this.cancel(animal, 3);
          return false;
        }
      }
    }
    if (
      animal.parentId !== undefined ||
      animal.wanderAI?.following ||
      animal.wanderAI?.state === "ridden" ||
      ai.alarmFrom ||
      ["flee", "recover", "startle"].includes(ai.state)
    ) {
      if (task.state !== "idle" || task.heldId) this.cancel(animal, 2);
      return false;
    }
    if (task.state === "idle" && (task.cooldown || ai.motion)) return false;
    if (task.elapsed > 35 && !["idle", "rest"].includes(task.state)) {
      this.cancel(animal, 3);
      return false;
    }
    if (ai.motion) return task.state !== "idle";
    if (task.state === "rest") {
      if (task.elapsed >= 8) {
        this.enter(task, "idle");
        task.cooldown = 0.5;
      }
      return true;
    }
    const target = this.find(task.targetId),
      held = this.find(task.heldId);
    if (
      task.heldId &&
      (!held || held.parentId !== animal.id || held.workItem?.claimedBy !== animal.persistentId)
    ) {
      this.cancel(animal, 2);
      return false;
    }
    if (task.state === "pickup") {
      if (task.elapsed < 0.7) return true;
      if (!target || !this.hold(animal, target)) {
        this.cancel(animal, 1);
        return false;
      }
      this.enter(task, "return");
    }
    if (task.state === "deposit" || task.state === "eat" || task.state === "retrieve") {
      if (task.elapsed < (task.state === "eat" ? 2 : 1.4)) return true;
      const site = this.find(task.siteId);
      if (
        task.state === "retrieve" &&
        site?.workItem?.claimedBy &&
        site.workItem.claimedBy !== animal.persistentId
      ) {
        this.cancel(animal, 2);
        return false;
      }
      if (task.state === "retrieve" && site?.workItem?.contents.length) {
        const food = site.workItem.contents.shift();
        if (!food) {
          this.cancel(animal, 2);
          return false;
        }
        const item = createForageItem(food, animal.position.wx, animal.position.wy);
        item.wz = animal.wz ?? 0;
        this.manager.spawn(item);
        if (!this.hold(animal, item))
          throw Error("Cache retrieval could not attach its owned food");
        task.retrieved++;
        restoreWorkItemPose(site);
        this.enter(task, "eat");
      } else if (held && (task.state === "eat" || site?.workItem)) {
        if (task.state === "eat") task.eaten++;
        else if (site?.workItem?.kind === "nest")
          site.workItem.units = Math.min(4, site.workItem.units + 1);
        else if (
          site?.workItem?.kind === "cache" &&
          ["nut", "fruit"].includes(held.workItem?.kind ?? "")
        )
          site.workItem.contents.push(held.workItem?.kind as FoodKind);
        delete task.heldId;
        delete task.targetId;
        this.manager.remove(held.id);
        task.deliveries++;
        if (site) restoreWorkItemPose(site);
        this.enter(task, "rest");
      } else {
        this.cancel(animal, 2);
        return false;
      }
      return true;
    }
    if (task.state === "seek") {
      if (!target || target.parentId !== undefined || target.workItem?.claimedBy) {
        this.cancel(animal, 0.5);
        return false;
      }
      if (
        gap(animal.position, target.position) <= (kind === "dog" ? 18 : 12) &&
        Math.abs((animal.wz ?? 0) - (target.wz ?? 0)) <= 6
      ) {
        this.enter(task, "pickup");
        return true;
      }
    }
    // Only complete admitted goals consume bounded planning/path work.
    if (planning && !planning.claim(animal, false)) return task.state !== "idle";
    if (task.state === "return" && carrying(animal)) {
      if (kind === "dog") {
        const player = context.players.find((p) => p.identity === task.returnOwner)?.entity;
        if (!player || gap(player.position, animal.position) > 256) {
          this.cancel(animal, 2);
          return false;
        }
        task.returnPosition = { ...player.position };
        if (gap(player.position, animal.position) <= 34) {
          const returnedBall = this.find(task.heldId);
          if (returnedBall?.workItem) returnedBall.workItem.returned = true;
          this.drop(animal);
          task.deliveries++;
          delete task.targetId;
          this.enter(task, "rest");
          return true;
        }
        const d = gap(player.position, animal.position),
          dest = {
            wx: player.position.wx + ((animal.position.wx - player.position.wx) * 26) / d,
            wy: player.position.wy + ((animal.position.wy - player.position.wy) * 26) / d,
          };
        if (!this.go(animal, dest, player.wz ?? 0, context, planning)) this.cancel(animal, 2);
      } else {
        const site = this.site(animal, context, planning);
        if (!site) {
          this.cancel(animal, 2);
          return false;
        }
        if (
          gap(site.position, animal.position) < 8 &&
          Math.abs((site.wz ?? 0) - (animal.wz ?? 0)) <= 3
        )
          this.enter(task, "deposit");
        else if (!this.go(animal, site.position, site.wz ?? 0, context, planning))
          this.cancel(animal, 2);
      }
      return true;
    }
    if (task.state === "seek" && target) {
      if (!this.go(animal, target.position, target.wz ?? 0, context, planning))
        this.cancel(animal, 2);
      return true;
    }
    if (task.state !== "idle") return true;
    let site: Entity | undefined;
    if (kind !== "dog") {
      site = this.site(animal, context, planning);
      if (!site) {
        task.cooldown = 2;
        return false;
      }
      if (kind === "crow" && (site.workItem?.units ?? 0) >= 4) {
        task.cooldown = 5;
        return false;
      }
      if (
        kind === "squirrel" &&
        (site.workItem?.contents.length ?? 0) > 0 &&
        (task.deliveries % 2 === 0 || task.retrieved > 0)
      ) {
        if (gap(site.position, animal.position) < 8) this.enter(task, "retrieve");
        else {
          if (!this.go(animal, site.position, site.wz ?? 0, context, planning)) {
            task.cooldown = 2;
            return false;
          }
          // Retrieval can begin only after real travel reaches its own cache.
          this.enter(task, "idle");
          task.cooldown = 0;
        }
        return true;
      }
    }
    const candidates = this.manager.entities
      .filter((e) => {
        const item = e.workItem;
        if (
          !item ||
          e.parentId !== undefined ||
          item.claimedBy ||
          (item.growth && item.units <= 0) ||
          gap(e.position, ai.home) > ai.radius ||
          gap(e.position, animal.position) > 160
        )
          return false;
        if (kind === "dog")
          return (
            item.kind === "ball" &&
            !item.returned &&
            item.owner &&
            context.players.some((p) => p.identity === item.owner) &&
            e.jumpVZ === undefined &&
            Math.hypot(e.velocity?.vx ?? 0, e.velocity?.vy ?? 0) < 8
          );
        return kind === "crow"
          ? item.kind === "twig"
          : item.kind === "nut" || item.kind === "fruit";
      })
      .sort(
        (a, b) =>
          gap(a.position, animal.position) - gap(b.position, animal.position) ||
          durableId(a).localeCompare(durableId(b)),
      );
    for (const item of candidates.slice(0, 12)) {
      if (planning && !planning.candidate(animal)) break;
      if (!this.go(animal, item.position, item.wz ?? 0, context, planning)) continue;
      task.targetId = durableId(item);
      if (kind === "dog") {
        if (item.workItem?.owner) task.returnOwner = item.workItem.owner;
        if (item.workItem?.returnPosition)
          task.returnPosition = { ...item.workItem.returnPosition };
      }
      this.enter(task, "seek");
      return true;
    }
    task.cooldown = 1;
    return false;
  }
  /** Shared attachment pose and sprite clips; client receives ordinary binary fields. */
  sync(animal: Entity): void {
    const task = animal.animalWork,
      p = faunaProfile(animal.type);
    if (!task || !animal.sprite || (animal.fauna ?? animal.rabbit ?? animal.robin)?.alarmFrom)
      return;
    restoreAnimalWorkPose(animal);
    if (!p) return;
    const item = this.find(task.heldId);
    if (item) {
      item.flashHidden = false;
      const dir = animal.sprite.direction;
      const reach = task.kind === "dog" ? 13 : task.kind === "crow" ? 9 : 6;
      const socket = carrySocket(animal);
      item.localOffsetX =
        socket?.[0] ?? (dir === Direction.Left ? -reach : dir === Direction.Right ? reach : 0);
      item.localOffsetY = socket ? 0 : dir === Direction.Up ? -8 : dir === Direction.Down ? 3 : 0;
      item.jumpZ = socket
        ? -(socket[1] ?? 0) - (item.type === "ball" ? 4 : 0)
        : task.kind === "dog"
          ? 12
          : task.kind === "crow"
            ? 13
            : 8;
      item.jumpZ = Math.max(0, item.jumpZ);
      item.position = {
        wx: animal.position.wx + item.localOffsetX,
        wy: animal.position.wy + item.localOffsetY,
      };
      item.wz = (animal.wz ?? 0) + item.jumpZ;
    }
  }
  syncAll(active: readonly Entity[]): void {
    for (const animal of active) if (animal.animalWork) this.sync(animal);
  }
}
