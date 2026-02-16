import { decodeServerMessage, encodeClientMessage } from "../shared/binaryCodec.js";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { IClientTransport } from "./Transport.js";

/**
 * Browser WebSocket-backed client transport.
 * Connects to a remote game server via WebSocket.
 */
export class WebSocketClientTransport implements IClientTransport {
  private ws: WebSocket;
  private messageHandler: ((msg: ServerMessage) => void) | null = null;
  bytesReceived = 0;

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.binaryType = "arraybuffer";
    this.ws.onmessage = (event) => {
      try {
        const buf = event.data as ArrayBuffer;
        this.bytesReceived += buf.byteLength;
        const msg = decodeServerMessage(buf);
        this.messageHandler?.(msg);
      } catch (err) {
        console.error("[tilefun] Bad server message:", err);
      }
    };
    this.ws.onerror = (event) => {
      console.error("[tilefun] WebSocket error:", event);
    };
  }

  /** Returns a promise that resolves when the WebSocket connection is open. */
  ready(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      this.ws.addEventListener("open", () => resolve(), { once: true });
      this.ws.addEventListener("error", () => reject(new Error("WebSocket connection failed")), {
        once: true,
      });
    });
  }

  send(msg: ClientMessage): void {
    if (this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(encodeClientMessage(msg));
    }
  }

  onMessage(handler: (msg: ServerMessage) => void): void {
    this.messageHandler = handler;
  }

  close(): void {
    this.ws.close();
  }
}
