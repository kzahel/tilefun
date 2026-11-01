/** Ordered, bounded application-delivery shim. Transport credits do not make
 * delayed application memory unbounded. All timers are owned by this object. */
export class OrderedLatency<T> {
  private queue: { at: number; value: T; bytes: number }[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private bytes = 0;
  private sequence = 0;
  delayMs = 0;
  jitterMs = 0;
  constructor(private readonly deliver: (value: T) => void) {}
  push(value: T, bytes = 0): void {
    if (this.queue.length >= 1024 || this.bytes + bytes > 16 * 1024 * 1024)
      throw Error("Simulated delivery queue exceeded its bound");
    const jitter = this.jitterMs * ((((++this.sequence * 16807) % 2147483647) % 101) / 50 - 1);
    const at = Math.max(
      performance.now() + Math.max(0, this.delayMs + jitter),
      this.queue.at(-1)?.at ?? 0,
    );
    this.queue.push({ at, value, bytes });
    this.bytes += bytes;
    this.schedule();
  }
  private schedule() {
    if (this.timer !== undefined || !this.queue.length) return;
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        const now = performance.now();
        const until = now + 2;
        let consumed = 0;
        while (
          this.queue[0] &&
          this.queue[0].at <= now &&
          consumed < 64 &&
          performance.now() <= until
        ) {
          const item = this.queue.shift();
          if (!item) break;
          this.bytes -= item.bytes;
          this.deliver(item.value);
          consumed++;
        }
        this.schedule();
      },
      Math.max(0, Math.ceil((this.queue[0]?.at ?? 0) - performance.now())),
    );
  }
  get pending() {
    return this.queue.length;
  }
  close(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.queue = [];
    this.bytes = 0;
  }
}
