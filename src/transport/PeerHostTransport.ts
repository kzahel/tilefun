import Peer, { type DataConnection } from "peerjs";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { IClientTransport, IServerTransport } from "./Transport.js";

const LOCAL_CLIENT_ID = "local";

/**
 * P2P host transport: combines local in-memory delivery for the host's own
 * GameClient (zero latency, like SerializingTransport) with PeerJS DataChannel
 * routing for remote guest connections.
 *
 * The host browser runs GameServer + GameClient. Remote guests connect via
 * PeerGuestTransport using the host's peer ID.
 */
export class PeerHostTransport {
  readonly clientSide: IClientTransport;
  readonly serverSide: IServerTransport;
  readonly peer: Peer;

  private serverMessageHandler: ((clientId: string, msg: ClientMessage) => void) | null = null;
  private clientMessageHandler: ((msg: ServerMessage) => void) | null = null;
  private connectHandler: ((clientId: string) => void) | null = null;
  private disconnectHandler: ((clientId: string) => void) | null = null;
  private remoteClients = new Map<string, DataConnection>();
  private closed = false;

  constructor(peerId?: string) {
    const opts = {
      debug: 0 as const,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    };
    this.peer = peerId ? new Peer(peerId, opts) : new Peer(opts);

    const self = this;

    // --- clientSide: for host's own GameClient (zero latency) ---
    this.clientSide = {
      send(msg: ClientMessage): void {
        if (self.closed) return;
        self.serverMessageHandler?.(LOCAL_CLIENT_ID, roundtrip(msg));
      },
      onMessage(handler: (msg: ServerMessage) => void): void {
        self.clientMessageHandler = handler;
      },
      close(): void {
        self.closed = true;
      },
    };

    // --- serverSide: for GameServer (routes to local + remote) ---
    this.serverSide = {
      send(clientId: string, msg: ServerMessage): void {
        if (self.closed) return;
        if (clientId === LOCAL_CLIENT_ID) {
          self.clientMessageHandler?.(roundtrip(msg));
        } else {
          const conn = self.remoteClients.get(clientId);
          if (conn?.open) {
            conn.send(JSON.stringify(msg));
          }
        }
      },
      broadcast(msg: ServerMessage): void {
        if (self.closed) return;
        // Local host client
        self.clientMessageHandler?.(roundtrip(msg));
        // All remote guests (stringify once)
        const data = JSON.stringify(msg);
        for (const conn of self.remoteClients.values()) {
          if (conn.open) {
            conn.send(data);
          }
        }
      },
      onMessage(handler: (clientId: string, msg: ClientMessage) => void): void {
        self.serverMessageHandler = handler;
      },
      onConnect(handler: (clientId: string) => void): void {
        self.connectHandler = handler;
      },
      onDisconnect(handler: (clientId: string) => void): void {
        self.disconnectHandler = handler;
      },
      close(): void {
        self.closed = true;
        for (const conn of self.remoteClients.values()) {
          conn.close();
        }
        self.remoteClients.clear();
        self.peer.destroy();
      },
    };

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
      this.peer.reconnect();
    });

    this.peer.on("error", (err) => {
      console.error("[tilefun] PeerJS host error:", err);
    });
  }

  /** Resolves with the peer ID once connected to the PeerJS signaling server. */
  ready(): Promise<string> {
    if (this.peer.open) {
      return Promise.resolve(this.peer.id);
    }
    return new Promise((resolve, reject) => {
      this.peer.on("open", (id) => resolve(id));
      this.peer.on("error", (err) => reject(err));
    });
  }

  /** Fire the connect event for the local host client (like SerializingTransport.triggerConnect). */
  triggerConnect(): void {
    this.connectHandler?.(LOCAL_CLIENT_ID);
  }

  /** Total player count (remote guests + local host). */
  get playerCount(): number {
    return this.remoteClients.size + 1;
  }

  private handleConnection(conn: DataConnection): void {
    const clientId = (conn.metadata as { uuid?: string })?.uuid;
    if (!clientId) {
      console.error("[tilefun] PeerJS connection without UUID metadata, closing");
      conn.close();
      return;
    }

    // Last-write-wins: kick existing connection with same UUID
    const existing = this.remoteClients.get(clientId);
    if (existing) {
      try {
        existing.send(JSON.stringify({ type: "kicked", reason: "Connected from another tab" }));
      } catch {
        // Old connection may already be closing
      }
      existing.close();
    }

    this.remoteClients.set(clientId, conn);

    conn.on("open", () => {
      console.log(`[tilefun] P2P guest connected: ${clientId}`);
      this.connectHandler?.(clientId);
    });

    conn.on("data", (data) => {
      try {
        const msg = (typeof data === "string" ? JSON.parse(data) : data) as ClientMessage;
        this.serverMessageHandler?.(clientId, msg);
      } catch (err) {
        console.error(`[tilefun] Bad P2P message from ${clientId}:`, err);
      }
    });

    conn.on("close", () => {
      if (this.remoteClients.get(clientId) === conn) {
        this.remoteClients.delete(clientId);
        this.disconnectHandler?.(clientId);
      }
    });

    conn.on("error", (err) => {
      console.error(`[tilefun] P2P error for ${clientId}:`, err);
      if (this.remoteClients.get(clientId) === conn) {
        this.remoteClients.delete(clientId);
        this.disconnectHandler?.(clientId);
      }
    });
  }
}

function roundtrip<T>(msg: T): T {
  return JSON.parse(JSON.stringify(msg));
}
