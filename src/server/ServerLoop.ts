import { TICK_RATE } from "../config/constants.js";
import { serverLogError } from "./serverLog.js";

/** Discard excessive wall-time debt after a long stall, as the client loop does. */
const MAX_CATCHUP_MS = 250;

/**
 * Fixed-step authority clock driven by monotonic deadlines, not timer counts.
 * Shared by browser Worker, P2P and dedicated server hosts.
 */
export class ServerLoop {
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private generation = 0;
  private nextTickMs = 0;
  private readonly tickFn: (dt: number) => void;
  private fixedDt: number;

  constructor(
    tickFn: (dt: number) => void,
    tickRate = TICK_RATE,
    private readonly onError?: (error: unknown) => void,
  ) {
    this.tickFn = tickFn;
    this.fixedDt = 1 / tickRate;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.generation++;
    this.nextTickMs = performance.now() + this.fixedDt * 1000;
    this.schedule();
  }

  private schedule(): void {
    const generation = this.generation;
    // Round up so a fractional browser/Node timer cannot run simulation early.
    // Late wakes keep the original deadline; work time never shifts the clock.
    const delay = Math.max(1, Math.ceil(this.nextTickMs - performance.now()));
    this.timerId = setTimeout(() => this.pump(generation), delay);
  }

  private pump(generation: number): void {
    if (!this.running || generation !== this.generation) return;
    this.timerId = null;
    const now = performance.now();
    const stepMs = this.fixedDt * 1000;
    if (now - this.nextTickMs + stepMs > MAX_CATCHUP_MS)
      this.nextTickMs = now - MAX_CATCHUP_MS + stepMs;
    while (now >= this.nextTickMs) {
      const dt = this.fixedDt;
      // Consume before callbacks can stop/restart or change the active rate.
      this.nextTickMs += dt * 1000;
      try {
        this.tickFn(dt);
      } catch (err) {
        serverLogError("tick error", err);
        this.onError?.(err);
      }
      if (!this.running || generation !== this.generation) return;
    }
    this.schedule();
  }

  stop(): void {
    this.running = false;
    this.generation++;
    if (this.timerId !== null) clearTimeout(this.timerId);
    this.timerId = null;
  }

  setTickRate(hz: number): void {
    if (!Number.isFinite(hz) || hz <= 0) return;
    this.setTickMs(1000 / hz);
  }

  setTickMs(ms: number): void {
    if (!Number.isFinite(ms) || ms <= 0) return;
    this.fixedDt = ms / 1000;
    if (this.running) {
      this.stop();
      this.start();
    }
  }
}
