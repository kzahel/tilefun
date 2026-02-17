import { decodeServerMessage, encodeClientMessage } from "../shared/binaryCodec.js";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { IClientTransport } from "./Transport.js";
import {
  classifyClientMessageChannel,
  WEBRTC_ENTITIES_CHANNEL_LABEL,
  WEBRTC_SYNC_CHANNEL_LABEL,
} from "./webrtcChannels.js";
import { decodeFragmentPacket } from "./webrtcFragment.js";

type SignalClientToServer =
  | { type: "offer"; sdp: string }
  | { type: "candidate"; candidate: string; sdpMid?: string };

type SignalServerToClient =
  | { type: "answer"; sdp: string }
  | { type: "candidate"; candidate: string; sdpMid?: string }
  | { type: "error"; reason: string };

export interface WebRtcClientTransportOptions {
  signalUrl: string;
  clientId: string;
  iceServers?: RTCIceServer[];
  /** Deprecated alias for syncChannelLabel. */
  channelLabel?: string;
  syncChannelLabel?: string;
  entitiesChannelLabel?: string;
}

/**
 * Browser transport for dedicated server WebRTC mode.
 * Uses WebSocket only for signaling; game traffic flows over RTCDataChannel.
 */
export class WebRtcClientTransport implements IClientTransport {
  private readonly pc: RTCPeerConnection;
  private readonly syncDc: RTCDataChannel;
  private readonly entitiesDc: RTCDataChannel | null;
  private readonly ws: WebSocket;
  private closed = false;
  private entitiesFallbackLogged = false;
  private messageHandler: ((msg: ServerMessage) => void) | null = null;
  private readyResolvers: { resolve: () => void; reject: (err: Error) => void } | null = null;
  private readyDone = false;
  private statsTimer: ReturnType<typeof setInterval> | null = null;
  private lastRttMs: number | undefined;
  private fragmentAssemblies = new Map<number, FragmentAssembly>();
  private nextFragmentGcAt = 0;
  bytesReceived = 0;

