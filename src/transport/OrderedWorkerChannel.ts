/** A bounded FIFO with one transferred batch in flight in each direction.
 * Credits are returned only after consumption, including browser delivery time.
 * Never drops deltas or puts lifecycle fences ahead of pending commands.
 */
export type ChannelEnvelope<T> = { kind: "batch"; items: T[] } | { kind: "credit" };
export interface BufferedPacket {
  buffer?: ArrayBuffer;
}
export class OrderedWorkerChannel<T extends BufferedPacket> {
  private outgoing: T[] = [];
  private incoming: T[] = [];
  private cursor = 0;
  private queuedBytes = 0;
  private flightBytes = 0;
  private flightCount = 0;
  private scheduled = false;
  private closed = false;
  private receivedAt = 0;
  highWaterBytes = 0;
  highWaterCount = 0;
  static readonly maxBytes = 16 * 1024 * 1024;
  static readonly maxCount = 1024;

  constructor(
    private readonly post: (message: ChannelEnvelope<T>, transfer: ArrayBuffer[]) => void,
  ) {}

  send(item: T): void {
    if (this.closed) return;
    const bytes = item.buffer?.byteLength ?? 0;
    if (
      this.queuedBytes + this.flightBytes + bytes > OrderedWorkerChannel.maxBytes ||
      this.outgoing.length + this.flightCount >= OrderedWorkerChannel.maxCount
    )
      throw new Error("Local server message queue exceeded its bound");
    this.outgoing.push(item);
    this.queuedBytes += bytes;
    this.highWaterBytes = Math.max(this.highWaterBytes, this.queuedBytes + this.flightBytes);
    this.highWaterCount = Math.max(this.highWaterCount, this.outgoing.length + this.flightCount);
    this.schedule();
  }

  receive(message: ChannelEnvelope<T>): void {
    if (this.closed) return;
    if (message.kind === "credit") {
      if (!this.flightCount) throw new Error("Unexpected local server credit");
      this.flightCount = 0;
      this.flightBytes = 0;
      this.schedule();
    } else {
      if (this.incoming.length) throw new Error("Local server exceeded receive credit");
      if (
        !message.items.length ||
        message.items.length > 64 ||
        message.items.reduce((sum, item) => sum + (item.buffer?.byteLength ?? 0), 0) >
          OrderedWorkerChannel.maxBytes
      )
        throw new Error("Invalid local server batch");
      this.incoming = message.items;
      this.cursor = 0;
      this.receivedAt = performance.now();
    }
  }

  /** A single message is atomic. The time bound is checked between messages. */
  pump(consume: (item: T) => void, budgetMs = 2): void {
    const until = performance.now() + budgetMs;
    let count = 0;
    while (!this.closed && this.cursor < this.incoming.length) {
      const item = this.incoming[this.cursor++];
      if (item) consume(item);
      if (++count >= 64 || performance.now() >= until) break;
    }
    if (!this.closed && this.incoming.length && this.cursor === this.incoming.length) {
      this.incoming = [];
      this.cursor = 0;
      this.post({ kind: "credit" }, []);
    }
  }

  get pending(): boolean {
    return this.cursor < this.incoming.length;
  }
  get writable(): boolean {
    return this.outgoing.length < 64 && this.queuedBytes < 1024 * 1024;
  }
  diagnostics() {
    return {
      queued: this.outgoing.length,
      queuedBytes: this.queuedBytes,
      inFlight: this.flightCount,
      inFlightBytes: this.flightBytes,
      incoming: this.incoming.length - this.cursor,
      oldestIncomingMs: this.pending ? performance.now() - this.receivedAt : 0,
      highWaterBytes: this.highWaterBytes,
      highWaterCount: this.highWaterCount,
    };
  }
  close(): void {
    this.closed = true;
    this.outgoing = [];
    this.incoming = [];
    this.queuedBytes = 0;
    this.flightBytes = 0;
    this.flightCount = 0;
    this.cursor = 0;
  }

  private schedule(): void {
    if (this.scheduled || this.closed || this.flightCount) return;
    this.scheduled = true;
    queueMicrotask(() => {
      this.scheduled = false;
      if (this.closed || this.flightCount || !this.outgoing.length) return;
      const items: T[] = [],
        transfer: ArrayBuffer[] = [];
      let bytes = 0;
      while (items.length < 64 && this.outgoing.length && bytes < 1024 * 1024) {
        const item = this.outgoing.shift();
        if (!item) break;
        items.push(item);
        if (item.buffer) {
          bytes += item.buffer.byteLength;
          transfer.push(item.buffer);
        }
      }
      this.queuedBytes -= bytes;
      this.flightBytes = bytes;
      this.flightCount = items.length;
      this.post({ kind: "batch", items }, transfer);
    });
  }
}
