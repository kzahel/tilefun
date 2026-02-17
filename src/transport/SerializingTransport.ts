import {
  decodeClientMessage,
  decodeServerMessage,
  encodeClientMessage,
  encodeServerMessage,
} from "../shared/binaryCodec.js";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { IClientTransport, IServerTransport } from "./Transport.js";

const LOCAL_CLIENT_ID = "local";

/**
 * In-memory transport that binary-roundtrips every message.
 * Validates that all data survives binary encoding — catches unsupported
 * field types or missing codec paths that would break real networking.
 */
export class SerializingTransport {
  readonly clientSide: IClientTransport;
  readonly serverSide: IServerTransport;

  private serverMessageHandler: ((clientId: string, msg: ClientMessage) => void) | null = null;
  private clientMessageHandler: ((msg: ServerMessage) => void) | null = null;
  private connectHandler: ((clientId: string) => void) | null = null;
  private disconnectHandler: ((clientId: string) => void) | null = null;
  private closed = false;

  constructor() {
    const self = this;
    let rxBytes = 0;

    this.clientSide = {
      send(msg: ClientMessage): void {
        if (self.closed) return;
        const decoded = decodeClientMessage(encodeClientMessage(msg));
        self.serverMessageHandler?.(LOCAL_CLIENT_ID, decoded);
      },
      onMessage(handler: (msg: ServerMessage) => void): void {
        self.clientMessageHandler = handler;
      },
      close(): void {
        self.closed = true;
      },
      get bytesReceived() {
        return rxBytes;
      },
      getDebugInfo() {
        return { transport: "In-memory binary loopback" };
      },
    };

    this.serverSide = {
      send(_clientId: string, msg: ServerMessage): void {
        if (self.closed) return;
        const buf = encodeServerMessage(msg);
        rxBytes += buf.byteLength;
        self.clientMessageHandler?.(decodeServerMessage(buf));
      },
      broadcast(msg: ServerMessage): void {
        if (self.closed) return;
        const buf = encodeServerMessage(msg);
        rxBytes += buf.byteLength;
        self.clientMessageHandler?.(decodeServerMessage(buf));
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
      },
    };
  }

  triggerConnect(): void {
    this.connectHandler?.(LOCAL_CLIENT_ID);
  }

  triggerDisconnect(): void {
    this.disconnectHandler?.(LOCAL_CLIENT_ID);
  }
}
