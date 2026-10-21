import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { directionFromVelocity } from "../entities/wanderAI.js";
import { durableId } from "../persistence/ActorRecords.js";
import type { AiPlanningScheduler } from "../server/AiPlanningScheduler.js";
import { restoreAnimalWorkPose } from "./AnimalWorkPose.js";
import type { AnimalWorkSystem, WorkContext } from "./AnimalWorkSystem.js";
import { type FaunaBehavior, faunaProfile } from "./Fauna.js";
import { canEat, creatureSpecies, dietFor } from "./FoodWeb.js";
import { settleFauna } from "./faunaInteractions.js";
import { alarmPrey, consumeWildlifePrey } from "./predatorAI.js";
import { spineDefenseBlocks } from "./SpineDefense.js";

const gap = (a: PositionComponent, b: PositionComponent) => Math.hypot(a.wx - b.wx, a.wy - b.wy);
const kindOf = (a: Entity) =>
  ["hedgehog", "porcupine", "fox"].find((k) => faunaProfile(a.type)?.species === k) as
    | "hedgehog"
    | "porcupine"
    | "fox"
    | undefined;
export const isThreatWorker = (a: Entity) => !!kindOf(a);

/** Grounded, saved defenses and actual small-prey ambushes; no alternate lab simulation. */
export class ThreatWork {
  constructor(
    private readonly manager: EntityManager,
    private readonly work: AnimalWorkSystem,
  ) {}
  private find(id?: string) {
    return id ? this.manager.entities.find((e) => e.persistentId === id) : undefined;
  }
  private local(a: Entity) {
    return this.manager.spatialHash
      .queryRange(
        Math.floor((a.position.wx - 112) / 256),
        Math.floor((a.position.wy - 112) / 256),
        Math.floor((a.position.wx + 112) / 256),
        Math.floor((a.position.wy + 112) / 256),
      )
      .filter(
        (e) =>
          e !== a && !e.workItem && gap(a.position, e.position) < 112 && e.deathTimer === undefined,
      )
      .sort(
        (x, y) =>
          gap(x.position, a.position) - gap(y.position, a.position) ||
          durableId(x).localeCompare(durableId(y)),
      )
      .slice(0, 12);
  }
  private supported(a: Entity, c: WorkContext) {
    return (
      !c.environment.isWater(a.position) &&
      Math.abs((a.wz ?? 0) - (c.environment.surfaceZ?.(a.position) ?? 0)) <= 1
    );
  }
  private face(a: Entity, p: PositionComponent, away = false) {
    if (!a.sprite) return;
    const d = directionFromVelocity(
      (p.wx - a.position.wx) * (away ? -1 : 1),
      (p.wy - a.position.wy) * (away ? -1 : 1),
    );
    a.sprite.direction = a.sprite.frameRow = d;
    if (a.fauna) a.fauna.facing = d;
    if (a.animalWork) a.animalWork.facing = d;
  }
  private enter(a: Entity, state: NonNullable<Entity["animalWork"]>["state"]) {
    const t = a.animalWork;
    if (!t) return;
    t.state = state;
    t.elapsed = 0;
    if (!a.fauna?.motion) {
      if (a.velocity) a.velocity.vx = a.velocity.vy = 0;
      if (a.wanderAI) a.wanderAI.state = "idle";
    }
    restoreAnimalWorkPose(a);
  }
  private stop(a: Entity, cooldown = 3) {
    this.work.cancel(a, cooldown);
    const t = a.animalWork;
    if (t) {
      delete t.defenseReady;
      delete t.sitePosition;
      delete t.quietFor;
      delete t.threat;
    }
  }
  private potentialThreat(a: Entity, c: WorkContext, planning?: AiPlanningScheduler) {
    const species = creatureSpecies(a);
    if (!species) return;
    for (const p of c.players)
      if (gap(a.position, p.entity.position) < 36)
        return { point: p.entity.position, actor: p.entity };
    for (const h of this.local(a)) {
      if (planning && !planning.candidate(a)) break;
      if (
        h.parentId !== undefined ||
        h.wanderAI?.following ||
        h.wanderAI?.state === "ridden" ||
        !c.ready(h.position, 96) ||
        Math.abs((h.wz ?? 0) - (a.wz ?? 0)) > 8
      )
        continue;
      if (dietFor(creatureSpecies(h) ?? "").has(species)) return { point: h.position, actor: h };
    }
  }
  private defend(a: Entity, dt: number, c: WorkContext, planning?: AiPlanningScheduler) {
    const t = a.animalWork,
      ai = a.fauna;
    if (!t || !ai) return false;
    if (t.state === "idle") {
      t.cooldown = Math.max(0, t.cooldown - dt);
      if (t.cooldown > 0) return false;
    }
    if (planning && !planning.claim(a, true)) return t.state !== "idle";
    const danger = this.potentialThreat(a, c, planning),
      threat = danger?.point,
      hedgehog = t.kind === "hedgehog";
    if (t.state === "idle") {
      if (!threat) {
        // Leave later planning turns to native walking/escape when the survey is empty.
        t.cooldown = 0.35;
        return false;
      }
      settleFauna(a);
      delete ai.alarmFrom;
      ai.state = "rest";
      t.sitePosition = { ...a.position, z: a.wz ?? 0 };
      t.quietFor = 0;
      t.threat = { ...threat };
      this.face(a, threat, !hedgehog);
      this.enter(a, hedgehog ? "curl-in" : "quills");
      return true;
    }
    if (
      !t.sitePosition ||
      gap(a.position, t.sitePosition) > 2 ||
      Math.abs((a.wz ?? 0) - t.sitePosition.z) > 1
    ) {
      this.stop(a);
      return false;
    }
    delete ai.alarmFrom;
    ai.state = "rest";
    delete ai.actionElapsed;
    if (threat) {
      t.threat = { ...threat };
      t.quietFor = 0;
      this.face(a, threat, !hedgehog);
    } else t.quietFor = (t.quietFor ?? 0) + dt;
    t.elapsed += dt;
    if (t.state === "curl-in" || t.state === "quills") {
      if (t.elapsed < 0.7) return true;
      t.defenseReady = true;
      if (hedgehog) t.curls = (t.curls ?? 0) + 1;
      else t.warnings = (t.warnings ?? 0) + 1;
      this.enter(a, hedgehog ? "curled" : "rattle");
      return true;
    }
    if (t.state === "curled" || t.state === "rattle") {
      const hunter = danger?.actor;
      if (
        !hedgehog &&
        hunter?.predator &&
        !hunter.predator.alarmFrom &&
        spineDefenseBlocks(a, hunter, creatureSpecies(hunter) ?? "")
      ) {
        alarmPrey(hunter, a.position);
        t.repelled = (t.repelled ?? 0) + 1;
      }
      if ((t.quietFor ?? 0) < 1.5) return true;
      delete t.defenseReady;
      this.enter(a, hedgehog ? "uncurl" : "relax");
      return true;
    }
    if (t.state === "uncurl" || t.state === "relax") {
      if (threat) {
        this.enter(a, hedgehog ? "curl-in" : "quills");
        return true;
      }
      if (t.elapsed < 0.7) return true;
      this.stop(a, 1);
      return false;
    }
    this.stop(a);
    return false;
  }
  private prey(a: Entity, b: Entity, c: WorkContext) {
    return (
      c.ready(b.position, 96) &&
      canEat(a, b) &&
      this.supported(b, c) &&
      (b.jumpZ ?? 0) <= 1 &&
      gap(b.position, a.fauna?.home ?? a.position) < (a.fauna?.radius ?? 0) &&
      Math.abs(
        (a.animalWork?.state === "pounce" ? (a.fauna?.motion?.startZ ?? a.wz ?? 0) : (a.wz ?? 0)) -
          (b.wz ?? 0),
      ) <= 1
    );
  }
  private fox(a: Entity, dt: number, c: WorkContext, planning?: AiPlanningScheduler) {
    const t = a.animalWork,
      ai = a.fauna;
    if (!t || !ai) return false;
    if (
      (ai.alarmFrom || ["startle", "flee", "recover"].includes(ai.state)) &&
      !(t.state === "pounce" && ai.motion)
    ) {
      if (t.state !== "idle") this.stop(a);
      return false;
    }
    t.elapsed += dt;
    t.cooldown = Math.max(0, t.cooldown - dt);
    if (t.state === "eat") {
      if (t.elapsed < 2.4) return true;
      this.stop(a, t.cooldown);
      return false;
    }
    const prey = this.find(t.targetId);
    if (t.state === "pounce") {
      if (ai.motion || t.elapsed < 1.05) return true;
      this.stop(a, 5);
      return false;
    }
    if (t.targetId && (!prey || !this.prey(a, prey, c))) {
      this.stop(a, 3);
      return false;
    }
    if (ai.motion) return t.state !== "idle";
    if (t.state === "listen" || t.state === "stalk") {
      if (!prey || gap(a.position, prey.position) > 112 || t.elapsed > 20) {
        this.stop(a);
        return false;
      }
      this.face(a, prey.position);
      if (t.elapsed < (t.state === "listen" ? 1.0 : 0.3)) return true;
      if (planning && !planning.claim(a, false)) return true;
      const d = gap(a.position, prey.position);
      if (d <= 42) {
        const travel = Math.max(0, d - 9),
          landing = {
            wx: a.position.wx + ((prey.position.wx - a.position.wx) * travel) / Math.max(d, 1),
            wy: a.position.wy + ((prey.position.wy - a.position.wy) * travel) / Math.max(d, 1),
          };
        if (!this.work.go(a, landing, prey.wz ?? 0, c, planning)) {
          this.stop(a);
          return false;
        }
        const m = (a.fauna as FaunaBehavior).motion;
        if (!m) return false;
        m.duration = 0.72;
        m.workSpeed = travel / 0.72;
        m.startZ = a.wz ?? 0;
        m.endZ = prey.wz ?? 0;
        m.lift = 7;
        t.sitePosition = { ...landing, z: prey.wz ?? 0 };
        t.pounces = (t.pounces ?? 0) + 1;
        alarmPrey(prey, a.position);
        this.enter(a, "pounce");
        return true;
      }
      const point = {
        wx: a.position.wx + (prey.position.wx - a.position.wx) * Math.min(18 / d, 1),
        wy: a.position.wy + (prey.position.wy - a.position.wy) * Math.min(18 / d, 1),
      };
      if (!this.work.go(a, point, a.wz ?? 0, c, planning)) {
        this.stop(a);
        return false;
      }
      const motion = (a.fauna as FaunaBehavior).motion;
      if (motion) motion.workSpeed = 22;
      this.enter(a, "stalk");
      return true;
    }
    if (t.cooldown) return false;
    if (planning && !planning.claim(a, false)) return false;
    for (const prey of this.local(a)) {
      if (planning && !planning.candidate(a)) break;
      if (!this.prey(a, prey, c)) continue;
      t.targetId = durableId(prey);
      this.face(a, prey.position);
      this.enter(a, "listen");
      return true;
    }
    t.cooldown = 2;
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
    const t = a.animalWork;
    if (a.parentId !== undefined || a.wanderAI?.following || a.wanderAI?.state === "ridden") {
      this.stop(a);
      return false;
    }
    const prey = this.find(t.targetId);
    if (
      !c.ready(a.position, 96) ||
      (t.state !== "pounce" && prey && !c.ready(prey.position, 96)) ||
      (t.sitePosition && !c.ready(t.sitePosition, 96))
    ) {
      if (ai.motion) ai.motion.workPaused = true;
      if (a.velocity) a.velocity.vx = a.velocity.vy = 0;
      return true;
    }
    if (ai.motion) delete ai.motion.workPaused;
    if (!ai.motion && (!this.supported(a, c) || !c.environment.canOccupy(a, a.position))) {
      this.stop(a);
      return false;
    }
    return kind === "fox" ? this.fox(a, dt, c, planning) : this.defend(a, dt, c, planning);
  }
  resolveCatches(active: readonly Entity[], c: WorkContext) {
    for (const a of active) {
      const t = a.animalWork,
        ai = a.fauna;
      if (
        t?.kind !== "fox" ||
        t.state !== "pounce" ||
        !ai ||
        ai.motion ||
        t.elapsed < 0.6 ||
        !c.ready(a.position, 96)
      )
        continue;
      const prey = this.find(t.targetId);
      if (!prey || !c.ready(prey.position, 96)) continue;
      const random = () => {
        ai.randomState = (Math.imul(ai.randomState, 1664525) + 1013904223) >>> 0;
        return ai.randomState / 4294967296;
      };
      if (!consumeWildlifePrey(this.manager, a, prey, c.environment, random)) continue;
      // Removal cancels target reservations, so retain the same durable task afterwards.
      t.eaten++;
      t.cooldown = 35 + random() * 20;
      delete t.targetId;
      delete t.sitePosition;
      this.enter(a, "eat");
    }
  }
}
