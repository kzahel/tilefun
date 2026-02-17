import { TICK_RATE } from "../config/constants.js";
import { serverLogError } from "./serverLog.js";

/**
 * Server-side tick loop using setInterval.
 * Not used in phase 1 local mode (client drives server.tick() directly).
 * Created for future remote mode.
 */
export class ServerLoop {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly tickFn: (dt: number) => void;
  private fixedDt: number;

  constructor(tickFn: (dt: number) => void, tickRate = TICK_RATE) {
    this.tickFn = tickFn;
    this.fixedDt = 1 / tickRate;
  }

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => {
      try {
        this.tickFn(this.fixedDt);
      } catch (err) {
        serverLogError("tick error", err);
      }
    }, this.fixedDt * 1000);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  setTickRate(hz: number): void {
    if (hz <= 0) return;
    this.fixedDt = 1 / hz;
    // Restart interval at new rate if currently running
    if (this.intervalId !== null) {
      this.stop();
      this.start();
    }
  }

  setTickMs(ms: number): void {
    if (ms <= 0) return;
    this.fixedDt = ms / 1000;
    // Restart interval at new rate if currently running
    if (this.intervalId !== null) {
      this.stop();
      this.start();
    }
  }
}
