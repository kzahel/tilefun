import {
  decodeClientMessage,
  decodeServerMessage,
  encodeClientMessage,
  encodeServerMessage,
} from "../../shared/binaryCodec.js";
import type { ClientMessage, ServerMessage } from "../../shared/protocol.js";
import type { ConnectionIdentity, IServerTransport } from "../../transport/Transport.js";

type Of<T extends ServerMessage["type"]> = Extract<ServerMessage, { type: T }>;

/**
 * Several device connections on one server. Every message crosses the binary codec,
 * as it does on a Worker, socket or peer link; "local" is the single-player connection.
 */
export class MemoryConnections {
  readonly serverSide: IServerTransport;
  /** What each connection received, decoded, while it was open. */
  readonly received = new Map<string, ServerMessage[]>();
  private readonly open = new Set<string>();
  private onMessage: ((id: string, msg: ClientMessage) => void) | undefined;
  private onConnect: ((id: string, identity?: ConnectionIdentity) => void) | undefined;
  private onDisconnect: ((id: string) => void) | undefined;

  constructor() {
    const deliver = (id: string, msg: ServerMessage) => {
      if (this.open.has(id))
        this.received.get(id)?.push(decodeServerMessage(encodeServerMessage(msg)));
    };
    this.serverSide = {
      send: deliver,
      broadcast: (msg) => {
        for (const id of this.open) deliver(id, msg);
      },
      onMessage: (handler) => {
        this.onMessage = handler;
      },
      onConnect: (handler) => {
        this.onConnect = handler;
      },
      onDisconnect: (handler) => {
        this.onDisconnect = handler;
      },
      close: () => {},
    };
  }

  /** `memoryServer` connects the local player once the server has started. */
  triggerConnect(): void {
    this.connect("local");
  }

  connect(id: string, identity?: ConnectionIdentity): void {
    this.open.add(id);
    this.received.set(id, []);
    this.onConnect?.(id, identity);
  }

  disconnect(id: string): void {
    this.open.delete(id);
    this.onDisconnect?.(id);
  }

  send(id: string, msg: ClientMessage): void {
    this.onMessage?.(id, decodeClientMessage(encodeClientMessage(msg)));
  }

  /** Any JSON a peer could put in the codec's JSON fallback, even a malformed message. */
  sendJson(id: string, msg: unknown): void {
    const json = new TextEncoder().encode(JSON.stringify(msg));
    const buffer = new Uint8Array(1 + json.byteLength);
    buffer[0] = 0xff;
    buffer.set(json, 1);
    this.onMessage?.(id, decodeClientMessage(buffer.buffer));
  }

  /** Messages of one type a connection received for its seat 0. */
  messages<T extends ServerMessage["type"]>(id: string, type: T): Of<T>[] {
    return (this.received.get(id) ?? []).filter((m): m is Of<T> => m.type === type);
  }

  /** Messages of one type a connection received for another seat, unwrapped. */
  seatMessages<T extends ServerMessage["type"]>(id: string, seat: number, type: T): Of<T>[] {
    return this.messages(id, "seat")
      .filter((envelope) => envelope.seat === seat)
      .map((envelope) => envelope.message)
      .filter((m): m is Of<T> => m.type === type);
  }
}
