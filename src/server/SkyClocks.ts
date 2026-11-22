import { descriptorFromMetadata } from "../generation/GenerationDescriptor.js";
import type { WorldMeta } from "../persistence/IWorldRegistry.js";
import { START_SECONDS, type WeatherKind } from "../sky/Sky.js";

/** Realm ticks between saves of the world's clock: 20 seconds. */
const SAVE_TICKS = 1200;

/** One world's clock, shared by its outdoor realm and its building interiors. */
export class SkyClock {
  /** Seconds on the world's clock (`sky/Sky.ts`). */
  time = START_SECONDS;
  /** Weather kept by a command until it is released; not saved. */
  held: WeatherKind | undefined;
  private advancedIn = -1;

  constructor(
    readonly seed: number,
    private readonly clocks: SkyClocks,
  ) {}

  /** One simulation step. The realms sharing the clock all ask; the first one counts. */
  advance(dt: number): void {
    if (this.advancedIn === this.clocks.tick) return;
    this.advancedIn = this.clocks.tick;
    this.time += dt;
  }
}

/** A server's world clocks by world id. An interior uses its parent world's. */
export class SkyClocks {
  /** The server tick being run. */
  tick = 0;
  private readonly clocks = new Map<string, SkyClock>();

  /**
   * The clock of a world being loaded. Each realm of the world saves the time it
   * last saw; the clock only moves forward, so the latest one is current.
   */
  adopt(worldId: string, seed: number, saved: number | undefined): SkyClock {
    let clock = this.clocks.get(worldId);
    if (!clock) {
      clock = new SkyClock(seed, this);
      this.clocks.set(worldId, clock);
    }
    if (saved !== undefined && Number.isFinite(saved)) clock.time = Math.max(clock.time, saved);
    return clock;
  }

  /** A deleted world's clock. */
  forget(worldId: string): void {
    this.clocks.delete(worldId);
  }
}

/** A realm's part in its world's clock: adopting, advancing and saving it. */
export class RealmSky {
  /** The server's clocks. A realm without them has plain daylight (labs, tests). */
  clocks: SkyClocks | null = null;
  clock: SkyClock | null = null;

  /** `saved` is this realm's saved meta. An interior shares its parent world's clock. */
  load(worldId: string, meta: WorldMeta, saved: { skyTime?: number } | null): void {
    this.clock =
      this.clocks?.adopt(
        meta.interior?.parentWorldId ?? worldId,
        descriptorFromMetadata(meta).seed,
        saved?.skyTime,
      ) ?? null;
  }

  /** One realm tick: a world's time passes while someone is in it. True when the
   * clock is due to be saved. */
  tick(dt: number, players: number, tick: number): boolean {
    if (!this.clock || !players) return false;
    this.clock.advance(dt);
    return tick % SAVE_TICKS === 0;
  }

  /** The part of the realm's saved meta the clock owns. */
  saved(): { skyTime?: number } {
    return this.clock ? { skyTime: this.clock.time } : {};
  }
}
