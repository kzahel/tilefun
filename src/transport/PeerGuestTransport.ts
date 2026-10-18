import Peer from "peerjs";
import { decodeServerMessage, encodeClientMessage } from "../shared/binaryCodec.js";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import { PeerConnectionDiagnostics } from "./PeerConnectionDiagnostics.js";
import { peerOptions } from "./peerOptions.js";
import type { IClientTransport } from "./Transport.js";
import { classifyClientMessageChannel } from "./webrtcChannels.js";

export type PeerGuestStatus =
  | "connecting-signaling"
  | "signaling-open"
  | "connecting-host"
  | "ice-checking"
  | "ice-connected"
  | "datachannel-open"
  | "receiving-state"
  | "reconnecting"
  | "failed";

/**
 * WebRTC DataChannel-backed client transport via PeerJS.
 * Connects to a PeerHostTransport host by its peer ID.
 * Automatically reconnects if the connection drops.
 *
 * Usage:
 *   const t = new PeerGuestTransport(hostPeerId, guestUuid);
 *   t.onStatus = (status, detail) => { ... };
 *   await t.ready(30_000, signal);
 */
export class PeerGuestTransport implements IClientTransport {
  private peer: Peer;
  private conn: ReturnType<Peer["connect"]> | null = null;
  private disconnectHandler: (() => void) | null = null;
  private messageHandler: ((msg: ServerMessage) => void) | null = null;
  private pendingMessages: ServerMessage[] = [];
  private destroyed = false;
  private reconnectAttempts = 0;
  private failed = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private readyFinish: ((error?: Error) => void) | null = null;
  private diagnostics: PeerConnectionDiagnostics | null = null;
  private healthySince: number | null = null;
  private lastFrameAt: number | null = null;
  private lastServerTick = -1;
  private receivedState = false;
  private singleChannelFallbackLogged = false;
  bytesReceived = 0;
  private static readonly MAX_RECONNECT_ATTEMPTS = 5;
  private static readonly RECONNECT_DELAY_MS = 2_000;
  private static readonly CONNECT_TIMEOUT_MS = 30_000;
  private static readonly HEALTHY_CONNECTION_MS = 10_000;
  private static readonly MAX_FRAME_GAP_MS = 3_000;
  onStatus: ((status: PeerGuestStatus, detail?: string) => void) | null = null;

  private hostPeerId: string;
  private guestUuid: string;

  constructor(hostPeerId: string, guestUuid: string) {
    this.hostPeerId = hostPeerId;
    this.guestUuid = guestUuid;

    this.emitStatus("connecting-signaling");

    this.peer = new Peer(peerOptions());

    this.peer.on("disconnected", () => {
      console.warn("[tilefun] P2P guest disconnected from signaling server");
      if (!this.destroyed && !this.failed) {
        this.peer.reconnect();
      }
    });

    this.peer.on("error", (err) => {
      console.error("[tilefun] PeerJS guest error:", err.type, err);
      // A failed offer can emit only a peer error, without closing its DataConnection.
      if (this.conn && !this.conn.open) this.endConnection(this.conn, "connection failed", err);
    });
  }

