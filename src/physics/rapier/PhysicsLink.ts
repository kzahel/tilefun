/** Seeded ordered application delay, usable with virtual or wall-clock time.
 * Mirrors the game's reliable ordered boundary; does not model WebRTC loss. */
export class PhysicsLink<T> {
  private queue: { at: number; value: T; bytes: number }[] = [];
  private bytes = 0;
  private random: number;
  constructor(
    readonly delayMs: number,
    readonly jitterMs: number,
    seed: number,
  ) {
    this.random = seed;
  }
  push(now: number, value: T, bytes = 0) {
    if (this.queue.length >= 1024 || this.bytes + bytes > 16 * 1024 * 1024)
      throw Error("Physics link queue exceeded its bound");
    this.random = (Math.imul(this.random, 1664525) + 1013904223) >>> 0;
    const jitter = ((this.random / 0xffffffff) * 2 - 1) * this.jitterMs;
    this.queue.push({
      at: Math.max(now + Math.max(0, this.delayMs + jitter), this.queue.at(-1)?.at ?? 0),
      value,
      bytes,
    });
    this.bytes += bytes;
  }
  drain(now: number): T[] {
    const ready: T[] = [];
    while (this.queue[0] && this.queue[0].at <= now && ready.length < 64) {
      const item = this.queue.shift();
      if (!item) break;
      this.bytes -= item.bytes;
      ready.push(item.value);
    }
    return ready;
  }
  get pending() {
    return this.queue.length;
  }
  clear() {
    this.queue = [];
    this.bytes = 0;
  }
}
