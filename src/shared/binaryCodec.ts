/**
 * Binary protocol codec — replaces JSON.stringify/parse for hot-path messages.
 *
 * Message type tags:
 *   0x01 = FrameMessage (server→client)
 *   0x03 = SyncChunksMessage (server→client)
 *   0x80 = player-input (client→server)
 *   0xFF = JSON fallback (UTF-8 JSON string follows)
 *
 * All multi-byte values are little-endian. All offsets measured in bytes.
 */

import type { SpriteState, WanderAIState } from "../entities/EntityDefs.js";
import type { EntityDelta } from "./entityDelta.js";
import { ENTITY_TYPE_LIST, ENTITY_TYPE_TO_INDEX, indexToEntityType } from "./entityTypeIndex.js";
import type {
  ChunkSnapshot,
  ClientMessage,
  EntitySnapshot,
  FrameMessage,
  ServerMessage,
  SyncChunksMessage,
} from "./protocol.js";

// ---- Message type tags ----

const TAG_FRAME = 0x01;
const TAG_SYNC_CHUNKS = 0x03;
const TAG_PLAYER_INPUT = 0x80;
const TAG_JSON = 0xff;

// ---- AI state string ↔ u8 ----

const AI_STATES = ["idle", "walking", "chasing", "following", "ridden"] as const;
const AI_STATE_TO_INDEX: Record<string, number> = {};
for (let i = 0; i < AI_STATES.length; i++) AI_STATE_TO_INDEX[AI_STATES[i]!] = i;

// ---- Presence bitmask bits (shared by baseline and delta) ----

const BIT_VELOCITY = 0;
const BIT_SPRITE = 1;
const BIT_WANDER_AI = 2;
const BIT_FLASH_HIDDEN = 3;
const BIT_NO_SHADOW = 4;
const BIT_DEATH_TIMER = 5;
const BIT_JUMP_Z = 6;
const BIT_JUMP_VZ = 7;
const BIT_WZ = 8;
const BIT_PARENT_ID = 9;
const BIT_LOCAL_OFFSET_X = 10;
const BIT_LOCAL_OFFSET_Y = 11;

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

const FRAME_HEADER_SIZE = 19; // 1 tag + 4 serverTick + 4 lastInput + 4 playerEntity + 2+2+2 counts
const MAX_BASELINE_SIZE = 15 + 8 + 4 + 3 + 1 + 1 + 4 + 4 + 4 + 4 + 4 + 4 + 4; // ~60 bytes
const MAX_DELTA_SIZE = 8 + 8 + 4 + 3 + 1 + 1 + 4 + 4 + 4 + 4 + 4 + 4 + 4; // ~55 bytes

function encodeFrameMessage(msg: FrameMessage): ArrayBuffer {
  const baselines = msg.entityBaselines ?? [];
  const deltas = msg.entityDeltas ?? [];
  const exits = msg.entityExits ?? [];

  const maxSize =
    FRAME_HEADER_SIZE +
    baselines.length * MAX_BASELINE_SIZE +
    deltas.length * MAX_DELTA_SIZE +
    exits.length * 4;

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

  // Baselines
  if (baselineCount > 0) {
    const entityBaselines: EntitySnapshot[] = [];
    for (let i = 0; i < baselineCount; i++) {
      const [snap, newOff] = readBaseline(view, off);
      entityBaselines.push(snap);
      off = newOff;
    }
    msg.entityBaselines = entityBaselines;
  }

  // Deltas
  if (deltaCount > 0) {
    const entityDeltas: EntityDelta[] = [];
    for (let i = 0; i < deltaCount; i++) {
      const [delta, newOff] = readDelta(view, off);
      entityDeltas.push(delta);
      off = newOff;
    }
    msg.entityDeltas = entityDeltas;
  }

  // Exits
  if (exitCount > 0) {
    const entityExits: number[] = [];
    for (let i = 0; i < exitCount; i++) {
      entityExits.push(view.getUint32(off, true));
      off += 4;
    }
    msg.entityExits = entityExits;
  }

  return msg;
}

// ---- EntitySnapshot baseline encoding ----

