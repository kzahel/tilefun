import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { directionFromVelocity } from "../entities/wanderAI.js";
import { durableId } from "../persistence/ActorRecords.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import type { AnimalWork } from "./AnimalWork.js";
import { restoreAnimalWorkPose } from "./AnimalWorkPose.js";
import type { WorkContext } from "./AnimalWorkSystem.js";
import { faunaProfile } from "./Fauna.js";
import { canEat } from "./FoodWeb.js";
import { restoreWorkItemPose } from "./ForageResources.js";
import { restoreFaunaPose, startleFauna } from "./faunaInteractions.js";
import { restoreRabbitPose, startleRabbit } from "./rabbitInteractions.js";
import { restoreRobinPose, robinMotionZ, startleRobin } from "./robinInteractions.js";

const gap = (a: PositionComponent, b: PositionComponent) => Math.hypot(a.wx - b.wx, a.wy - b.wy);
const kindOf = (a: Entity) =>
  a.rabbit
    ? "rabbit"
    : a.robin
      ? "robin"
      : faunaProfile(a.type)?.species === "meerkat"
        ? "meerkat"
        : undefined;
export const isMeadowWorker = (a: Entity) => !!kindOf(a);
const moving = (a: Entity) => !!(a.rabbit?.hop || a.robin?.motion || a.fauna?.motion);
const native = (a: Entity) => a.rabbit ?? a.robin ?? a.fauna;
const face = (a: Entity, p: PositionComponent) => {
  if (!a.sprite) return;
  a.sprite.direction = directionFromVelocity(p.wx - a.position.wx, p.wy - a.position.wy);
  a.sprite.frameRow = a.sprite.direction;
  if (a.animalWork) a.animalWork.facing = a.sprite.direction;
};

