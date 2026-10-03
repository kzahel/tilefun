import type { ClientMessage, ServerMessage } from "../shared/protocol.js";

export interface ClientTransportDebugInfo {
  /** Human-readable transport label for HUD/debug output. */
  transport: string;
  /** Optional transport RTT in milliseconds (when available). */
  rttMs?: number | undefined;
}

export interface IClientTransport {
  /** Optional bounded delivery at the client update boundary. */
  pump?(): void;
  getDiagnostics?(): Promise<unknown>;
  resetDiagnostics?(): Promise<void>;
  send(msg: ClientMessage): void;
  onMessage(handler: (msg: ServerMessage) => void): void;
  /** Notify callers when the game connection closes (reconnecting transports may recover). */
  onDisconnect?(handler: () => void): void;
  close(): void;
  /** Cumulative bytes received from the server (for net stats display). */
  readonly bytesReceived?: number;
  /** Optional transport diagnostics for HUD/debug output. */
  getDebugInfo?(): ClientTransportDebugInfo;
}

export interface ConnectionIdentity {
  profileId: string;
  displayName: string;
}

export interface IServerTransport {
  /** Backpressure: defer replica publication without dropping delta dependencies. */
  canSend?(): boolean;
  send(clientId: string, msg: ServerMessage): void;
  broadcast(msg: ServerMessage): void;
  onMessage(handler: (clientId: string, msg: ClientMessage) => void): void;
  onConnect(handler: (clientId: string, identity?: ConnectionIdentity) => void): void;
  onDisconnect(handler: (clientId: string) => void): void;
  close(): void;
}
