import type { Entity, PositionComponent } from "../entities/Entity.js";
import type { RobinWorkBudget } from "../wildlife/RobinWorkBudget.js";

interface Clock {
  elapsed: number;
  due: boolean;
  pending: boolean;
  claimed: boolean;
  wait: number;
  near: boolean;
  distanceElapsed: number;
  candidates: number;
  samples: number;
}

/** Realm-owned logical-time admission. Fast reactions, timers and motion stay outside it. */
export class AiPlanningScheduler {
  private readonly clocks = new WeakMap<Entity, Clock>();
  readonly budget: RobinWorkBudget = { starts: 0, candidates: 0, samples: 0 };

  begin(): void {
    this.budget.starts = 4;
    this.budget.candidates = 64;
    this.budget.samples = 768;
  }

  advance(
    entity: Entity,
    dt: number,
    players: readonly PositionComponent[] | boolean = true,
  ): void {
    let clock = this.clocks.get(entity);
    const near =
      !clock || clock.distanceElapsed + dt >= 0.1 - 1e-9
        ? typeof players === "boolean"
          ? players
          : players.some(
              (p) => (p.wx - entity.position.wx) ** 2 + (p.wy - entity.position.wy) ** 2 < 192 ** 2,
            )
        : clock.near;
    const period = near ? 0.1 : 0.3;
    if (!clock) {
      const seed =
        (
          entity.fauna ??
          entity.deer ??
          entity.robin ??
          entity.rabbit ??
          entity.frog ??
          entity.mallard
        )?.randomState ?? entity.id;
      clock = {
        elapsed: ((seed % 6) * period) / 6,
        due: false,
        pending: false,
        claimed: false,
        wait: 0,
        near,
        distanceElapsed: 0,
        candidates: 0,
        samples: 0,
      };
      this.clocks.set(entity, clock);
    }
    // Ambient distance classification is sampled at 10Hz. Species alarm sensing
    // still reads live player positions on every admitted update.
    clock.distanceElapsed += dt;
    if (clock.distanceElapsed >= 0.1 - 1e-9)
      clock.distanceElapsed = Math.max(0, clock.distanceElapsed - 0.1) % 0.1;
    clock.near = near;
    clock.claimed = false;
    // Only admitted simulation dt accrues; no wall-time debt or catch-up loop.
    clock.elapsed += dt;
    clock.due = clock.elapsed >= period - 1e-9;
    if (clock.due) clock.elapsed = Math.max(0, clock.elapsed - period) % period;
    if (clock.pending) clock.wait += dt;
  }

  priority(entity: Entity, urgent: boolean): number {
    const clock = this.clocks.get(entity);
    // A sustained urgent stream cannot permanently starve distant due work.
    if (clock?.pending && clock.wait >= 0.5) return -1;
    return urgent ? 0 : clock?.near ? 1 : 2;
  }

  claim(entity: Entity, urgent: boolean): boolean {
    const clock = this.clocks.get(entity);
    if (!clock || clock.claimed || (!urgent && !clock.due && !clock.pending)) return false;
    if (!this.budget.starts || !this.budget.candidates || !this.budget.samples) {
      clock.pending = true;
      return false;
    }
    this.budget.starts--;
    clock.claimed = true;
    clock.pending = clock.due = false;
    clock.wait = 0;
    clock.candidates = clock.near ? 24 : 12;
    clock.samples = clock.near ? 256 : 128;
    return true;
  }

  candidate(entity: Entity): boolean {
    const clock = this.clocks.get(entity);
    if (!clock?.candidates || !this.budget.candidates) return false;
    clock.candidates--;
    this.budget.candidates--;
    return true;
  }

  /** Reserve a complete path before querying it; never accept an unchecked suffix. */
  path(entity: Entity, samples: number): boolean {
    const clock = this.clocks.get(entity);
    if (!clock || samples > clock.samples || samples > this.budget.samples) return false;
    clock.samples -= samples;
    this.budget.samples -= samples;
    return true;
  }
}