/** Finite feeding and lookout duties use the same saved work component as carrying. */
export class MeadowWork {
  constructor(private readonly manager: EntityManager) {}
  private nearby(a: Entity, radius: number) {
    return this.manager.spatialHash
      .queryRange(
        Math.floor((a.position.wx - radius) / 256),
        Math.floor((a.position.wy - radius) / 256),
        Math.floor((a.position.wx + radius) / 256),
        Math.floor((a.position.wy + radius) / 256),
      )
      .filter((e) => gap(e.position, a.position) <= radius);
  }
  private find(id?: string) {
    return id ? this.manager.entities.find((e) => e.persistentId === id) : undefined;
  }
  private availableFood(item: Entity, context: WorkContext): boolean {
    const food = item.workItem;
    if (!food || item.parentId !== undefined) return false;
    if (!food.claimedBy) return true;
    const owner = this.find(food.claimedBy);
    const task = owner?.animalWork;
    if (
      item.persistentId &&
      (task?.targetId === item.persistentId || task?.heldId === item.persistentId)
    )
      return false;
    // Unparented food is a provisional reservation, not carried inventory.
    // Eviction can outlive a cancelled task; a returning owner revalidates it.
    if (!context.ready(item.position, 16)) return false;
    delete food.claimedBy;
    return true;
  }
  private enter(a: Entity, state: AnimalWork["state"]) {
    if (!a.animalWork) return;
    a.animalWork.state = state;
    a.animalWork.elapsed = 0;
    if (!moving(a)) {
      if (a.velocity) a.velocity.vx = a.velocity.vy = 0;
      if (
        a.wanderAI &&
        !native(a)?.alarmFrom &&
        !["recover", "startle", "flee"].includes(native(a)?.state ?? "")
      )
        a.wanderAI.state = "idle";
      if (a.sprite) a.sprite.moving = false;
    }
    restoreAnimalWorkPose(a);
  }
  private release(a: Entity) {
    const target = this.find(a.animalWork?.targetId);
    if (target?.workItem && target.workItem.claimedBy === a.persistentId)
      delete target.workItem.claimedBy;
    if (a.animalWork) delete a.animalWork.targetId;
  }
  private cancel(a: Entity, delay = 3) {
    this.release(a);
    const task = a.animalWork;
    if (!task) return;
    this.enter(a, "idle");
    task.cooldown = delay;
    delete task.threat;
    if (a.rabbit) restoreRabbitPose(a);
    else if (a.robin) restoreRobinPose(a);
    else restoreFaunaPose(a);
  }
  private peers(a: Entity) {
    return this.nearby(a, 160).filter(
      (e) =>
        faunaProfile(e.type)?.species === "meerkat" &&
        e.fauna &&
        gap(e.position, a.position) < 160 &&
        (a.fauna?.groupId
          ? e.fauna.groupId === a.fauna.groupId
          : !e.fauna.groupId && gap(e.fauna.home, a.fauna?.home ?? a.position) < 144),
    );
  }
  private go(
    a: Entity,
    point: PositionComponent,
    z: number,
    c: WorkContext,
    planning?: AiPlanningScheduler,
  ): boolean {
    const ai = native(a);
    if (!ai || !c.ready(a.position, 16) || !c.ready(point, 16) || gap(point, ai.home) > ai.radius)
      return false;
    const distance = gap(a.position, point),
      startZ = a.wz ?? 0;
    // Rabbits keep their native one-second hop and short stride, never one giant slide.
    const length = a.rabbit ? Math.min(28, distance) : distance;
    const end = {
      wx: a.position.wx + ((point.wx - a.position.wx) * length) / Math.max(0.001, distance),
      wy: a.position.wy + ((point.wy - a.position.wy) * length) / Math.max(0.001, distance),
    };
    const endZ = a.robin ? z : (c.environment.surfaceZ?.(end) ?? 0);
    const samples = Math.max(1, Math.ceil(length / 3));
    if (samples > 96 || (planning && !planning.path(a, samples))) return false;
    for (let i = 1; i <= samples; i++) {
      const t = i / samples,
        pos = {
          wx: a.position.wx + (end.wx - a.position.wx) * t,
          wy: a.position.wy + (end.wy - a.position.wy) * t,
        };
      const height = a.robin
        ? robinMotionZ("flight", startZ, endZ, t)
        : (c.environment.surfaceZ?.(pos) ?? 0);
      if (
        c.environment.isWater(pos) ||
        (!a.robin && Math.abs(height - startZ) > 4) ||
        !c.environment.canOccupy({ collider: a.collider, wz: height }, pos)
      )
        return false;
    }
    if (!c.environment.canOccupy({ collider: a.collider, wz: endZ }, end)) return false;
    if (a.rabbit) {
      a.rabbit.target = end;
      a.rabbit.state = "hop";
      a.rabbit.hop = { elapsed: 0, startZ, endZ, escaping: false };
      restoreRabbitPose(a);
    } else if (a.robin) {
      a.robin.target = { ...end, z: endZ };
      a.robin.state = "flight";
      a.robin.motion = {
        elapsed: 0,
        duration: Math.max(0.8, length / 55),
        startZ,
        endZ,
        escaping: false,
      };
      restoreRobinPose(a);
    } else if (a.fauna) {
      a.fauna.target = end;
      a.fauna.state = "travel";
      a.fauna.motion = {
        elapsed: 0,
        duration: length / (faunaProfile(a.type)?.speed ?? 12) + 0.05,
        escaping: false,
      };
      restoreFaunaPose(a);
    }
    if (a.wanderAI) a.wanderAI.state = "walking";
    return true;
  }
  update(a: Entity, dt: number, c: WorkContext, planning?: AiPlanningScheduler): boolean {
    const kind = kindOf(a),
      ai = native(a);
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
    const task = a.animalWork;
    task.elapsed += dt;
    task.cooldown = Math.max(0, task.cooldown - dt);
    // Native alarm/escape wins. A nearby player also interrupts robin's early idle path.
    const player = c.players.find(
      (p) => gap(p.entity.position, a.position) < (kind === "robin" && (a.wz ?? 0) > 4 ? 12 : 26),
    );
    if (player && kind === "robin") startleRobin(a, player.entity.position);
    if (player && kind === "rabbit") startleRabbit(a, player.entity.position);
    if (
      ai.alarmFrom ||
      ["recover", "startle", "flee"].includes(ai.state) ||
      a.parentId !== undefined ||
      a.wanderAI?.following ||
      a.wanderAI?.state === "ridden"
    ) {
      this.cancel(a);
      return false;
    }
    if (moving(a)) return task.state !== "idle";
    if (task.state === "lower") {
      if (task.elapsed < 0.6) return true;
      this.cancel(a, 10);
      return false;
    }
    if (task.state === "alarm") {
      if (task.elapsed < 0.65) return true;
      const from = task.threat;
      if (from)
        for (const peer of this.peers(a).filter(
          (e) =>
            e.parentId === undefined && !e.wanderAI?.following && e.wanderAI?.state !== "ridden",
        )) {
          this.release(peer);
          if (peer.animalWork) {
            peer.animalWork.state = "idle";
            peer.animalWork.cooldown = 12;
          }
          startleFauna(peer, from);
        }
      task.alarms = (task.alarms ?? 0) + 1;
      this.cancel(a, 14);
      return false;
    }
    if (task.state === "scan") {
      // Sensing is sampled under the shared planning quota, not a new per-frame search.
      if (planning && !planning.claim(a, false)) return true;
      const threat =
        task.elapsed < 0.6
          ? undefined
          : this.nearby(a, 128)
              .filter((e) => e.predator)
              .sort((x, y) => gap(x.position, a.position) - gap(y.position, a.position))
              .find((e) => {
                if (planning && !planning.candidate(a)) return false;
                return (
                  !!e.predator &&
                  canEat(e, a) &&
                  gap(e.position, a.position) < 128 &&
                  Math.abs((e.wz ?? 0) - (a.wz ?? 0)) < 40
                );
              });
      if (threat) {
        task.threat = { ...threat.position };
        face(a, threat.position);
        this.enter(a, "alarm");
      } else if (task.elapsed >= 6) {
        task.deliveries++;
        this.enter(a, "lower");
      } else if (a.sprite) {
        a.sprite.direction = Math.floor(task.elapsed / 1.5) % 4;
        a.sprite.frameRow = a.sprite.direction;
        task.facing = a.sprite.direction;
      }
      return true;
    }
    if (task.state === "rest") {
      if (task.elapsed < (kind === "rabbit" ? 1.2 : 3)) return true;
      this.cancel(a, 1);
      return false;
    }
    const target = this.find(task.targetId);
    if (task.state === "eat") {
      if (
        !target?.workItem ||
        target.workItem.claimedBy !== a.persistentId ||
        gap(target.position, a.position) > 15 ||
        Math.abs((target.wz ?? 0) - (a.wz ?? 0)) > 4 ||
        !c.ready(target.position, 16)
      ) {
        this.cancel(a);
        return false;
      }
      if (task.elapsed < 1.2) return true;
      target.workItem.units = Math.max(0, (target.workItem.units || 1) - 1);
      task.eaten++;
      this.release(a);
      if (!target.workItem.units) this.manager.remove(target.id);
      else restoreWorkItemPose(target);
      this.enter(a, kind === "robin" ? "return" : "rest");
      return true;
    }
    if (task.state === "seek") {
      if (
        !target?.workItem ||
        target.workItem.claimedBy !== a.persistentId ||
        target.parentId !== undefined ||
        task.elapsed > 25
      ) {
        this.cancel(a);
        return false;
      }
      if (gap(target.position, a.position) < 12 && Math.abs((target.wz ?? 0) - (a.wz ?? 0)) < 4) {
        face(a, target.position);
        this.enter(a, "eat");
        return true;
      }
    }
    if (task.state === "idle" && task.cooldown) return false;
    if (planning && !planning.claim(a, false)) return task.state !== "idle";
    if (task.state === "return") {
      const perch = task.sitePosition;
      const supported =
        perch &&
        c.environment
          .perches?.(perch, 8)
          .some((p) => gap(p, perch) < 1 && Math.abs(p.z - perch.z) < 1);
      if (!supported || !perch || !c.ready(perch, 16)) {
        this.cancel(a);
        return false;
      }
      if (gap(perch, a.position) < 2 && Math.abs((a.wz ?? 0) - perch.z) < 1) {
        task.deliveries++;
        this.enter(a, "rest");
      } else if (!this.go(a, perch, perch.z, c, planning)) this.cancel(a);
      return true;
    }
    if (task.state === "seek" && target) {
      if (!this.go(a, target.position, target.wz ?? 0, c, planning)) this.cancel(a);
      return true;
    }
    if (kind === "meerkat") {
      const peers = this.peers(a).filter(
        (e) =>
          !moving(e) &&
          !native(e)?.alarmFrom &&
          e.parentId === undefined &&
          !e.wanderAI?.following &&
          e.wanderAI?.state !== "ridden",
      );
      const watcher = peers.find((e) =>
        ["scan", "alarm", "lower"].includes(e.animalWork?.state ?? ""),
      );
      const next = peers
        .filter((e) => !e.animalWork?.cooldown)
        .sort(
          (x, y) =>
            (x.animalWork?.deliveries ?? 0) - (y.animalWork?.deliveries ?? 0) ||
            durableId(x).localeCompare(durableId(y)),
        )[0];
      if (!watcher && next === a) {
        this.enter(a, "scan");
        return true;
      }
    }
    const foods = this.nearby(a, 160)
      .filter(
        (e) =>
          e.workItem &&
          e.parentId === undefined &&
          this.availableFood(e, c) &&
          gap(e.position, ai.home) < ai.radius &&
          (kind === "rabbit"
            ? e.workItem.kind === "greens"
            : kind === "robin"
              ? ["seed", "fruit"].includes(e.workItem.kind)
              : e.workItem.kind === "fruit"),
      )
      .sort(
        (x, y) =>
          gap(x.position, a.position) - gap(y.position, a.position) ||
          durableId(x).localeCompare(durableId(y)),
      );
    for (const food of foods.slice(0, 8)) {
      if (planning && !planning.candidate(a)) break;
      if (kind === "robin") {
        const perch =
          c.environment
            .perches?.(ai.home, ai.radius)
            .find((p) => gap(p, a.position) < 2 && Math.abs(p.z - (a.wz ?? 0)) < 1) ??
          c.environment.perches?.(ai.home, ai.radius)[0];
        if (!perch) continue;
        task.sitePosition = { ...perch };
      }
      if (!this.go(a, food.position, food.wz ?? 0, c, planning)) continue;
      if (food.workItem) food.workItem.claimedBy = durableId(a);
      task.targetId = durableId(food);
      this.enter(a, "seek");
      return true;
    }
    task.cooldown = 2;
    return false;
  }
}
