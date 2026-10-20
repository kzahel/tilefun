import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { directionFromVelocity } from "../entities/wanderAI.js";
import { durableId } from "../persistence/ActorRecords.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import type { AnimalWork } from "./AnimalWork.js";
import { restoreAnimalWorkPose } from "./AnimalWorkPose.js";
import type { AnimalWorkSystem, WorkContext } from "./AnimalWorkSystem.js";
import { type FaunaBehavior, faunaProfile } from "./Fauna.js";
import { createForageItem, restoreWorkItemPose } from "./ForageResources.js";
import { restoreFaunaPose, settleFauna } from "./faunaInteractions.js";
import { type ClimbTree, sameTree, treeClimbPoint } from "./TreeClimbing.js";

const gap = (a: PositionComponent, b: PositionComponent) => Math.hypot(a.wx - b.wx, a.wy - b.wy);
const kindOf = (a: Entity) => {
  const p = faunaProfile(a.type);
  return p?.species === "capuchin-monkey"
    ? "capuchin"
    : p?.species === "raccoon"
      ? "raccoon"
      : p?.species === "cat" || p?.variantOf === "cat"
        ? "cat"
        : undefined;
};
export const isWoodlandWorker = (a: Entity) => !!kindOf(a);
/** One saved state machine for climbing, conserved cache theft and physical toy play. */
export class WoodlandWork {
  constructor(
    private manager: EntityManager,
    private work: AnimalWorkSystem,
  ) {}
  private find(id?: string) {
    return id ? this.manager.entities.find((e) => e.persistentId === id) : undefined;
  }
  private nearby(a: Entity) {
    const p = a.position;
    return this.manager.spatialHash
      .queryRange(
        Math.floor((p.wx - 160) / 256),
        Math.floor((p.wy - 160) / 256),
        Math.floor((p.wx + 160) / 256),
        Math.floor((p.wy + 160) / 256),
      )
      .filter((e) => gap(p, e.position) <= 160)
      .sort(
        (x, y) =>
          gap(x.position, p) - gap(y.position, p) || durableId(x).localeCompare(durableId(y)),
      );
  }
  private enter(a: Entity, state: AnimalWork["state"]) {
    const t = a.animalWork;
    if (!t) return;
    t.state = state;
    t.elapsed = 0;
    if (!a.fauna?.motion) {
      if (a.velocity) a.velocity.vx = a.velocity.vy = 0;
      if (
        a.wanderAI &&
        !a.fauna?.alarmFrom &&
        !["startle", "flee", "recover"].includes(a.fauna?.state ?? "")
      )
        a.wanderAI.state = "idle";
      if (a.sprite) a.sprite.moving = false;
    }
    if (!a.fauna?.motion) restoreFaunaPose(a);
    restoreAnimalWorkPose(a);
  }
  private face(a: Entity, p: PositionComponent) {
    if (!a.sprite) return;
    a.sprite.direction = directionFromVelocity(p.wx - a.position.wx, p.wy - a.position.wy);
    a.sprite.frameRow = a.sprite.direction;
    if (a.animalWork) a.animalWork.facing = a.sprite.direction;
  }
  private release(a: Entity) {
    const target = this.find(a.animalWork?.targetId);
    if (target?.workItem && target.workItem.claimedBy === a.persistentId)
      delete target.workItem.claimedBy;
    if (a.animalWork) delete a.animalWork.targetId;
  }
  private cancel(a: Entity, delay = 3) {
    this.release(a);
    this.work.drop(a);
    const t = a.animalWork;
    if (t) {
      delete t.tree;
      delete t.climbZ;
      delete t.climbFrom;
      t.cooldown = delay;
      this.enter(a, "idle");
    }
    if (!a.fauna?.alarmFrom) settleFauna(a);
  }
  private available(e: Entity, c: WorkContext) {
    const i = e.workItem;
    if (!i || e.parentId !== undefined || !c.ready(e.position, 24)) return false;
    if (i.claimedBy) {
      const owner = this.find(i.claimedBy);
      if (
        owner?.animalWork?.targetId === e.persistentId ||
        owner?.animalWork?.heldId === e.persistentId
      )
        return false;
      delete i.claimedBy;
    }
    return true;
  }
  private startClimb(a: Entity, tree: ClimbTree, down = false) {
    const t = a.animalWork;
    if (!t) return;
    t.tree = { ...tree };
    t.climbZ = a.wz ?? 0;
    t.climbFrom = { ...a.position, z: a.wz ?? 0 };
    this.face(a, { wx: tree.wx, wy: tree.wy });
    this.enter(a, down ? "descend" : "climb");
  }
  private supported(t: AnimalWork, c: WorkContext) {
    const support = t.tree;
    return (
      support && c.environment.climbTrees?.(support, 64).some((tree) => sameTree(tree, support))
    );
  }
  update(a: Entity, dt: number, c: WorkContext, planning?: AiPlanningScheduler): boolean {
    const kind = kindOf(a),
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
    const t = a.animalWork;
    const priorElapsed = t.elapsed;
    t.elapsed += dt;
    t.cooldown = Math.max(0, t.cooldown - dt);
    if (a.parentId !== undefined || a.wanderAI?.following || a.wanderAI?.state === "ridden") {
      this.cancel(a);
      return false;
    }
    if (t.tree && c.ready(t.tree, 64) && !this.supported(t, c)) {
      this.cancel(a);
      return false;
    }
    if (ai.alarmFrom || ["recover", "startle", "flee"].includes(ai.state)) {
      if (t.tree && t.climbZ !== undefined && (a.wz ?? 0) > t.tree.ground + 1) {
        this.release(a);
        this.work.drop(a);
        // Reverse from the actual attained height; no jump to the crown on alarm.
        if (t.state !== "descend") {
          t.climbFrom = { ...a.position, z: a.wz ?? 0 };
          this.enter(a, "descend");
        }
      } else {
        this.cancel(a);
        return false;
      }
    }
    if (t.tree && !c.ready(t.tree, 64)) {
      // Freeze the committed grip while adjacent support scopes are unavailable.
      t.elapsed = priorElapsed;
      if (a.velocity) a.velocity.vx = a.velocity.vy = 0;
      return true;
    }
    if (t.tree && t.climbZ !== undefined && t.state === "idle") {
      this.startClimb(a, t.tree, true);
      return true;
    }
    if (t.heldId) {
      const held = this.find(t.heldId);
      if (!held || held.parentId !== a.id || held.workItem?.claimedBy !== a.persistentId) {
        this.cancel(a);
        return false;
      }
    }
    if (["climb", "descend"].includes(t.state) && t.tree) {
      const down = t.state === "descend",
        duration = Math.max(1.5, (t.tree.z - t.tree.ground) / 8),
        f = Math.min(1, t.elapsed / duration);
      const normal = treeClimbPoint(t.tree, f, down);
      const from = t.climbFrom;
      const point =
        down && from && from.z < t.tree.z - 0.1
          ? {
              wx: from.wx + (t.tree.gripX - from.wx) * f,
              wy: from.wy + (t.tree.gripY - from.wy) * f,
              z: from.z + (t.tree.ground - from.z) * f,
            }
          : normal;
      if (
        !c.environment.canOccupy({ collider: a.collider, wz: point.z }, point) ||
        c.environment.isWater(point)
      ) {
        this.cancel(a);
        return false;
      }
      t.climbZ = point.z;
      a.wz = point.z;
      if (a.velocity) {
        a.velocity.vx = (point.wx - a.position.wx) / Math.max(dt, 0.001);
        a.velocity.vy = (point.wy - a.position.wy) / Math.max(dt, 0.001);
      }
      restoreAnimalWorkPose(a);
      if (f >= 1 && gap(a.position, point) < 1) {
        if (a.velocity) a.velocity.vx = a.velocity.vy = 0;
        if (down) {
          this.cancel(a, 10);
          return false;
        }
        this.enter(a, kind === "cat" ? "perch" : "pickup");
      }
      return true;
    }
    if (ai.motion) return t.state !== "idle";
    if (t.state === "idle" && t.cooldown) return false;
    if (t.elapsed > 35 && !["idle", "rest", "perch"].includes(t.state)) {
      if (t.tree && t.climbZ !== undefined) this.startClimb(a, t.tree, true);
      else this.cancel(a);
      return true;
    }
    const target = this.find(t.targetId);
    if (["rest", "perch"].includes(t.state)) {
      if (t.elapsed < (t.state === "perch" ? 6 : 3)) return true;
      if (t.tree) this.startClimb(a, t.tree, true);
      else {
        this.enter(a, "idle");
        t.cooldown = 0.5;
      }
      return true;
    }
    if (t.state === "eat") {
      if (t.elapsed < 2) return true;
      const held = this.find(t.heldId);
      if (held?.parentId === a.id) {
        delete t.heldId;
        this.manager.remove(held.id);
        t.eaten++;
      }
      this.enter(a, t.tree ? "perch" : "rest");
      return true;
    }
    if (t.state === "return" && t.sitePosition) {
      if (planning && !planning.claim(a, false)) return true;
      if (gap(a.position, t.sitePosition) < 10) this.enter(a, "eat");
      else if (!this.work.go(a, t.sitePosition, t.sitePosition.z, c, planning)) this.cancel(a);
      return true;
    }
    if (t.state === "pounce") {
      this.enter(a, "bat");
      return true;
    }
    if (t.state === "bat") {
      if (
        !target ||
        target.parentId !== undefined ||
        target.workItem?.claimedBy !== a.persistentId ||
        gap(a.position, target.position) > 28
      ) {
        this.cancel(a, 1);
        return false;
      }
      if (t.elapsed < 0.45) return true;
      let dx = target.position.wx - a.position.wx,
        dy = target.position.wy - a.position.wy;
      if (Math.hypot(dx, dy) < 1) {
        dx = a.sprite?.direction === 2 ? -1 : 1;
        dy = 0;
      }
      const d = Math.hypot(dx, dy);
      target.velocity = { vx: (dx / d) * 55, vy: (dy / d) * 55 };
      target.ballThrowerId = a.id;
      target.jumpVZ = 25;
      target.jumpZ = 0.1;
      target.wz = (a.wz ?? 0) + 0.1;
      t.played = (t.played ?? 0) + 1;
      this.release(a);
      this.enter(a, "rest");
      return true;
    }
    if (t.state === "pickup") {
      if (
        !target?.workItem ||
        target.workItem.claimedBy !== a.persistentId ||
        gap(a.position, target.position) > 18
      ) {
        this.cancel(a);
        return false;
      }
      this.face(a, target.position);
      if (t.elapsed < 1.1) return true;
      if (kind === "capuchin") {
        delete target.workItem.claimedBy;
        if (!this.work.hold(a, target)) {
          if (t.tree) this.startClimb(a, t.tree, true);
          else this.cancel(a);
          return true;
        }
        this.release(a);
        this.enter(a, "eat");
        return true;
      }
      const food = target.workItem.contents[0];
      if (!food) {
        this.cancel(a);
        return false;
      }
      const item = createForageItem(food, a.position.wx, a.position.wy);
      item.wz = a.wz ?? 0;
      this.manager.spawn(item);
      if (!this.work.hold(a, item)) {
        this.manager.remove(item.id);
        this.cancel(a);
        return false;
      }
      target.workItem.contents.shift();
      restoreWorkItemPose(target);
      t.stolen = (t.stolen ?? 0) + 1;
      this.release(a);
      this.enter(a, "return");
      return true;
    }
    if (planning && !planning.claim(a, false)) return t.state !== "idle";
    if (["seek", "stalk"].includes(t.state)) {
      if (kind === "cat" && t.tree && !t.targetId) {
        const grip = { wx: t.tree.gripX, wy: t.tree.gripY };
        if (gap(a.position, grip) < 1) this.startClimb(a, t.tree);
        else if (!this.work.go(a, grip, t.tree.ground, c, planning)) this.cancel(a);
        return true;
      }
      if (
        !target?.workItem ||
        target.workItem.claimedBy !== a.persistentId ||
        target.parentId !== undefined
      ) {
        this.cancel(a);
        return false;
      }
      if (kind === "capuchin" && t.tree) {
        const grip = { wx: t.tree.gripX, wy: t.tree.gripY };
        if (gap(a.position, grip) < 1) this.startClimb(a, t.tree);
        else if (!this.work.go(a, grip, t.tree.ground, c, planning)) this.cancel(a);
      } else if (kind === "raccoon") {
        if (gap(a.position, target.position) < 12) this.enter(a, "pickup");
        else if (!this.work.go(a, target.position, target.wz ?? 0, c, planning)) this.cancel(a);
      } else {
        this.face(a, target.position);
        const d = gap(a.position, target.position);
        if (d < 30) {
          const travel = Math.max(0, d - 10);
          const landing = {
            wx: a.position.wx + ((target.position.wx - a.position.wx) * travel) / Math.max(1, d),
            wy: a.position.wy + ((target.position.wy - a.position.wy) * travel) / Math.max(1, d),
          };
          if (this.work.go(a, landing, target.wz ?? 0, c, planning)) {
            const motion = (a.fauna as FaunaBehavior).motion;
            if (!motion) return false;
            motion.duration = Math.max(0.5, travel / 42);
            motion.workSpeed = 42;
            motion.startZ = a.wz ?? 0;
            motion.endZ = target.wz ?? 0;
            motion.lift = 6;
            this.enter(a, "pounce");
          } else this.cancel(a);
        } else {
          // Short deliberate stalks recheck a rolling toy, with a crouch pause.
          if (t.elapsed < 0.6) return true;
          const point = {
            wx: a.position.wx + (target.position.wx - a.position.wx) * Math.min(20 / d, 1),
            wy: a.position.wy + (target.position.wy - a.position.wy) * Math.min(20 / d, 1),
          };
          if (!this.work.go(a, point, target.wz ?? 0, c, planning)) this.cancel(a);
          else {
            const motion = (a.fauna as FaunaBehavior).motion;
            if (motion) motion.workSpeed = 8;
            t.elapsed = 0;
          }
        }
      }
      return true;
    }
    const trees = (c.environment.climbTrees?.(ai.home, ai.radius) ?? []).filter(
      (tree) => gap(tree, ai.home) < ai.radius && c.ready(tree, 64),
    );
    if (
      kind === "cat" &&
      (t.played ?? 0) > 0 &&
      (t.played ?? 0) % 3 === 0 &&
      t.deliveries !== t.played &&
      trees[0]
    ) {
      t.deliveries = t.played ?? 0;
      t.tree = { ...trees[0] };
      this.enter(a, "seek");
      return true;
    }
    for (const item of this.nearby(a).slice(0, 48)) {
      if (planning && !planning.candidate(a)) break;
      const w = item.workItem;
      if (
        !w ||
        !this.available(item, c) ||
        gap(item.position, ai.home) > ai.radius + (kind === "cat" ? 80 : 0)
      )
        continue;
      if (kind === "capuchin") {
        if (w.kind !== "fruit" || !w.growth?.tree || !w.units) continue;
        const support = w.growth.tree;
        const tree = trees.find((tree) => sameTree(tree, support));
        if (!tree) continue;
        t.tree = { ...tree };
      } else if (kind === "raccoon") {
        if (w.kind !== "cache" || !w.contents.length) continue;
        const cover = trees.find((tree) => gap(tree, a.position) < ai.radius);
        if (!cover) continue;
        t.sitePosition = {
          wx: cover.gripX + Math.max(0, (a.collider?.width ?? 12) / 2 - 7),
          wy: cover.gripY,
          z: cover.ground,
        };
      } else if (
        w.kind !== "ball" ||
        item.jumpVZ !== undefined ||
        Math.abs((item.wz ?? 0) - (a.wz ?? 0)) > 4
      )
        continue;
      w.claimedBy = durableId(a);
      t.targetId = durableId(item);
      this.enter(a, kind === "cat" ? "stalk" : "seek");
      return true;
    }
    t.cooldown = 1;
    return false;
  }
}