function writeBaseline(view: DataView, off: number, snap: EntitySnapshot): number {
  // id (u32)
  view.setUint32(off, snap.id, true);
  off += 4;

  // entityTypeIndex (u8)
  const typeIdx = ENTITY_TYPE_TO_INDEX.get(snap.type) ?? 0;
  view.setUint8(off, typeIdx);
  off += 1;

  // position (2x f32)
  view.setFloat32(off, snap.position.wx, true);
  off += 4;
  view.setFloat32(off, snap.position.wy, true);
  off += 4;

  // Build presence mask
  let mask = 0;
  if (snap.velocity !== null) mask |= 1 << BIT_VELOCITY;
  if (snap.spriteState !== null) mask |= 1 << BIT_SPRITE;
  if (snap.wanderAIState !== null) mask |= 1 << BIT_WANDER_AI;
  if (snap.flashHidden !== undefined) mask |= 1 << BIT_FLASH_HIDDEN;
  if (snap.noShadow !== undefined) mask |= 1 << BIT_NO_SHADOW;
  if (snap.deathTimer !== undefined) mask |= 1 << BIT_DEATH_TIMER;
  if (snap.jumpZ !== undefined) mask |= 1 << BIT_JUMP_Z;
  if (snap.jumpVZ !== undefined) mask |= 1 << BIT_JUMP_VZ;
  if (snap.wz !== undefined) mask |= 1 << BIT_WZ;
  if (snap.parentId !== undefined) mask |= 1 << BIT_PARENT_ID;
  if (snap.localOffsetX !== undefined) mask |= 1 << BIT_LOCAL_OFFSET_X;
  if (snap.localOffsetY !== undefined) mask |= 1 << BIT_LOCAL_OFFSET_Y;
  view.setUint16(off, mask, true);
  off += 2;

  // Conditional fields
  if (mask & (1 << BIT_VELOCITY)) {
    view.setFloat32(off, snap.velocity!.vx, true);
    off += 4;
    view.setFloat32(off, snap.velocity!.vy, true);
    off += 4;
  }
  if (mask & (1 << BIT_SPRITE)) {
    off = writeSpriteState(view, off, snap.spriteState!);
  }
  if (mask & (1 << BIT_WANDER_AI)) {
    off = writeWanderAIState(view, off, snap.wanderAIState!);
  }
  if (mask & (1 << BIT_FLASH_HIDDEN)) {
    view.setUint8(off, snap.flashHidden! ? 1 : 0);
    off += 1;
  }
  if (mask & (1 << BIT_NO_SHADOW)) {
    view.setUint8(off, snap.noShadow! ? 1 : 0);
    off += 1;
  }
  if (mask & (1 << BIT_DEATH_TIMER)) {
    view.setFloat32(off, snap.deathTimer!, true);
    off += 4;
  }
  if (mask & (1 << BIT_JUMP_Z)) {
    view.setFloat32(off, snap.jumpZ!, true);
    off += 4;
  }
  if (mask & (1 << BIT_JUMP_VZ)) {
    view.setFloat32(off, snap.jumpVZ!, true);
    off += 4;
  }
  if (mask & (1 << BIT_WZ)) {
    view.setFloat32(off, snap.wz!, true);
    off += 4;
  }
  if (mask & (1 << BIT_PARENT_ID)) {
    view.setUint32(off, snap.parentId!, true);
    off += 4;
  }
  if (mask & (1 << BIT_LOCAL_OFFSET_X)) {
    view.setFloat32(off, snap.localOffsetX!, true);
    off += 4;
  }
  if (mask & (1 << BIT_LOCAL_OFFSET_Y)) {
    view.setFloat32(off, snap.localOffsetY!, true);
    off += 4;
  }

  return off;
}

