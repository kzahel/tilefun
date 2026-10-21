import { Direction, type Entity, type PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import type { AnimalWork } from "./AnimalWork.js";
import { restoreAnimalWorkPose } from "./AnimalWorkPose.js";
import type { AnimalWorkSystem, WorkContext } from "./AnimalWorkSystem.js";
import { actionSocket } from "./BehaviorArt.js";
import { faunaProfile } from "./Fauna.js";
import {
  createForageItem,
  forageType,
  restoreWorkItemPose,
  sourceType,
} from "./ForageResources.js";
import { restoreFaunaPose } from "./faunaInteractions.js";
import { canopyLeafPoint, sameTree } from "./TreeClimbing.js";

const gap = (a: PositionComponent, b: PositionComponent) => Math.hypot(a.wx - b.wx, a.wy - b.wy);
const kindOf = (a: Entity) => {
  const species = faunaProfile(a.type)?.species;
  return species === "horse" || species === "giraffe" || species === "beaver" ? species : undefined;
};
export const isRangeWorker = (a: Entity) => !!kindOf(a);

/** Ground feeding, real canopy support and conserved branch construction. */
export class RangeWork {
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
      .filter(
        (e) =>
          gap(e.position, p) < 180 &&
          gap(e.position, a.fauna?.home ?? p) < (a.fauna?.radius ?? 0) + 48,
      )
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
      if (a.wanderAI) a.wanderAI.state = "idle";
      restoreFaunaPose(a);
    }
    restoreAnimalWorkPose(a);
  }
  private stop(a: Entity, cooldown = 3) {
    this.work.cancel(a, cooldown);
    const t = a.animalWork;
    if (t) {
      delete t.siteId;
      delete t.sitePosition;
      delete t.tree;
      delete t.facing;
    }
  }
  private available(e: Entity, c: WorkContext, owner?: Entity) {
    const item = e.workItem;
    if (!item || e.parentId !== undefined || !c.ready(e.position, 96)) return false;
    if (item.claimedBy && item.claimedBy !== owner?.persistentId) {
      const actor = this.find(item.claimedBy);
      if (
        actor?.animalWork &&
        [actor.animalWork.targetId, actor.animalWork.siteId, actor.animalWork.heldId].includes(
          e.persistentId,
        )
      )
        return false;
      delete item.claimedBy;
    }
    return true;
  }
  private supported(food: Entity, c: WorkContext) {
    const tree = food.workItem?.growth?.tree;
    if (food.type === sourceType("canopy-leaves"))
      return (
        !!tree &&
        c.ready(tree, 96) &&
        !!c.environment.climbTrees?.(tree, 64).some((x) => sameTree(x, tree)) &&
        gap(food.position, canopyLeafPoint(tree)) < 1 &&
        Math.abs((food.wz ?? 0) - tree.z) < 1
      );
    return (
      Math.abs((food.wz ?? 0) - (c.environment.surfaceZ?.(food.position) ?? 0)) <= 4 &&
      !c.environment.isWater(food.position)
    );
  }
  private point(a: Entity, food: Entity, action: string, facing: Direction, c: WorkContext) {
    const socket = actionSocket(a, action, -1, facing);
    if (!socket) return;
    const ground = c.environment.surfaceZ?.(food.position) ?? 0;
    const p = {
      wx: food.position.wx - (socket[0] ?? 0),
      wy: food.position.wy - (food.wz ?? 0) - (socket[1] ?? 0) + ground,
    };
    const z = c.environment.surfaceZ?.(p) ?? ground;
    return Math.abs(z - ground) <= 4 ? { ...p, z } : undefined;
  }
  private contact(a: Entity, food: Entity, action: string, c: WorkContext) {
    const point = this.point(a, food, action, a.animalWork?.facing ?? Direction.Right, c);
    return (
      this.supported(food, c) &&
      !!point &&
      gap(a.position, point) <= 3 &&
      Math.abs((a.wz ?? 0) - point.z) <= 4
    );
  }
  private approach(
    a: Entity,
    food: Entity,
    action: string,
    c: WorkContext,
    planning?: AiPlanningScheduler,
  ) {
    const t = a.animalWork,
      ai = a.fauna;
    if (!t || !ai || !this.supported(food, c)) return false;
    for (const facing of [Direction.Right, Direction.Left, Direction.Up, Direction.Down]) {
      const p = this.point(a, food, action, facing, c);
      if (!p || gap(p, ai.home) > ai.radius || !this.work.go(a, p, p.z, c, planning)) continue;
      t.sitePosition = p;
      t.facing = facing;
      return true;
    }
    return false;
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
    t.elapsed += dt;
    t.cooldown = Math.max(0, t.cooldown - dt);
    const food = this.find(t.targetId),
      site = this.find(t.siteId),
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
    if (
      [food, site].some(
        (e) =>
          e &&
          (!c.ready(e.position, 96) ||
            (e.workItem?.growth?.tree && !c.ready(e.workItem.growth.tree, 96))),
      )
    ) {
      t.elapsed = prior;
      if (ai.motion) ai.motion.workPaused = true;
      if (a.velocity) a.velocity.vx = a.velocity.vy = 0;
      return true;
    }
    if (ai.motion) delete ai.motion.workPaused;
    if (
      t.targetId &&
      (!food?.workItem ||
        food.parentId !== undefined ||
        food.workItem.claimedBy !== a.persistentId ||
        !this.supported(food, c))
    ) {
      this.stop(a);
      return false;
    }
    if (
      t.siteId &&
      (site?.workItem?.kind !== "lodge" ||
        site.workItem.claimedBy !== a.persistentId ||
        site.parentId !== undefined ||
        !this.supported(site, c))
    ) {
      this.stop(a);
      return false;
    }
    if (ai.motion) return t.state !== "idle";
    if (
      t.state === "raise" ||
      (t.state === "lower" && kind === "giraffe") ||
      t.state === "settle"
    ) {
      if (t.elapsed < (kind === "horse" ? 0.75 : kind === "giraffe" ? 1.2 : 1.5)) return true;
      this.stop(a, 4);
      return false;
    }
    if (kind === "beaver" && (t.state === "return" || t.state === "build")) {
      if (
        held?.workItem?.kind !== "twig" ||
        held.workItem.claimedBy !== a.persistentId ||
        held.parentId !== a.id ||
        !site?.workItem ||
        site.workItem.units >= 4
      ) {
        this.stop(a);
        return false;
      }
      if (t.state === "return") {
        const point = t.sitePosition;
        if (!point || t.elapsed > 30) {
          this.stop(a);
          return false;
        }
        if (gap(a.position, point) <= 1.5) this.enter(a, "build");
        else if (!this.work.go(a, point, point.z, c, planning)) this.stop(a);
        return true;
      }
      if (!this.contact(a, site, "build", c)) {
        this.stop(a);
        return false;
      }
      if (t.elapsed < 1.6) return true;
      delete t.heldId;
      this.manager.remove(held.id);
      site.workItem.units++;
      t.deliveries++;
      restoreWorkItemPose(site);
      this.enter(a, "settle");
      return true;
    }
    const action =
      kind === "giraffe"
        ? "browse"
        : kind === "beaver"
          ? "pickup"
          : food?.type === sourceType("spring-pool")
            ? "drink"
            : "graze";
    if (["lower", "reach", "graze", "drink", "browse", "pickup"].includes(t.state)) {
      if (!food?.workItem || !this.contact(a, food, action, c)) {
        this.stop(a);
        return false;
      }
      if (t.state === "lower" || t.state === "reach") {
        if (t.elapsed < (kind === "horse" ? 0.75 : 1.2)) return true;
        this.enter(a, action);
        return true;
      }
      if (t.elapsed < (kind === "beaver" ? 1 : kind === "horse" && action === "graze" ? 1.2 : 1.6))
        return true;
      const looseBranch = !food.workItem.growth && food.workItem.kind === "twig";
      if (!looseBranch && food.workItem.units <= 0) {
        this.stop(a);
        return false;
      }
      if (kind === "beaver") {
        if (!site || !this.contact(a, food, "pickup", c)) {
          this.stop(a);
          return false;
        }
        const branch = looseBranch ? food : createForageItem("twig", a.position.wx, a.position.wy);
        if (looseBranch) delete food.workItem.claimedBy;
        else {
          branch.wz = a.wz ?? 0;
          this.manager.spawn(branch);
        }
        if (!this.work.hold(a, branch)) {
          if (!looseBranch) this.manager.remove(branch.id);
          this.stop(a);
          return false;
        }
        if (!looseBranch) {
          food.workItem.units--;
          restoreWorkItemPose(food);
          delete food.workItem.claimedBy;
        }
        delete t.targetId;
        if (!this.approach(a, site, "build", c, planning)) {
          this.stop(a);
          return false;
        }
        this.enter(a, "return");
        return true;
      }
      food.workItem.units--;
      if (action === "drink") t.drunk = (t.drunk ?? 0) + 1;
      else t.eaten++;
      restoreWorkItemPose(food);
      this.enter(a, kind === "horse" ? "raise" : "lower");
      return true;
    }
    if (t.state === "idle" && t.cooldown) return false;
    if (planning && !planning.claim(a, false)) return t.state !== "idle";
    if (t.state === "seek") {
      const point = t.sitePosition;
      if (!point || !food || t.elapsed > 30) {
        this.stop(a);
        return false;
      }
      if (gap(a.position, point) <= 1.5)
        this.enter(a, kind === "horse" ? "lower" : kind === "giraffe" ? "reach" : "pickup");
      else if (!this.work.go(a, point, point.z, c, planning)) this.stop(a);
      return true;
    }
    const nearby = this.nearby(a);
    const lodge =
      kind === "beaver"
        ? nearby.find(
            (e) =>
              e.type === forageType("lodge") &&
              e.workItem &&
              e.workItem.units < 4 &&
              this.available(e, c, a) &&
              this.supported(e, c),
          )
        : undefined;
    if (kind === "beaver" && !lodge) {
      t.cooldown = 3;
      return false;
    }
    const wantsWater = t.eaten > (t.drunk ?? 0);
    const foods = nearby
      .filter(
        (e) =>
          this.available(e, c) &&
          this.supported(e, c) &&
          (kind === "giraffe"
            ? e.type === sourceType("canopy-leaves")
            : kind === "beaver"
              ? e.type === sourceType("branch-pile") || e.type === forageType("twig")
              : [sourceType("growing-plant"), sourceType("spring-pool")].includes(e.type)) &&
          (!e.workItem?.growth || e.workItem.units > 0),
      )
      .sort((x, y) =>
        kind === "horse"
          ? Number((y.type === sourceType("spring-pool")) === wantsWater) -
            Number((x.type === sourceType("spring-pool")) === wantsWater)
          : 0,
      );
    for (const resource of foods.slice(0, 8)) {
      if (planning && !planning.candidate(a)) break;
      const name =
        kind === "horse"
          ? resource.type === sourceType("spring-pool")
            ? "drink"
            : "graze"
          : kind === "giraffe"
            ? "browse"
            : "pickup";
      if (!this.approach(a, resource, name, c, planning)) continue;
      if (resource.workItem) resource.workItem.claimedBy = durableId(a);
      t.targetId = durableId(resource);
      if (lodge?.workItem) {
        lodge.workItem.claimedBy = durableId(a);
        t.siteId = durableId(lodge);
      }
      this.enter(a, "seek");
      return true;
    }
    t.cooldown = 2;
    return false;
  }
}
