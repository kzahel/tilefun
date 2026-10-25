import Peer, { type DataConnection } from "peerjs";
import { encodeServerMessage } from "../shared/binaryCodec.js";
import { PeerConnectionDiagnostics } from "./PeerConnectionDiagnostics.js";
import { peerOptions } from "./peerOptions.js";
import type { WorkerClientTransport } from "./WorkerClientTransport.js";
import type { WorkerPeerLink } from "./WorkerPeerLink.js";

/** Main-thread PeerJS connections bridge owned binary buffers to Worker authority. */
export class PeerHostTransport {
  readonly peer: Peer;
  private links = new WeakMap<DataConnection, WorkerPeerLink>();
  private remoteClients = new Map<string, DataConnection>();
  private closed = false;

  constructor(
    private readonly authority: WorkerClientTransport,
    peerId?: string,
  ) {
    const opts = peerOptions();
    this.peer = peerId ? new Peer(peerId, opts) : new Peer(opts);

    this.peer.on("open", (id) => {
      console.log(
        `[tilefun] P2P host peer open: ${id}, server: ${this.peer.options.host}:${this.peer.options.port}${this.peer.options.path}`,
      );
    });

    // Handle incoming PeerJS connections from guests
    this.peer.on("connection", (conn) => {
      console.log(
        `[tilefun] P2P host: incoming connection from ${conn.peer}, serialization: ${conn.serialization}, metadata:`,
        conn.metadata,
      );
      this.handleConnection(conn);
    });

    this.peer.on("disconnected", () => {
      console.warn("[tilefun] P2P host disconnected from signaling server — attempting reconnect");
      if (!this.closed) this.peer.reconnect();
    });

    this.peer.on("error", (err) => {
      console.error("[tilefun] PeerJS host error:", err);
    });
  }

  /** Resolves with the peer ID once connected to the PeerJS signaling server. */
  ready(timeoutMs = 30_000): Promise<string> {
    if (this.peer.open) {
      return Promise.resolve(this.peer.id);
    }
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        this.peer.off("open", opened);
        this.peer.off("error", failed);
      };
      const opened = (id: string) => {
        cleanup();
        resolve(id);
      };
      const failed = (error: Error) => {
        cleanup();
        reject(error);
      };
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Signaling timed out. Check your internet connection and try again."));
      }, timeoutMs);
      this.peer.on("open", opened);
      this.peer.on("error", failed);
    });
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const conn of this.remoteClients.values()) {
      this.links.get(conn)?.close();
      conn.close();
    }
    this.remoteClients.clear();
    this.peer.destroy();
  }

  /** Total player count (remote guests + local host). */
  get playerCount(): number {
    return this.remoteClients.size + 1;
  }

  private handleConnection(conn: DataConnection): void {
    const clientId = (conn.metadata as { uuid?: string })?.uuid;
    if (this.closed || typeof clientId !== "string" || !clientId || clientId === "local") {
      console.error("[tilefun] PeerJS connection without UUID metadata, closing");
      conn.close();
      return;
    }

    // Last-write-wins: kick existing connection with same UUID
    const existing = this.remoteClients.get(clientId);
    // Publish the replacement first so old callbacks cannot detach its authority.
    this.remoteClients.set(clientId, conn);
    if (existing) {
      try {
        existing.send(
          encodeServerMessage({ type: "kicked", reason: "Connected from another tab" }),
        );
      } catch {
        // Old connection may already be closing
      }
      this.links.get(existing)?.close();
      existing.close();
    }
    const diagnostics = new PeerConnectionDiagnostics("host", conn);

    conn.on("open", () => {
      if (this.closed || this.remoteClients.get(clientId) !== conn) return;
      diagnostics.opened();
      console.log(`[tilefun] P2P guest connected: ${clientId}`);
      try {
        const link = this.authority.attachPeer(
          clientId,
          ({ buffer, messageType }) => {
            if (conn.open) diagnostics.send(messageType ?? "unknown", buffer);
          },
          (error) => {
            if (error !== undefined) diagnostics.log("Worker guest link closed", error);
            if (this.remoteClients.get(clientId) === conn) {
              this.remoteClients.delete(clientId);
              conn.close();
            }
          },
          () =>
            conn.open &&
            (conn.dataChannel?.bufferedAmount ?? 0) < 1024 * 1024 &&
            ((conn as DataConnection & { readonly bufferSize?: number }).bufferSize ?? 0) < 64,
        );
        this.links.set(conn, link);
      } catch (error) {
        diagnostics.log("Worker guest attach failed", error);
        this.remoteClients.delete(clientId);
        conn.close();
      }
    });

    conn.on("data", (data) => {
      if (this.closed || this.remoteClients.get(clientId) !== conn) return;
      try {
        let buffer: ArrayBuffer;
        if (data instanceof ArrayBuffer) buffer = data;
        else if (ArrayBuffer.isView(data)) {
          const bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
          buffer = bytes.slice().buffer;
        } else throw Error("Expected binary guest message");
        this.links.get(conn)?.send({ buffer });
      } catch (err) {
        console.error(`[tilefun] Bad P2P message from ${clientId}:`, err);
      }
    });

    conn.on("close", () => {
      if (this.remoteClients.get(clientId) === conn) {
        if (!this.closed) diagnostics.log("host channel closed");
        this.remoteClients.delete(clientId);
        this.links.get(conn)?.close();
      }
    });

    conn.on("error", (err) => {
      diagnostics.log("host connection error", err);
      if (this.remoteClients.get(clientId) === conn) {
        this.remoteClients.delete(clientId);
        this.links.get(conn)?.close();
        conn.close();
      }
    });
  }
}
