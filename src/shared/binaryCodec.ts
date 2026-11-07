/**
 * Binary protocol codec — replaces JSON.stringify/parse for hot-path messages.
 *
 * Message type tags:
 *   0x16 = FrameMessage (vehicle rotation, equipment and couplings, prescribed groups, momentum and solved pairs) (server→client)
 *   0x03 = SyncChunksMessage (server→client)
 *   0x81 = fixed-tick player-input (client→server)
 *   0xFF = JSON fallback (UTF-8 JSON string follows)
 *
 * All multi-byte values are little-endian. All offsets measured in bytes.
 */

import {
  type EntityDelta,
  MAX_BASELINE_FIELD_BYTES,
  MAX_DELTA_FIELD_BYTES,
  readBaselineFields,
  readDeltaFields,
  writeBaselineFields,
  writeDeltaFields,
} from "./entityFields.js";
import { ENTITY_TYPE_TO_INDEX, indexToEntityType } from "./entityTypeIndex.js";
import type { WireCursor } from "./entityWire.js";
import { physicsStateBytes, readPhysicsState, writePhysicsState } from "./physicsStateCodec.js";
import type {
  ChunkSnapshot,
  ClientMessage,
  EntitySnapshot,
  FrameMessage,
  ServerMessage,
  SyncChunksMessage,
} from "./protocol.js";

// ---- Message type tags ----

const TAG_FRAME = 0x16;
const TAG_SYNC_CHUNKS = 0x03;
const TAG_PLAYER_INPUT = 0x81;
const TAG_JSON = 0xff;

// ---- TextEncoder/Decoder for JSON fallback ----

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

// ---- Server message encoding ----

export function encodeServerMessage(msg: ServerMessage): ArrayBuffer {
  if (msg.type === "frame") return encodeFrameMessage(msg);
  if (msg.type === "sync-chunks") return encodeSyncChunksMessage(msg);
  return encodeJsonFallback(msg);
}

export function decodeServerMessage(buf: ArrayBuffer): ServerMessage {
  const view = new DataView(buf);
  const tag = view.getUint8(0);
  if (tag === TAG_FRAME) return decodeFrameMessage(view, buf);
  if (tag === 0x01 || (tag >= 0x04 && tag <= 0x10))
    throw new Error("Legacy entity frame: matching updated client and server builds are required");
  if (tag === TAG_SYNC_CHUNKS) return decodeSyncChunksMessage(view, buf);
  if (tag === TAG_JSON) return decodeJsonFallback(buf) as ServerMessage;
  throw new Error(`Unknown server message tag: 0x${tag.toString(16)}`);
}

// ---- Client message encoding ----

export function encodeClientMessage(msg: ClientMessage): ArrayBuffer {
  if (msg.type === "player-input") return encodePlayerInput(msg);
  return encodeJsonFallback(msg);
}

export function decodeClientMessage(buf: ArrayBuffer): ClientMessage {
  const view = new DataView(buf);
  const tag = view.getUint8(0);
  if (tag === TAG_PLAYER_INPUT) return decodePlayerInput(view);
  if (tag === TAG_JSON) return decodeJsonFallback(buf) as ClientMessage;
  throw new Error(`Unknown client message tag: 0x${tag.toString(16)}`);
}

// ---- JSON fallback ----

function encodeJsonFallback(msg: unknown): ArrayBuffer {
  const json = textEncoder.encode(JSON.stringify(msg));
  const buf = new ArrayBuffer(1 + json.byteLength);
  new DataView(buf).setUint8(0, TAG_JSON);
  new Uint8Array(buf, 1).set(json);
  return buf;
}

function decodeJsonFallback(buf: ArrayBuffer): unknown {
  const json = textDecoder.decode(new Uint8Array(buf, 1));
  return JSON.parse(json);
}

// ---- FrameMessage binary codec ----

const FRAME_HEADER_SIZE = 27; // tag + tick/input/player + Float64 simulation time + counts
const MAX_BASELINE_SIZE = 14 + MAX_BASELINE_FIELD_BYTES; // id, type, position + fields
const MAX_DELTA_SIZE = 4 + MAX_DELTA_FIELD_BYTES; // id + masks, position and fields

