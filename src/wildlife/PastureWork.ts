import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { directionFromVelocity } from "../entities/wanderAI.js";
import { durableId } from "../persistence/ActorRecords.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import type { AnimalWork } from "./AnimalWork.js";
import { restoreAnimalWorkPose } from "./AnimalWorkPose.js";
import type { AnimalWorkSystem, WorkContext } from "./AnimalWorkSystem.js";
import { actionSocket } from "./BehaviorArt.js";
import { type BrowsingRock, sameRock } from "./BrowsingRocks.js";
import { faunaProfile } from "./Fauna.js";
import { createForageItem, restoreWorkItemPose, sourceType } from "./ForageResources.js";
import { restoreFaunaPose, settleFauna } from "./faunaInteractions.js";
import { sameTree } from "./TreeClimbing.js";

const gap = (a: PositionComponent, b: PositionComponent) => Math.hypot(a.wx - b.wx, a.wy - b.wy);
const kindOf = (a: Entity) => {
  const species = faunaProfile(a.type)?.species;
  return species === "goat"
    ? "goat"
    : species === "piglet"
      ? "pig"
      : species === "elephant"
        ? "elephant"
        : undefined;
};
export const isPastureWorker = (a: Entity) => !!kindOf(a);

/** Finite browsing, rooting and trunk transfers through ordinary saved actors. */
export class PastureWork {
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
      .filter((e) => gap(e.position, p) < 180)
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
      restoreFaunaPose(a);
    }
    restoreAnimalWorkPose(a);
  }
  private face(a: Entity, p: PositionComponent, direction?: Direction) {
    if (!a.sprite || !a.animalWork) return;
    a.sprite.direction =
      direction ?? directionFromVelocity(p.wx - a.position.wx, p.wy - a.position.wy);
    a.sprite.frameRow = a.sprite.direction;
    a.animalWork.facing = a.sprite.direction;
  }
  private release(a: Entity) {
    const target = this.find(a.animalWork?.targetId);
    if (target?.workItem && target.workItem.claimedBy === a.persistentId)
      delete target.workItem.claimedBy;
    if (a.animalWork) delete a.animalWork.targetId;
  }
  private cancel(a: Entity, cooldown = 3) {
    this.release(a);
    this.work.drop(a);
    const t = a.animalWork;
    if (t) {
      delete t.rock;
      delete t.tree;
      delete t.sitePosition;
      delete t.returnPosition;
      delete t.hopDown;
      this.enter(a, "idle");
      t.cooldown = cooldown;
    }
    if (!a.fauna?.alarmFrom && !["flee", "startle", "recover"].includes(a.fauna?.state ?? ""))
      settleFauna(a);
  }
  private available(e: Entity, c: WorkContext) {
    const item = e.workItem;
    if (
      !item ||
      e.parentId !== undefined ||
      !c.ready(e.position, 32) ||
      (item.growth && item.units <= 0)
    )
      return false;
    if (item.claimedBy) {
      const owner = this.find(item.claimedBy);
      if (
        owner?.animalWork?.targetId === e.persistentId ||
        owner?.animalWork?.heldId === e.persistentId
      )
        return false;
      delete item.claimedBy;
    }
    return true;
  }
  private rockSupported(rock: BrowsingRock, c: WorkContext) {
    return c.environment.browsingRocks?.(rock, 24).some((r) => sameRock(r, rock));
  }
  private hop(
    a: Entity,
    point: PositionComponent,
    endZ: number,
    down: boolean,
    c: WorkContext,
    planning?: AiPlanningScheduler,
  ) {
    const ai = a.fauna,
      t = a.animalWork,
      startZ = a.wz ?? 0,
      distance = gap(a.position, point);
    if (!ai || !t || distance > 64 || !c.ready(point, 32) || (planning && !planning.path(a, 24)))
      return false;
    for (let i = 1; i <= 24; i++) {
      const f = i / 24,
        pos = {
          wx: a.position.wx + (point.wx - a.position.wx) * f,
          wy: a.position.wy + (point.wy - a.position.wy) * f,
        };
      const z = startZ + (endZ - startZ) * f + Math.sin(Math.PI * f) * 14;
      if (
        !c.ready(pos, 24) ||
        c.environment.isWater(pos) ||
        !c.environment.canOccupy({ collider: a.collider, wz: z }, pos)
      )
        return false;
    }
    ai.target = { ...point };
    ai.state = "travel";
    delete ai.actionElapsed;
    ai.motion = {
      elapsed: 0,
      duration: 0.9,
      escaping: false,
      startZ,
      endZ,
      lift: 14,
      workSpeed: distance / 0.9,
    };
    t.hopDown = down;
    this.face(a, point);
    this.enter(a, "hop");
    if (a.wanderAI) a.wanderAI.state = "walking";
    return true;
  }
  private chooseRock(a: Entity, c: WorkContext, planning?: AiPlanningScheduler) {
    const t = a.animalWork,
      ai = a.fauna;
    if (!t || !ai) return false;
    const rocks = [...(c.environment.browsingRocks?.(ai.home, ai.radius) ?? [])].sort(
      (x, y) => gap(a.position, x) - gap(a.position, y) || x.id.localeCompare(y.id),
    );
    for (const rock of rocks.slice(0, 6)) {
      if (planning && !planning.candidate(a)) break;
      if (gap(rock, ai.home) > ai.radius || !c.ready(rock, 64)) continue;
      for (const sign of [1, -1]) {
        const point = {
          wx: rock.wx + sign * (rock.width / 2 + (a.collider?.width ?? 20) / 2 + 8),
          wy: rock.wy,
        };
        if (this.work.go(a, point, rock.ground, c, planning)) {
          t.rock = { ...rock };
          t.returnPosition = { ...point };
          t.sitePosition = { ...point, z: rock.ground };
          this.enter(a, "seek");
          return true;
        }
      }
    }
    return false;
  }
  /** A portion becomes one actual held item, only after attachment succeeds. */
  private take(a: Entity, source: Entity) {
    const t = a.animalWork,
      item = source.workItem;
    if (!t || !item || item.claimedBy !== a.persistentId) return false;
    if (item.growth) {
      const food = item.growth.food;
      if (item.units <= 0 || (food !== "fruit" && food !== "root")) return false;
      const loose = createForageItem(food, a.position.wx, a.position.wy);
      loose.wz = a.wz ?? 0;
      this.manager.spawn(loose);
      if (!this.work.hold(a, loose)) {
        this.manager.remove(loose.id);
        return false;
      }
      item.units--;
      restoreWorkItemPose(source);
    } else {
      delete item.claimedBy;
      if (!this.work.hold(a, source)) return false;
    }
    if (t.kind === "pig") t.uncovered = (t.uncovered ?? 0) + 1;
    else t.harvested = (t.harvested ?? 0) + 1;
    return true;
  }
  private shake(a: Entity, source: Entity, c: WorkContext) {
    const t = a.animalWork,
      item = source.workItem,
      tree = item?.growth?.tree;
    if (!t || !item || !tree || item.claimedBy !== a.persistentId) return;
    let released = 0;
    for (const [dx, dy] of [
      [28, 24],
      [-28, 24],
      [28, -12],
      [-28, -12],
    ]) {
      if (released >= 2 || item.units <= 0) break;
      const point = { wx: tree.wx + (dx ?? 0), wy: tree.wy + (dy ?? 0) },
        fruit = createForageItem("fruit", point.wx, point.wy);
      fruit.wz = c.environment.surfaceZ?.(point) ?? tree.ground;
      if (
        !c.ready(point, 24) ||
        c.environment.isWater(point) ||
        !c.environment.canOccupy(fruit, point)
      )
        continue;
      this.manager.spawn(fruit);
      item.units--;
      released++;
    }
    t.shaken = (t.shaken ?? 0) + released;
    restoreWorkItemPose(source);
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
    const t = a.animalWork,
      prior = t.elapsed;
    if (t.state === "idle" && !t.heldId) {
      delete t.tree;
      delete t.rock;
      delete t.sitePosition;
    }
    t.elapsed += dt;
    t.cooldown = Math.max(0, t.cooldown - dt);
    const target = this.find(t.targetId),
      held = this.find(t.heldId);
    if (a.parentId !== undefined || a.wanderAI?.following || a.wanderAI?.state === "ridden") {
      this.cancel(a);
      return false;
    }
    const scope = t.rock ?? t.tree ?? target?.position;
    if (scope && !c.ready(scope, 64)) {
      t.elapsed = prior;
      if (ai.motion) ai.motion.workPaused = true;
      if (a.velocity) a.velocity.vx = a.velocity.vy = 0;
      return true;
    }
    if (ai.motion) delete ai.motion.workPaused;
    if (t.rock && !this.rockSupported(t.rock, c)) {
      if (ai.motion && t.state === "hop") {
        // Removed support turns the committed landing into a normal ground landing.
        const ground = c.environment.surfaceZ?.(ai.target) ?? 0;
        if (ai.motion.endZ !== ground) {
          // A late deletion still needs a short descent, rather than squeezing
          // the missing platform's height into the final fraction of a frame.
          const remaining = Math.max(0.45, ai.motion.duration - ai.motion.elapsed);
          ai.motion.duration = ai.motion.elapsed + remaining;
          ai.motion.workSpeed = gap(a.position, ai.target) / remaining;
          const f = Math.min(0.999, ai.motion.elapsed / ai.motion.duration);
          ai.motion.startZ =
            ((a.wz ?? 0) - ground * f - Math.sin(Math.PI * f) * (ai.motion.lift ?? 0)) / (1 - f);
          ai.motion.endZ = ground;
        }
        t.hopDown = true;
      } else {
        this.cancel(a);
        return false;
      }
    }
    const tree = t.tree;
    if (tree && !c.environment.climbTrees?.(tree, 64).some((r) => sameTree(r, tree))) {
      this.cancel(a);
      return false;
    }
    const alarm = ai.alarmFrom || ["startle", "flee", "recover"].includes(ai.state);
    if (alarm) {
      if (t.state === "hop" && ai.motion) return true;
      if (t.rock && (a.wz ?? 0) > t.rock.ground + 1 && t.returnPosition) {
        if (planning && !planning.claim(a, true)) return true;
        if (this.hop(a, t.returnPosition, t.rock.ground, true, c, planning)) return true;
      }
      this.cancel(a);
      return false;
    }
    if (ai.motion) return t.state !== "idle";
    if (t.state === "hop") {
      if (!t.rock || t.hopDown) {
        this.cancel(a, 8);
        return false;
      }
      if (gap(a.position, t.rock) > 3 || Math.abs((a.wz ?? 0) - t.rock.z) > 1) {
        this.cancel(a);
        return false;
      }
      t.hops = (t.hops ?? 0) + 1;
      this.enter(a, "perch");
      return true;
    }
    if (t.state === "perch") {
      if (t.elapsed < 2) return true;
      if (planning && !planning.claim(a, false)) return true;
      if (
        !t.rock ||
        !t.returnPosition ||
        !this.hop(a, t.returnPosition, t.rock.ground, true, c, planning)
      )
        this.cancel(a);
      return true;
    }
    if (t.state === "rest") {
      if (t.elapsed < 3) return true;
      this.cancel(a, 0.5);
      return false;
    }
    if (t.state === "eat" || t.state === "curl" || t.state === "pickup") {
      if (!held || held.parentId !== a.id || held.workItem?.claimedBy !== a.persistentId) {
        this.cancel(a);
        return false;
      }
      if (t.state !== "eat") {
        if (t.elapsed < (t.state === "curl" ? 1.5 : 0.7)) return true;
        this.enter(a, "eat");
        return true;
      }
      if (t.elapsed < 1.6) return true;
      delete t.heldId;
      this.manager.remove(held.id);
      t.eaten++;
      this.release(a);
      delete t.tree;
      this.enter(a, "rest");
      return true;
    }
    if (t.state === "lower") {
      if (t.elapsed < 0.6) return true;
      this.release(a);
      this.enter(a, "rest");
      return true;
    }
    if (["rear", "browse", "sniff", "root", "reach", "shake"].includes(t.state)) {
      if (
        !target?.workItem ||
        target.workItem.claimedBy !== a.persistentId ||
        target.parentId !== undefined ||
        gap(a.position, t.returnPosition ?? target.position) > 3
      ) {
        this.cancel(a);
        return false;
      }
      if (t.state === "rear" || t.state === "sniff") {
        if (t.elapsed < (t.state === "rear" ? 0.6 : 0.8)) return true;
        this.enter(a, t.state === "rear" ? "browse" : "root");
        return true;
      }
      if (t.elapsed < (t.state === "browse" ? 1.2 : 1.5)) return true;
      if (t.state === "browse") {
        if (target.workItem.units <= 0) {
          this.cancel(a);
          return false;
        }
        target.workItem.units--;
        restoreWorkItemPose(target);
        t.eaten++;
        this.enter(a, "lower");
        return true;
      }
      if (t.state === "shake") {
        this.shake(a, target, c);
        this.release(a);
        delete t.tree;
        this.enter(a, "rest");
        return true;
      }
      if (!this.take(a, target)) {
        this.cancel(a);
        return false;
      }
      this.enter(a, kind === "elephant" ? "curl" : "pickup");
      return true;
    }
    if (t.state === "idle" && (t.cooldown || ai.motion)) return false;
    if (planning && !planning.claim(a, false)) return t.state !== "idle";
    if (t.state === "seek") {
      const point = t.sitePosition;
      if (
        !point ||
        t.elapsed > 30 ||
        (!t.rock && (!target?.workItem || target.workItem.claimedBy !== a.persistentId))
      ) {
        this.cancel(a);
        return false;
      }
      if (gap(point, a.position) <= 1.5) {
        if (t.rock) {
          if (!this.hop(a, t.rock, t.rock.z, false, c, planning)) this.cancel(a);
        } else if (target) {
          this.face(a, target.position, t.facing as Direction);
          this.enter(
            a,
            kind === "goat"
              ? "rear"
              : kind === "pig"
                ? "sniff"
                : (t.harvested ?? 0) > (t.shaken ?? 0)
                  ? "shake"
                  : "reach",
          );
        }
      } else if (!this.work.go(a, point, point.z, c, planning)) this.cancel(a);
      return true;
    }
    if (kind === "goat" && t.eaten > (t.hops ?? 0) && this.chooseRock(a, c, planning)) return true;
    const foods = this.nearby(a).filter(
      (e) =>
        this.available(e, c) &&
        gap(e.position, ai.home) < ai.radius + 48 &&
        (kind === "goat"
          ? e.type === sourceType("browse-shrub")
          : kind === "pig"
            ? e.type === sourceType("root-patch") ||
              (!e.workItem?.growth && e.workItem?.kind === "root")
            : e.type === sourceType("fruit-tree") && !!e.workItem?.growth?.tree),
    );
    for (const food of foods.slice(0, 8)) {
      if (planning && !planning.candidate(a)) break;
      const ground = c.environment.surfaceZ?.(food.position) ?? 0;
      if (kind !== "elephant" && Math.abs((food.wz ?? 0) - ground) > 4) continue;
      const directions = [Direction.Right, Direction.Left, Direction.Up, Direction.Down];
      for (const direction of directions) {
        const socket = kind === "elephant" ? actionSocket(a, "reach", -1, direction) : undefined;
        const point = socket
          ? {
              wx: food.position.wx - (socket[0] ?? 0),
              wy: food.position.wy - (food.wz ?? 0) - (socket[1] ?? 0) + ground,
            }
          : {
              wx:
                food.position.wx +
                (direction === Direction.Right ? -14 : direction === Direction.Left ? 14 : 0),
              wy:
                food.position.wy +
                (direction === Direction.Up ? 14 : direction === Direction.Down ? -14 : 0),
            };
        if (kind === "elephant" && !socket) continue;
        if (!this.work.go(a, point, ground, c, planning)) continue;
        if (food.workItem) food.workItem.claimedBy = durableId(a);
        t.targetId = durableId(food);
        t.returnPosition = { ...point };
        t.sitePosition = { ...point, z: ground };
        t.facing = direction;
        if (kind === "elephant" && food.workItem?.growth?.tree)
          t.tree = { ...food.workItem.growth.tree };
        this.enter(a, "seek");
        return true;
      }
    }
    if (kind === "goat" && !(t.hops ?? 0) && this.chooseRock(a, c, planning)) return true;
    t.cooldown = 2;
    return false;
  }
}
