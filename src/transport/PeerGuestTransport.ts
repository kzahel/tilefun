import Peer from "peerjs";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { IClientTransport } from "./Transport.js";

/**
 * WebRTC DataChannel-backed client transport via PeerJS.
 * Connects to a PeerHostTransport host by its peer ID.
 */
export class PeerGuestTransport implements IClientTransport {
  private peer: Peer;
  private conn: ReturnType<Peer["connect"]>;
  private messageHandler: ((msg: ServerMessage) => void) | null = null;

  constructor(hostPeerId: string, guestUuid: string) {
    this.peer = new Peer({
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    this.conn = this.peer.connect(hostPeerId, {
      metadata: { uuid: guestUuid },
      reliable: true,
      serialization: "none",
    });

    this.conn.on("data", (data) => {
      try {
        const msg = (typeof data === "string" ? JSON.parse(data) : data) as ServerMessage;
        this.messageHandler?.(msg);
      } catch (err) {
        console.error("[tilefun] Bad P2P server message:", err);
      }
    });

    this.conn.on("close", () => {
      // Synthesize a kicked message so GameClient shows disconnect screen
      this.messageHandler?.({ type: "kicked", reason: "Host disconnected" } as ServerMessage);
    });

    this.conn.on("error", (err) => {
      console.error("[tilefun] P2P guest connection error:", err);
    });

    this.peer.on("error", (err) => {
      console.error("[tilefun] PeerJS guest error:", err);
    });
  }

  /** Resolves when the DataChannel is open. Rejects on error or 10s timeout. */
  ready(): Promise<void> {
    if (this.conn.open) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("P2P connection timed out")), 10_000);
      this.conn.on("open", () => {
        clearTimeout(timer);
        resolve();
      });
      this.conn.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  send(msg: ClientMessage): void {
    if (this.conn.open) {
      this.conn.send(JSON.stringify(msg));
    }
  }

  onMessage(handler: (msg: ServerMessage) => void): void {
    this.messageHandler = handler;
  }

  close(): void {
    this.conn.close();
    this.peer.destroy();
  }
}
