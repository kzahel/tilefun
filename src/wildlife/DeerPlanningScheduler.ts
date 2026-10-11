import type { Entity } from "../entities/Entity.js";

const PERIOD = 0.1;

/** Realm-owned ambient planning cadence. Motion, alarms and timers do not use this gate. */
export class DeerPlanningScheduler {
  private readonly clocks = new WeakMap<
    Entity,
    { elapsed: number; due: boolean; pending: boolean }
  >();
  private starts = 0;

  begin(): void {
    // One complete search: at most 24 candidates and 480 path samples per AI step.
    this.starts = 1;
  }

  advance(entity: Entity, dt: number): void {
    let clock = this.clocks.get(entity);
    if (!clock) {
      clock = {
        elapsed: ((entity.deer?.randomState ?? 0) % 6) * (PERIOD / 6),
        due: false,
        pending: false,
      };
      this.clocks.set(entity, clock);
    }
    // Only admitted simulation time accrues. Sleep cannot accumulate planning debt.
    clock.elapsed += dt;
    clock.due = clock.elapsed >= PERIOD - 1e-9;
    if (clock.due) clock.elapsed = Math.max(0, clock.elapsed - PERIOD) % PERIOD;
  }

  claim(entity: Entity, urgent: boolean): boolean {
    const clock = this.clocks.get(entity);
    if (!clock || (!urgent && !clock.due && !clock.pending)) return false;
    if (!this.starts) {
      clock.pending = true;
      return false;
    }
    this.starts--;
    clock.pending = clock.due = false;
    return true;
  }
}
