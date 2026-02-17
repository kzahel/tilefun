import type { Server as HttpServer, IncomingMessage } from "node:http";
import type nodeDataChannelImport from "node-datachannel";
import { type WebSocket, WebSocketServer } from "ws";
import { decodeClientMessage, encodeServerMessage } from "../shared/binaryCodec.js";
import type { ClientMessage, ServerMessage } from "../shared/protocol.js";
import type { IServerTransport } from "./Transport.js";
import {
  classifyDataChannelLabel,
  routeServerMessageChannel,
} from "./webrtcChannels.js";
import {
  fragmentForDataChannel,
  WEBRTC_FRAGMENT_DEFAULT_MAX_PAYLOAD_BYTES,
} from "./webrtcFragment.js";

type NodeDataChannelModule = typeof nodeDataChannelImport;
type PeerConnectionLike = InstanceType<NodeDataChannelModule["PeerConnection"]>;

type SignalClientToServer =
  | { type: "offer"; sdp: string }
  | { type: "candidate"; candidate: string; sdpMid?: string };

type SignalServerToClient =
  | { type: "answer"; sdp: string }
  | { type: "candidate"; candidate: string; sdpMid?: string }
  | { type: "error"; reason: string };

interface DataChannelLike {
  getLabel?(): string;
  onOpen?(handler: () => void): void;
  onClosed?(handler: () => void): void;
  onError?(handler: (err: string) => void): void;
  onMessage?(handler: (data: string | ArrayBuffer | Uint8Array) => void): void;
  sendMessageBinary?(data: Uint8Array): boolean | void;
  sendMessage?(data: string | Uint8Array): boolean | void;
  close?(): void;
}

