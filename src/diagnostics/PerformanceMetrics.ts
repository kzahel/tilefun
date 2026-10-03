/** Opt-in, bounded CPU timings. Each execution context owns its own recorder. */
export class PerformanceMetrics {
  enabled = false;
  private timings = new Map<
    string,
    { values: number[]; next: number; count: number; totalMs: number; maxMs: number }
  >();
  static readonly capacity = 512;

  start(): number {
    return this.enabled ? performance.now() : 0;
  }

  end(name: string, start: number): void {
    if (this.enabled) this.record(name, performance.now() - start);
  }

  record(name: string, ms: number): void {
    if (!this.enabled) return;
    let timing = this.timings.get(name);
    if (!timing) {
      if (this.timings.size >= 32) return;
      timing = { values: [], next: 0, count: 0, totalMs: 0, maxMs: 0 };
      this.timings.set(name, timing);
    }
    timing.values[timing.next] = ms;
    timing.next = (timing.next + 1) % PerformanceMetrics.capacity;
    timing.count++;
    timing.totalMs += ms;
    timing.maxMs = Math.max(timing.maxMs, ms);
  }

  reset(): void {
    this.timings.clear();
  }

  /** Sorting happens only on explicit diagnostic reads, never in the frame loop. */
  snapshot() {
    return Object.fromEntries(
      [...this.timings].map(([name, t]) => {
        const sorted = [...t.values].sort((a, b) => a - b);
        const at = (p: number) =>
          sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
        return [
          name,
          {
            count: t.count,
            totalMs: t.totalMs,
            maxMs: t.maxMs,
            retained: sorted.length,
            p50Ms: at(0.5),
            p95Ms: at(0.95),
            p99Ms: at(0.99),
          },
        ];
      }),
    );
  }
}

export const performanceMetrics = new PerformanceMetrics();
export type PerformanceSnapshot = ReturnType<PerformanceMetrics["snapshot"]>;
