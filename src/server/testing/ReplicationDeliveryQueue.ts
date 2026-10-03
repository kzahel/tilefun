import type { ServerMessage } from "../../shared/protocol.js";
import { routeServerMessageChannel } from "../../transport/webrtcChannels.js";

interface PendingDelivery {
  message: ServerMessage;
  due: number;
}

/** Application-level channel model, not SCTP/UDP emulation. Reliable loss is
 * represented by a bounded extra delay; later messages cannot overtake it.
 * The legacy switch exists only to reproduce the pre-fix audit.
 */
export class ReplicationDeliveryQueue {
  private reliable: PendingDelivery[] = [];
  private unreliable: PendingDelivery[] = [];
  dropped = 0;
  delayedByLoss = 0;

  constructor(
    private readonly deliver: (message: ServerMessage) => void,
    private readonly legacyUnreliableFrames = false,
  ) {}

  enqueue(message: ServerMessage, tick: number, delayTicks = 0, lost = false): void {
    const channel =
      this.legacyUnreliableFrames && message.type === "frame"
        ? "entities"
        : routeServerMessageChannel(message, true).channel;
    if (channel === "entities" && lost) {
      this.dropped++;
      return;
    }
    if (channel === "sync" && lost) this.delayedByLoss++;
    const queue = channel === "sync" ? this.reliable : this.unreliable;
    queue.push({ message, due: tick + delayTicks + (lost ? 30 : 0) });
  }

  drain(tick: number): void {
    while (this.reliable[0] && this.reliable[0].due <= tick) {
      const item = this.reliable.shift();
      if (item) this.deliver(item.message);
    }
    this.unreliable.sort((a, b) => a.due - b.due);
    while (this.unreliable[0] && this.unreliable[0].due <= tick) {
      const item = this.unreliable.shift();
      if (item) this.deliver(item.message);
    }
  }
}
