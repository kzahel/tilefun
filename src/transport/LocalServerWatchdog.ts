/** Visible wall time only; a suspended main thread resets the observation window. */
export class LocalServerWatchdog {
  private sampledAt = 0;
  private repliedAt = 0;
  private progressedAt = 0;
  private ticks: number | undefined;
  constructor(readonly timeoutMs = 30_000) {}
  reset(now: number) {
    this.sampledAt = this.repliedAt = this.progressedAt = now;
    this.ticks = undefined;
  }
  reply(now: number, ticks: number) {
    this.repliedAt = now;
    if (ticks !== this.ticks) this.progressedAt = now;
    this.ticks = ticks;
  }
  check(now: number): string | null {
    // Browser/OS suspension and main-thread stalls cannot establish Worker failure.
    if (now - this.sampledAt > Math.min(10_000, this.timeoutMs)) this.reset(now);
    this.sampledAt = now;
    if (now - this.repliedAt >= this.timeoutMs) return "Local server stopped responding";
    if (this.ticks !== undefined && now - this.progressedAt >= this.timeoutMs)
      return "Local server simulation stopped advancing";
    return null;
  }
}
