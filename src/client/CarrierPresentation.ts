import type { Entity } from "../entities/Entity.js";
import { physicsBodyMotion } from "../physics/PhysicsBodies.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { motionLead, samplePredictedPose } from "./PredictionPresentation.js";
import type { ReplayPose } from "./PredictionSnapshots.js";

type Offset = { x: number; y: number; z: number };
type Correction = Offset & { at: number };
type Release = Correction & { duration: number };
type BodyMap = ReadonlyMap<number, Entity>;
const ZERO: Offset = { x: 0, y: 0, z: 0 };

const motionUnit = (entity: Entity) => entity.physicsGroupId ?? entity.id;

/** Carries both a single support and a group of coupled bodies on one display
 * timeline. Prescribed trajectories keep their own error from matching-tick
 * replay; dynamic supports still share their solved contact correction. */
export class CarrierPresentation {
  private readonly corrections = new Map<number, Correction>();
  private readonly drawn = new Map<number, Offset>();
  private readonly releases = new Map<number, Release>();

  clear(): void {
    this.corrections.clear();
    this.drawn.clear();
    this.releases.clear();
  }

  readonly owns = (entity: Entity): boolean =>
    entity.physicsGroupId !== undefined ||
    this.drawn.has(entity.id) ||
    this.releases.has(motionUnit(entity));

  private correction(id: number, now: number): Offset {
    const error = this.corrections.get(id);
    if (!error) return ZERO;
    const decay = Math.exp(-Math.max(0, now - error.at) / 0.06);
    return { x: error.x * decay, y: error.y * decay, z: error.z * decay };
  }

  offset(entity: Entity, now: number): Offset | undefined {
    if (physicsBodyMotion(entity) === "prescribed") return this.correction(motionUnit(entity), now);
    return undefined;
  }

  reconcile(
    published: BodyMap,
    before: BodyMap,
    compared: ReadonlyMap<number, ReplayPose> | undefined,
    now: number,
  ): void {
    const roots = new Map<number, Entity>();
    for (const entity of published.values()) {
      if (physicsBodyMotion(entity) !== "prescribed") continue;
      const unit = motionUnit(entity);
      roots.set(unit, published.get(unit) ?? entity);
    }
    for (const id of this.corrections.keys()) if (!roots.has(id)) this.corrections.delete(id);
    for (const [id, root] of roots) {
      const previous = before.get(root.id);
      const matching = compared?.get(root.id);
      if (!previous || !matching) {
        this.corrections.delete(id);
        continue;
      }
      const retained = this.correction(id, now);
      const offset = {
        x: previous.position.wx - matching.x + retained.x,
        y: previous.position.wy - matching.y + retained.y,
        z: (previous.wz ?? 0) - matching.z + retained.z,
      };
      this.corrections.set(id, {
        ...(Math.hypot(offset.x, offset.y, offset.z) < 32 ? offset : ZERO),
        at: now,
      });
    }
  }

  /** Remember the displayed translation, including any shared dynamic-contact
   * correction. Keep ownership until the support leaves prediction entirely. */
  track(entity: Entity, offset: Offset | undefined, supporting: boolean): void {
    if (supporting || this.drawn.has(entity.id) || entity.physicsGroupId !== undefined)
      this.drawn.set(entity.id, offset ?? ZERO);
  }

  /** Release a formerly selected support to the buffer. All members of a motion
   * unit use one translation. Released actors keep moving during sliced replay. */
  release(
    buffered: readonly Entity[],
    selected: { has(id: number): boolean },
    published: BodyMap,
    alpha: number,
    now: number,
  ): readonly Entity[] {
    if (!this.drawn.size && !this.releases.size) return buffered;
    const visible = new Set<number>();
    const unselected: Entity[] = [];
    for (const entity of buffered) {
      visible.add(entity.id);
      if (selected.has(entity.id)) {
        this.releases.delete(motionUnit(entity));
      } else {
        unselected.push(entity);
      }
    }
    // Seed releases before applying them so a group member's order in the
    // buffer cannot cause part of its motion unit to switch a frame early.
    for (const entity of unselected) {
      const previous = this.drawn.get(entity.id);
      const body = published.get(entity.id);
      const unit = motionUnit(entity);
      if (previous && body && !this.releases.has(unit)) {
        const offset = this.offset(body, now) ?? previous;
        const shift = releaseOffset(entity, body, offset, alpha, now);
        if (shift) this.releases.set(unit, shift);
      }
      this.drawn.delete(entity.id);
    }
    for (const id of this.drawn.keys()) if (!visible.has(id)) this.drawn.delete(id);
    return this.applyReleases(buffered, selected, now);
  }

  private applyReleases(
    buffered: readonly Entity[],
    selected: { has(id: number): boolean },
    now: number,
  ): readonly Entity[] {
    const pending = new Set(this.releases.keys());
    let released: Entity[] | undefined;
    for (const [index, entity] of buffered.entries()) {
      const unit = motionUnit(entity);
      const shift = this.releases.get(unit);
      if (!shift || selected.has(entity.id)) continue;
      pending.delete(unit);
      const t = Math.min(1, Math.max(0, (now - shift.at) / shift.duration));
      if (t === 1) {
        this.releases.delete(unit);
        continue;
      }
      const factor = 1 - t * t * (3 - 2 * t);
      const position = {
        wx: entity.position.wx + shift.x * factor,
        wy: entity.position.wy + shift.y * factor,
      };
      const z = (entity.wz ?? 0) + shift.z * factor;
      released ??= [...buffered];
      released[index] = { ...entity, position, prevPosition: position, wz: z, prevWz: z };
    }
    for (const unit of pending) this.releases.delete(unit);
    return released ?? buffered;
  }
}

function releaseOffset(
  buffered: Entity,
  predicted: Entity,
  offset: Offset,
  alpha: number,
  at: number,
): Release | undefined {
  const pose = samplePredictedPose(predicted, alpha, buffered.sprite, offset);
  const previous = predicted.prevPosition ?? predicted.position;
  const vx = (predicted.position.wx - previous.wx) / PHYSICS_DT;
  const vy = (predicted.position.wy - previous.wy) / PHYSICS_DT;
  const x = pose.position.wx - buffered.position.wx;
  const y = pose.position.wy - buffered.position.wy;
  const z = (pose.wz ?? 0) - (buffered.wz ?? 0);
  const lead = Math.max(0, motionLead(x, y, vx, vy));
  // Easing a timeline lead gives the buffer time to catch up. A large
  // unexplained displacement is a relocation and takes effect immediately.
  if (Math.hypot(x - vx * lead, y - vy * lead, z) >= 32) return undefined;
  return { x, y, z, at, duration: 0.2 + 3 * lead };
}