function encodeFrameMessage(msg: FrameMessage): ArrayBuffer {
  const baselines = msg.entityBaselines ?? [];
  const deltas = msg.entityDeltas ?? [];
  const exits = msg.entityExits ?? [];

  const maxSize =
    FRAME_HEADER_SIZE +
    baselines.length * MAX_BASELINE_SIZE +
    deltas.length * MAX_DELTA_SIZE +
    exits.length * 4 +
    physicsStateBytes(msg.physics);

  const buf = new ArrayBuffer(maxSize);
  const view = new DataView(buf);
  let off = 0;

  // Header
  view.setUint8(off, TAG_FRAME);
  off += 1;
  view.setUint32(off, msg.serverTick, true);
  off += 4;
  view.setUint32(off, msg.lastProcessedInputSeq, true);
  off += 4;
  view.setUint32(off, msg.playerEntityId, true);
  off += 4;
  view.setFloat64(off, msg.simulationTime ?? -1, true);
  off += 8;
  view.setUint16(off, baselines.length, true);
  off += 2;
  view.setUint16(off, deltas.length, true);
  off += 2;
  view.setUint16(off, exits.length, true);
  off += 2;

  // Baselines
  for (const snap of baselines) {
    off = writeBaseline(view, off, snap);
  }

  // Deltas
  for (const delta of deltas) {
    off = writeDelta(view, off, delta);
  }

  // Exits
  for (const id of exits) {
    view.setUint32(off, id, true);
    off += 4;
  }

  off = writePhysicsState(view, off, msg.physics);
  return buf.slice(0, off);
}

function decodeFrameMessage(view: DataView, _buf: ArrayBuffer): FrameMessage {
  let off = 1; // skip tag

  const serverTick = view.getUint32(off, true);
  off += 4;
  const lastProcessedInputSeq = view.getUint32(off, true);
  off += 4;
  const playerEntityId = view.getUint32(off, true);
  off += 4;
  const simulationTime = view.getFloat64(off, true);
  off += 8;
  const baselineCount = view.getUint16(off, true);
  off += 2;
  const deltaCount = view.getUint16(off, true);
  off += 2;
  const exitCount = view.getUint16(off, true);
  off += 2;

  const msg: FrameMessage = {
    type: "frame",
    serverTick,
    lastProcessedInputSeq,
    playerEntityId,
  };

  if (Number.isFinite(simulationTime) && simulationTime >= 0) msg.simulationTime = simulationTime;

  const cursor: WireCursor = { view, off };
  if (baselineCount > 0) {
    const entityBaselines: EntitySnapshot[] = [];
    for (let i = 0; i < baselineCount; i++) entityBaselines.push(readBaseline(cursor));
    msg.entityBaselines = entityBaselines;
  }
  if (deltaCount > 0) {
    const entityDeltas: EntityDelta[] = [];
    for (let i = 0; i < deltaCount; i++) entityDeltas.push(readDelta(cursor));
    msg.entityDeltas = entityDeltas;
  }
  off = cursor.off;

  // Exits
  if (exitCount > 0) {
    const entityExits: number[] = [];
    for (let i = 0; i < exitCount; i++) {
      entityExits.push(view.getUint32(off, true));
      off += 4;
    }
    msg.entityExits = entityExits;
  }

  const [physics, end] = readPhysicsState(view, off);
  if (physics) msg.physics = physics;
  if (end !== view.byteLength) throw Error("Unexpected trailing entity frame bytes");
  return msg;
}

// ---- Entity baselines and deltas (fields come from ENTITY_FIELDS) ----

function writeBaseline(view: DataView, off: number, snap: EntitySnapshot): number {
  view.setUint32(off, snap.id, true);
  view.setUint16(off + 4, ENTITY_TYPE_TO_INDEX.get(snap.type) ?? 0, true);
  view.setFloat32(off + 6, snap.position.wx, true);
  view.setFloat32(off + 10, snap.position.wy, true);
  return writeBaselineFields(view, off + 14, snap);
}

