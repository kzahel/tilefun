import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { durableId } from "../persistence/ActorRecords.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import { gap } from "../shared/gap.js";
import type { AnimalWorkSystem, WorkContext } from "./AnimalWorkSystem.js";
import { actionSocket } from "./BehaviorArt.js";
import { faunaProfile } from "./Fauna.js";
import { forageType, restoreWorkItemPose, sourceType } from "./ForageResources.js";
import {
  enterFaunaWork,
  faceToward,
  freshWork,
  groundSupported,
  protectedActor,
  WorkKit,
} from "./WorkKit.js";

const kindOf = (a: Entity) => {
  const species = faunaProfile(a.type)?.species;
  return species === "cow" || species === "sheep" || species === "donkey" ? species : undefined;
};
export const isHerdWorker = (a: Entity) => !!kindOf(a);
const supported = (e: Entity, c: WorkContext) => groundSupported(e, c, 4);

/** Paid rumination, local flock reunions and supported dust baths in ordinary authority. */
export class HerdWork {
  private readonly kit: WorkKit;
  constructor(
    manager: EntityManager,
    private readonly work: AnimalWorkSystem,
  ) {
    this.kit = new WorkKit(manager);
  }
  private nearby(a: Entity) {
    return this.kit.nearest(a.position, 180, (e) => e !== a && gap(e.position, a.position) < 180);
  }
  private stop(a: Entity, cooldown = 3) {
    this.work.cancel(a, cooldown);
    if (a.animalWork) {
      delete a.animalWork.sitePosition;
      delete a.animalWork.facing;
    }
  }
  private clearBath(a: Entity, site: Entity, c: WorkContext) {
    const z = site.wz ?? 0;
    return (
      supported(site, c) &&
      [-20, 0, 20].every((x) =>
        [-20, 0, 20].every((y) => {
          const p = { wx: site.position.wx + x, wy: site.position.wy + y };
          return !c.environment.isWater(p) && Math.abs((c.environment.surfaceZ?.(p) ?? 0) - z) <= 2;
        }),
      ) &&
      c.environment.canOccupy(
        {
          ...a,
          wz: z,
          collider: a.collider ? { ...a.collider, width: 40, height: 40 } : a.collider,
        },
        site.position,
      )
    );
  }
  private eligiblePeer(a: Entity, e: Entity, c: WorkContext) {
    return (
      e !== a &&
      kindOf(e) === "sheep" &&
      !!e.fauna &&
      !protectedActor(e) &&
      !e.fauna.alarmFrom &&
      !["startle", "flee", "recover"].includes(e.fauna.state) &&
      Math.abs((e.wz ?? 0) - (a.wz ?? 0)) <= 4 &&
      c.ready(e.position, 96) &&
      (a.fauna?.groupId
        ? e.fauna.groupId === a.fauna.groupId
        : !e.fauna.groupId && gap(e.fauna.home, a.fauna?.home ?? a.position) < 144)
    );
  }
  private peers(a: Entity, c: WorkContext) {
    return this.nearby(a)
      .filter((e) => this.eligiblePeer(a, e, c))
      .slice(0, 8);
  }
  private center(peers: Entity[]) {
    return {
      wx: peers.reduce((sum, e) => sum + e.position.wx, 0) / peers.length,
      wy: peers.reduce((sum, e) => sum + e.position.wy, 0) / peers.length,
    };
  }
  private foodPoint(a: Entity, food: Entity, facing: Direction, c: WorkContext) {
    const socket = actionSocket(a, "graze", -1, facing);
    if (!socket) return;
    const z = c.environment.surfaceZ?.(food.position) ?? 0;
    const p = {
      wx: food.position.wx - (socket[0] ?? 0),
      wy: food.position.wy - (food.wz ?? 0) - (socket[1] ?? 0) + z,
    };
    return Math.abs((c.environment.surfaceZ?.(p) ?? z) - z) <= 4 ? { ...p, z } : undefined;
  }
  private available(e: Entity) {
    const owner = this.kit.find(e.workItem?.claimedBy);
    if (owner && owner.animalWork?.targetId === e.persistentId) return false;
    if (e.workItem) delete e.workItem.claimedBy;
    return !!e.workItem && e.parentId === undefined;
  }
  private startSource(a: Entity, c: WorkContext, planning?: AiPlanningScheduler) {
    const t = a.animalWork,
      ai = a.fauna;
    if (!t || !ai) return false;
    const cow = t.kind === "cow";
    for (const food of this.nearby(a)
      .filter((e) =>
        cow
          ? e.type === sourceType("growing-plant") && (e.workItem?.units ?? 0) > 0
          : e.workItem?.kind === "dust",
      )
      .slice(0, 8)) {
      if (planning && !planning.candidate(a)) break;
      if (
        !this.available(food) ||
        !supported(food, c) ||
        !c.ready(food.position, 96) ||
        (!cow && !this.clearBath(a, food, c))
      )
        continue;
      for (const facing of [Direction.Right, Direction.Left, Direction.Up, Direction.Down]) {
        const p = cow ? this.foodPoint(a, food, facing, c) : { ...food.position, z: food.wz ?? 0 };
        if (!p || gap(p, ai.home) > ai.radius || !this.work.go(a, p, p.z, c, planning)) continue;
        t.targetId = durableId(food);
        if (food.workItem) food.workItem.claimedBy = durableId(a);
        t.sitePosition = p;
        t.facing = cow ? facing : (a.sprite?.direction ?? facing);
        enterFaunaWork(a, "seek");
        return true;
      }
    }
    t.cooldown = 3;
    return false;
  }
  private flock(a: Entity, c: WorkContext, planning?: AiPlanningScheduler) {
    const t = a.animalWork,
      ai = a.fauna;
    if (!t || !ai) return false;
    const peers = this.peers(a, c),
      leader = peers[0];
    if (!leader) {
      this.stop(a);
      return false;
    }
    const center = this.center(peers),
      distance = gap(a.position, center);
    if (t.state === "bleat") {
      if (distance > 64) {
        this.stop(a);
        return false;
      }
      faceToward(a, center);
      if (t.elapsed < 1.2) return true;
      t.regrouped = (t.regrouped ?? 0) + 1;
      this.stop(a, 8);
      return false;
    }
    if (t.state === "seek" && distance <= 56) {
      faceToward(a, center);
      enterFaunaWork(a, "bleat");
      return true;
    }
    if (distance <= 56 || t.elapsed > 20) {
      this.stop(a);
      return false;
    }
    const p = {
      wx: center.wx + ((a.position.wx - center.wx) * 44) / distance,
      wy: center.wy + ((a.position.wy - center.wy) * 44) / distance,
    };
    const z = c.environment.surfaceZ?.(p) ?? 0;
    if (gap(p, ai.home) > ai.radius || !this.work.go(a, p, z, c, planning)) {
      this.stop(a);
      return false;
    }
    t.targetId = durableId(leader);
    t.sitePosition = { ...p, z };
    if (t.state !== "seek") enterFaunaWork(a, "seek");
    return true;
  }
  update(a: Entity, dt: number, c: WorkContext, planning?: AiPlanningScheduler): boolean {
    const kind = kindOf(a),
      ai = a.fauna;
    if (!kind || !ai) return false;
    a.animalWork ??= freshWork(kind);
    const t = a.animalWork;
    if (protectedActor(a) || ai.alarmFrom || ["startle", "flee", "recover"].includes(ai.state)) {
      if (t.state !== "idle" || t.targetId) this.stop(a);
      return false;
    }
    const source = this.kit.find(t.targetId);
    if (
      !c.ready(a.position, 96) ||
      (t.sitePosition && !c.ready(t.sitePosition, 96)) ||
      (source && !c.ready(source.position, 96))
    ) {
      if (ai.motion) ai.motion.workPaused = true;
      a.motionIntent = { vx: 0, vy: 0 };
      return true;
    }
    if (ai.motion) delete ai.motion.workPaused;
    t.elapsed += dt;
    t.cooldown = Math.max(0, t.cooldown - dt);
    if (!supported(a, c)) {
      this.stop(a);
      return false;
    }
    if (t.targetId) {
      const valid =
        kind === "sheep"
          ? !!source && this.eligiblePeer(a, source, c)
          : !!source?.workItem &&
            source.parentId === undefined &&
            source.workItem.claimedBy === a.persistentId &&
            supported(source, c) &&
            (kind !== "donkey" || this.clearBath(a, source, c)) &&
            (kind === "cow"
              ? source.type === sourceType("growing-plant")
              : source.type === forageType("dust") && source.workItem.kind === "dust") &&
            (kind !== "donkey" || (!!t.sitePosition && gap(source.position, t.sitePosition) < 1));
      if (!valid) {
        this.stop(a);
        return false;
      }
    }
    if (ai.motion) return t.state !== "idle";
    if (t.state === "stand") {
      if (t.elapsed < 1.2) return true;
      this.stop(a, kind === "donkey" ? 25 : 8);
      return false;
    }
    if (kind === "cow" && ["raise", "lie", "ruminate"].includes(t.state)) {
      if (t.eaten <= (t.ruminated ?? 0)) {
        this.stop(a);
        return false;
      }
      if (t.elapsed < (t.state === "raise" ? 0.75 : t.state === "lie" ? 1.2 : 4.8)) return true;
      if (t.state === "ruminate") {
        t.ruminated = (t.ruminated ?? 0) + 1;
        enterFaunaWork(a, "stand");
      } else enterFaunaWork(a, t.state === "raise" ? "lie" : "ruminate");
      return true;
    }
    if (kind === "donkey" && (t.state === "lie" || t.state === "roll")) {
      if (!source?.workItem || !t.sitePosition || gap(a.position, t.sitePosition) > 2) {
        this.stop(a);
        return false;
      }
      if (t.elapsed < (t.state === "lie" ? 1.2 : 3.6)) return true;
      if (t.state === "lie") enterFaunaWork(a, "roll");
      else {
        source.workItem.units = Math.min(3, source.workItem.units + 1);
        restoreWorkItemPose(source);
        t.dustBaths = (t.dustBaths ?? 0) + 1;
        enterFaunaWork(a, "stand");
      }
      return true;
    }
    if (kind === "cow" && (t.state === "lower" || t.state === "graze")) {
      const p = source && this.foodPoint(a, source, t.facing ?? Direction.Right, c);
      if (!p || gap(a.position, p) > 3 || (source?.workItem?.units ?? 0) <= 0) {
        this.stop(a);
        return false;
      }
      if (t.elapsed < (t.state === "lower" ? 0.75 : 1.2)) return true;
      if (t.state === "lower") enterFaunaWork(a, "graze");
      else {
        if (source?.workItem) {
          source.workItem.units--;
          delete source.workItem.claimedBy;
          restoreWorkItemPose(source);
        }
        delete t.targetId;
        delete t.sitePosition;
        t.eaten++;
        enterFaunaWork(a, "raise");
      }
      return true;
    }
    if (t.state === "idle" && t.cooldown) return false;
    if (planning && !planning.claim(a, false)) return t.state !== "idle";
    if (kind === "sheep") return this.flock(a, c, planning);
    if (kind === "cow" && t.state === "idle" && t.eaten > (t.ruminated ?? 0)) {
      enterFaunaWork(a, "lie");
      return true;
    }
    if (t.state === "seek") {
      const p = t.sitePosition;
      if (!p || !source || t.elapsed > 20) {
        this.stop(a);
        return false;
      }
      if (gap(a.position, p) <= 1.5) enterFaunaWork(a, kind === "cow" ? "lower" : "lie");
      else if (!this.work.go(a, p, p.z, c, planning)) this.stop(a);
      return true;
    }
    return this.startSource(a, c, planning);
  }
}
