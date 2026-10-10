import type { ChunkDemand } from "./InterestManager.js";

export interface ResidencyHooks<T> {
  load: (key: string) => Promise<T>;
  publish: (key: string, data: T) => void;
  /** Freeze and acknowledge durable state, retaining memory on error. */
  save: (key: string) => Promise<void>;
  canRelease: (key: string) => boolean;
  release: (key: string) => void;
  canLoad?: () => boolean;
}
interface Holder {
  token: number;
  state: "loading" | "ready" | "saving" | "failed";
  retryAt: number;
}

/** Bounded async admission and eviction; no backend or host-specific branches. */
export class ChunkResidency<T> {
  readonly holders = new Map<string, Holder>();
  readonly metrics = {
    cancelled: 0,
    discarded: 0,
    loaded: 0,
    evicted: 0,
    failures: 0,
    highWater: 0,
  };
  error: unknown;
  private desired = new Map<string, ChunkDemand>();
  private pending = new Set<Promise<void>>();
  private serial = 0;
  private turn = 0;
  private loads = 0;
  private saves = 0;
  private closed = false;

  constructor(
    readonly hooks: ResidencyHooks<T>,
    readonly limits = { holders: 4096, loads: 8, saves: 4 },
  ) {}

  ready(key: string): boolean {
    return this.holders.get(key)?.state === "ready";
  }
  demanded(key: string): boolean {
    return this.desired.has(key);
  }
  get inFlight(): number {
    return this.pending.size;
  }

  diagnostics() {
    const states = { loading: 0, ready: 0, saving: 0, failed: 0 };
    for (const holder of this.holders.values()) states[holder.state]++;
    return {
      ...this.metrics,
      states,
      demanded: this.desired.size,
      inFlight: this.inFlight,
      lastError:
        this.error === undefined
          ? null
          : this.error instanceof Error
            ? this.error.message
            : String(this.error),
    };
  }

  reconcile(desired: Map<string, ChunkDemand>): void {
    if (this.closed) return;
    this.turn++;
    this.desired = desired;
    for (const [key, holder] of this.holders) {
      if (desired.has(key)) {
        if (holder.state === "saving") {
          holder.token = ++this.serial;
          holder.state = "ready";
        }
        continue;
      }
      if (holder.state === "loading" || holder.state === "failed") {
        this.holders.delete(key);
        this.metrics.cancelled++;
      } else if (
        holder.state === "ready" &&
        this.saves < this.limits.saves &&
        this.turn >= holder.retryAt
      ) {
        this.retire(key, holder);
      }
    }
    this.pump();
  }
  private pump(): void {
    if (this.closed || this.hooks.canLoad?.() === false) return;
    for (const key of this.desired.keys()) {
      if (this.loads >= this.limits.loads) break;
      const old = this.holders.get(key);
      if (old && (old.state !== "failed" || this.turn < old.retryAt)) continue;
      if (!old && this.holders.size >= this.limits.holders) break;
      const holder: Holder = { token: ++this.serial, state: "loading", retryAt: 0 };
      this.holders.set(key, holder);
      this.metrics.highWater = Math.max(this.metrics.highWater, this.holders.size);
      this.loads++;
      this.track(
        Promise.resolve()
          .then(() => this.hooks.load(key))
          .then((data) => {
            if (this.closed || this.holders.get(key) !== holder || !this.desired.has(key)) {
              this.metrics.discarded++;
              return;
            }
            this.hooks.publish(key, data);
            holder.state = "ready";
            this.metrics.loaded++;
          })
          .catch((error) => {
            if (this.holders.get(key) === holder) {
              holder.state = "failed";
              holder.retryAt = this.turn + 60;
            }
            this.error = error;
            this.metrics.failures++;
          })
          .finally(() => {
            this.loads--;
            this.pump();
          }),
      );
    }
  }
  private retire(key: string, holder: Holder): void {
    holder.state = "saving";
    const token = holder.token;
    this.saves++;
    this.track(
      Promise.resolve()
        .then(() => this.hooks.save(key))
        .then(() => {
          if (holder.token !== token || this.desired.has(key)) return;
          if (!this.hooks.canRelease(key)) {
            holder.state = "ready";
            return;
          }
          this.hooks.release(key);
          this.holders.delete(key);
          this.metrics.evicted++;
        })
        .catch((error) => {
          if (holder.token === token) {
            holder.state = "ready";
            holder.retryAt = this.turn + 60;
          }
          this.error = error;
          this.metrics.failures++;
        })
        .finally(() => {
          this.saves--;
          this.pump();
        }),
    );
  }
  private track(work: Promise<void>): void {
    this.pending.add(work);
    void work.finally(() => this.pending.delete(work));
  }
  async settle(): Promise<void> {
    while (this.pending.size) await Promise.all(this.pending);
  }
  resume(): void {
    this.closed = false;
    for (const [key, holder] of this.holders)
      if (holder.state === "loading") this.holders.delete(key);
    this.reconcile(this.desired);
  }
  async close(): Promise<void> {
    this.closed = true;
    await this.settle();
  }
}
