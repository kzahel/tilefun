import { TICK_RATE } from "../config/constants.js";
import type { SyncSkyMessage } from "../shared/protocol.js";
import type { SkyClockView } from "./Sky.js";

/** A replica's copy of its world's clock, kept current by the realm's frame ticks. */
export class SkyReplica {
  private synced: SyncSkyMessage | undefined;
  /** The replica's tick when the clock arrived: frames from its realm follow. */
  private arrivedAt = 0;

  constructor(private readonly serverTick: () => number) {}

  apply(message: SyncSkyMessage): void {
    this.synced = message;
    this.arrivedAt = this.serverTick();
  }

  /** Another realm: its clock arrives with its stream, or it has none. */
  clear(): void {
    this.synced = undefined;
  }

  /** The clock now; undefined in a realm without a sky. */
  get now(): SkyClockView | undefined {
    const sky = this.synced;
    if (!sky) return undefined;
    // Until a frame follows, the replica's tick may still be another realm's.
    const tick = this.serverTick();
    const elapsed = tick === this.arrivedAt ? 0 : (tick - sky.tick) / TICK_RATE;
    return { seed: sky.seed, time: sky.time + elapsed, held: sky.weather };
  }
}