function readBaseline(view: DataView, off: number): [EntitySnapshot, number] {
  const id = view.getUint32(off, true);
  off += 4;

  const typeIdx = view.getUint8(off);
  off += 1;
  const type = indexToEntityType(typeIdx) ?? "unknown";

  const wx = view.getFloat32(off, true);
  off += 4;
  const wy = view.getFloat32(off, true);
  off += 4;

  const mask = view.getUint16(off, true);
  off += 2;

  let velocity: { vx: number; vy: number } | null = null;
  let spriteState: SpriteState | null = null;
  let wanderAIState: WanderAIState | null = null;

  if (mask & (1 << BIT_VELOCITY)) {
    const vx = view.getFloat32(off, true);
    off += 4;
    const vy = view.getFloat32(off, true);
    off += 4;
    velocity = { vx, vy };
  }
  if (mask & (1 << BIT_SPRITE)) {
    const [ss, newOff] = readSpriteState(view, off);
    spriteState = ss;
    off = newOff;
  }
  if (mask & (1 << BIT_WANDER_AI)) {
    const [ws, newOff] = readWanderAIState(view, off);
    wanderAIState = ws;
    off = newOff;
  }

  const snap: EntitySnapshot = {
    id,
    type,
    position: { wx, wy },
    velocity,
    spriteState,
    wanderAIState,
  };

  if (mask & (1 << BIT_FLASH_HIDDEN)) {
    snap.flashHidden = view.getUint8(off) !== 0;
    off += 1;
  }
  if (mask & (1 << BIT_NO_SHADOW)) {
    snap.noShadow = view.getUint8(off) !== 0;
    off += 1;
  }
  if (mask & (1 << BIT_DEATH_TIMER)) {
    snap.deathTimer = view.getFloat32(off, true);
    off += 4;
  }
  if (mask & (1 << BIT_JUMP_Z)) {
    snap.jumpZ = view.getFloat32(off, true);
    off += 4;
  }
  if (mask & (1 << BIT_JUMP_VZ)) {
    snap.jumpVZ = view.getFloat32(off, true);
    off += 4;
  }
  if (mask & (1 << BIT_WZ)) {
    snap.wz = view.getFloat32(off, true);
    off += 4;
  }
  if (mask & (1 << BIT_PARENT_ID)) {
    snap.parentId = view.getUint32(off, true);
    off += 4;
  }
  if (mask & (1 << BIT_LOCAL_OFFSET_X)) {
    snap.localOffsetX = view.getFloat32(off, true);
    off += 4;
  }
  if (mask & (1 << BIT_LOCAL_OFFSET_Y)) {
    snap.localOffsetY = view.getFloat32(off, true);
    off += 4;
  }

  return [snap, off];
}

// ---- EntityDelta encoding ----

