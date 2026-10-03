import type { LocalHostBoot, LocalHostPacket } from "../shared/localHostProtocol.js";
import type { ChannelEnvelope } from "../transport/OrderedWorkerChannel.js";
import { LocalServerRuntime } from "./LocalServerRuntime.js";

const port = globalThis as unknown as {
  postMessage(message: unknown, transfer?: ArrayBuffer[]): void;
  onmessage:
    | ((event: MessageEvent<LocalHostBoot | ChannelEnvelope<LocalHostPacket>>) => void)
    | null;
  addEventListener(
    type: "unhandledrejection",
    listener: (event: PromiseRejectionEvent) => void,
  ): void;
};
const runtime = new LocalServerRuntime(
  (message, transfer) => port.postMessage(message, transfer),
  (error) =>
    port.postMessage({
      kind: "failed",
      error: error instanceof Error ? error.message : String(error),
    }),
);
let initialized = false;
port.onmessage = ({ data }) => {
  if (data.kind === "init") {
    if (initialized) {
      runtime.fail(new Error("Duplicate local server initialization"));
      return;
    }
    initialized = true;
    void runtime.init(data.metrics).then(
      () => port.postMessage({ kind: "ready" }),
      (error) => runtime.fail(error),
    );
  } else if (data.kind === "batch" || data.kind === "credit") runtime.receive(data);
};
port.addEventListener("unhandledrejection", (event) => {
  event.preventDefault();
  runtime.fail(event.reason);
});
