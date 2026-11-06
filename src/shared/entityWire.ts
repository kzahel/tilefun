/**
 * Wire kinds for replicated entity fields. Each kind writes one present value
 * at an offset and reads it back through a shared cursor. Encodings here are
 * part of the protocol: changing one changes the entity frame wire format.
 */

import { PLAYER_MODELS } from "../characters/PlayerModels.js";
import type { SpriteState, WanderAIState } from "../entities/EntityDefs.js";
import type { BodyRotation } from "../physics/BodyRotation.js";
import { paintFromWire, paintWireIndex } from "../traffic/VehiclePaint.js";

/** Mutable read position shared by every field decoded from one frame. */
export interface WireCursor {
  readonly view: DataView;
  off: number;
}

/** Little-endian encoding of one present (non-null) field value. */
export interface WireKind<T> {
  /** Upper bound on encoded bytes, used to size frame buffers. */
  readonly maxBytes: number;
  write(view: DataView, off: number, value: T): number;
  read(cursor: WireCursor): T;
}

export const BOOL8: WireKind<boolean> = {
  maxBytes: 1,
  write(view, off, value) {
    view.setUint8(off, value ? 1 : 0);
    return off + 1;
  },
  read(c) {
    return c.view.getUint8(c.off++) !== 0;
  },
};

export const U8: WireKind<number> = {
  maxBytes: 1,
  write(view, off, value) {
    view.setUint8(off, value);
    return off + 1;
  },
  read(c) {
    return c.view.getUint8(c.off++);
  },
};

export const U32: WireKind<number> = {
  maxBytes: 4,
  write(view, off, value) {
    view.setUint32(off, value, true);
    return off + 4;
  },
  read(c) {
    const value = c.view.getUint32(c.off, true);
    c.off += 4;
    return value;
  },
};

export const F32: WireKind<number> = {
  maxBytes: 4,
  write(view, off, value) {
    view.setFloat32(off, value, true);
    return off + 4;
  },
  read(c) {
    const value = c.view.getFloat32(c.off, true);
    c.off += 4;
    return value;
  },
};

/** Vehicle paint scheme id as its u8 index in `VEHICLE_PAINT_IDS`. */
export const PAINT: WireKind<string> = {
  maxBytes: 1,
  write(view, off, value) {
    view.setUint8(off, paintWireIndex(value));
    return off + 1;
  },
  read(c) {
    return paintFromWire(c.view.getUint8(c.off++));
  },
};

/** Two f32 components, vx then vy. */
export const VELOCITY: WireKind<{ vx: number; vy: number }> = {
  maxBytes: 8,
  write(view, off, value) {
    view.setFloat32(off, value.vx, true);
    view.setFloat32(off + 4, value.vy, true);
    return off + 8;
  },
  read(c) {
    const vx = c.view.getFloat32(c.off, true);
    const vy = c.view.getFloat32(c.off + 4, true);
    c.off += 8;
    return { vx, vy };
  },
};

/** Four f32 quaternion components in stored order. */
export const ROTATION: WireKind<BodyRotation> = {
  maxBytes: 16,
  write(view, off, value) {
    for (const component of value) {
      view.setFloat32(off, component, true);
      off += 4;
    }
    return off;
  },
  read(c) {
    const { view, off } = c;
    c.off += 16;
    return [
      view.getFloat32(off, true),
      view.getFloat32(off + 4, true),
      view.getFloat32(off + 8, true),
      view.getFloat32(off + 12, true),
    ];
  },
};

// ---- SpriteState ----
// Byte 0: direction (bits 0-1) | moving (bit 2) | flipX (bit 3) | hasFrameDuration (bit 4)
// Byte 1: frameRow (u8)
// Optional bytes 2-3: frameDuration (u16, only if hasFrameDuration)
// Flag bit 5: model index (u8), following frameDuration when present.
// Flag bit 6: animation clip index (u8), following model when present.
// Flag bit 7: physically timed clip elapsed milliseconds (u16).

export const SPRITE: WireKind<SpriteState> = {
  maxBytes: 8,
  write(view, off, ss) {
    let flags = (ss.direction as number) & 0x03;
    if (ss.moving) flags |= 0x04;
    if (ss.flipX) flags |= 0x08;
    if (ss.frameDuration !== undefined) flags |= 0x10;
    if (ss.model !== undefined) flags |= 0x20;
    if (ss.clip !== undefined) flags |= 0x40;
    if (ss.clipElapsedMs !== undefined) flags |= 0x80;

    view.setUint8(off++, flags);
    view.setUint8(off++, ss.frameRow);
    if (ss.frameDuration !== undefined) {
      view.setUint16(off, ss.frameDuration, true);
      off += 2;
    }
    if (ss.model !== undefined) {
      const model = PLAYER_MODELS.findIndex((m) => m.id === ss.model);
      if (model < 0) throw new Error("Unknown player model");
      view.setUint8(off++, model);
    }
    if (ss.clip !== undefined) view.setUint8(off++, ss.clip);
    if (ss.clipElapsedMs !== undefined) {
      view.setUint16(off, ss.clipElapsedMs, true);
      off += 2;
    }
    return off;
  },
  read(c) {
    const view = c.view;
    const flags = view.getUint8(c.off++);
    const ss: SpriteState = {
      direction: (flags & 0x03) as SpriteState["direction"],
      moving: (flags & 0x04) !== 0,
      frameRow: view.getUint8(c.off++),
    };
    if (flags & 0x08) ss.flipX = true;
    if (flags & 0x10) {
      ss.frameDuration = view.getUint16(c.off, true);
      c.off += 2;
    }
    if (flags & 0x20) {
      const model = PLAYER_MODELS[view.getUint8(c.off++)];
      if (!model) throw new Error("Unknown player model");
      ss.model = model.id;
    }
    if (flags & 0x40) ss.clip = view.getUint8(c.off++);
    if (flags & 0x80) {
      ss.clipElapsedMs = view.getUint16(c.off, true);
      c.off += 2;
    }
    return ss;
  },
};

// ---- WanderAIState ----
// Byte 0: aiStateIndex (bits 0-2) | befriendable present/value (bits 5/6) | following (bit 7)
// Byte 1: dirX (i8)
// Byte 2: dirY (i8)

const AI_STATES = ["idle", "walking", "chasing", "following", "ridden", "scared"] as const;
const AI_STATE_TO_INDEX = new Map<string, number>(AI_STATES.map((state, i) => [state, i]));

export const WANDER_AI: WireKind<WanderAIState> = {
  maxBytes: 3,
  write(view, off, ws) {
    let flags = AI_STATE_TO_INDEX.get(ws.state) ?? 0;
    if (ws.following) flags |= 0x80;
    if (ws.befriendable !== undefined) flags |= 0x20 | (ws.befriendable ? 0x40 : 0);
    view.setUint8(off, flags);
    view.setInt8(off + 1, ws.dirX);
    view.setInt8(off + 2, ws.dirY);
    return off + 3;
  },
  read(c) {
    const { view, off } = c;
    const flags = view.getUint8(off);
    c.off += 3;
    const ws: WanderAIState = {
      state: AI_STATES[flags & 0x07] ?? "idle",
      dirX: view.getInt8(off + 1),
      dirY: view.getInt8(off + 2),
    };
    if (flags & 0x80) ws.following = true;
    if (flags & 0x20) ws.befriendable = (flags & 0x40) !== 0;
    return ws;
  },
};
