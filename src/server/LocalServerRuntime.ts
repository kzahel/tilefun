import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import { decodeClientMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import type { LocalHostDiagnostics, LocalHostPacket } from "../shared/localHostProtocol.js";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import { type ChannelEnvelope, OrderedWorkerChannel } from "../transport/OrderedWorkerChannel.js";
import type { ConnectionIdentity, IServerTransport } from "../transport/Transport.js";
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
    const send = (_id: string, message: ServerMessage) => {
      const start = performanceMetrics.start();
      const buffer = encodeServerMessage(message);
      performanceMetrics.end("server.encode", start);
      this.channel.send({ type: "message", buffer });
    };
    this.server = create({
      send,
      broadcast: (message) => send("local", message),
      onMessage: (handler) => {
        this.onMessage = handler;
      },
      onConnect: (handler) => {
        this.onConnect = handler;
      },
      onDisconnect: () => {},
      canSend: () => this.channel.writable,
      close: () => {}, // Runtime owns the link until the shutdown receipt is consumed.
    });
    this.server.onLoopError = (error) => this.fail(error);
  }

  async init(metrics: boolean): Promise<void> {
    performanceMetrics.enabled = metrics;
    await this.server.init();
    if (this.state !== "starting") throw Error("Local server stopped during startup");
    this.state = "ready";
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
        if (!this.hidden) this.startSimulation();
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
          this.server.stopLoop();
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
            await this.server.destroy();
            this.state = "stopped";
            this.channel.send({ type: "result", id: packet.id });
          })
          .catch((error) => {
            if (this.state === "failed" || this.state === "stopped") return;
            this.state = "ready";
            this.storageFailure(error, packet.id);
            if (this.started && !this.hidden) this.startSimulation();
          });
        break;
      case "diagnostics": {
        const diagnostics: LocalHostDiagnostics = {
          timings: performanceMetrics.snapshot(),
          channel: this.channel.diagnostics(),
          ticks: this.server.completedTicks,
          hidden: this.hidden,
          persistence: this.server.persistenceDiagnostics ?? [],
        };
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
      if (this.state !== "ready" || this.hidden || this.checkpointPending) return;
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
