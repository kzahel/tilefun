import { type ChannelEnvelope, OrderedWorkerChannel } from "../transport/OrderedWorkerChannel.js";
import type { ScenarioPacket, ScenarioResponse } from "./ScenarioProtocol.js";
import { ScenarioWorkerHost } from "./ScenarioWorkerHost.js";

const channel = new OrderedWorkerChannel<ScenarioPacket>((message, transfer) =>
  self.postMessage(message, { transfer }),
);
const publish = (response: ScenarioResponse, reset = false) => {
  if (reset && !response.error) channel.send({ type: "reset" });
  for (const buffer of response.frames) channel.send({ type: "frame", buffer });
  const { frames: _, ...metadata } = response;
  channel.send({ type: "response", response: metadata });
};
const host = new ScenarioWorkerHost(publish, () => channel.writable);
let timer: ReturnType<typeof setTimeout> | undefined;
function pump() {
  if (timer !== undefined || !channel.pending) return;
  timer = setTimeout(() => {
    timer = undefined;
    channel.pump((packet) => {
      if (packet.type === "input") host.input(packet.buffer, packet.range);
      else if (packet.type === "request") {
        const r = packet.request;
        void host
          .request(r)
          .then((response) =>
            publish(response, r.kind === "reload" || r.kind === "reset" || r.kind === "open"),
          );
      } else throw new Error("Unexpected scenario client packet");
    });
    pump();
  }, 0);
}
self.onmessage = (event: MessageEvent<ChannelEnvelope<ScenarioPacket>>) => {
  channel.receive(event.data);
  pump();
};
