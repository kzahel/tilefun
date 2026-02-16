import type { Server as HttpServer, IncomingMessage } from "node:http";
import { type WebSocket, WebSocketServer } from "ws";
import { decodeClientMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { IServerTransport } from "./Transport.js";

/**
 * WebSocket-backed server transport for Node.js.
 * Each connected WebSocket is identified by a UUID extracted from the
 * connection URL query string (?uuid=...).
 */
export class WebSocketServerTransport implements IServerTransport {
  private wss: WebSocketServer;
  private clients = new Map<string, WebSocket>();
  /** Sockets that were replaced by a newer connection with the same UUID.
   *  Their close/error handlers are suppressed to avoid spurious disconnects. */
  private replacedSockets = new Set<WebSocket>();
  private messageHandler: ((clientId: string, msg: ClientMessage) => void) | null = null;
  private connectHandler: ((clientId: string) => void) | null = null;
  private disconnectHandler: ((clientId: string) => void) | null = null;

  constructor(options: { server: HttpServer; path?: string }) {
    if (options.path) {
      // noServer mode: only accept upgrades on the specified path.
      // This avoids intercepting other WebSocket connections (e.g. Vite HMR).
      this.wss = new WebSocketServer({ noServer: true });
      options.server.on("upgrade", (req, socket, head) => {
        const url = req.url ?? "";
        if (url === options.path || url.startsWith(`${options.path}?`)) {
          this.wss.handleUpgrade(req, socket, head, (ws) => {
            this.wss.emit("connection", ws, req);
          });
        }
        // Otherwise let other handlers (Vite HMR, etc.) handle the upgrade
      });
    } else {
      // Default: handle all WebSocket connections on this server
      this.wss = new WebSocketServer({ server: options.server });
    }

    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      // Extract UUID from query params
      const url = new URL(req.url ?? "", "http://localhost");
      const uuid = url.searchParams.get("uuid");
      if (!uuid) {
        console.error("[tilefun] WebSocket connection without UUID, closing");
        ws.close(4000, "Missing UUID");
        return;
      }
      const clientId = uuid;

      // Kick existing connection with same UUID (last-write-wins)
      const existingWs = this.clients.get(clientId);
      if (existingWs) {
        this.replacedSockets.add(existingWs);
        try {
          existingWs.send(
            encodeServerMessage({
              type: "kicked",
              reason: "Connected from another tab",
            }),
          );
        } catch {
          // Old socket may already be closing
        }
        existingWs.close(4001, "Replaced by new connection");
      }

      this.clients.set(clientId, ws);

      ws.on("message", (data) => {
        try {
          // Node ws delivers Buffer for binary messages. Extract the
          // underlying ArrayBuffer slice to get a proper ArrayBuffer.
          let buf: ArrayBuffer;
          if (data instanceof ArrayBuffer) {
            buf = data;
          } else {
            const b = data as Buffer;
            buf = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
          }
          const msg = decodeClientMessage(buf);
          this.messageHandler?.(clientId, msg);
        } catch (err) {
          console.error(`[tilefun] Bad message from ${clientId}:`, err);
        }
      });

      ws.on("close", () => {
        // Suppress disconnect for sockets that were replaced by a newer connection
        if (this.replacedSockets.delete(ws)) return;
        if (this.clients.get(clientId) === ws) {
          this.clients.delete(clientId);
          this.disconnectHandler?.(clientId);
        }
      });

      ws.on("error", (err) => {
        console.error(`[tilefun] WebSocket error for ${clientId}:`, err);
        if (this.replacedSockets.delete(ws)) return;
        if (this.clients.get(clientId) === ws) {
          this.clients.delete(clientId);
          this.disconnectHandler?.(clientId);
        }
      });

      this.connectHandler?.(clientId);
    });
  }

  send(clientId: string, msg: ServerMessage): void {
    const ws = this.clients.get(clientId);
    if (ws?.readyState === 1 /* WebSocket.OPEN */) {
      ws.send(encodeServerMessage(msg));
    }
  }

  broadcast(msg: ServerMessage): void {
    const data = encodeServerMessage(msg);
    for (const ws of this.clients.values()) {
      if (ws.readyState === 1) {
        ws.send(data);
      }
    }
  }

  onMessage(handler: (clientId: string, msg: ClientMessage) => void): void {
    this.messageHandler = handler;
  }

  onConnect(handler: (clientId: string) => void): void {
    this.connectHandler = handler;
  }

  onDisconnect(handler: (clientId: string) => void): void {
    this.disconnectHandler = handler;
  }

  close(): void {
    for (const ws of this.clients.values()) {
      ws.close();
    }
    this.clients.clear();
    this.wss.close();
  }
}
