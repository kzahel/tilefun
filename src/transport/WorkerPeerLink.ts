import type { PeerHostPacket } from "../shared/localHostProtocol.js";
import { type ChannelEnvelope, OrderedWorkerChannel } from "./OrderedWorkerChannel.js";

/** Structural subset of MessagePort, also usable by deterministic transport tests. */
export interface PeerPort {
  postMessage(message: ChannelEnvelope<PeerHostPacket>, transfer: ArrayBuffer[]): void;
  onmessage: ((event: MessageEvent<ChannelEnvelope<PeerHostPacket>>) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  close(): void;
}

/** Automatically drains network traffic independently of the local render loop.
 * Withholding consumption also withholds credit, bounding a slow guest's bridge.
 */
export class WorkerPeerLink {
  private readonly channel: OrderedWorkerChannel<PeerHostPacket>;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private closed = false;

  constructor(
    private readonly port: PeerPort,
    private readonly consume: (packet: PeerHostPacket) => void,
    private readonly onClose: (error?: unknown) => void,
    private readonly canConsume: () => boolean = () => true,
  ) {
    this.channel = new OrderedWorkerChannel((message, transfer) =>
      port.postMessage(message, transfer),
    );
    port.onmessage = ({ data }) => {
      if (this.closed) return;
      try {
        this.channel.receive(data);
        this.schedulePump();
      } catch (error) {
        this.close(error);
      }
    };
    port.onmessageerror = () => this.close(new Error("Could not decode guest Worker message"));
  }

  send(packet: PeerHostPacket): void {
    if (this.closed) return;
    try {
      this.channel.send(packet);
    } catch (error) {
      this.close(error);
    }
  }
  get writable(): boolean {
    return !this.closed && this.channel.writable;
  }
  diagnostics() {
    return this.channel.diagnostics();
  }

  close(error?: unknown): void {
    if (this.closed) return;
    this.closed = true;
    clearTimeout(this.timer);
    this.channel.close();
    this.port.onmessage = null;
    this.port.onmessageerror = null;
    this.port.close();
    this.onClose(error);
  }

  private schedulePump(): void {
    if (this.closed || this.timer !== undefined || !this.channel.pending) return;
    this.timer = setTimeout(
      () => {
        this.timer = undefined;
        try {
          if (this.canConsume()) this.channel.pump(this.consume);
          this.schedulePump();
        } catch (error) {
          this.close(error);
        }
      },
      this.canConsume() ? 0 : 8,
    );
  }
}
