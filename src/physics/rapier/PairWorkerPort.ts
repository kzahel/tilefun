import {
  type ChannelEnvelope,
  OrderedWorkerChannel,
} from "../../transport/OrderedWorkerChannel.js";
import type { PairAuthorityPort, PairFrame, ScheduledPhysicsInput } from "./PairAuthority.js";
import type { PairScenario } from "./PhysicsScenarios.js";
import type { PairPacket } from "./pair.worker.js";

/** One request in flight; no unbounded RPC queue during Worker stalls. */
export class PairWorkerPort implements PairAuthorityPort {
  private worker = new Worker(new URL("./pair.worker.ts", import.meta.url), { type: "module" });
  private channel = new OrderedWorkerChannel<PairPacket>((message, transfer) =>
    this.worker.postMessage(message, transfer),
  );
  private sequence = 0;
  private pending:
    | {
        id: number;
        resolve: (frame: PairFrame | undefined) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    | undefined;
  private closed = false;
  constructor() {
    this.worker.onmessage = (event: MessageEvent<ChannelEnvelope<PairPacket>>) => {
      this.channel.receive(event.data);
      this.channel.pump((packet) => {
        const pending = this.pending;
        if (!pending || packet.id !== pending.id) return;
        clearTimeout(pending.timer);
        this.pending = undefined;
        if (packet.type === "error") pending.reject(new Error(packet.message));
        else if (packet.type === "result") pending.resolve(packet.frame);
        else if (packet.type === "closed") pending.resolve(undefined);
      });
    };
    this.worker.onerror = (event) => this.fail(new Error(event.message));
  }
  private fail(error: Error) {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(error);
      this.pending = undefined;
    }
  }
  private request(packet: PairPacket): Promise<PairFrame | undefined> {
    if (this.pending || this.closed)
      return Promise.reject(new Error("Pair port is busy or closed"));
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => this.fail(new Error("Pair Worker timed out")), 10000);
      this.pending = { id: packet.id, resolve, reject, timer };
      this.channel.send(packet);
    });
  }
  async open(scene: PairScenario) {
    const frame = await this.request({ type: "open", id: ++this.sequence, scene });
    if (!frame) throw Error("Missing initial pair frame");
    return frame;
  }
  async step(inputs: ScheduledPhysicsInput[]) {
    const frame = await this.request({ type: "step", id: ++this.sequence, inputs });
    if (!frame) throw Error("Missing pair frame");
    return frame;
  }
  async close() {
    if (this.closed) return;
    // Disposal can happen during a tick. Reject it and terminate the disposable
    // memory-only realm rather than retaining a late response or another timer.
    this.closed = true;
    this.fail(new Error("Pair port closed"));
    this.worker.terminate();
    this.channel.close();
  }
}
