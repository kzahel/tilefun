import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { IClientTransport, IServerTransport } from "./Transport.js";

const LOCAL_CLIENT_ID = "local";

export class LocalTransport {
  readonly clientSide: IClientTransport;
  readonly serverSide: IServerTransport;

  private serverMessageHandler: ((clientId: string, msg: ClientMessage) => void) | null = null;
  private clientMessageHandler: ((msg: ServerMessage) => void) | null = null;
  private connectHandler: ((clientId: string) => void) | null = null;
  private disconnectHandler: ((clientId: string) => void) | null = null;
  private closed = false;

  constructor() {
    const self = this;

    this.clientSide = {
      send(msg: ClientMessage): void {
        if (self.closed) return;
        self.serverMessageHandler?.(LOCAL_CLIENT_ID, msg);
      },
      onMessage(handler: (msg: ServerMessage) => void): void {
        self.clientMessageHandler = handler;
      },
      close(): void {
        self.closed = true;
      },
      getDebugInfo() {
        return { transport: "Local in-memory" };
      },
    };

    this.serverSide = {
      send(_clientId: string, msg: ServerMessage): void {
        if (self.closed) return;
        self.clientMessageHandler?.(msg);
      },
      broadcast(msg: ServerMessage): void {
        if (self.closed) return;
        self.clientMessageHandler?.(msg);
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

  /** Simulate the "local" client connecting. Call after handlers are registered. */
  triggerConnect(): void {
    this.connectHandler?.(LOCAL_CLIENT_ID);
  }

  /** Simulate the "local" client disconnecting. */
  triggerDisconnect(): void {
    this.disconnectHandler?.(LOCAL_CLIENT_ID);
  }
}
