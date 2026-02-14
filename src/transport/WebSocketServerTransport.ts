import type { Server as HttpServer } from "node:http";
import { type WebSocket, WebSocketServer } from "ws";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { IServerTransport } from "./Transport.js";

/**
 * WebSocket-backed server transport for Node.js.
 * Each connected WebSocket gets a unique clientId.
 */
export class WebSocketServerTransport implements IServerTransport {
  private wss: WebSocketServer;
  private clients = new Map<string, WebSocket>();
  private nextClientId = 1;
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

    this.wss.on("connection", (ws) => {
      const clientId = `ws-${this.nextClientId++}`;
      this.clients.set(clientId, ws);

      ws.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString()) as ClientMessage;
          this.messageHandler?.(clientId, msg);
        } catch (err) {
          console.error(`[tilefun] Bad message from ${clientId}:`, err);
        }
      });

      ws.on("close", () => {
        this.clients.delete(clientId);
        this.disconnectHandler?.(clientId);
      });

      ws.on("error", (err) => {
        console.error(`[tilefun] WebSocket error for ${clientId}:`, err);
        this.clients.delete(clientId);
        this.disconnectHandler?.(clientId);
      });

      this.connectHandler?.(clientId);
    });
  }

  send(clientId: string, msg: ServerMessage): void {
    const ws = this.clients.get(clientId);
    if (ws?.readyState === 1 /* WebSocket.OPEN */) {
      ws.send(JSON.stringify(msg));
    }
  }

  broadcast(msg: ServerMessage): void {
    const data = JSON.stringify(msg);
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