function writeDelta(view: DataView, off: number, delta: EntityDelta): number {
  // id (u32)
  view.setUint32(off, delta.id, true);
  off += 4;

  // Build changeMask and nullMask
  let changeMask = 0;
  let nullMask = 0;

  if (delta.position !== undefined) changeMask |= 1 << BIT_VELOCITY; // wait no, position is bit 0 in baseline but...

  // Delta doesn't have 'type' so the bitmask maps differently than baseline.
  // Actually let me reconsider: for deltas, bit 0 = position (not velocity).
  // Baseline has position as a required field, so it doesn't need a bit.
  // But for deltas, position is optional. So the bitmask layout MUST differ.
  //
  // Let me use the SAME bitmask bit assignments, but add a bit for position:
  // Actually the plan says same bitmask. Let me re-read...
  // Plan says: "Same bitmask layout as EntitySnapshot (bits 0-11)"
  // But EntitySnapshot uses bits 0-11 where bit 0 = velocity.
  // In baseline, position is ALWAYS present (no bit needed).
  // In delta, position is optional and needs a bit.
  //
  // Solution: use a DIFFERENT bit assignment for deltas that includes position at bit 0.
  // delta bit 0 = position
  // delta bits 1-12 = same as baseline bits 0-11

  // I'll define delta-specific bit offsets.
  changeMask = 0;
  nullMask = 0;

  if (delta.position !== undefined) changeMask |= 1 << 0;
  if (delta.velocity !== undefined) {
    changeMask |= 1 << 1;
    if (delta.velocity === null) nullMask |= 1 << 1;
  }
  if (delta.spriteState !== undefined) {
    changeMask |= 1 << 2;
    if (delta.spriteState === null) nullMask |= 1 << 2;
  }
  if (delta.wanderAIState !== undefined) {
    changeMask |= 1 << 3;
    if (delta.wanderAIState === null) nullMask |= 1 << 3;
  }
  if (delta.flashHidden !== undefined) {
    changeMask |= 1 << 4;
    if (delta.flashHidden === null) nullMask |= 1 << 4;
  }
  if (delta.noShadow !== undefined) {
    changeMask |= 1 << 5;
    if (delta.noShadow === null) nullMask |= 1 << 5;
  }
  if (delta.deathTimer !== undefined) {
    changeMask |= 1 << 6;
    if (delta.deathTimer === null) nullMask |= 1 << 6;
  }
  if (delta.jumpZ !== undefined) {
    changeMask |= 1 << 7;
    if (delta.jumpZ === null) nullMask |= 1 << 7;
  }
  if (delta.jumpVZ !== undefined) {
    changeMask |= 1 << 8;
    if (delta.jumpVZ === null) nullMask |= 1 << 8;
  }
  if (delta.wz !== undefined) {
    changeMask |= 1 << 9;
    if (delta.wz === null) nullMask |= 1 << 9;
  }
  if (delta.parentId !== undefined) {
    changeMask |= 1 << 10;
    if (delta.parentId === null) nullMask |= 1 << 10;
  }
  if (delta.localOffsetX !== undefined) {
    changeMask |= 1 << 11;
    if (delta.localOffsetX === null) nullMask |= 1 << 11;
  }
  if (delta.localOffsetY !== undefined) {
    changeMask |= 1 << 12;
    if (delta.localOffsetY === null) nullMask |= 1 << 12;
  }

  view.setUint16(off, changeMask, true);
  off += 2;
  view.setUint16(off, nullMask, true);
  off += 2;

  // Write values for changed, non-null fields
  if (changeMask & (1 << 0)) {
    view.setFloat32(off, delta.position!.wx, true);
    off += 4;
    view.setFloat32(off, delta.position!.wy, true);
    off += 4;
  }
  if (changeMask & (1 << 1) && !(nullMask & (1 << 1))) {
    view.setFloat32(off, delta.velocity!.vx, true);
    off += 4;
    view.setFloat32(off, delta.velocity!.vy, true);
    off += 4;
  }
  if (changeMask & (1 << 2) && !(nullMask & (1 << 2))) {
    off = writeSpriteState(view, off, delta.spriteState!);
  }
  if (changeMask & (1 << 3) && !(nullMask & (1 << 3))) {
    off = writeWanderAIState(view, off, delta.wanderAIState!);
  }
  if (changeMask & (1 << 4) && !(nullMask & (1 << 4))) {
    view.setUint8(off, delta.flashHidden! ? 1 : 0);
    off += 1;
  }
  if (changeMask & (1 << 5) && !(nullMask & (1 << 5))) {
    view.setUint8(off, delta.noShadow! ? 1 : 0);
    off += 1;
  }
  if (changeMask & (1 << 6) && !(nullMask & (1 << 6))) {
    view.setFloat32(off, delta.deathTimer as number, true);
    off += 4;
  }
  if (changeMask & (1 << 7) && !(nullMask & (1 << 7))) {
    view.setFloat32(off, delta.jumpZ as number, true);
    off += 4;
  }
  if (changeMask & (1 << 8) && !(nullMask & (1 << 8))) {
    view.setFloat32(off, delta.jumpVZ as number, true);
    off += 4;
  }
  if (changeMask & (1 << 9) && !(nullMask & (1 << 9))) {
    view.setFloat32(off, delta.wz as number, true);
    off += 4;
  }
  if (changeMask & (1 << 10) && !(nullMask & (1 << 10))) {
    view.setUint32(off, delta.parentId as number, true);
    off += 4;
  }
  if (changeMask & (1 << 11) && !(nullMask & (1 << 11))) {
    view.setFloat32(off, delta.localOffsetX as number, true);
    off += 4;
  }
  if (changeMask & (1 << 12) && !(nullMask & (1 << 12))) {
    view.setFloat32(off, delta.localOffsetY as number, true);
    off += 4;
  }

  return off;
}