function readBaseline(cursor: WireCursor): EntitySnapshot {
  const { view, off } = cursor;
  cursor.off += 14;
  const snap: EntitySnapshot = {
    id: view.getUint32(off, true),
    type: indexToEntityType(view.getUint16(off + 4, true)) ?? "unknown",
    position: { wx: view.getFloat32(off + 6, true), wy: view.getFloat32(off + 10, true) },
    velocity: null,
    spriteState: null,
    wanderAIState: null,
  };
  readBaselineFields(cursor, snap);
  return snap;
}

function writeDelta(view: DataView, off: number, delta: EntityDelta): number {
  view.setUint32(off, delta.id, true);
  return writeDeltaFields(view, off + 4, delta);
}

function readDelta(cursor: WireCursor): EntityDelta {
  const delta: EntityDelta = { id: cursor.view.getUint32(cursor.off, true) };
  cursor.off += 4;
  readDeltaFields(cursor, delta);
  return delta;
}

// ---- player-input encoding ----

function encodePlayerInput(msg: Extract<ClientMessage, { type: "player-input" }>): ArrayBuffer {
  const buf = new ArrayBuffer(8);
  const view = new DataView(buf);
  view.setUint8(0, TAG_PLAYER_INPUT);
  view.setUint32(1, msg.seq, true);
  // Quantize analog [-1,1] to Int8 [-127,127]. 0.8% precision — plenty for a joystick.
  view.setInt8(5, Math.round(Math.max(-1, Math.min(1, msg.dx)) * 127));
  view.setInt8(6, Math.round(Math.max(-1, Math.min(1, msg.dy)) * 127));
  let flags = 0;
  if (msg.sprinting) flags |= 0x01;
  if (msg.jump) flags |= 0x02;
  if (msg.jumpPressed) flags |= 0x04;
  if (msg.reversing) flags |= 0x08;
  if (msg.relativeDriving) flags |= 0x10;
  view.setUint8(7, flags);
  return buf;
}

function decodePlayerInput(view: DataView): ClientMessage {
  if (view.byteLength !== 8) throw Error("Invalid fixed-tick input length");
  const seq = view.getUint32(1, true);
  const dx = view.getInt8(5) / 127;
  const dy = view.getInt8(6) / 127;
  const flags = view.getUint8(7);
  return {
    type: "player-input",
    seq,
    dx,
    dy,
    sprinting: (flags & 0x01) !== 0,
    jump: (flags & 0x02) !== 0,
    ...((flags & 0x04) !== 0 ? { jumpPressed: true } : {}),
    ...((flags & 0x08) !== 0 ? { reversing: true } : {}),
    ...((flags & 0x10) !== 0 ? { relativeDriving: true } : {}),
  };
}

// ---- SyncChunksMessage encoding ----
// Chunk data uses raw typed array bytes instead of JSON number arrays.
// Array sizes are fixed (derived from CHUNK_SIZE=16, SUBGRID_SIZE=33, MAX_BLEND_LAYERS=6):
//   subgrid:     Uint8Array  33*33 = 1089 bytes
//   roadGrid:    Uint8Array  16*16 = 256 bytes
//   heightGrid:  Uint8Array  16*16 = 256 bytes
//   terrain:     Uint16Array 16*16 = 512 bytes
//   detail:      Uint16Array 16*16 = 512 bytes
//   blendBase:   Uint8Array  16*16 = 256 bytes
//   blendLayers: Uint32Array 6*256 = 6144 bytes
//   collision:   Uint8Array  16*16 = 256 bytes
// Total per chunk: 9281 bytes + 8 header = 9289 bytes

const SUBGRID_BYTES = 1089;
const AREA_BYTES = 256;
const AREA_U16_BYTES = 512;
const BLEND_LAYERS_BYTES = 6144;
const CHUNK_BINARY_SIZE =
  8 + SUBGRID_BYTES + AREA_BYTES * 4 + AREA_U16_BYTES * 2 + BLEND_LAYERS_BYTES;

