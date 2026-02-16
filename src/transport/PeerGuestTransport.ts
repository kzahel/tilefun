import Peer from "peerjs";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { IClientTransport } from "./Transport.js";

export type PeerGuestStatus =
  | "connecting-signaling"
  | "signaling-open"
  | "connecting-host"
  | "ice-checking"
  | "ice-connected"
  | "datachannel-open"
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
  private messageHandler: ((msg: ServerMessage) => void) | null = null;
  private pendingMessages: ServerMessage[] = [];
  private destroyed = false;
  private reconnectAttempts = 0;
  bytesReceived = 0;
  private static readonly MAX_RECONNECT_ATTEMPTS = 5;
  private static readonly RECONNECT_DELAY_MS = 2_000;
  onStatus: ((status: PeerGuestStatus, detail?: string) => void) | null = null;

  private hostPeerId: string;
  private guestUuid: string;

  constructor(hostPeerId: string, guestUuid: string) {
    this.hostPeerId = hostPeerId;
    this.guestUuid = guestUuid;

    this.emitStatus("connecting-signaling");

    this.peer = new Peer({
      debug: 0,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    this.peer.on("disconnected", () => {
      console.warn("[tilefun] P2P guest disconnected from signaling server");
      if (!this.destroyed) {
        this.peer.reconnect();
      }
    });

    this.peer.on("error", (err) => {
      console.error("[tilefun] PeerJS guest error:", err.type, err);
    });
  }

  /**
   * Resolves when the DataChannel is open.
   * Waits for signaling socket to open, then initiates peer.connect().
   */
  ready(timeoutMs = 30_000, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => finish(new Error("P2P connection timed out")), timeoutMs);

      const finish = (err?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve();
      };

      if (signal) {
        signal.addEventListener("abort", () => {
          finish(new DOMException("Connection cancelled", "AbortError"));
        });
      }

      const onPeerOpen = (id: string) => {
        console.log(
          `[tilefun] P2P guest peer open: ${id}, server: ${this.peer.options.host}:${this.peer.options.port}${this.peer.options.path}`,
        );
        this.emitStatus("signaling-open");
        this.connectToHost(() => finish());
      };

      if (this.peer.open) {
        onPeerOpen(this.peer.id);
      } else {
        this.peer.on("open", onPeerOpen);
      }
    });
  }

  /** Create a DataConnection to the host and wire up events. */
  private connectToHost(onFirstOpen?: () => void): void {
    if (this.destroyed) return;

    console.log(`[tilefun] P2P guest connecting to host: ${this.hostPeerId}`);
    this.emitStatus("connecting-host");

    this.conn = this.peer.connect(this.hostPeerId, {
      metadata: { uuid: this.guestUuid },
      reliable: true,
      serialization: "raw",
    });

    this.conn.on("open", () => {
      console.log("[tilefun] P2P DataChannel open");
      this.reconnectAttempts = 0;
      this.emitStatus("datachannel-open");
      onFirstOpen?.();
      onFirstOpen = undefined; // only call once
    });

    this.conn.on("data", (data) => {
      try {
        if (typeof data === "string") {
          this.bytesReceived += data.length;
        }
        const msg = (typeof data === "string" ? JSON.parse(data) : data) as ServerMessage;
        if (this.messageHandler) {
          this.messageHandler(msg);
        } else {
          this.pendingMessages.push(msg);
        }
      } catch (err) {
        console.error("[tilefun] Bad P2P server message:", err);
      }
    });

    this.conn.on("close", () => {
      console.warn("[tilefun] P2P DataChannel closed");
      this.tryReconnect();
    });

    this.conn.on("error", (err) => {
      console.error("[tilefun] P2P guest connection error:", err);
    });

    this.conn.on("iceStateChanged", (state: string) => {
      console.log(`[tilefun] P2P ICE state: ${state}`);
      if (state === "checking" || state === "new") {
        this.emitStatus("ice-checking");
      } else if (state === "connected" || state === "completed") {
        this.emitStatus("ice-connected");
      }
    });
  }

  private tryReconnect(): void {
    if (this.destroyed) return;
    if (this.reconnectAttempts >= PeerGuestTransport.MAX_RECONNECT_ATTEMPTS) {
      console.error("[tilefun] P2P max reconnect attempts reached");
      this.emitStatus("failed", "Could not reconnect to host");
      this.messageHandler?.({ type: "kicked", reason: "Host disconnected" } as ServerMessage);
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

    setTimeout(() => {
      if (this.destroyed) return;
      // Ensure signaling is still connected
      if (this.peer.disconnected) {
        this.peer.reconnect();
      }
      this.connectToHost();
    }, delay);
  }

  send(msg: ClientMessage): void {
    if (this.conn?.open) {
      this.conn.send(JSON.stringify(msg));
    }
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
    this.conn?.close();
    this.peer.destroy();
  }

  private emitStatus(status: PeerGuestStatus, detail?: string): void {
    this.onStatus?.(status, detail);
  }
}