function readDelta(view: DataView, off: number): [EntityDelta, number] {
  const id = view.getUint32(off, true);
  off += 4;
  const changeMask = view.getUint16(off, true);
  off += 2;
  const nullMask = view.getUint16(off, true);
  off += 2;

  const delta: EntityDelta = { id };

  // position (bit 0)
  if (changeMask & (1 << 0)) {
    const wx = view.getFloat32(off, true);
    off += 4;
    const wy = view.getFloat32(off, true);
    off += 4;
    delta.position = { wx, wy };
  }

  // velocity (bit 1)
  if (changeMask & (1 << 1)) {
    if (nullMask & (1 << 1)) {
      delta.velocity = null;
    } else {
      const vx = view.getFloat32(off, true);
      off += 4;
      const vy = view.getFloat32(off, true);
      off += 4;
      delta.velocity = { vx, vy };
    }
  }

  // spriteState (bit 2)
  if (changeMask & (1 << 2)) {
    if (nullMask & (1 << 2)) {
      delta.spriteState = null;
    } else {
      const [ss, newOff] = readSpriteState(view, off);
      delta.spriteState = ss;
      off = newOff;
    }
  }

  // wanderAIState (bit 3)
  if (changeMask & (1 << 3)) {
    if (nullMask & (1 << 3)) {
      delta.wanderAIState = null;
    } else {
      const [ws, newOff] = readWanderAIState(view, off);
      delta.wanderAIState = ws;
      off = newOff;
    }
  }

  // flashHidden (bit 4)
  if (changeMask & (1 << 4)) {
    if (nullMask & (1 << 4)) {
      delta.flashHidden = null;
    } else {
      delta.flashHidden = view.getUint8(off) !== 0;
      off += 1;
    }
  }

  // noShadow (bit 5)
  if (changeMask & (1 << 5)) {
    if (nullMask & (1 << 5)) {
      delta.noShadow = null;
    } else {
      delta.noShadow = view.getUint8(off) !== 0;
      off += 1;
    }
  }

  // deathTimer (bit 6)
  if (changeMask & (1 << 6)) {
    if (nullMask & (1 << 6)) {
      delta.deathTimer = null;
    } else {
      delta.deathTimer = view.getFloat32(off, true);
      off += 4;
    }
  }

  // jumpZ (bit 7)
  if (changeMask & (1 << 7)) {
    if (nullMask & (1 << 7)) {
      delta.jumpZ = null;
    } else {
      delta.jumpZ = view.getFloat32(off, true);
      off += 4;
    }
  }

  // jumpVZ (bit 8)
  if (changeMask & (1 << 8)) {
    if (nullMask & (1 << 8)) {
      delta.jumpVZ = null;
    } else {
      delta.jumpVZ = view.getFloat32(off, true);
      off += 4;
    }
  }

  // wz (bit 9)
  if (changeMask & (1 << 9)) {
    if (nullMask & (1 << 9)) {
      delta.wz = null;
    } else {
      delta.wz = view.getFloat32(off, true);
      off += 4;
    }
  }

  // parentId (bit 10)
  if (changeMask & (1 << 10)) {
    if (nullMask & (1 << 10)) {
      delta.parentId = null;
    } else {
      delta.parentId = view.getUint32(off, true);
      off += 4;
    }
  }

  // localOffsetX (bit 11)
  if (changeMask & (1 << 11)) {
    if (nullMask & (1 << 11)) {
      delta.localOffsetX = null;
    } else {
      delta.localOffsetX = view.getFloat32(off, true);
      off += 4;
    }
  }

  // localOffsetY (bit 12)
  if (changeMask & (1 << 12)) {
    if (nullMask & (1 << 12)) {
      delta.localOffsetY = null;
    } else {
      delta.localOffsetY = view.getFloat32(off, true);
      off += 4;
    }
  }

  return [delta, off];
}

// ---- SpriteState encoding ----
// Byte 0: direction (bits 0-1) | moving (bit 2) | flipX (bit 3) | hasFrameDuration (bit 4)
// Byte 1: frameRow (u8)
// Optional bytes 2-3: frameDuration (u16, only if hasFrameDuration)

