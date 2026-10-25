import type { FaultAuthority, FaultReport } from "../diagnostics/FaultReport.js";
import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import { decodeServerMessage, encodeClientMessage } from "../shared/binaryCodec.js";
import type {
  LocalHostBoot,
  LocalHostDiagnostics,
  LocalHostPacket,
  PeerHostPacket,
} from "../shared/localHostProtocol.js";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import { LocalServerWatchdog } from "./LocalServerWatchdog.js";
import { type ChannelEnvelope, OrderedWorkerChannel } from "./OrderedWorkerChannel.js";
import type { ConnectionIdentity, IClientTransport } from "./Transport.js";
import { WorkerPeerLink } from "./WorkerPeerLink.js";

export interface WorkerEndpoint {
  postMessage(message: unknown, transfer: Transferable[]): void;
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
  private failure: Error | undefined;
  private failureChannel:
    | ReturnType<OrderedWorkerChannel<LocalHostPacket>["diagnostics"]>
    | undefined;
  private readonly watchdog: LocalServerWatchdog;
  private watchdogTimer: ReturnType<typeof setInterval> | undefined;
  private hidden = false;
  private lastAuthority: LocalHostDiagnostics | undefined;
  private probeId = 0;
  private acceptedProbe = 0;
  private reportedStorageFailure = false;
  private readonly startup: Promise<void>;
  private resolveStartup!: () => void;
  private rejectStartup!: (error: Error) => void;
  private startupTimer: ReturnType<typeof setTimeout>;
  private autoPump = true;
  private pumpTimer: ReturnType<typeof setTimeout> | undefined;
  private nextId = 1;
  private nextConnectionId = 1;
  private readonly peers = new Map<string, { connectionId: number; link: WorkerPeerLink }>();
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
      watchdogMs?: number;
      onFault?: (kind: FaultReport["kind"], error: Error) => void;
      keepAliveWhenHidden?: boolean;
    } = {},
  ) {
    this.watchdog = new LocalServerWatchdog(options.watchdogMs);
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
        } else if (data.kind === "heartbeat") {
          if (data.id <= this.acceptedProbe || data.id > this.probeId) return;
          this.acceptedProbe = data.id;
          this.lastAuthority = data.diagnostics;
          if (!this.hidden) this.watchdog.reply(performance.now(), data.diagnostics.ticks);
          const failures = (data.diagnostics.persistence ?? []).reduce(
            (n, r) => n + (r.residency?.failures ?? 0),
            0,
          );
          if (failures >= 2 && !this.reportedStorageFailure) {
            this.reportedStorageFailure = true;
            this.options.onFault?.(
              "chunk-failure",
              new Error("Repeated local chunk persistence failures"),
            );
          }
        } else if (data.kind === "peer-closed") {
          const peer = this.peers.get(data.clientId);
          if (peer?.connectionId === data.connectionId) peer.link.close(data.error);
        } else if (data.kind === "failed") {
          const error = new Error(data.error);
          if (data.stack) error.stack = data.stack;
          this.fail(error);
        } else if (data.kind === "batch" || data.kind === "credit") {
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
    worker.postMessage(
      {
        kind: "init",
        metrics: options.metrics ?? false,
        keepAliveWhenHidden: options.keepAliveWhenHidden ?? false,
      },
      [],
    );
  }

  ready(): Promise<void> {
    return this.startup;
  }
  /** Each guest owns an independent ordered port and publication credit. */
  attachPeer(
    clientId: string,
    consume: (packet: PeerHostPacket) => void,
    onClose: (error?: unknown) => void,
    canConsume?: () => boolean,
  ): WorkerPeerLink {
    if (this.state !== "ready") throw Error("Local authority is not ready for guests");
    if (!clientId || clientId === "local") throw Error("Invalid guest identity");
    this.peers.get(clientId)?.link.close();
    const { port1, port2 } = new MessageChannel();
    const connectionId = this.nextConnectionId++;
    const link = new WorkerPeerLink(
      port1,
      consume,
      (error) => {
        if (this.peers.get(clientId)?.link === link) {
          this.peers.delete(clientId);
          if (this.state === "ready")
            this.worker.postMessage({ kind: "detach-peer", clientId, connectionId }, []);
        }
        onClose(error);
      },
      canConsume,
    );
    this.peers.set(clientId, { connectionId, link });
    try {
      this.worker.postMessage({ kind: "attach-peer", clientId, connectionId, port: port2 }, [
        port2,
      ]);
    } catch (error) {
      port2.close();
      link.close(error);
    }
    return link;
  }
  connect(identity?: ConnectionIdentity): void {
    this.channel.send({ type: "connect", ...(identity ? { identity } : {}) });
  }
  start(): void {
    this.autoPump = false;
    this.channel.send({ type: "start" });
    this.watchdog.reset(performance.now());
    if (this.watchdogTimer === undefined)
      this.watchdogTimer = setInterval(
        () => this.probe(),
        Math.min(5000, this.watchdog.timeoutMs / 4),
      );
  }
  setHidden(hidden: boolean): void {
    if (this.state !== "ready") return;
    this.hidden = hidden;
    this.watchdog.reset(performance.now());
    this.autoPump = hidden;
    this.channel.send({ type: "visibility", hidden });
    this.schedulePump();
  }

  send(message: ClientMessage): void {
    if (this.failure && "requestId" in message) throw this.failure;
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
          if (packet.error) request.reject(new Error(packet.error));
          else request.resolve(packet.diagnostics);
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
      authority: this.failure ? undefined : await this.request("diagnostics"),
      clientChannel: this.channel.diagnostics(),
      state: this.state,
      ...(this.failure ? { error: this.failure.message, stack: this.failure.stack } : {}),
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
    })().catch((error) => {
      if (this.state === "stopping") this.state = "ready";
      this.shutdownPromise = undefined;
      throw error;
    });
    return this.shutdownPromise;
  }
  close(): void {
    void this.shutdown().catch((error) =>
      this.options.onError?.(error instanceof Error ? error : new Error(String(error))),
    );
  }
  getDebugInfo() {
    return { transport: `Local server Worker (${this.state})` };
  }

  getFaultDiagnostics(): FaultAuthority {
    const a = this.lastAuthority,
      channel = this.failureChannel ?? this.channel.diagnostics();
    return {
      state: this.state,
      ticks: a?.ticks ?? 0,
      hidden: this.hidden,
      queuedBytes: channel.queuedBytes,
      inFlightBytes: channel.inFlightBytes,
      realms: (a?.persistence ?? []).slice(0, 8).map((r) => ({
        realmId: (r.realmId ?? "").slice(0, 100),
        loadedChunks: r.loadedChunks,
        transitioningPlayers: r.transitioningPlayers,
        loading: r.residency?.states.loading ?? 0,
        failed: r.residency?.states.failed ?? 0,
        failures: r.residency?.failures ?? 0,
        lastError: (r.residency?.lastError ?? "").slice(0, 1000),
      })),
    };
  }
  private probe(): void {
    if (this.state !== "ready" || this.hidden) return;
    const problem = this.watchdog.check(performance.now());
    if (problem) {
      const error = new Error(`${problem}. Reload to recover.`);
      error.name = "LocalServerHang";
      this.fail(error);
      return;
    }
    try {
      this.worker.postMessage({ kind: "probe", id: ++this.probeId }, []);
    } catch (error) {
      this.fail(error);
    }
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
    this.failureChannel = this.channel.diagnostics();
    this.failure = error;
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
    for (const peer of this.peers.values()) peer.link.close();
    clearTimeout(this.startupTimer);
    clearInterval(this.watchdogTimer);
    clearTimeout(this.pumpTimer);
    this.channel.close();
    this.worker.onmessage = null;
    this.worker.onerror = null;
    this.worker.onmessageerror = null;
    this.worker.terminate();
  }
}
