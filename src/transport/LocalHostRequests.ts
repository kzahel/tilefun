import type { LocalHostPacket } from "../shared/localHostProtocol.js";

/** A numbered request to a local authority; it answers with a `result` packet. */
export type LocalHostRequest =
  | { type: "flush" | "shutdown" | "diagnostics" | "reset-diagnostics" }
  | { type: "admin"; request: unknown };
export type LocalHostResult = Extract<LocalHostPacket, { type: "result" }>;

/** Outstanding requests, each settled once: by its result in channel order, or
 * rejected when it times out or the authority fails. */
export class LocalHostRequests {
  private nextId = 1;
  private readonly pending = new Map<
    number,
    {
      resolve: (result: LocalHostResult) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();

  constructor(
    private readonly timeoutMs: number,
    private readonly timedOut: (error: Error) => void,
  ) {}

  /** Number the request and hand its packet to `send`. */
  open(
    request: LocalHostRequest,
    send: (packet: LocalHostPacket) => void,
  ): Promise<LocalHostResult> {
    if (this.pending.size >= 32)
      return Promise.reject(new Error("Too many local server lifecycle requests"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.timedOut(new Error(`Local server ${request.type} timed out`)),
        this.timeoutMs,
      );
      this.pending.set(id, { resolve, reject, timer });
      send({ ...request, id } as LocalHostPacket);
    });
  }

  answer(result: LocalHostResult): void {
    const request = this.pending.get(result.id);
    if (!request) throw Error("Unexpected local server lifecycle response");
    clearTimeout(request.timer);
    this.pending.delete(result.id);
    if (result.error) request.reject(new Error(result.error));
    else request.resolve(result);
  }

  rejectAll(error: Error): void {
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }
}