function encodeSyncChunksMessage(msg: SyncChunksMessage): ArrayBuffer {
  const keys = msg.loadedChunkKeys;
  const updates = msg.chunkUpdates;
  const keyCount = keys?.length ?? 0;
  const updateCount = updates?.length ?? 0;
  // Optional geometry extension. Ordinary chunks keep their fixed layout.
  const hasRails = updates?.some((c) => c.railPaths?.length) ?? false;
  const rails = hasRails
    ? (updates?.map((c) => textEncoder.encode(JSON.stringify(c.railPaths ?? []))) ?? [])
    : [];

  // Header: 1 tag + 1 flags + 2 keyCount + keyCount*4 + 2 updateCount + updateCount*CHUNK_BINARY_SIZE
  const size =
    1 +
    1 +
    2 +
    keyCount * 4 +
    2 +
    updateCount * CHUNK_BINARY_SIZE +
    rails.reduce((n, r) => n + 4 + r.length, 0);
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let off = 0;

  view.setUint8(off, TAG_SYNC_CHUNKS);
  off += 1;

  let flags = 0;
  if (keys) flags |= 0x01;
  if (updates) flags |= 0x02;
  if (hasRails) flags |= 0x04;
  view.setUint8(off, flags);
  off += 1;

  // Loaded chunk keys as i16 pairs
  view.setUint16(off, keyCount, true);
  off += 2;
  if (keys) {
    for (const key of keys) {
      const [cxStr, cyStr] = key.split(",") as [string, string];
      view.setInt16(off, Number.parseInt(cxStr, 10), true);
      off += 2;
      view.setInt16(off, Number.parseInt(cyStr, 10), true);
      off += 2;
    }
  }

  // Chunk updates
  view.setUint16(off, updateCount, true);
  off += 2;
  if (updates) {
    for (const [i, chunk] of updates.entries()) {
      off = writeChunkSnapshot(view, bytes, off, chunk);
      const rail = rails[i];
      if (rail) {
        view.setUint32(off, rail.length, true);
        off += 4;
        bytes.set(rail, off);
        off += rail.length;
      }
    }
  }

  return buf;
}

function decodeSyncChunksMessage(view: DataView, buf: ArrayBuffer): SyncChunksMessage {
  const bytes = new Uint8Array(buf);
  let off = 1; // skip tag

  const flags = view.getUint8(off);
  off += 1;

  const msg: SyncChunksMessage = { type: "sync-chunks" };

  // Loaded chunk keys
  const keyCount = view.getUint16(off, true);
  off += 2;
  if (flags & 0x01) {
    const loadedChunkKeys: string[] = [];
    for (let i = 0; i < keyCount; i++) {
      const cx = view.getInt16(off, true);
      off += 2;
      const cy = view.getInt16(off, true);
      off += 2;
      loadedChunkKeys.push(`${cx},${cy}`);
    }
    msg.loadedChunkKeys = loadedChunkKeys;
  }

  // Chunk updates
  const updateCount = view.getUint16(off, true);
  off += 2;
  if (flags & 0x02) {
    const chunkUpdates: ChunkSnapshot[] = [];
    for (let i = 0; i < updateCount; i++) {
      const [chunk, newOff] = readChunkSnapshot(view, bytes, off);
      chunkUpdates.push(chunk);
      off = newOff;
      if (flags & 0x04) {
        const size = view.getUint32(off, true);
        off += 4;
        if (size > 65536 || off + size > bytes.length) throw Error("Invalid rail geometry size");
        const paths = JSON.parse(textDecoder.decode(bytes.subarray(off, off + size)));
        if (!Array.isArray(paths) || paths.length > 4) throw Error("Invalid rail geometry batch");
        if (paths.length) chunk.railPaths = paths;
        off += size;
      }
    }
    msg.chunkUpdates = chunkUpdates;
  }

  return msg;
}

