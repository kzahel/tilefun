import type { Entity, PositionComponent } from "../entities/Entity.js";
import { wake } from "../entities/naps.js";
import type { RobinWorkBudget } from "../wildlife/RobinWorkBudget.js";
import { wildlifeBrain } from "../wildlife/WildlifeKinds.js";

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
  /** In the waiting line, and the turn it first reached the front (0: not yet). */
  queued: boolean;
  fronted: number;
}

const STARTS = 4;
/** Of those, the starts open to goals that are not urgent: the rate at which a crowd
 * larger than the budget plans. The rest stay free for alarms. */
const ORDINARY_STARTS = 2;
/** Turns a request may sit at the front of the line unclaimed before it is dropped. */
const UNCLAIMED_TURNS = 30;
/** Waiting requests beyond which the line is periodically swept of departed actors. */
const SWEEP_LINE = 256;

/** Realm-owned logical-time admission. Fast reactions, timers and motion stay outside it.
 * A goal refused for lack of budget joins a first-come line; each turn the front of the
 * line is offered that turn's starts, so a waiting actor need not ask again meanwhile. */
export class AiPlanningScheduler {
  private clocks = new WeakMap<Entity, Clock>();
  readonly budget: RobinWorkBudget = { starts: 0, candidates: 0, samples: 0 };
  private line: Entity[] = [];
  private front = 0;
  private readonly offered = new Set<Entity>();
  private turn = 0;
  private granted = false;
  private ordinary = 0;

  /** Forget every clock and request: the world they belonged to is gone. */
  clear(): void {
    this.clocks = new WeakMap();
    this.line = [];
    this.front = 0;
    this.offered.clear();
  }

  /** Offer this turn's starts to the front of the line and wake those actors. Call
   * before choosing who decides this tick; `begin` does it otherwise. A realm passes
   * its tick, so requests of actors it no longer simulates are dropped at once. */
  grant(tick?: number): void {
    this.granted = true;
    this.turn++;
    this.offered.clear();
    const gone = (entity: Entity) => tick !== undefined && entity.simTick !== tick - 1;
    // A long line is mostly live requests; sweep out the departed before it grows.
    if (this.line.length - this.front > SWEEP_LINE && this.turn % 64 === 0) {
      this.line = this.line.slice(this.front).filter((entity) => {
        const clock = this.clocks.get(entity);
        if (clock?.pending && !gone(entity)) return true;
        if (clock) clock.pending = clock.queued = false;
        return false;
      });
      this.front = 0;
    }
    const line = this.line;
    let i = this.front;
    for (; i < line.length && this.offered.size < ORDINARY_STARTS; i++) {
      const entity = line[i] as Entity,
        clock = this.clocks.get(entity);
      const stale = this.turn - (clock?.fronted || this.turn) > UNCLAIMED_TURNS;
      if (!clock?.pending || stale || gone(entity)) {
        // Served out of turn, or gone: an actor that still wants a start asks again.
        if (clock) clock.pending = clock.queued = false;
        continue;
      }
      clock.fronted ||= this.turn;
      this.offered.add(entity);
      wake(entity);
    }
    // Requests still offered stay at the front, in order.
    this.front = i - this.offered.size;
    let slot = this.front;
    for (const entity of this.offered) line[slot++] = entity;
    if (this.front > 1024) {
      this.line = line.slice(this.front);
      this.front = 0;
    }
  }

  begin(): void {
    if (!this.granted) this.grant();
    this.granted = false;
    this.budget.starts = STARTS;
    this.ordinary = ORDINARY_STARTS;
    this.budget.candidates = 64;
    this.budget.samples = 768;
  }

  /** Decisions, up to `limit`, in which this actor's goal is certain to be refused:
   * its request waits in the line, or its clock is not yet due. */
  refusals(entity: Entity, dt: number, limit: number): number {
    const clock = this.clocks.get(entity);
    if (!clock) return 0;
    if (clock.pending) return clock.queued && !this.offered.has(entity) ? limit : 0;
    const period = clock.near ? 0.1 : 0.3;
    let elapsed = clock.elapsed,
      count = 0;
    for (; count < limit; count++) {
      elapsed += dt;
      if (elapsed >= period - 1e-9) break;
    }
    return count;
  }

  /** `times` consecutive ticks of `dt`: a napping actor's clock catches up in one call. */
  advance(
    entity: Entity,
    dt: number,
    players: readonly PositionComponent[] | boolean = true,
    times = 1,
  ): void {
    const known = this.clocks.get(entity);
    let clock = this.tick(entity, dt, players, known);
    for (let i = 1; i < times; i++) clock = this.tick(entity, dt, players, clock);
  }

  private tick(
    entity: Entity,
    dt: number,
    players: readonly PositionComponent[] | boolean,
    clock: Clock | undefined,
  ): Clock {
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
      const seed = wildlifeBrain(entity)?.randomState ?? entity.id;
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
        queued: false,
        fronted: 0,
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
    return clock;
  }

  /** Order of decision within a tick: 0 a request offered a start after a long wait,
   * 1 urgent, 2 other offered requests, then 3 near and 4 far newcomers. */
  priority(entity: Entity, urgent: boolean): number {
    const clock = this.clocks.get(entity);
    const offered = this.offered.has(entity);
    // A sustained urgent stream cannot permanently starve distant due work.
    if (offered && clock && clock.wait >= 0.5) return 0;
    return urgent ? 1 : offered ? 2 : clock?.near ? 3 : 4;
  }

  claim(entity: Entity, urgent: boolean): boolean {
    const clock = this.clocks.get(entity);
    if (!clock || clock.claimed || (!urgent && !clock.due && !clock.pending)) return false;
    // A request already in the line is served in its turn, so it need not keep asking.
    if (!urgent && clock.pending && clock.queued && !this.offered.has(entity)) return false;
    const open = this.budget.starts && (urgent || this.ordinary);
    if (!open || !this.budget.candidates || !this.budget.samples) {
      clock.pending = true;
      if (!clock.queued) {
        clock.queued = true;
        clock.fronted = 0;
        this.line.push(entity);
      }
      return false;
    }
    this.budget.starts--;
    if (!urgent) this.ordinary--;
    clock.claimed = true;
    clock.pending = clock.due = false;
    clock.wait = 0;
    clock.candidates = clock.near ? 24 : 12;
    clock.samples = clock.near ? 256 : 128;
    return true;
  }

  /** This tick's start is already this actor's: a goal that came to nothing (no food
   * in reach) leaves its remaining candidates and samples to the actor's next goal. */
  claimed(entity: Entity): boolean {
    return this.clocks.get(entity)?.claimed ?? false;
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