interface ClientState {
  signalWs: WebSocket;
  peer: PeerConnectionLike;
  syncChannel: DataChannelLike | null;
  entitiesChannel: DataChannelLike | null;
  syncOpen: boolean;
  entitiesOpen: boolean;
  connected: boolean;
  entitiesFallbackLogged: boolean;
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
 * - Game data: dual data channels on one peer connection
 *   - entities: unordered + maxRetransmits=0 (frame hot path)
 *   - sync: ordered + reliable (all sync/control + client->server)
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
  private nextFragmentMessageId = 1;
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
    if (!client?.connected || !client.syncOpen) return;
    const encoded = encodeServerMessage(msg);
    this.sendEncoded(clientId, client, msg, encoded);
  }

  broadcast(msg: ServerMessage): void {
    const encoded = encodeServerMessage(msg);
    for (const [clientId, client] of this.clients) {
      if (!client.connected || !client.syncOpen) continue;
      this.sendEncoded(clientId, client, msg, encoded);
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
      syncChannel: null,
      entitiesChannel: null,
      syncOpen: false,
      entitiesOpen: false,
      connected: false,
      entitiesFallbackLogged: false,
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
      // If signaling closes before we establish sync channel, drop the pending peer.
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
      iceServers: [...this.iceServers],
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

      const label = dc.getLabel?.();
      const parsedKind = classifyDataChannelLabel(label);
      const kind =
        parsedKind ??
        (!client.syncChannel ? "sync" : !client.entitiesChannel ? "entities" : undefined);

      if (!kind) {
        console.warn(
          `[tilefun] Ignoring unexpected WebRTC datachannel label from ${clientId}: ${label ?? "(none)"}`,
        );
        dc.close?.();
        return;
      }

      if (kind === "sync") {
        client.syncChannel = dc;
        this.attachSyncChannelHandlers(clientId, dc);
        return;
      }

      client.entitiesChannel = dc;
      this.attachEntitiesChannelHandlers(clientId, dc);
    });

    peer.onStateChange?.((state) => {
      if (state === "failed" || state === "disconnected" || state === "closed") {
        this.dropClient(clientId, true);
      }
    });

    return peer;
  }

  private attachSyncChannelHandlers(clientId: string, dc: DataChannelLike): void {
    dc.onOpen?.(() => {
      const state = this.clients.get(clientId);
      if (!state) return;
      state.syncOpen = true;
      if (state.connected) return;
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
        console.error(`[tilefun] Bad WebRTC sync message from ${clientId}:`, err);
      }
    });

    dc.onClosed?.(() => {
      this.dropClient(clientId, true);
    });

    dc.onError?.((err) => {
      console.error(`[tilefun] Sync datachannel error for ${clientId}:`, err);
    });
  }

  private attachEntitiesChannelHandlers(clientId: string, dc: DataChannelLike): void {
    dc.onOpen?.(() => {
      const state = this.clients.get(clientId);
      if (!state) return;
      state.entitiesOpen = true;
      console.log(`[tilefun] WebRTC entities channel ready for ${clientId}`);
    });

    dc.onMessage?.((_data) => {
      // Phase 6 keeps client->server traffic on reliable sync.
    });

    dc.onClosed?.(() => {
      const state = this.clients.get(clientId);
      if (!state) return;
      state.entitiesOpen = false;
      if (state.entitiesChannel === dc) {
        state.entitiesChannel = null;
      }
      this.logEntitiesFallbackOnce(clientId, state, "entities datachannel closed");
    });

    dc.onError?.((err) => {
      console.error(`[tilefun] Entities datachannel error for ${clientId}:`, err);
    });
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
      client.syncChannel?.close?.();
    } catch {
      // Ignore teardown errors.
    }
    try {
      client.entitiesChannel?.close?.();
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

  private sendEncoded(
    clientId: string,
    client: ClientState,
    msg: ServerMessage,
    encoded: ArrayBuffer,
  ): void {
    const route = routeServerMessageChannel(msg, client.entitiesOpen && !!client.entitiesChannel);
    if (route.fellBack) {
      this.logEntitiesFallbackOnce(clientId, client, "entities channel unavailable");
      this.sendEncodedReliable(clientId, client, encoded);
      return;
    }

    if (route.channel === "entities") {
      if (this.sendEncodedEntities(clientId, client, encoded)) {
        return;
      }
      this.logEntitiesFallbackOnce(clientId, client, "entities send failed");
    }

    this.sendEncodedReliable(clientId, client, encoded);
  }

  private sendEncodedEntities(clientId: string, client: ClientState, encoded: ArrayBuffer): boolean {
    if (!client.entitiesChannel || !client.entitiesOpen) {
      return false;
    }
    try {
      // No app-level fragmentation/retransmit on unreliable entities channel.
      sendBinary(client.entitiesChannel, new Uint8Array(encoded));
      return true;
    } catch (err) {
      if (!isMessageSizeLimitError(err)) {
        console.error(`[tilefun] WebRTC entities send failed for ${clientId}:`, err);
      }
      return false;
    }
  }

  private sendEncodedReliable(clientId: string, client: ClientState, encoded: ArrayBuffer): void {
    if (!client.syncChannel || !client.syncOpen) return;
    const source = new Uint8Array(encoded);
    let maxPayload = WEBRTC_FRAGMENT_DEFAULT_MAX_PAYLOAD_BYTES;

    for (let attempt = 0; attempt < 5; attempt++) {
      const packets = this.buildPackets(source, maxPayload);
      try {
        for (const packet of packets) {
          sendBinary(client.syncChannel, packet);
        }
        return;
      } catch (err) {
        if (!isMessageSizeLimitError(err) || maxPayload <= 512) {
          console.error(`[tilefun] WebRTC reliable send failed for ${clientId}:`, err);
          return;
        }
        maxPayload = Math.max(512, Math.floor(maxPayload / 2));
      }
    }
  }

  private logEntitiesFallbackOnce(clientId: string, client: ClientState, reason: string): void {
    if (client.entitiesFallbackLogged) return;
    client.entitiesFallbackLogged = true;
    console.warn(`[tilefun] WebRTC ${clientId}: falling back to sync channel (${reason})`);
  }

  private buildPackets(encoded: Uint8Array, maxPayload: number): Uint8Array[] {
    return fragmentForDataChannel(encoded, this.allocateFragmentMessageId(), maxPayload);
  }

  private allocateFragmentMessageId(): number {
    const id = this.nextFragmentMessageId >>> 0;
    this.nextFragmentMessageId = (this.nextFragmentMessageId + 1) >>> 0;
    if (this.nextFragmentMessageId === 0) this.nextFragmentMessageId = 1;
    return id;
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

function sendBinary(dataChannel: DataChannelLike, msg: Uint8Array): void {
  if (dataChannel.sendMessageBinary) {
    const ok = dataChannel.sendMessageBinary(msg);
    if (ok === false) {
      throw new Error("sendMessageBinary returned false");
    }
    return;
  }
  if (dataChannel.sendMessage) {
    const ok = dataChannel.sendMessage(msg);
    if (ok === false) {
      throw new Error("sendMessage returned false");
    }
    return;
  }
  throw new Error("No binary send function on datachannel");
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

function isMessageSizeLimitError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return err.message.includes("Message size exceeds limit");
}
