import type { DataConnection } from "peerjs";

/** Bounded metadata only: never retain message payloads or a frame-by-frame history. */
export class PeerConnectionDiagnostics {
  private openedAt: number | null = null;
  private lastSentType: string | null = null;
  private lastSentBytes = 0;
  // PeerJS nulls these properties before emitting close; retain the native handles
  // so closure diagnostics still include their states and the negotiated limit.
  private pc: RTCPeerConnection | undefined;
  private channel: RTCDataChannel | undefined;
  private maxMessageSize: number | undefined;

  constructor(
    private readonly role: "host" | "guest",
    private readonly connection: DataConnection,
  ) {
    this.pc = connection.peerConnection;
    this.channel = connection.dataChannel;
  }

  opened(): void {
    this.openedAt = performance.now();
    this.pc = this.connection.peerConnection;
    this.channel = this.connection.dataChannel;
    this.maxMessageSize = this.pc?.sctp?.maxMessageSize;
  }

  send(type: string, buffer: ArrayBuffer): void {
    this.lastSentType = type;
    this.lastSentBytes = buffer.byteLength;
    try {
      this.connection.send(buffer);
    } catch (error) {
      this.log("send threw", error);
      this.connection.close();
    }
  }

  log(reason: string, error?: unknown): void {
    const pc = this.connection.peerConnection ?? this.pc;
    const dc = this.connection.dataChannel ?? this.channel;
    const context = {
      role: this.role,
      connectionId: this.connection.connectionId,
      serialization: this.connection.serialization,
      connectionAgeMs:
        this.openedAt === null ? null : Math.round(performance.now() - this.openedAt),
      lastSent:
        this.lastSentType === null ? null : { type: this.lastSentType, bytes: this.lastSentBytes },
      maxMessageSize: pc?.sctp?.maxMessageSize ?? this.maxMessageSize,
      bufferedBytes: dc?.bufferedAmount,
      channelState: dc?.readyState,
      connectionState: pc?.connectionState,
      iceState: pc?.iceConnectionState,
    };
    if (error !== undefined) console.error(`[tilefun] P2P ${reason}`, context, error);
    else console.warn(`[tilefun] P2P ${reason}`, context);
  }
}
