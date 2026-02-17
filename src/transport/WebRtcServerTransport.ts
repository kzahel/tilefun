import type { Server as HttpServer, IncomingMessage } from "node:http";
import type nodeDataChannelImport from "node-datachannel";
import { type WebSocket, WebSocketServer } from "ws";
import { decodeClientMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { IServerTransport } from "./Transport.js";

type NodeDataChannelModule = typeof nodeDataChannelImport;
type PeerConnectionLike = InstanceType<NodeDataChannelModule["PeerConnection"]>;

type SignalClientToServer =
  | { type: "offer"; sdp: string }
  | { type: "candidate"; candidate: string; sdpMid?: string };

type SignalServerToClient =
  | { type: "answer"; sdp: string }
  | { type: "candidate"; candidate: string; sdpMid?: string }
  | { type: "error"; reason: string };

interface ClientState {
  signalWs: WebSocket;
  peer: PeerConnectionLike;
  dataChannel: {
    sendMessageBinary?(data: Uint8Array): void;
    sendMessage?(data: Uint8Array): void;
    close?(): void;
  } | null;
  connected: boolean;
}

interface WebRtcServerTransportOptions {
  server: HttpServer;
  /** Signaling WebSocket path. */
  path?: string;
  /** STUN/TURN servers passed to node-datachannel. */
  iceServers?: readonly string[];
}

/**
 * Dedicated-server WebRTC transport (UDP data path) with WebSocket signaling.
 *
 * Design:
 * - Signaling: WebSocket (offer/answer + ICE candidates)
 * - Game data: one reliable ordered RTCDataChannel per client
 * - Message payloads: existing binary protocol (encodeServerMessage/decodeClientMessage)
 */
export class WebRtcServerTransport implements IServerTransport {
  static async create(options: WebRtcServerTransportOptions): Promise<WebRtcServerTransport> {
    const mod = await loadNodeDataChannel();
    return new WebRtcServerTransport(mod, options);
  }

  private readonly ndc: NodeDataChannelModule;
  private readonly wss: WebSocketServer;
  private readonly clients = new Map<string, ClientState>();
  private readonly replacedSockets = new Set<WebSocket>();
  private readonly iceServers: readonly string[];
  private messageHandler: ((clientId: string, msg: ClientMessage) => void) | null = null;
  private connectHandler: ((clientId: string) => void) | null = null;
  private disconnectHandler: ((clientId: string) => void) | null = null;
  private closed = false;

  private constructor(ndc: NodeDataChannelModule, options: WebRtcServerTransportOptions) {
    this.ndc = ndc;
    this.iceServers = options.iceServers ?? [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
    ];
    this.ndc.initLogger?.("warn");

    if (options.path) {
      this.wss = new WebSocketServer({ noServer: true });
      options.server.on("upgrade", (req, socket, head) => {
        const url = req.url ?? "";
        if (url === options.path || url.startsWith(`${options.path}?`)) {
          this.wss.handleUpgrade(req, socket, head, (ws) => {
            this.wss.emit("connection", ws, req);
          });
        }
      });
    } else {
      this.wss = new WebSocketServer({ server: options.server });
    }

    this.wss.on("connection", (ws, req) => this.onSignalConnection(ws, req));
  }

  send(clientId: string, msg: ServerMessage): void {
    const client = this.clients.get(clientId);
    if (!client?.connected || !client.dataChannel) return;
    const encoded = encodeServerMessage(msg);
    sendBinary(client.dataChannel, encoded);
  }

  broadcast(msg: ServerMessage): void {
    const encoded = encodeServerMessage(msg);
    for (const client of this.clients.values()) {
      if (!client.connected || !client.dataChannel) continue;
      sendBinary(client.dataChannel, encoded);
    }
  }

  onMessage(handler: (clientId: string, msg: ClientMessage) => void): void {
    this.messageHandler = handler;
  }

  onConnect(handler: (clientId: string) => void): void {
    this.connectHandler = handler;
  }

  onDisconnect(handler: (clientId: string) => void): void {
    this.disconnectHandler = handler;
  }

  close(): void {
    this.closed = true;
    for (const clientId of [...this.clients.keys()]) {
      this.dropClient(clientId, false);
    }
    this.wss.close();
    this.ndc.cleanup?.();
  }

  private onSignalConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url ?? "", "http://localhost");
    const uuid = url.searchParams.get("uuid");
    if (!uuid) {
      ws.close(4000, "Missing UUID");
      return;
    }
    const clientId = uuid;

    const existing = this.clients.get(clientId);
    if (existing) {
      this.replacedSockets.add(existing.signalWs);
      this.sendSignal(existing.signalWs, {
        type: "error",
        reason: "Connected from another tab",
      });
      this.dropClient(clientId, false);
    }

    const peer = this.createPeer(clientId, ws);
    this.clients.set(clientId, {
      signalWs: ws,
      peer,
      dataChannel: null,
      connected: false,
    });

    ws.on("message", (data) => {
      const raw = toText(data);
      if (raw !== null) {
        this.handleSignalMessage(clientId, raw);
      } else {
        this.sendSignal(ws, { type: "error", reason: "Unsupported signaling payload" });
      }
    });

    ws.on("close", () => {
      if (this.replacedSockets.delete(ws)) return;
      // If signaling closes before we establish datachannel, drop the pending peer.
      const client = this.clients.get(clientId);
      if (client && !client.connected) {
        this.dropClient(clientId, false);
      }
    });

    ws.on("error", (err) => {
      console.error(`[tilefun] WebRTC signaling socket error for ${clientId}:`, err);
      if (this.replacedSockets.delete(ws)) return;
      const client = this.clients.get(clientId);
      if (client && !client.connected) {
        this.dropClient(clientId, false);
      }
    });
  }

  private createPeer(clientId: string, signalWs: WebSocket): PeerConnectionLike {
    const peer = new this.ndc.PeerConnection(`tilefun-${clientId}`, {
      iceServers: this.iceServers,
    });

    peer.onLocalDescription?.((sdp, type) => {
      if (this.closed) return;
      if (type !== "answer") return;
      this.sendSignal(signalWs, { type: "answer", sdp });
    });

    peer.onLocalCandidate?.((candidate, sdpMid) => {
      if (this.closed || !candidate) return;
      this.sendSignal(signalWs, { type: "candidate", candidate, ...(sdpMid ? { sdpMid } : {}) });
    });

    peer.onDataChannel?.((dc) => {
      const client = this.clients.get(clientId);
      if (!client) return;
      client.dataChannel = dc;

      dc.onOpen?.(() => {
        const state = this.clients.get(clientId);
        if (!state || state.connected) return;
        state.connected = true;
        this.connectHandler?.(clientId);
      });

      dc.onMessage?.((data) => {
        const buf = toArrayBuffer(data);
        if (!buf) return;
        try {
          const msg = decodeClientMessage(buf);
          this.messageHandler?.(clientId, msg);
        } catch (err) {
          console.error(`[tilefun] Bad WebRTC message from ${clientId}:`, err);
        }
      });

      dc.onClosed?.(() => {
        this.dropClient(clientId, true);
      });

      dc.onError?.((err) => {
        console.error(`[tilefun] Datachannel error for ${clientId}:`, err);
      });
    });

    peer.onStateChange?.((state) => {
      if (state === "failed" || state === "disconnected" || state === "closed") {
        this.dropClient(clientId, true);
      }
    });

    return peer;
  }

  private handleSignalMessage(clientId: string, raw: string): void {
    let msg: SignalClientToServer;
    try {
      msg = JSON.parse(raw) as SignalClientToServer;
    } catch {
      const client = this.clients.get(clientId);
      if (client) this.sendSignal(client.signalWs, { type: "error", reason: "Invalid JSON" });
      return;
    }

    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      if (msg.type === "offer") {
        client.peer.setRemoteDescription?.(msg.sdp, "offer");
      } else if (msg.type === "candidate" && msg.candidate) {
        client.peer.addRemoteCandidate?.(msg.candidate, msg.sdpMid);
      }
    } catch (err) {
      console.error(`[tilefun] WebRTC signaling error for ${clientId}:`, err);
      this.sendSignal(client.signalWs, {
        type: "error",
        reason: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private sendSignal(ws: WebSocket, msg: SignalServerToClient): void {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify(msg));
  }

  private dropClient(clientId: string, notifyDisconnect: boolean): void {
    const client = this.clients.get(clientId);
    if (!client) return;
    this.clients.delete(clientId);

    try {
      client.dataChannel?.close?.();
    } catch {
      // Ignore teardown errors.
    }
    try {
      client.peer.close?.();
    } catch {
      // Ignore teardown errors.
    }
    try {
      if (client.signalWs.readyState === client.signalWs.OPEN) {
        client.signalWs.close();
      }
    } catch {
      // Ignore teardown errors.
    }

    if (notifyDisconnect && client.connected) {
      this.disconnectHandler?.(clientId);
    }
  }
}

function toArrayBuffer(data: string | ArrayBuffer | Uint8Array): ArrayBuffer | null {
  if (typeof data === "string") return null;
  if (data instanceof ArrayBuffer) return data;
  if (ArrayBuffer.isView(data)) {
    return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  }
  return null;
}

function sendBinary(
  dataChannel: { sendMessageBinary?(data: Uint8Array): void; sendMessage?(data: Uint8Array): void },
  msg: ArrayBuffer,
): void {
  const bytes = new Uint8Array(msg);
  if (dataChannel.sendMessageBinary) {
    dataChannel.sendMessageBinary(bytes);
    return;
  }
  dataChannel.sendMessage?.(bytes);
}

async function loadNodeDataChannel(): Promise<NodeDataChannelModule> {
  try {
    const mod = (await import("node-datachannel")) as unknown as
      | NodeDataChannelModule
      | { default: NodeDataChannelModule };
    return "default" in mod ? mod.default : mod;
  } catch (err) {
    throw new Error(
      `WebRTC transport requires optional dependency 'node-datachannel'. Install it and retry. Original error: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

function toText(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (data instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(data));
  if (ArrayBuffer.isView(data)) {
    return new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  }
  if (Array.isArray(data)) {
    const parts = data.filter((part): part is Uint8Array => ArrayBuffer.isView(part));
    const total = parts.reduce((sum, part) => sum + part.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
      merged.set(new Uint8Array(part.buffer, part.byteOffset, part.byteLength), offset);
      offset += part.byteLength;
    }
    return new TextDecoder().decode(merged);
  }
  return null;
}
