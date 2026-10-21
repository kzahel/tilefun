import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { directionFromVelocity } from "../entities/wanderAI.js";
import { durableId } from "../persistence/ActorRecords.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import type { AnimalWork } from "./AnimalWork.js";
import { restoreAnimalWorkPose } from "./AnimalWorkPose.js";
import type { AnimalWorkSystem, WorkContext } from "./AnimalWorkSystem.js";
import { actionSocket } from "./BehaviorArt.js";
import { DEER_WALK_SPEED, restoreDeerPose, settleDeer } from "./deerInteractions.js";
import { faunaProfile } from "./Fauna.js";
import { createForageItem, restoreWorkItemPose, sourceType } from "./ForageResources.js";
import { restoreFaunaPose } from "./faunaInteractions.js";

const gap = (a: PositionComponent, b: PositionComponent) => Math.hypot(a.wx - b.wx, a.wy - b.wy);
const native = (a: Entity) => a.deer ?? a.fauna;
const kindOf = (a: Entity) =>
  a.deer
    ? "deer"
    : (["peacock", "raven"].find((k) => faunaProfile(a.type)?.species === k) as
        | "peacock"
        | "raven"
        | undefined);
export const isForestWorker = (a: Entity) => !!kindOf(a);
const protectedActor = (a: Entity) =>
  a.parentId !== undefined || a.wanderAI?.following || a.wanderAI?.state === "ridden";
const fresh = (kind: AnimalWork["kind"]): AnimalWork => ({
  kind,
  state: "idle",
  elapsed: 0,
  cooldown: 0,
  deliveries: 0,
  eaten: 0,
  retrieved: 0,
});
const homeKey = (a: Entity) => a.naturalSpawnId ?? a.proceduralId ?? durableId(a);

