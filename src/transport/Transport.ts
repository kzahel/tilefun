import type { ClientMessage, ServerMessage } from "../shared/protocol.js";

export interface IClientTransport {
  send(msg: ClientMessage): void;
  onMessage(handler: (msg: ServerMessage) => void): void;
  close(): void;
}

export interface IServerTransport {
  send(clientId: string, msg: ServerMessage): void;
  broadcast(msg: ServerMessage): void;
  onMessage(handler: (clientId: string, msg: ClientMessage) => void): void;
  onConnect(handler: (clientId: string) => void): void;
  onDisconnect(handler: (clientId: string) => void): void;
  close(): void;
}
