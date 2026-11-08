import type { IServerTransport } from "../../transport/Transport.js";
import type { WorkerEndpoint } from "../../transport/WorkerClientTransport.js";
import {
  type LocalAuthority,
  type LocalAuthorityPort,
  type LocalServerRuntime,
  serveLocalAuthority,
} from "../LocalServerRuntime.js";

/**
 * A local authority Worker in this thread: the real port wiring and runtime,
 * with every message structured-cloned (buffers transferred) and delivered on a
 * later microtask, as between a page and its Worker.
 */
export function inProcessWorker(
  create: (transport: IServerTransport) => LocalAuthority,
  onTerminate: () => void = () => {},
): {
  endpoint: WorkerEndpoint;
  runtime: LocalServerRuntime;
  readonly terminated: number;
  /** An unhandled promise rejection inside the Worker. */
  rejectUnhandled(reason: unknown): void;
} {
  let terminated = 0;
  let unhandled: ((event: PromiseRejectionEvent) => void) | undefined;
  const deliver =
    (target: { onmessage: ((event: MessageEvent) => void) | null }) =>
    (message: unknown, transfer: Transferable[] = []) => {
      const data = structuredClone(message, { transfer });
      queueMicrotask(() => {
        if (!terminated) target.onmessage?.({ data } as MessageEvent);
      });
    };
  const endpoint: WorkerEndpoint = {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    postMessage: () => {},
    terminate: () => {
      terminated++;
      onTerminate();
    },
  };
  const port: LocalAuthorityPort = {
    onmessage: null,
    postMessage: deliver(endpoint),
    addEventListener(_type, listener) {
      unhandled = listener;
    },
  };
  const runtime = serveLocalAuthority(port, create);
  endpoint.postMessage = deliver(port);
  return {
    endpoint,
    runtime,
    get terminated() {
      return terminated;
    },
    rejectUnhandled(reason) {
      unhandled?.({ reason, preventDefault() {} } as PromiseRejectionEvent);
    },
  };
}