/** Ordinary native travel, finite browse, reciprocal social work and conserved objects. */
export class ForestWork {
  constructor(
    private readonly manager: EntityManager,
    private readonly work: AnimalWorkSystem,
  ) {
    manager.removalListeners.add((removed, destroyed) => {
      if (!destroyed) return;
      if (removed.workItem?.kind === "hoard") {
        for (const item of manager.entities)
          if (item.workItem?.cachedIn === removed.persistentId) this.releaseStored(item);
      }
      if (removed.workItem?.cachedIn) {
        const site = this.find(removed.workItem.cachedIn);
        if (site?.workItem) {
          site.workItem.storedIds = (site.workItem.storedIds ?? []).filter(
            (id) => id !== removed.persistentId,
          );
          site.workItem.units = site.workItem.storedIds?.length ?? 0;
          restoreWorkItemPose(site);
        }
      }
    });
  }
  private find(id?: string) {
    return id ? this.manager.entities.find((e) => e.persistentId === id) : undefined;
  }
  private nearby(a: Entity) {
    return this.manager.spatialHash
      .queryRange(
        Math.floor((a.position.wx - 180) / 256),
        Math.floor((a.position.wy - 180) / 256),
        Math.floor((a.position.wx + 180) / 256),
        Math.floor((a.position.wy + 180) / 256),
      )
      .filter((e) => e !== a && gap(e.position, a.position) < 180)
      .sort(
        (x, y) =>
          gap(x.position, a.position) - gap(y.position, a.position) ||
          durableId(x).localeCompare(durableId(y)),
      );
  }
  private supported(a: Entity, c: WorkContext) {
    return (
      !c.environment.isWater(a.position) &&
      Math.abs((a.wz ?? 0) - (c.environment.surfaceZ?.(a.position) ?? 0)) <= 4
    );
  }
  private face(a: Entity, point: PositionComponent) {
    if (!a.sprite) return;
    const facing = directionFromVelocity(point.wx - a.position.wx, point.wy - a.position.wy);
    a.sprite.direction = a.sprite.frameRow = facing;
    if (a.animalWork) a.animalWork.facing = facing;
  }
  private enter(a: Entity, state: AnimalWork["state"]) {
    const t = a.animalWork;
    if (!t) return;
    t.state = state;
    t.elapsed = 0;
    if (!native(a)?.motion) {
      if (a.velocity) a.velocity.vx = a.velocity.vy = 0;
      if (a.wanderAI && !native(a)?.alarmFrom) a.wanderAI.state = "idle";
      if (a.deer) restoreDeerPose(a);
      else restoreFaunaPose(a);
    }
    restoreAnimalWorkPose(a);
  }
  private stop(a: Entity, cooldown = 3) {
    this.work.cancel(a, cooldown);
    if (a.animalWork) {
      delete a.animalWork.sitePosition;
      delete a.animalWork.facing;
    }
    if (a.deer && !a.deer.alarmFrom) settleDeer(a);
  }
  private contactPoint(
    a: Entity,
    item: Entity,
    clip: string,
    frame: number,
    facing: Direction,
    c: WorkContext,
  ) {
    const socket = actionSocket(a, clip, frame, facing);
    if (!socket) return;
    const z = c.environment.surfaceZ?.(item.position) ?? 0;
    const p = {
      wx: item.position.wx - (socket[0] ?? 0),
      // Browse the shrub's authored leaf crown, eight pixels above its ground anchor.
      wy: item.position.wy - (a.deer ? 8 : 0) - (item.wz ?? 0) - (socket[1] ?? 0) + z,
      z,
    };
    return Math.abs((c.environment.surfaceZ?.(p) ?? z) - z) <= 4 ? p : undefined;
  }
  private go(
    a: Entity,
    p: PositionComponent & { z: number },
    c: WorkContext,
    planning?: AiPlanningScheduler,
  ) {
    const ai = native(a);
    if (!ai || gap(p, ai.home) > ai.radius) return false;
    if (!a.deer) return this.work.go(a, p, p.z, c, planning);
    const distance = gap(a.position, p),
      steps = Math.max(1, Math.ceil(distance / 4));
    if (steps > 96 || (planning && !planning.path(a, steps))) return false;
    for (let i = 1; i <= steps; i++) {
      const q = {
        wx: a.position.wx + ((p.wx - a.position.wx) * i) / steps,
        wy: a.position.wy + ((p.wy - a.position.wy) * i) / steps,
      };
      if (
        !c.ready(q, 24) ||
        c.environment.isWater(q) ||
        Math.abs((c.environment.surfaceZ?.(q) ?? 0) - (a.wz ?? 0)) > 4 ||
        !c.environment.canOccupy(a, q)
      )
        return false;
    }
    a.deer.state = "travel";
    a.deer.target = { wx: p.wx, wy: p.wy };
    a.deer.motion = { elapsed: 0, duration: distance / DEER_WALK_SPEED + 0.15, escaping: false };
    if (a.wanderAI) a.wanderAI.state = "walking";
    restoreDeerPose(a);
    return true;
  }
  private available(item: Entity) {
    if (!item.workItem || item.parentId !== undefined || item.workItem.cachedIn) return false;
    const owner = this.find(item.workItem.claimedBy),
      t = owner?.animalWork;
    if (t && [t.targetId, t.siteId, t.heldId].includes(item.persistentId)) return false;
    delete item.workItem.claimedBy;
    return true;
  }
  private deer(a: Entity, dt: number, c: WorkContext, planning?: AiPlanningScheduler) {
    const ai = a.deer,
      t = a.animalWork;
    if (!ai || !t) return false;
    if (!ai.alarmFrom) delete t.stampedAlarm;
    if (ai.alarmFrom) {
      if (ai.motion || ai.state !== "startle" || t.stampedAlarm) {
        if (t.state !== "idle") this.stop(a);
        return false;
      }
      if (t.state !== "stamp") {
        this.stop(a, 0);
        this.face(a, ai.alarmFrom);
        this.enter(a, "stamp");
      }
      t.elapsed += dt;
      if (t.elapsed < 0.6) return true;
      t.alarms = (t.alarms ?? 0) + 1;
      t.stampedAlarm = true;
      this.stop(a);
      ai.timer = 0;
      return false;
    }
    if (["recover", "flee"].includes(ai.state)) {
      if (t.state !== "idle") this.stop(a);
      return false;
    }
    const food = this.find(t.targetId);
    if (
      t.targetId &&
      (!food?.workItem ||
        food.type !== sourceType("browse-shrub") ||
        food.parentId !== undefined ||
        food.workItem.claimedBy !== a.persistentId ||
        !this.supported(food, c))
    ) {
      this.stop(a);
      return false;
    }
    if (ai.motion) return t.state !== "idle";
    t.elapsed += dt;
    t.cooldown = Math.max(0, t.cooldown - dt);
    if (t.state === "raise") {
      if (t.elapsed < 0.75) return true;
      this.stop(a, 8);
      return false;
    }
    if (t.state === "lower" || t.state === "browse") {
      const p = food && this.contactPoint(a, food, "browse", -1, t.facing ?? Direction.Right, c);
      if (!p || gap(a.position, p) > 3 || (food?.workItem?.units ?? 0) <= 0) {
        this.stop(a);
        return false;
      }
      if (t.elapsed < (t.state === "lower" ? 0.75 : 1.2)) return true;
      if (t.state === "lower") this.enter(a, "browse");
      else {
        if (food?.workItem) {
          food.workItem.units--;
          delete food.workItem.claimedBy;
          restoreWorkItemPose(food);
        }
        t.eaten++;
        delete t.targetId;
        delete t.sourcePosition;
        this.enter(a, "raise");
      }
      return true;
    }
    if (t.state === "seek") {
      if (!t.sitePosition || !food || t.elapsed > 20) {
        this.stop(a);
        return false;
      }
      const current = this.contactPoint(a, food, "browse", -1, t.facing ?? Direction.Right, c);
      if (!current || gap(current, t.sitePosition) > 1) {
        this.stop(a);
        return false;
      }
      if (gap(a.position, current) <= 1.5) this.enter(a, "lower");
      else if (!this.go(a, current, c, planning)) this.stop(a);
      return true;
    }
    if (t.cooldown) return false;
    if (planning && !planning.claim(a, false)) return false;
    for (const food of this.nearby(a)
      .filter((e) => e.type === sourceType("browse-shrub") && (e.workItem?.units ?? 0) > 0)
      .slice(0, 8)) {
      if (planning && !planning.candidate(a)) break;
      if (
        !food.workItem ||
        !c.ready(food.position, 96) ||
        !this.available(food) ||
        !this.supported(food, c)
      )
        continue;
      for (const facing of [Direction.Right, Direction.Left, Direction.Up, Direction.Down]) {
        const p = this.contactPoint(a, food, "browse", -1, facing, c);
        if (!p || !this.go(a, p, c, planning)) continue;
        t.targetId = durableId(food);
        t.sourcePosition = { ...food.position };
        food.workItem.claimedBy = durableId(a);
        t.facing = facing;
        t.sitePosition = p;
        this.enter(a, "seek");
        return true;
      }
    }
    t.cooldown = 3;
    return false;
  }
  private stopPair(a: Entity) {
    const t = a.animalWork,
      peer = this.find(t?.partnerId);
    if (t) {
      delete t.partnerId;
      delete t.displayLeader;
    }
    this.stop(a, 30);
    if (peer?.animalWork && a.persistentId && peer.animalWork.partnerId === a.persistentId) {
      delete peer.animalWork.partnerId;
      delete peer.animalWork.displayLeader;
      this.stop(peer, 30);
    }
  }
  releasePartner(a: Entity, cooldown: number) {
    const t = a.animalWork,
      peer = this.find(t?.partnerId);
    if (t) {
      delete t.partnerId;
      delete t.displayLeader;
    }
    if (peer?.animalWork && a.persistentId && peer.animalWork.partnerId === a.persistentId) {
      delete peer.animalWork.partnerId;
      delete peer.animalWork.displayLeader;
      this.work.cancel(peer, cooldown);
    }
  }
  private eligiblePartner(a: Entity, b: Entity, c: WorkContext) {
    const ai = b.fauna;
    return (
      kindOf(b) === "peacock" &&
      !!ai &&
      !protectedActor(b) &&
      !ai.alarmFrom &&
      !["startle", "flee", "recover"].includes(ai.state) &&
      Math.abs((b.wz ?? 0) - (a.wz ?? 0)) <= 4 &&
      c.ready(b.position, 96) &&
      this.supported(b, c) &&
      c.environment.canOccupy(b, b.position) &&
      (a.fauna?.groupId
        ? a.fauna.groupId === ai.groupId
        : !ai.groupId && gap(ai.home, a.fauna?.home ?? a.position) < 144)
    );
  }
  private peacock(a: Entity, dt: number, c: WorkContext, planning?: AiPlanningScheduler): boolean {
    const t = a.animalWork,
      ai = a.fauna;
    if (!t || !ai) return false;
    const peer = this.find(t.partnerId),
      p = peer?.animalWork;
    if (t.partnerId) {
      if (
        !peer ||
        !p ||
        p.partnerId !== a.persistentId ||
        !this.eligiblePartner(a, peer, c) ||
        !t.sitePosition ||
        !p.sitePosition ||
        (!(p.displayLeader && p.state === "seek") && gap(peer.position, p.sitePosition) > 2)
      ) {
        this.stopPair(a);
        return false;
      }
      if (!t.displayLeader) return true;
      t.elapsed += dt;
      if (ai.motion) return true;
      this.face(a, peer.position);
      this.face(peer, a.position);
      if (t.state === "seek") {
        if (t.elapsed > 20) {
          this.stopPair(a);
          return false;
        }
        if (gap(a.position, t.sitePosition) > 1.5) {
          if (!this.go(a, t.sitePosition, c, planning)) this.stopPair(a);
          return true;
        }
        this.enter(a, "open");
        this.enter(peer, "open");
        return true;
      }
      if (gap(a.position, peer.position) > 56 || gap(a.position, t.sitePosition) > 2) {
        this.stopPair(a);
        return false;
      }
      p.elapsed = t.elapsed;
      const duration = t.state === "display" ? 3 : 1.2;
      if (t.elapsed < duration) return true;
      if (t.state === "close") {
        t.courted = (t.courted ?? 0) + 1;
        p.courted = (p.courted ?? 0) + 1;
        this.stopPair(a);
        return false;
      }
      const next = t.state === "open" ? "display" : "close";
      this.enter(a, next);
      this.enter(peer, next);
      return true;
    }
    t.cooldown = Math.max(0, t.cooldown - dt);
    if (t.cooldown || ai.motion) return false;
    if (planning && !planning.claim(a, false)) return false;
    for (const peer of this.nearby(a)
      .filter((e) => this.eligiblePartner(a, e, c))
      .slice(0, 8)) {
      if (planning && !planning.candidate(a)) break;
      if (
        peer.fauna?.motion ||
        (peer.animalWork &&
          (peer.animalWork.state !== "idle" ||
            peer.animalWork.cooldown > 0 ||
            peer.animalWork.partnerId))
      )
        continue;
      const d = gap(a.position, peer.position);
      if (d < 1) continue;
      const point = {
        wx: peer.position.wx + ((a.position.wx - peer.position.wx) * 40) / d,
        wy: peer.position.wy + ((a.position.wy - peer.position.wy) * 40) / d,
        z: peer.wz ?? 0,
      };
      if (!this.go(a, point, c, planning)) continue;
      peer.animalWork ??= fresh("peacock");
      t.partnerId = durableId(peer);
      peer.animalWork.partnerId = durableId(a);
      t.displayLeader = true;
      peer.animalWork.displayLeader = false;
      t.sitePosition = point;
      peer.animalWork.sitePosition = { ...peer.position, z: peer.wz ?? 0 };
      this.enter(a, "seek");
      this.enter(peer, "wait");
      return true;
    }
    t.cooldown = 3;
    return false;
  }
  private releaseStored(item: Entity) {
    if (item.workItem) delete item.workItem.cachedIn;
    delete item.parentId;
    delete item.localOffsetX;
    delete item.localOffsetY;
    delete item.jumpZ;
    delete item.jumpVZ;
    item.flashHidden = false;
    item.noShadow = false;
  }
  syncCaches(active: readonly Entity[]) {
    for (const site of active)
      if (site.workItem?.kind === "hoard") {
        for (const id of site.workItem.storedIds ?? []) {
          const item = this.find(id);
          if (
            !item?.workItem ||
            item.workItem.cachedIn !== site.persistentId ||
            item.parentId !== site.id
          )
            continue;
          item.flashHidden = true;
          item.noShadow = true;
          item.position = { ...site.position };
          item.wz = site.wz ?? 0;
        }
        site.workItem.units = site.workItem.storedIds?.length ?? 0;
        restoreWorkItemPose(site);
      }
  }
  private hoard(a: Entity, c: WorkContext, planning?: AiPlanningScheduler) {
    const ai = a.fauna,
      t = a.animalWork;
    if (!ai || !t) return;
    if (t.siteId) {
      const site = this.find(t.siteId);
      if (!site) return;
      if (
        site.workItem?.kind === "hoard" &&
        (!site.workItem.owner || site.workItem.owner === homeKey(a))
      ) {
        site.workItem.owner = homeKey(a);
        return site;
      }
      delete t.siteId;
    }
    const owner = homeKey(a),
      old = this.manager.entities.find(
        (e) => e.workItem?.kind === "hoard" && e.workItem.owner === owner,
      );
    if (old) return old;
    const placed = this.nearby(a).find(
      (e) =>
        e.workItem?.kind === "hoard" &&
        !e.workItem.owner &&
        e.parentId === undefined &&
        c.ready(e.position, 96) &&
        this.supported(e, c) &&
        gap(e.position, ai.home) < ai.radius,
    );
    if (placed?.workItem) {
      placed.workItem.owner = owner;
      return placed;
    }
    if (!c.ready(ai.home, ai.radius + 32)) return;
    for (const [dx = 0, dy = 0] of [
      [32, 24],
      [-32, 24],
      [0, -32],
    ]) {
      if (planning && !planning.candidate(a)) return;
      const p = { wx: ai.home.wx + dx, wy: ai.home.wy + dy };
      const z = c.environment.surfaceZ?.(p) ?? 0;
      if (
        !c.ready(p, 96) ||
        c.environment.isWater(p) ||
        Math.abs(z - (a.wz ?? 0)) > 4 ||
        !c.environment.canOccupy({ ...a, wz: z }, p) ||
        this.manager.entities.some((e) => e.workItem?.kind === "hoard" && gap(e.position, p) < 20)
      )
        continue;
      const site = createForageItem("hoard", p.wx, p.wy);
      site.wz = z;
      if (!site.workItem) return;
      site.workItem.owner = owner;
      site.workItem.storedIds = [];
      this.manager.spawn(site);
      return site;
    }
  }
  private raven(a: Entity, dt: number, c: WorkContext, planning?: AiPlanningScheduler) {
    const t = a.animalWork,
      ai = a.fauna;
    if (!t || !ai) return false;
    const target = this.find(t.targetId),
      held = this.find(t.heldId),
      site = this.find(t.siteId);
    if (
      t.targetId &&
      (target?.workItem?.kind !== "shiny" ||
        !!target.workItem.owner ||
        target.workItem.claimedBy !== a.persistentId ||
        (!held && (target.parentId !== undefined || !this.supported(target, c))))
    ) {
      this.stop(a);
      return false;
    }
    if (
      t.state !== "idle" &&
      (site?.workItem?.kind !== "hoard" ||
        site.parentId !== undefined ||
        site.workItem.owner !== homeKey(a) ||
        site.workItem.claimedBy !== a.persistentId ||
        !this.supported(site, c) ||
        !t.sitePosition ||
        !t.returnPosition ||
        gap(site.position, t.returnPosition) > 1)
    ) {
      this.stop(a);
      return false;
    }
    if (held && (held.parentId !== a.id || held.workItem?.claimedBy !== a.persistentId)) {
      this.stop(a);
      return false;
    }
    if (ai.motion) return t.state !== "idle";
    t.elapsed += dt;
    t.cooldown = Math.max(0, t.cooldown - dt);
    if (t.state === "seek" || t.state === "pickup") {
      const point =
        target && this.contactPoint(a, target, "pickup", 6, t.facing ?? Direction.Right, c);
      if (!point || !target?.workItem || t.elapsed > 20) {
        this.stop(a);
        return false;
      }
      if (t.state === "seek") {
        if (gap(a.position, point) <= 1.5) this.enter(a, "pickup");
        else if (!this.go(a, point, c, planning)) this.stop(a);
        return true;
      }
      if (!held && gap(a.position, point) > 3) {
        this.stop(a);
        return false;
      }
      if (t.elapsed >= 0.42 && !held) {
        delete target.workItem.claimedBy;
        if (!this.work.hold(a, target)) {
          this.stop(a);
          return false;
        }
        delete t.sourcePosition;
      }
      if (t.elapsed >= 0.84) {
        t.facing = t.cacheFacing ?? Direction.Right;
        this.enter(a, "return");
      }
      return true;
    }
    if (t.state === "return" || t.state === "bury") {
      if (
        !held?.workItem ||
        !site?.workItem ||
        !t.sitePosition ||
        (site.workItem.storedIds?.length ?? 0) >= 3
      ) {
        this.stop(a);
        return false;
      }
      if (t.state === "return") {
        if (t.elapsed > 30) {
          this.stop(a);
          return false;
        }
        if (gap(a.position, t.sitePosition) <= 1.5) this.enter(a, "bury");
        else if (!this.go(a, t.sitePosition, c, planning)) this.stop(a);
        return true;
      }
      if (gap(a.position, t.sitePosition) > 3) {
        this.stop(a);
        return false;
      }
      if (t.elapsed < 1.26) return true;
      const id = durableId(held);
      site.workItem.storedIds ??= [];
      if (site.workItem.storedIds.includes(id)) {
        this.stop(a);
        return false;
      }
      site.workItem.storedIds.push(id);
      held.workItem.cachedIn = durableId(site);
      delete held.workItem.claimedBy;
      held.parentId = site.id;
      held.localOffsetX = held.localOffsetY = held.jumpZ = 0;
      held.flashHidden = true;
      held.position = { ...site.position };
      held.wz = site.wz ?? 0;
      delete t.heldId;
      delete t.targetId;
      t.deliveries++;
      site.workItem.units = site.workItem.storedIds.length;
      restoreWorkItemPose(site);
      this.stop(a, 6);
      return false;
    }
    if (t.cooldown) return false;
    if (planning && !planning.claim(a, false)) return false;
    for (const item of this.nearby(a)
      .filter((e) => e.workItem?.kind === "shiny" && !e.workItem.owner)
      .slice(0, 8)) {
      if (planning && !planning.candidate(a)) break;
      if (
        !item.workItem ||
        !c.ready(item.position, 96) ||
        !this.available(item) ||
        !this.supported(item, c)
      )
        continue;
      const cache = this.hoard(a, c, planning);
      if (
        cache?.workItem?.kind !== "hoard" ||
        cache.workItem.owner !== homeKey(a) ||
        !c.ready(cache.position, 96) ||
        !this.supported(cache, c) ||
        (cache.workItem.storedIds?.length ?? 0) >= 3
      )
        continue;
      for (const facing of [Direction.Right, Direction.Left, Direction.Up, Direction.Down]) {
        const p = this.contactPoint(a, item, "pickup", 6, facing, c),
          back = this.contactPoint(a, cache, "bury", 0, facing, c);
        if (!p || !back || gap(back, ai.home) > ai.radius || !this.go(a, p, c, planning)) continue;
        t.siteId = durableId(cache);
        t.sitePosition = back;
        t.returnPosition = { ...cache.position };
        t.targetId = durableId(item);
        t.sourcePosition = { ...item.position };
        t.facing = t.cacheFacing = facing;
        cache.workItem.claimedBy = item.workItem.claimedBy = durableId(a);
        this.enter(a, "seek");
        return true;
      }
    }
    t.cooldown = 3;
    return false;
  }
  update(a: Entity, dt: number, c: WorkContext, planning?: AiPlanningScheduler): boolean {
    const kind = kindOf(a),
      ai = native(a);
    if (!kind || !ai) return false;
    a.animalWork ??= fresh(kind);
    const t = a.animalWork;
    if (protectedActor(a)) {
      if (kind === "peacock") this.stopPair(a);
      else this.stop(a);
      return false;
    }
    const target = this.find(t.targetId),
      site = this.find(t.siteId),
      partner = this.find(t.partnerId);
    if (
      !c.ready(a.position, 96) ||
      (t.state !== "idle" &&
        ((target && !c.ready(target.position, 96)) ||
          (site && !c.ready(site.position, 96)) ||
          (partner && !c.ready(partner.position, 96)) ||
          (t.sitePosition && !c.ready(t.sitePosition, 96)) ||
          (t.sourcePosition && !c.ready(t.sourcePosition, 96))))
    ) {
      if (ai.motion) ai.motion.workPaused = true;
      if (a.velocity) a.velocity.vx = a.velocity.vy = 0;
      return true;
    }
    if (ai.motion) delete ai.motion.workPaused;
    if (!ai.motion && (!this.supported(a, c) || !c.environment.canOccupy(a, a.position))) {
      if (kind === "peacock") this.stopPair(a);
      else this.stop(a);
      return false;
    }
    if (kind === "deer") return this.deer(a, dt, c, planning);
    if (ai.alarmFrom || ["startle", "flee", "recover"].includes(ai.state)) {
      if (kind === "peacock") this.stopPair(a);
      else if (t.state !== "idle" || t.heldId) this.stop(a);
      return false;
    }
    return kind === "peacock" ? this.peacock(a, dt, c, planning) : this.raven(a, dt, c, planning);
  }
}
