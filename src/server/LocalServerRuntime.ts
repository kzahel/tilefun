import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import { decodeClientMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import type { LocalHostDiagnostics, LocalHostPacket } from "../shared/localHostProtocol.js";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import { type ChannelEnvelope, OrderedWorkerChannel } from "../transport/OrderedWorkerChannel.js";
import type { ConnectionIdentity, IServerTransport } from "../transport/Transport.js";
import { type PeerPort, WorkerPeerLink } from "../transport/WorkerPeerLink.js";
import { GameServer } from "./GameServer.js";
import { browserServerDependencies } from "./hosts/browser.js";

export interface LocalAuthority {
  init(): Promise<void>;
  startLoop(): void;
  stopLoop(): void;
  settle(): Promise<void>;
  flushAsync(): Promise<void>;
  destroy(): void | Promise<void>;
  completedTicks: number;
  readonly persistenceDiagnostics?: GameServer["persistenceDiagnostics"];
  onLoopError: ((error: unknown) => void) | undefined;
}

/** Owns the local authority lifecycle; the Worker entry point only forwards messages. */
export class LocalServerRuntime {
  private readonly channel: OrderedWorkerChannel<LocalHostPacket>;
  private readonly server: LocalAuthority;
  private onMessage: ((id: string, msg: ClientMessage) => void) | undefined;
  private onConnect: ((id: string, identity?: ConnectionIdentity) => void) | undefined;
  private onDisconnect: ((id: string) => void) | undefined;
  private readonly peers = new Map<string, { connectionId: number; link: WorkerPeerLink }>();
  private keepAliveWhenHidden = false;
  private state: "starting" | "ready" | "stopping" | "stopped" | "failed" = "starting";
  private started = false;
  private hidden = false;
  private pumpTimer: ReturnType<typeof setTimeout> | undefined;
  private flushChain = Promise.resolve();
  private saveTimer: ReturnType<typeof setInterval> | undefined;
  private checkpointPending = false;

  constructor(
    post: (message: ChannelEnvelope<LocalHostPacket>, transfer: ArrayBuffer[]) => void,
    private readonly fatal: (error: unknown) => void,
    create: (transport: IServerTransport) => LocalAuthority = (transport) =>
      new GameServer(transport, browserServerDependencies()),
  ) {
    this.channel = new OrderedWorkerChannel(post);
    const send = (id: string, message: ServerMessage) => {
      if (id !== "local" && !this.peers.has(id)) return;
      const start = performanceMetrics.start();
      const buffer = encodeServerMessage(message);
      performanceMetrics.end("server.encode", start);
      if (id === "local") this.channel.send({ type: "message", buffer });
      else this.peers.get(id)?.link.send({ buffer, messageType: message.type });
    };
    this.server = create({
      send,
      broadcast: (message) => {
        send("local", message);
        for (const id of this.peers.keys()) send(id, message);
      },
      onMessage: (handler) => {
        this.onMessage = handler;
      },
      onConnect: (handler) => {
        this.onConnect = handler;
      },
      onDisconnect: (handler) => {
        this.onDisconnect = handler;
      },
      canSend: (id) =>
        id === undefined
          ? true
          : id === "local"
            ? this.channel.writable && !(this.keepAliveWhenHidden && this.hidden)
            : (this.peers.get(id)?.link.writable ?? false),
      close: () => {}, // Runtime owns the link until the shutdown receipt is consumed.
    });
    this.server.onLoopError = (error) => this.fail(error);
  }

  async init(metrics: boolean, keepAliveWhenHidden = false): Promise<void> {
    this.keepAliveWhenHidden = keepAliveWhenHidden;
    performanceMetrics.enabled = metrics;
    await this.server.init();
    if (this.state !== "starting") throw Error("Local server stopped during startup");
    this.state = "ready";
  }

  attachPeer(
    clientId: string,
    connectionId: number,
    port: PeerPort,
    closed: (error?: unknown) => void,
  ): void {
    if (this.state !== "ready" || clientId === "local" || !clientId) {
      port.close();
      closed(new Error("Authority cannot attach this guest"));
      return;
    }
    const previous = this.peers.get(clientId);
    if (previous) previous.link.close();
    const link = new WorkerPeerLink(
      port,
      ({ buffer }) => {
        if (this.peers.get(clientId)?.link !== link || this.state !== "ready") return;
        const start = performanceMetrics.start();
        const message = decodeClientMessage(buffer);
        performanceMetrics.end("server.decode", start);
        this.onMessage?.(clientId, message);
      },
      (error) => {
        if (this.peers.get(clientId)?.link === link) {
          this.peers.delete(clientId);
          this.onDisconnect?.(clientId);
        }
        closed(error);
      },
    );
    this.peers.set(clientId, { connectionId, link });
    this.onConnect?.(clientId);
  }

  detachPeer(clientId: string, connectionId: number): void {
    const peer = this.peers.get(clientId);
    if (peer?.connectionId === connectionId) peer.link.close();
  }

  receive(message: ChannelEnvelope<LocalHostPacket>): void {
    if (this.state === "failed") return;
    try {
      this.channel.receive(message);
      this.schedulePump();
    } catch (error) {
      this.fail(error);
    }
  }

  fail(error: unknown): void {
    if (this.state === "failed" || this.state === "stopped") return;
    this.state = "failed";
    clearTimeout(this.pumpTimer);
    clearInterval(this.saveTimer);
    this.server.stopLoop();
    for (const peer of this.peers.values()) peer.link.close();
    this.channel.close();
    this.fatal(error);
  }

  private schedulePump(): void {
    if (this.pumpTimer !== undefined || !this.channel.pending) return;
    this.pumpTimer = setTimeout(() => {
      this.pumpTimer = undefined;
      try {
        this.channel.pump((item) => this.consume(item));
        this.schedulePump();
      } catch (error) {
        this.fail(error);
      }
    }, 0);
  }

  private consume(packet: LocalHostPacket): void {
    if (this.state !== "ready") return;
    switch (packet.type) {
      case "connect":
        this.onConnect?.("local", packet.identity);
        break;
      case "start":
        this.started = true;
        if (!this.hidden || this.keepAliveWhenHidden) this.startSimulation();
        break;
      case "message": {
        const start = performanceMetrics.start();
        const message = decodeClientMessage(packet.buffer);
        performanceMetrics.end("server.decode", start);
        this.onMessage?.("local", message);
        break;
      }
      case "visibility":
        this.hidden = packet.hidden;
        if (this.hidden) {
          if (!this.keepAliveWhenHidden) this.server.stopLoop();
          void this.flush().catch((error) => this.storageFailure(error));
        } else if (this.started) this.startSimulation();
        break;
      case "flush":
        void this.flush().then(
          () => this.channel.send({ type: "result", id: packet.id }),
          (error) => this.storageFailure(error, packet.id),
        );
        break;
      case "shutdown":
        this.state = "stopping";
        this.server.stopLoop();
        clearInterval(this.saveTimer);
        this.saveTimer = undefined;
        void this.flush()
          .then(async () => {
            for (const peer of this.peers.values()) peer.link.close();
            await this.server.destroy();
            this.state = "stopped";
            this.channel.send({ type: "result", id: packet.id });
          })
          .catch((error) => {
            if (this.state === "failed" || this.state === "stopped") return;
            this.state = "ready";
            this.storageFailure(error, packet.id);
            if (this.started && (!this.hidden || this.keepAliveWhenHidden)) this.startSimulation();
          });
        break;
      case "diagnostics": {
        const diagnostics = this.diagnostics();
        this.channel.send({ type: "result", id: packet.id, diagnostics });
        break;
      }
      case "reset-diagnostics":
        performanceMetrics.reset();
        this.channel.send({ type: "result", id: packet.id });
        break;
      case "result":
        throw Error("Unexpected client lifecycle receipt");
    }
  }

  diagnostics(): LocalHostDiagnostics {
    return {
      timings: performanceMetrics.snapshot(),
      channel: this.channel.diagnostics(),
      ticks: this.server.completedTicks,
      hidden: this.hidden,
      persistence: this.server.persistenceDiagnostics ?? [],
      peers: [...this.peers].map(([clientId, peer]) => ({
        clientId,
        channel: peer.link.diagnostics(),
      })),
    };
  }

  private storageFailure(error: unknown, id?: number): void {
    const message = error instanceof Error ? error.message : String(error);
    // The shared server reports pressure for the affected world; the host only
    // rejects its lifecycle receipt and keeps the executor available for retry.
    console.error("[tilefun] Local save delayed", message);
    if (id !== undefined) this.channel.send({ type: "result", id, error: message });
  }
  private startSimulation(): void {
    this.server.startLoop();
    if (this.saveTimer !== undefined) return;
    // Debounced edit saves alone can starve during uninterrupted movement.
    this.saveTimer = setInterval(() => {
      if (
        this.state !== "ready" ||
        (this.hidden && !this.keepAliveWhenHidden) ||
        this.checkpointPending
      )
        return;
      this.checkpointPending = true;
      void this.flush()
        .catch((error) => this.storageFailure(error))
        .finally(() => {
          this.checkpointPending = false;
        });
    }, 5000);
  }

  private flush(): Promise<void> {
    this.flushChain = this.flushChain
      .catch(() => {})
      .then(async () => {
        await this.server.settle();
        await this.server.flushAsync();
      });
    return this.flushChain;
  }
}
