import { TICK_RATE } from "../config/constants.js";

const FIXED_DT = 1 / TICK_RATE;

/**
 * Server-side tick loop using setInterval.
 * Not used in phase 1 local mode (client drives server.tick() directly).
 * Created for future remote mode.
 */
export class ServerLoop {
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly tickFn: (dt: number) => void;

  constructor(tickFn: (dt: number) => void) {
    this.tickFn = tickFn;
  }

  start(): void {
    if (this.intervalId !== null) return;
    this.intervalId = setInterval(() => {
      this.tickFn(FIXED_DT);
    }, FIXED_DT * 1000);
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
}