function writeChunkSnapshot(
  view: DataView,
  bytes: Uint8Array,
  off: number,
  chunk: ChunkSnapshot,
): number {
  view.setInt16(off, chunk.cx, true);
  off += 2;
  view.setInt16(off, chunk.cy, true);
  off += 2;
  view.setUint32(off, chunk.revision, true);
  off += 4;

  // Write raw array data. Source is number[] (from serializeChunk's Array.from).
  // We write directly as the appropriate byte width.

  // subgrid: u8 x 1089
  for (let i = 0; i < SUBGRID_BYTES; i++) bytes[off + i] = chunk.subgrid[i]!;
  off += SUBGRID_BYTES;

  // roadGrid: u8 x 256
  for (let i = 0; i < AREA_BYTES; i++) bytes[off + i] = chunk.roadGrid[i]!;
  off += AREA_BYTES;

  // heightGrid: u8 x 256
  for (let i = 0; i < AREA_BYTES; i++) bytes[off + i] = chunk.heightGrid[i]!;
  off += AREA_BYTES;

  // terrain: u16 x 256 (little-endian)
  for (let i = 0; i < 256; i++) {
    view.setUint16(off, chunk.terrain[i]!, true);
    off += 2;
  }

  // detail: u16 x 256
  for (let i = 0; i < 256; i++) {
    view.setUint16(off, chunk.detail[i]!, true);
    off += 2;
  }

  // blendBase: u8 x 256
  for (let i = 0; i < AREA_BYTES; i++) bytes[off + i] = chunk.blendBase[i]!;
  off += AREA_BYTES;

  // blendLayers: u32 x 1536
  for (let i = 0; i < 1536; i++) {
    view.setUint32(off, chunk.blendLayers[i]!, true);
    off += 4;
  }

  // collision: u8 x 256
  for (let i = 0; i < AREA_BYTES; i++) bytes[off + i] = chunk.collision[i]!;
  off += AREA_BYTES;

  return off;
}

function readChunkSnapshot(
  view: DataView,
  bytes: Uint8Array,
  off: number,
): [ChunkSnapshot, number] {
  const cx = view.getInt16(off, true);
  off += 2;
  const cy = view.getInt16(off, true);
  off += 2;
  const revision = view.getUint32(off, true);
  off += 4;

  // subgrid: u8 x 1089
  const subgrid: number[] = Array.from(bytes.subarray(off, off + SUBGRID_BYTES));
  off += SUBGRID_BYTES;

  // roadGrid: u8 x 256
  const roadGrid: number[] = Array.from(bytes.subarray(off, off + AREA_BYTES));
  off += AREA_BYTES;

  // heightGrid: u8 x 256
  const heightGrid: number[] = Array.from(bytes.subarray(off, off + AREA_BYTES));
  off += AREA_BYTES;

  // terrain: u16 x 256
  const terrain: number[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    terrain[i] = view.getUint16(off, true);
    off += 2;
  }

  // detail: u16 x 256
  const detail: number[] = new Array(256);
  for (let i = 0; i < 256; i++) {
    detail[i] = view.getUint16(off, true);
    off += 2;
  }

  // blendBase: u8 x 256
  const blendBase: number[] = Array.from(bytes.subarray(off, off + AREA_BYTES));
  off += AREA_BYTES;

  // blendLayers: u32 x 1536
  const blendLayers: number[] = new Array(1536);
  for (let i = 0; i < 1536; i++) {
    blendLayers[i] = view.getUint32(off, true);
    off += 4;
  }

  // collision: u8 x 256
  const collision: number[] = Array.from(bytes.subarray(off, off + AREA_BYTES));
  off += AREA_BYTES;

  return [
    {
      cx,
      cy,
      revision,
      subgrid,
      roadGrid,
      heightGrid,
      terrain,
      detail,
      blendBase,
      blendLayers,
      collision,
    },
    off,
  ];
}

// ---- Shared quantization (for prediction parity) ----

/** Quantize an analog axis value [-1,1] the same way the binary codec does.
 *  Call this on dx/dy *before* sending and predicting so client and server
 *  process identical values. */
export function quantizeAxis(v: number): number {
  return Math.round(Math.max(-1, Math.min(1, v)) * 127) / 127;
}

// ---- Exports for testing ----

export { ENTITY_TYPE_TO_INDEX };
