import {
  type ChannelEnvelope,
  OrderedWorkerChannel,
} from "../../transport/OrderedWorkerChannel.js";
import { PairAuthority, type PairFrame, type ScheduledPhysicsInput } from "./PairAuthority.js";
import type { PairScenario } from "./PhysicsScenarios.js";

export type PairPacket = { buffer?: ArrayBuffer } & (
  | { type: "open"; id: number; scene: PairScenario }
  | { type: "step"; id: number; inputs: ScheduledPhysicsInput[] }
  | { type: "close"; id: number }
  | { type: "result"; id: number; frame: PairFrame; buffer: ArrayBuffer }
  | { type: "closed"; id: number }
  | { type: "error"; id: number; message: string }
);
let authority: PairAuthority | undefined;
let tail: Promise<void> = Promise.resolve();
const channel = new OrderedWorkerChannel<PairPacket>((message, transfer) =>
  self.postMessage(message, { transfer }),
);
async function receive(packet: PairPacket) {
  try {
    let frame: PairFrame;
    if (packet.type === "open") {
      await authority?.close();
      authority = await PairAuthority.create(packet.scene);
      frame = authority.frame();
    } else if (packet.type === "step") {
      if (!authority) throw Error("Pair authority not open");
      frame = await authority.step(packet.inputs);
    } else if (packet.type === "close") {
      await authority?.close();
      authority = undefined;
      channel.send({ type: "closed", id: packet.id });
      return;
    } else return;
    // The large WASM snapshot is an owned transferable, charged by the normal channel.
    const buffer = frame.snapshot.state.bytes.buffer as ArrayBuffer;
    channel.send({ type: "result", id: packet.id, frame, buffer });
  } catch (error) {
    channel.send({ type: "error", id: packet.id, message: String(error) });
  }
}
self.onmessage = (event: MessageEvent<ChannelEnvelope<PairPacket>>) => {
  channel.receive(event.data);
  channel.pump((packet) => {
    tail = tail.then(() => receive(packet));
  });
};
