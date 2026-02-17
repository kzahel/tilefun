import { decodeServerMessage, encodeClientMessage } from "../shared/binaryCodec.js";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { IClientTransport } from "./Transport.js";

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
  channelLabel?: string;
}

/**
 * Browser transport for dedicated server WebRTC mode.
 * Uses WebSocket only for signaling; game traffic flows over RTCDataChannel.
 */
export class WebRtcClientTransport implements IClientTransport {
  private readonly pc: RTCPeerConnection;
  private readonly dc: RTCDataChannel;
  private readonly ws: WebSocket;
  private closed = false;
  private messageHandler: ((msg: ServerMessage) => void) | null = null;
  private readyResolvers: { resolve: () => void; reject: (err: Error) => void } | null = null;
  private readyDone = false;
  bytesReceived = 0;

  constructor(options: WebRtcClientTransportOptions) {
    this.pc = new RTCPeerConnection({
      iceServers: options.iceServers ?? [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });
    this.dc = this.pc.createDataChannel(options.channelLabel ?? "game", {
      ordered: true,
    });
    this.dc.binaryType = "arraybuffer";

    this.dc.onopen = () => {
      this.resolveReady();
    };
    this.dc.onmessage = (event) => {
      this.consumeData(event.data);
    };
    this.dc.onerror = (event) => {
      console.error("[tilefun] WebRTC datachannel error:", event);
    };
    this.dc.onclose = () => {
      if (!this.closed) {
        console.warn("[tilefun] WebRTC datachannel closed");
      }
    };

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
    if (this.dc.readyState === "open") return Promise.resolve();
    if (this.readyDone) return Promise.reject(new Error("WebRTC transport is closed"));

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.dc.readyState === "open") return;
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
    if (this.dc.readyState !== "open") return;
    this.dc.send(encodeClientMessage(msg));
  }

  onMessage(handler: (msg: ServerMessage) => void): void {
    this.messageHandler = handler;
  }

  close(): void {
    this.closed = true;
    this.readyDone = true;
    this.dc.close();
    this.pc.close();
    this.ws.close();
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

  private consumeData(data: string | ArrayBuffer | Blob): void {
    if (typeof data === "string") return;
    if (data instanceof Blob) {
      data
        .arrayBuffer()
        .then((buf) => this.consumeData(buf))
        .catch((err) => {
          console.error("[tilefun] Failed to decode WebRTC blob:", err);
        });
      return;
    }

    try {
      this.bytesReceived += data.byteLength;
      const msg = decodeServerMessage(data);
      this.messageHandler?.(msg);
    } catch (err) {
      console.error("[tilefun] Bad WebRTC server message:", err);
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
      this.dc.close();
      this.pc.close();
      this.ws.close();
    }
  }
}

function appendUuid(signalUrl: string, clientId: string): string {
  const url = new URL(signalUrl);
  url.searchParams.set("uuid", clientId);
  return url.toString();
}