function writeSpriteState(view: DataView, off: number, ss: SpriteState): number {
  let flags = (ss.direction as number) & 0x03;
  if (ss.moving) flags |= 0x04;
  if (ss.flipX) flags |= 0x08;
  const hasFrameDuration = ss.frameDuration !== undefined;
  if (hasFrameDuration) flags |= 0x10;

  view.setUint8(off, flags);
  off += 1;
  view.setUint8(off, ss.frameRow);
  off += 1;
  if (hasFrameDuration) {
    view.setUint16(off, ss.frameDuration!, true);
    off += 2;
  }
  return off;
}

function readSpriteState(view: DataView, off: number): [SpriteState, number] {
  const flags = view.getUint8(off);
  off += 1;
  const frameRow = view.getUint8(off);
  off += 1;

  const ss: SpriteState = {
    direction: (flags & 0x03) as SpriteState["direction"],
    moving: (flags & 0x04) !== 0,
    frameRow,
  };
  if (flags & 0x08) ss.flipX = true;
  if (flags & 0x10) {
    ss.frameDuration = view.getUint16(off, true);
    off += 2;
  }
  return [ss, off];
}

// ---- WanderAIState encoding ----
// Byte 0: aiStateIndex (bits 0-2) | following (bit 7)
// Byte 1: dirX (i8)
// Byte 2: dirY (i8)

function writeWanderAIState(view: DataView, off: number, ws: WanderAIState): number {
  let flags = AI_STATE_TO_INDEX[ws.state] ?? 0;
  if (ws.following) flags |= 0x80;

  view.setUint8(off, flags);
  off += 1;
  view.setInt8(off, ws.dirX);
  off += 1;
  view.setInt8(off, ws.dirY);
  off += 1;
  return off;
}

function readWanderAIState(view: DataView, off: number): [WanderAIState, number] {
  const flags = view.getUint8(off);
  off += 1;
  const dirX = view.getInt8(off);
  off += 1;
  const dirY = view.getInt8(off);
  off += 1;

  const ws: WanderAIState = {
    state: AI_STATES[flags & 0x07] ?? "idle",
    dirX,
    dirY,
  };
  if (flags & 0x80) ws.following = true;
  return [ws, off];
}

// ---- player-input encoding ----

function encodePlayerInput(msg: Extract<ClientMessage, { type: "player-input" }>): ArrayBuffer {
  const buf = new ArrayBuffer(14);
  const view = new DataView(buf);
  view.setUint8(0, TAG_PLAYER_INPUT);
  view.setUint32(1, msg.seq, true);
  view.setFloat32(5, msg.dx, true);
  view.setFloat32(9, msg.dy, true);
  let flags = 0;
  if (msg.sprinting) flags |= 0x01;
  if (msg.jump) flags |= 0x02;
  view.setUint8(13, flags);
  return buf;
}

function decodePlayerInput(view: DataView): ClientMessage {
  const seq = view.getUint32(1, true);
  const dx = view.getFloat32(5, true);
  const dy = view.getFloat32(9, true);
  const flags = view.getUint8(13);
  return {
    type: "player-input",
    seq,
    dx,
    dy,
    sprinting: (flags & 0x01) !== 0,
    jump: (flags & 0x02) !== 0,
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

  // Header: 1 tag + 1 flags + 2 keyCount + keyCount*4 + 2 updateCount + updateCount*CHUNK_BINARY_SIZE
  const size = 1 + 1 + 2 + keyCount * 4 + 2 + updateCount * CHUNK_BINARY_SIZE;
  const buf = new ArrayBuffer(size);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  let off = 0;

  view.setUint8(off, TAG_SYNC_CHUNKS);
  off += 1;

  let flags = 0;
  if (keys) flags |= 0x01;
  if (updates) flags |= 0x02;
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
    for (const chunk of updates) {
      off = writeChunkSnapshot(view, bytes, off, chunk);
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

// ---- Exports for testing ----

export { ENTITY_TYPE_LIST, ENTITY_TYPE_TO_INDEX };