  /**
   * Resolves when the DataChannel is open.
   * Waits for signaling socket to open, then initiates peer.connect().
   */
  ready(timeoutMs = 30_000, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.destroyed || this.failed) {
        reject(new Error("P2P connection closed"));
        return;
      }
      const abort = () => finish(new DOMException("Connection cancelled", "AbortError"));
      const onPeerOpen = (id: string) => {
        this.peer.off("open", onPeerOpen);
        console.log(`[tilefun] P2P guest peer open: ${id}`);
        this.emitStatus("signaling-open");
        this.connectToHost();
      };
      const finish = (error?: Error) => {
        if (this.readyFinish !== finish) return;
        this.readyFinish = null;
        clearTimeout(timer);
        this.peer.off("open", onPeerOpen);
        signal?.removeEventListener("abort", abort);
        if (error) reject(error);
        else resolve();
      };
      const timer = setTimeout(() => finish(new Error("P2P connection timed out")), timeoutMs);
      this.readyFinish = finish;
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) abort();
      else if (this.peer.open) onPeerOpen(this.peer.id);
      else this.peer.on("open", onPeerOpen);
    });
  }

  /** All callbacks are scoped to this connection; late events cannot replace its successor. */
  private connectToHost(): void {
    if (this.destroyed || this.failed || this.conn) return;
    console.log(`[tilefun] P2P guest connecting to host: ${this.hostPeerId}`);
    this.emitStatus("connecting-host");
    const conn = this.peer.connect(this.hostPeerId, {
      metadata: { uuid: this.guestUuid },
      reliable: true,
      // Raw bypasses PeerJS fragmentation and can close on a large terrain baseline.
      serialization: "binary",
    });
    this.conn = conn;
    const diagnostics = new PeerConnectionDiagnostics("guest", conn);
    this.diagnostics = diagnostics;
    this.connectTimer = setTimeout(() => {
      this.endConnection(conn, "connection attempt timed out");
    }, PeerGuestTransport.CONNECT_TIMEOUT_MS);

    conn.on("open", () => {
      if (this.conn !== conn || this.destroyed || this.failed) return;
      this.clearConnectTimer();
      diagnostics.opened();
      console.log("[tilefun] P2P DataChannel open");
      this.logSingleChannelFallbackOnce();
      this.emitStatus("datachannel-open");
      this.readyFinish?.();
    });
    conn.on("data", (data) => {
      if (this.conn !== conn || this.destroyed || this.failed) return;
      try {
        const buf =
          data instanceof ArrayBuffer ? data : ((data as Uint8Array).buffer as ArrayBuffer);
        this.bytesReceived += buf.byteLength;
        const msg = decodeServerMessage(buf);
        this.observeReplication(msg);
        if (this.messageHandler) this.messageHandler(msg);
        else this.pendingMessages.push(msg);
      } catch (error) {
        diagnostics.log("bad server message", error);
      }
    });
    conn.on("close", () => this.endConnection(conn, "guest channel closed"));
    conn.on("error", (error) => this.endConnection(conn, "guest connection error", error));
    conn.on("iceStateChanged", (state: string) => {
      if (this.conn !== conn || this.destroyed || this.failed) return;
      console.log(`[tilefun] P2P ICE state: ${state}`);
      if (state === "checking" || state === "new") this.emitStatus("ice-checking");
      else if (state === "connected" || state === "completed") this.emitStatus("ice-connected");
    });
  }

  private observeReplication(msg: ServerMessage): void {
    if (msg.type === "world-loaded" || msg.type === "realm-joined" || msg.type === "realm-left") {
      this.resetHealth();
    }
    if ((msg.type === "frame" || msg.type === "realm-list") && !this.receivedState) {
      this.receivedState = true;
      this.emitStatus("receiving-state");
    }
    if (msg.type !== "frame" || msg.serverTick <= this.lastServerTick) return;
    const now = performance.now();
    if (this.lastFrameAt === null || now - this.lastFrameAt > PeerGuestTransport.MAX_FRAME_GAP_MS) {
      this.healthySince = now;
    }
    this.lastFrameAt = now;
    this.lastServerTick = msg.serverTick;
    if (
      this.reconnectAttempts > 0 &&
      this.healthySince !== null &&
      now - this.healthySince >= PeerGuestTransport.HEALTHY_CONNECTION_MS
    ) {
      console.log("[tilefun] P2P replication healthy; reconnect budget reset");
      this.reconnectAttempts = 0;
    }
  }

  private resetHealth(): void {
    this.healthySince = null;
    this.lastFrameAt = null;
    this.lastServerTick = -1;
    this.receivedState = false;
  }

  private clearConnectTimer(): void {
    if (this.connectTimer !== null) clearTimeout(this.connectTimer);
    this.connectTimer = null;
  }

  private endConnection(conn: ReturnType<Peer["connect"]>, reason: string, error?: unknown): void {
    if (this.conn !== conn || this.destroyed || this.failed) return;
    this.diagnostics?.log(reason, error);
    this.conn = null;
    this.diagnostics = null;
    this.clearConnectTimer();
    this.resetHealth();
    this.pendingMessages.length = 0;
    conn.close();
    this.disconnectHandler?.();
    this.tryReconnect();
  }

  private tryReconnect(): void {
    if (this.destroyed || this.failed || this.reconnectTimer !== null) return;
    if (this.reconnectAttempts >= PeerGuestTransport.MAX_RECONNECT_ATTEMPTS) {
      console.error("[tilefun] P2P max reconnect attempts reached");
      this.failed = true;
      const error = new Error("Could not reconnect to host after 5 attempts. Retry or go back.");
      this.readyFinish?.(error);
      this.peer.destroy();
      // A synthetic kicked message destroys GameClient and covers Retry/Back with another overlay.
      this.emitStatus("failed", error.message);
      return;
    }

    this.reconnectAttempts++;
    const delay = PeerGuestTransport.RECONNECT_DELAY_MS;
    console.log(
      `[tilefun] P2P reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${PeerGuestTransport.MAX_RECONNECT_ATTEMPTS})`,
    );
    this.emitStatus(
      "reconnecting",
      `Attempt ${this.reconnectAttempts}/${PeerGuestTransport.MAX_RECONNECT_ATTEMPTS}`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.destroyed || this.failed) return;
      // Ensure signaling is still connected
      if (this.peer.disconnected) {
        this.peer.reconnect();
      }
      this.connectToHost();
    }, delay);
  }

  send(msg: ClientMessage): void {
    if (classifyClientMessageChannel(msg) !== "sync") return;
    if (this.conn?.open) {
      this.diagnostics?.send(msg.type, encodeClientMessage(msg));
    }
  }

  onDisconnect(handler: () => void): void {
    this.disconnectHandler = handler;
  }

  onMessage(handler: (msg: ServerMessage) => void): void {
    this.messageHandler = handler;
    // Flush any messages that arrived before the handler was registered
    for (const msg of this.pendingMessages) {
      handler(msg);
    }
    this.pendingMessages.length = 0;
  }

  close(): void {
    this.destroyed = true;
    this.clearConnectTimer();
    if (this.reconnectTimer !== null) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.readyFinish?.(new Error("P2P connection closed"));
    this.pendingMessages.length = 0;
    this.conn?.close();
    this.conn = null;
    this.peer.destroy();
  }

  getDebugInfo() {
    const dcState = this.conn?.open ? "open" : "closed";
    return { transport: `WebRTC P2P ordered sync (${dcState})` };
  }

  private emitStatus(status: PeerGuestStatus, detail?: string): void {
    this.onStatus?.(status, detail);
  }

  private logSingleChannelFallbackOnce(): void {
    if (this.singleChannelFallbackLogged) return;
    this.singleChannelFallbackLogged = true;
    console.warn("[tilefun] PeerJS guest transport uses a single reliable channel (ordered sync)");
  }
}