  constructor(options: WebRtcClientTransportOptions) {
    this.pc = new RTCPeerConnection({
      iceServers: options.iceServers ?? [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    const syncLabel = options.syncChannelLabel ?? options.channelLabel ?? WEBRTC_SYNC_CHANNEL_LABEL;
    const entitiesLabel = options.entitiesChannelLabel ?? WEBRTC_ENTITIES_CHANNEL_LABEL;

    this.syncDc = this.pc.createDataChannel(syncLabel, { ordered: true });
    this.syncDc.binaryType = "arraybuffer";
    this.syncDc.onopen = () => {
      console.log(
        `[tilefun] WebRTC dedicated sync channel open (pc=${this.pc.connectionState}, ice=${this.pc.iceConnectionState})`,
      );
      this.startStatsPolling();
      this.resolveReady();
    };
    this.syncDc.onmessage = (event) => {
      this.consumeData(event.data, "sync");
    };
    this.syncDc.onerror = (event) => {
      console.error("[tilefun] WebRTC sync datachannel error:", event);
    };
    this.syncDc.onclose = () => {
      if (!this.closed) {
        console.warn("[tilefun] WebRTC sync datachannel closed");
      }
    };

    this.entitiesDc = this.createEntitiesChannel(entitiesLabel);

    this.pc.onicecandidate = (event) => {
      const candidate = event.candidate;
      if (!candidate) return;
      this.sendSignal({
        type: "candidate",
        candidate: candidate.candidate,
        ...(candidate.sdpMid ? { sdpMid: candidate.sdpMid } : {}),
      });
    };
    this.pc.onconnectionstatechange = () => {
      console.log(`[tilefun] WebRTC dedicated state: ${this.pc.connectionState}`);
      if (this.pc.connectionState === "failed") {
        this.rejectReady(new Error("WebRTC connection failed"));
      }
    };

    this.ws = new WebSocket(appendUuid(options.signalUrl, options.clientId));
    this.ws.onopen = () => {
      this.startOffer().catch((err) => {
        this.rejectReady(err instanceof Error ? err : new Error(String(err)));
      });
    };
    this.ws.onmessage = (event) => {
      this.handleSignal(event.data);
    };
    this.ws.onerror = (event) => {
      console.error("[tilefun] WebRTC signaling error:", event);
      this.rejectReady(new Error("WebRTC signaling failed"));
    };
    this.ws.onclose = () => {
      if (!this.readyDone && !this.closed) {
        this.rejectReady(new Error("WebRTC signaling closed before datachannel opened"));
      }
    };
  }

  ready(timeoutMs = 30_000): Promise<void> {
    if (this.syncDc.readyState === "open") return Promise.resolve();
    if (this.readyDone) return Promise.reject(new Error("WebRTC transport is closed"));

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.syncDc.readyState === "open") return;
        this.rejectReady(new Error("WebRTC connection timed out"));
      }, timeoutMs);

      this.readyResolvers = {
        resolve: () => {
          clearTimeout(timer);
          resolve();
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      };
    });
  }

  send(msg: ClientMessage): void {
    if (classifyClientMessageChannel(msg) !== "sync") return;
    if (this.syncDc.readyState !== "open") return;
    this.syncDc.send(encodeClientMessage(msg));
  }

  onMessage(handler: (msg: ServerMessage) => void): void {
    this.messageHandler = handler;
  }

  close(): void {
    this.closed = true;
    this.readyDone = true;
    this.stopStatsPolling();
    this.fragmentAssemblies.clear();
    this.entitiesDc?.close();
    this.syncDc.close();
    this.pc.close();
    this.ws.close();
  }

  getDebugInfo() {
    const syncState = this.syncDc.readyState;
    const entitiesState = this.entitiesDc?.readyState ?? "unavailable";
    const mode = entitiesState === "open" ? "dual-channel" : "sync-only";
    return {
      transport: `WebRTC dedicated ${mode} (${this.pc.connectionState}/sync:${syncState}/entities:${entitiesState})`,
      rttMs: this.lastRttMs,
    };
  }

  private createEntitiesChannel(label: string): RTCDataChannel | null {
    try {
      const dc = this.pc.createDataChannel(label, {
        ordered: false,
        maxRetransmits: 0,
      });
      dc.binaryType = "arraybuffer";
      dc.onopen = () => {
        console.log("[tilefun] WebRTC dedicated entities channel open (unordered/unreliable)");
      };
      dc.onmessage = (event) => {
        this.consumeData(event.data, "entities");
      };
      dc.onerror = (event) => {
        console.error("[tilefun] WebRTC entities datachannel error:", event);
      };
      dc.onclose = () => {
        if (!this.closed) {
          this.logEntitiesFallbackOnce("entities datachannel closed");
        }
      };
      return dc;
    } catch (err) {
      this.logEntitiesFallbackOnce(
        `entities datachannel unavailable, falling back to reliable sync only (${err instanceof Error ? err.message : String(err)})`,
      );
      return null;
    }
  }

  private logEntitiesFallbackOnce(reason: string): void {
    if (this.entitiesFallbackLogged) return;
    this.entitiesFallbackLogged = true;
    console.warn(`[tilefun] WebRTC dedicated: ${reason}`);
  }

  private async startOffer(): Promise<void> {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sendSignal({ type: "offer", sdp: offer.sdp ?? "" });
  }

  private sendSignal(msg: SignalClientToServer): void {
    if (this.ws.readyState !== this.ws.OPEN) return;
    this.ws.send(JSON.stringify(msg));
  }

  private handleSignal(raw: string | ArrayBuffer | Blob): void {
    if (typeof raw !== "string") {
      if (raw instanceof Blob) {
        raw
          .text()
          .then((text) => this.handleSignal(text))
          .catch((err) => {
            this.rejectReady(err instanceof Error ? err : new Error(String(err)));
          });
      }
      return;
    }

    let msg: SignalServerToClient;
    try {
      msg = JSON.parse(raw) as SignalServerToClient;
    } catch {
      this.rejectReady(new Error("Invalid signaling JSON from server"));
      return;
    }

    if (msg.type === "answer") {
      this.pc
        .setRemoteDescription({ type: "answer", sdp: msg.sdp })
        .catch((err) => this.rejectReady(err instanceof Error ? err : new Error(String(err))));
      return;
    }
    if (msg.type === "candidate" && msg.candidate) {
      this.pc
        .addIceCandidate({ candidate: msg.candidate, sdpMid: msg.sdpMid ?? null })
        .catch((err) => this.rejectReady(err instanceof Error ? err : new Error(String(err))));
      return;
    }
    if (msg.type === "error") {
      this.rejectReady(new Error(`WebRTC server error: ${msg.reason}`));
    }
  }

  private consumeData(data: string | ArrayBuffer | Blob, channel: "sync" | "entities"): void {
    if (typeof data === "string") return;
    if (data instanceof Blob) {
      data
        .arrayBuffer()
        .then((buf) => this.consumeData(buf, channel))
        .catch((err) => {
          console.error("[tilefun] Failed to decode WebRTC blob:", err);
        });
      return;
    }

    try {
      this.bytesReceived += data.byteLength;
      const packet = new Uint8Array(data);
      if (channel === "sync") {
        this.consumeSyncBinaryPacket(packet);
      } else {
        this.deliverDecoded(packet);
      }
    } catch (err) {
      console.error(`[tilefun] Bad WebRTC ${channel} server message:`, err);
    }
  }

  private resolveReady(): void {
    if (this.readyDone) return;
    this.readyDone = true;
    this.readyResolvers?.resolve();
    this.readyResolvers = null;
  }

  private rejectReady(err: Error): void {
    if (this.readyDone) return;
    this.readyDone = true;
    this.readyResolvers?.reject(err);
    this.readyResolvers = null;
    if (!this.closed) {
      this.stopStatsPolling();
      this.fragmentAssemblies.clear();
      this.entitiesDc?.close();
      this.syncDc.close();
      this.pc.close();
      this.ws.close();
    }
  }

  private startStatsPolling(): void {
    if (this.statsTimer) return;
    this.sampleStats();
    this.statsTimer = setInterval(() => {
      this.sampleStats();
    }, 1000);
  }

  private stopStatsPolling(): void {
    if (!this.statsTimer) return;
    clearInterval(this.statsTimer);
    this.statsTimer = null;
  }

  private sampleStats(): void {
    this.pc
      .getStats()
      .then((report) => {
        let rttMs: number | undefined;
        let selectedPairId: string | undefined;
        let pairById: Record<string, RTCStats> | undefined;

        report.forEach((stat) => {
          const s = stat as RTCStats & {
            type?: string;
            id?: string;
            selectedCandidatePairId?: string;
            currentRoundTripTime?: number;
            nominated?: boolean;
            selected?: boolean;
          };
          if (s.type === "transport" && s.selectedCandidatePairId) {
            selectedPairId = s.selectedCandidatePairId;
          } else if (s.type === "candidate-pair" && s.id) {
            pairById ??= {};
            pairById[s.id] = s;
            const selected = s.selected === true || s.nominated === true;
            if (selected && typeof s.currentRoundTripTime === "number") {
              rttMs = s.currentRoundTripTime * 1000;
            }
          }
        });

        if (rttMs === undefined && selectedPairId && pairById?.[selectedPairId]) {
          const selectedPair = pairById[selectedPairId] as RTCStats & {
            currentRoundTripTime?: number;
          };
          if (typeof selectedPair.currentRoundTripTime === "number") {
            rttMs = selectedPair.currentRoundTripTime * 1000;
          }
        }

        this.lastRttMs = rttMs;
      })
      .catch(() => {
        // Ignore occasional getStats errors during reconnect/teardown.
      });
  }

  private consumeSyncBinaryPacket(packet: Uint8Array): void {
    const fragment = decodeFragmentPacket(packet);
    if (!fragment) {
      this.deliverDecoded(packet);
      return;
    }

    const assembled = this.consumeFragment(fragment);
    if (assembled) {
      this.deliverDecoded(assembled);
    }
    this.pruneFragmentAssemblies();
  }

  private consumeFragment(fragment: {
    messageId: number;
    partIndex: number;
    partCount: number;
    payload: Uint8Array;
  }): Uint8Array | null {
    const now = performance.now();
    const existing = this.fragmentAssemblies.get(fragment.messageId);
    const assembly =
      existing && existing.partCount === fragment.partCount
        ? existing
        : {
            createdAt: now,
            partCount: fragment.partCount,
            parts: new Array<Uint8Array | undefined>(fragment.partCount),
            receivedCount: 0,
            totalBytes: 0,
          };

    const payload = fragment.payload.slice();
    if (!assembly.parts[fragment.partIndex]) {
      assembly.parts[fragment.partIndex] = payload;
      assembly.receivedCount++;
      assembly.totalBytes += payload.byteLength;
    }
    this.fragmentAssemblies.set(fragment.messageId, assembly);

    if (assembly.receivedCount !== assembly.partCount) {
      return null;
    }

    const out = new Uint8Array(assembly.totalBytes);
    let offset = 0;
    for (let i = 0; i < assembly.parts.length; i++) {
      const part = assembly.parts[i];
      if (!part) {
        return null;
      }
      out.set(part, offset);
      offset += part.byteLength;
    }
    this.fragmentAssemblies.delete(fragment.messageId);
    return out;
  }

  private deliverDecoded(bytes: Uint8Array): void {
    const msg = decodeServerMessage(toArrayBuffer(bytes));
    this.messageHandler?.(msg);
  }

  private pruneFragmentAssemblies(): void {
    const now = performance.now();
    if (now < this.nextFragmentGcAt) return;
    this.nextFragmentGcAt = now + 5000;

    for (const [id, assembly] of this.fragmentAssemblies) {
      if (now - assembly.createdAt > 15_000) {
        this.fragmentAssemblies.delete(id);
      }
    }
  }
}

function appendUuid(signalUrl: string, clientId: string): string {
  const url = new URL(signalUrl);
  url.searchParams.set("uuid", clientId);
  return url.toString();
}

interface FragmentAssembly {
  createdAt: number;
  partCount: number;
  parts: Array<Uint8Array | undefined>;
  receivedCount: number;
  totalBytes: number;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
