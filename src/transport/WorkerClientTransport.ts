import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import { decodeServerMessage, encodeClientMessage } from "../shared/binaryCodec.js";
import type {
  LocalHostBoot,
  LocalHostDiagnostics,
  LocalHostPacket,
} from "../shared/localHostProtocol.js";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import { type ChannelEnvelope, OrderedWorkerChannel } from "./OrderedWorkerChannel.js";
import type { ConnectionIdentity, IClientTransport } from "./Transport.js";

export interface WorkerEndpoint {
  postMessage(message: unknown, transfer: ArrayBuffer[]): void;
  terminate(): void;
  onmessage:
    | ((event: MessageEvent<LocalHostBoot | ChannelEnvelope<LocalHostPacket>>) => void)
    | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
}

/** One local authority instance, one ordered binary transport, explicit lifecycle. */
export class WorkerClientTransport implements IClientTransport {
  private readonly channel: OrderedWorkerChannel<LocalHostPacket>;
  private state: "starting" | "ready" | "stopping" | "stopped" | "failed" = "starting";
  private messageHandler: ((message: ServerMessage) => void) | undefined;
  private disconnectHandler: (() => void) | undefined;
  private readonly startup: Promise<void>;
  private resolveStartup!: () => void;
  private rejectStartup!: (error: Error) => void;
  private startupTimer: ReturnType<typeof setTimeout>;
  private autoPump = true;
  private pumpTimer: ReturnType<typeof setTimeout> | undefined;
  private nextId = 1;
  private shutdownPromise: Promise<void> | undefined;
  private readonly requests = new Map<
    number,
    {
      resolve: (result: LocalHostDiagnostics | undefined) => void;
      reject: (error: Error) => void;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  bytesReceived = 0;

  constructor(
    private readonly worker: WorkerEndpoint,
    private readonly options: {
      metrics?: boolean;
      onError?: (error: Error) => void;
      timeoutMs?: number;
    } = {},
  ) {
    this.channel = new OrderedWorkerChannel((message, transfer) =>
      worker.postMessage(message, transfer),
    );
    this.startup = new Promise((resolve, reject) => {
      this.resolveStartup = resolve;
      this.rejectStartup = reject;
    });
    // The host may fail before its caller reaches ready(). Preserve the rejection for that caller.
    void this.startup.catch(() => {});
    this.startupTimer = setTimeout(
      () => this.fail(new Error("Local server startup timed out")),
      options.timeoutMs ?? 30000,
    );
    worker.onmessage = ({ data }) => {
      if (this.state === "stopped" || this.state === "failed") return;
      try {
        if (data.kind === "ready") {
          if (this.state !== "starting") throw Error("Unexpected local server readiness");
          this.state = "ready";
          clearTimeout(this.startupTimer);
          this.resolveStartup();
        } else if (data.kind === "failed") this.fail(new Error(data.error));
        else if (data.kind === "batch" || data.kind === "credit") {
          this.channel.receive(data);
          this.schedulePump();
        }
      } catch (error) {
        this.fail(error);
      }
    };
    worker.onerror = (event) => {
      event.preventDefault();
      this.fail(new Error(event.message || "Local server Worker failed"));
    };
    worker.onmessageerror = () =>
      this.fail(new Error("Could not decode local server Worker message"));
    worker.postMessage({ kind: "init", metrics: options.metrics ?? false }, []);
  }

  ready(): Promise<void> {
    return this.startup;
  }
  connect(identity?: ConnectionIdentity): void {
    this.channel.send({ type: "connect", ...(identity ? { identity } : {}) });
  }
  start(): void {
    this.autoPump = false;
    this.channel.send({ type: "start" });
  }
  setHidden(hidden: boolean): void {
    if (this.state !== "ready") return;
    this.autoPump = hidden;
    this.channel.send({ type: "visibility", hidden });
    this.schedulePump();
  }

  send(message: ClientMessage): void {
    if (this.state !== "ready") return;
    try {
      const start = performanceMetrics.start();
      const buffer = encodeClientMessage(message);
      performanceMetrics.end("client.encode", start);
      this.channel.send({ type: "message", buffer });
    } catch (error) {
      this.fail(error);
    }
  }
  onMessage(handler: (message: ServerMessage) => void): void {
    this.messageHandler = handler;
  }
  onDisconnect(handler: () => void): void {
    this.disconnectHandler = handler;
  }

  pump(): void {
    if (this.state === "failed" || this.state === "stopped") return;
    try {
      this.channel.pump((packet) => {
        if (packet.type === "message") {
          const start = performanceMetrics.start();
          this.bytesReceived += packet.buffer.byteLength;
          const message = decodeServerMessage(packet.buffer);
          performanceMetrics.end("client.decode", start);
          this.messageHandler?.(message);
        } else if (packet.type === "result") {
          const request = this.requests.get(packet.id);
          if (!request) throw Error("Unexpected local server lifecycle response");
          clearTimeout(request.timer);
          this.requests.delete(packet.id);
          request.resolve(packet.diagnostics);
        } else throw Error("Unexpected local server packet");
      });
    } catch (error) {
      this.fail(error);
    }
  }

  flush(): Promise<void> {
    return this.request("flush").then(() => {});
  }
  async getDiagnostics() {
    return {
      authority: await this.request("diagnostics"),
      clientChannel: this.channel.diagnostics(),
      state: this.state,
    };
  }
  resetDiagnostics(): Promise<void> {
    return this.request("reset-diagnostics").then(() => {});
  }

  shutdown(): Promise<void> {
    if (this.shutdownPromise) return this.shutdownPromise;
    if (this.state === "stopped" || this.state === "failed") return Promise.resolve();
    this.shutdownPromise = (async () => {
      await this.ready();
      this.state = "stopping";
      this.autoPump = true;
      this.schedulePump();
      await this.request("shutdown");
      this.state = "stopped";
      this.cleanup();
      this.disconnectHandler?.();
    })();
    return this.shutdownPromise;
  }
  close(): void {
    void this.shutdown().catch((error) => this.fail(error));
  }
  getDebugInfo() {
    return { transport: `Local server Worker (${this.state})` };
  }

  private request(
    type: "flush" | "shutdown" | "diagnostics" | "reset-diagnostics",
  ): Promise<LocalHostDiagnostics | undefined> {
    if (this.state !== "ready" && !(this.state === "stopping" && type === "shutdown"))
      return Promise.reject(new Error("Local server is not ready"));
    if (this.requests.size >= 32)
      return Promise.reject(new Error("Too many local server lifecycle requests"));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.fail(new Error(`Local server ${type} timed out`)),
        this.options.timeoutMs ?? 30000,
      );
      this.requests.set(id, { resolve, reject, timer });
      try {
        this.channel.send({ type, id });
      } catch (error) {
        this.fail(error);
      }
    });
  }

  private schedulePump(): void {
    if (!this.autoPump || !this.channel.pending || this.pumpTimer !== undefined) return;
    this.pumpTimer = setTimeout(() => {
      this.pumpTimer = undefined;
      this.pump();
      this.schedulePump();
    }, 0);
  }
  private fail(reason: unknown): void {
    if (this.state === "failed" || this.state === "stopped") return;
    const error = reason instanceof Error ? reason : new Error(String(reason));
    this.state = "failed";
    this.rejectStartup(error);
    for (const request of this.requests.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.requests.clear();
    this.cleanup();
    this.disconnectHandler?.();
    this.options.onError?.(error);
  }
  private cleanup(): void {
    clearTimeout(this.startupTimer);
    clearTimeout(this.pumpTimer);
    this.channel.close();
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.onmessageerror = null;
    this.worker.terminate();
  }
}
