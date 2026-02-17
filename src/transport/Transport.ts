import type { ClientMessage, ServerMessage } from "../shared/protocol.js";

export interface ClientTransportDebugInfo {
  /** Human-readable transport label for HUD/debug output. */
  transport: string;
  /** Optional transport RTT in milliseconds (when available). */
  rttMs?: number | undefined;
}

export interface IClientTransport {
  send(msg: ClientMessage): void;
  onMessage(handler: (msg: ServerMessage) => void): void;
  close(): void;
  /** Cumulative bytes received from the server (for net stats display). */
  readonly bytesReceived?: number;
  /** Optional transport diagnostics for HUD/debug output. */
  getDebugInfo?(): ClientTransportDebugInfo;
}

export interface IServerTransport {
  send(clientId: string, msg: ServerMessage): void;
  broadcast(msg: ServerMessage): void;
  onMessage(handler: (clientId: string, msg: ClientMessage) => void): void;
  onConnect(handler: (clientId: string) => void): void;
  onDisconnect(handler: (clientId: string) => void): void;
  close(): void;
}
