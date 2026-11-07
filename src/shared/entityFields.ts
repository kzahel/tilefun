/**
 * Replicated entity fields — the single declaration that drives entity
 * baseline/delta encoding, delta diffing and the entity ↔ snapshot mirror.
 *
 * Adding a replicated field: declare it on `Entity` and `EntitySnapshot`, then
 * add one `ENTITY_FIELDS` entry with the next free `bit`. The compiler rejects
 * a snapshot field without an entry, and an optional (mirrored) field that
 * `Entity` lacks or types differently. Optional fields copy between entity and
 * snapshot generically; `core` fields (always present, `null` when absent)
 * keep hand-written entity mappings in serialization and `applyEntityDelta`.
 *
 * Wire layout (all little-endian), fields in ascending `bit` order:
 *   baseline: id u32 · type u16 · wx f32 · wy f32 · presence u32 · present values
 *   delta:    id u32 · change u32 · null u32 · [wx f32 · wy f32] · changed non-null values
 * Baseline presence uses `bit`; delta masks use `bit + 1` because delta bit 0
 * is the always-non-null position.
 */

import type { Entity } from "../entities/Entity.js";
import type { SpriteState, WanderAIState } from "../entities/EntityDefs.js";
import { rotationsEqual } from "../physics/BodyRotation.js";
import {
  BOOL8,
  F32,
  PAINT,
  ROTATION,
  SPRITE,
  U8,
  U32,
  VELOCITY,
  WANDER_AI,
  type WireCursor,
  type WireKind,
} from "./entityWire.js";
import type { EntitySnapshot } from "./protocol.js";

type FieldKey = Exclude<keyof EntitySnapshot, "id" | "type" | "position">;
type FieldValue<K extends FieldKey> = NonNullable<EntitySnapshot[K]>;
/** Snapshot fields that are optional and mirror an `Entity` property 1:1. */
type MirroredKey = {
  [K in FieldKey]-?: undefined extends EntitySnapshot[K] ? K : never;
}[FieldKey];

/**
 * Partial entity update (JSON Merge Patch, RFC 7396): an absent field is
 * unchanged, a value replaces it and `null` removes it.
 */
export type EntityDelta = {
  id: number;
  position?: { wx: number; wy: number };
} & { [K in FieldKey]?: FieldValue<K> | null };

type EntityField<K extends FieldKey> = {
  readonly key: K;
  /** Baseline presence bit; the delta change/null bit is `bit + 1`. Defines wire order. */
  readonly bit: number;
  readonly wire: WireKind<FieldValue<K>>;
  /** Delta/reuse equality; defaults to `===`. */
  equal?(a: EntitySnapshot[K], b: EntitySnapshot[K]): boolean;
  /** Copy applied when a value moves between an entity and a snapshot. */
  clone?(value: FieldValue<K>): FieldValue<K>;
} & (K extends MirroredKey
  ? { readonly core?: never }
  : {
      /** Always-present nullable snapshot field with a hand-written entity mapping. */
      readonly core: true;
    });

const ENTITY_FIELDS: { readonly [K in FieldKey]: EntityField<K> } = {
  velocity: { key: "velocity", bit: 0, wire: VELOCITY, equal: velocitiesEqual, core: true },
  spriteState: { key: "spriteState", bit: 1, wire: SPRITE, equal: spriteStatesEqual, core: true },
  wanderAIState: {
    key: "wanderAIState",
    bit: 2,
    wire: WANDER_AI,
    equal: wanderAIStatesEqual,
    core: true,
  },
  flashHidden: { key: "flashHidden", bit: 3, wire: BOOL8 },
  noShadow: { key: "noShadow", bit: 4, wire: BOOL8 },
  deathTimer: { key: "deathTimer", bit: 5, wire: F32 },
  jumpZ: { key: "jumpZ", bit: 6, wire: F32 },
  jumpVZ: { key: "jumpVZ", bit: 7, wire: F32 },
  wz: { key: "wz", bit: 8, wire: F32 },
  parentId: { key: "parentId", bit: 9, wire: U32 },
  localOffsetX: { key: "localOffsetX", bit: 10, wire: F32 },
  localOffsetY: { key: "localOffsetY", bit: 11, wire: F32 },
  jumpInputState: { key: "jumpInputState", bit: 12, wire: F32 },
  emergencyState: { key: "emergencyState", bit: 13, wire: U8 },
  vehicleHeading: { key: "vehicleHeading", bit: 14, wire: F32 },
  paintSchemeId: { key: "paintSchemeId", bit: 15, wire: PAINT },
  bodyRotation: {
    key: "bodyRotation",
    bit: 16,
    wire: ROTATION,
    equal: rotationsEqual,
    clone: (q) => [...q],
  },
  physicsGroupId: { key: "physicsGroupId", bit: 17, wire: U32 },
  vehicleBedTilt: { key: "vehicleBedTilt", bit: 18, wire: F32 },
  vehicleBedTarget: { key: "vehicleBedTarget", bit: 19, wire: F32 },
  towTargetId: { key: "towTargetId", bit: 20, wire: U32 },
  towedBy: { key: "towedBy", bit: 21, wire: U32 },
  vehicleRamp: { key: "vehicleRamp", bit: 22, wire: U8 },
  transportLoadId: { key: "transportLoadId", bit: 23, wire: U32 },
  transportedBy: { key: "transportedBy", bit: 24, wire: U32 },
};

/** Every replicated field in wire order (index === `bit`). */
const WIRE_ORDER: readonly EntityField<FieldKey>[] = Object.values<EntityField<FieldKey>>(
  ENTITY_FIELDS,
).sort((a, b) => a.bit - b.bit);
for (const [i, field] of WIRE_ORDER.entries())
  if (field.bit !== i) throw new Error(`Entity field bits must be contiguous: ${field.key}`);
// Delta masks are u32 with position at bit 0.
if (WIRE_ORDER.length > 31) throw new Error("Entity fields exceed the u32 delta mask");

/** Baseline mask bits that name a field; unknown bits are ignored on read. */
const FIELD_BITS = 2 ** WIRE_ORDER.length - 1;

/** Upper bound on the presence mask plus every field value of one baseline. */
export const MAX_BASELINE_FIELD_BYTES = 4 + maxFieldBytes();
/** Upper bound on both masks, position and every field value of one delta. */
export const MAX_DELTA_FIELD_BYTES = 8 + 8 + maxFieldBytes();
function maxFieldBytes(): number {
  return WIRE_ORDER.reduce((sum, field) => sum + field.wire.maxBytes, 0);
}

const MIRRORED_FIELDS = WIRE_ORDER.filter((f): f is EntityField<MirroredKey> => !f.core);

// ---- Wire encoding ----

/** Writes the presence mask and present field values of a baseline. */
export function writeBaselineFields(view: DataView, off: number, snap: EntitySnapshot): number {
  const maskOff = off;
  off += 4;
  let mask = 0;
  let bit = 1;
  for (const field of WIRE_ORDER) {
    const value = snap[field.key];
    if (value !== undefined && value !== null) {
      mask |= bit;
      off = field.wire.write(view, off, value);
    }
    bit <<= 1;
  }
  view.setUint32(maskOff, mask, true);
  return off;
}

/** Reads baseline fields into `snap`; nullable core fields stay `null` when absent. */
export function readBaselineFields(cursor: WireCursor, snap: EntitySnapshot): void {
  const mask = cursor.view.getUint32(cursor.off, true);
  cursor.off += 4;
  // Visit set bits only, lowest (earliest on the wire) first.
  for (let bits = mask & FIELD_BITS; bits !== 0; bits &= bits - 1)
    setField(snap, fieldAt(31 - Math.clz32(bits & -bits)), cursor);
}

/** Writes delta masks, optional position and changed non-null values after the id. */
export function writeDeltaFields(view: DataView, off: number, delta: EntityDelta): number {
  const maskOff = off;
  off += 8;
  let changeMask = 0;
  let nullMask = 0;
  if (delta.position !== undefined) {
    changeMask = 1;
    view.setFloat32(off, delta.position.wx, true);
    view.setFloat32(off + 4, delta.position.wy, true);
    off += 8;
  }
  let bit = 2;
  for (const field of WIRE_ORDER) {
    const value = delta[field.key];
    if (value !== undefined) {
      changeMask |= bit;
      if (value === null) nullMask |= bit;
      else off = field.wire.write(view, off, value);
    }
    bit <<= 1;
  }
  view.setUint32(maskOff, changeMask, true);
  view.setUint32(maskOff + 4, nullMask, true);
  return off;
}

/** Reads delta masks, position and changed fields (after the id) into `delta`. */
export function readDeltaFields(cursor: WireCursor, delta: EntityDelta): void {
  const { view } = cursor;
  const changeMask = view.getUint32(cursor.off, true);
  const nullMask = view.getUint32(cursor.off + 4, true);
  cursor.off += 8;
  if (changeMask & 1) {
    const wx = view.getFloat32(cursor.off, true);
    const wy = view.getFloat32(cursor.off + 4, true);
    cursor.off += 8;
    delta.position = { wx, wy };
  }
  // Visit changed field bits only (position is bit 0), lowest first.
  for (let bits = changeMask & (FIELD_BITS << 1); bits !== 0; bits &= bits - 1) {
    const bit = bits & -bits;
    const field = fieldAt(30 - Math.clz32(bit));
    if (nullMask & bit) delta[field.key] = null;
    else setField(delta, field, cursor);
  }
}

function fieldAt(index: number): EntityField<FieldKey> {
  const field = WIRE_ORDER[index];
  if (!field) throw new Error(`Unknown entity field bit ${index}`);
  return field;
}

function setField<K extends FieldKey>(
  target: { [P in K]?: EntitySnapshot[P] | null },
  field: EntityField<K>,
  cursor: WireCursor,
): void {
  target[field.key] = field.wire.read(cursor);
}

// ---- Delta diff ----

/** Adds every changed field to `delta` (created on first change) and returns it. */
export function diffFields(
  prev: EntitySnapshot,
  curr: EntitySnapshot,
  delta: EntityDelta | null,
): EntityDelta | null {
  for (const field of WIRE_ORDER) {
    const before = prev[field.key];
    const after = curr[field.key];
    if (before === after || field.equal?.(before, after)) continue;
    delta ??= { id: curr.id };
    setChanged(delta, field, after);
  }
  return delta;
}

function setChanged<K extends FieldKey>(
  delta: EntityDelta,
  field: EntityField<K>,
  value: EntitySnapshot[K],
): void {
  delta[field.key] = value ?? null;
}

// ---- Entity ↔ snapshot mirror (optional fields only) ----

type SnapshotMirror = { [K in MirroredKey]?: FieldValue<K> };
type EntityMirror = Pick<Entity, MirroredKey>;
/** Both sides of the mirror; `never` (a compile error at every caller) if `Entity` lacks a mirrored field or types it differently. */
type Mirror = [EntityMirror, SnapshotMirror] extends [SnapshotMirror, EntityMirror]
  ? SnapshotMirror
  : never;

/** Copies present optional fields from `source` to `target`. */
export function copyMirroredFields(target: Mirror, source: Mirror): void {
  for (const field of MIRRORED_FIELDS) copyField(target, source, field);
}

function copyField<K extends MirroredKey>(target: Mirror, source: Mirror, field: EntityField<K>) {
  const value = source[field.key];
  if (value !== undefined) target[field.key] = field.clone ? field.clone(value) : value;
}

/** Whether every optional field of `entity` matches the snapshot. */
export function mirroredFieldsMatch(entity: Mirror, snap: Mirror): boolean {
  for (const field of MIRRORED_FIELDS) {
    const a = entity[field.key];
    const b = snap[field.key];
    if (a !== b && !field.equal?.(a, b)) return false;
  }
  return true;
}

/** Applies changed optional delta fields to `entity`: `null` deletes, a value sets. */
export function applyMirroredFields(entity: Mirror, delta: EntityDelta): void {
  for (const field of MIRRORED_FIELDS) applyField(entity, delta, field);
}

function applyField<K extends MirroredKey>(
  entity: Mirror,
  delta: { readonly [P in K]?: FieldValue<P> | null },
  field: EntityField<K>,
) {
  const value = delta[field.key];
  if (value === undefined) return;
  if (value === null) delete entity[field.key];
  else entity[field.key] = field.clone ? field.clone(value) : value;
}

// ---- Core field equality ----

function velocitiesEqual(a: EntitySnapshot["velocity"], b: EntitySnapshot["velocity"]): boolean {
  if (a === null || b === null) return a === b;
  return a.vx === b.vx && a.vy === b.vy;
}

function spriteStatesEqual(a: SpriteState | null, b: SpriteState | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.direction === b.direction &&
    a.moving === b.moving &&
    a.frameRow === b.frameRow &&
    a.flipX === b.flipX &&
    a.frameDuration === b.frameDuration &&
    a.clip === b.clip &&
    a.clipElapsedMs === b.clipElapsedMs &&
    a.model === b.model
  );
}

function wanderAIStatesEqual(a: WanderAIState | null, b: WanderAIState | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.state === b.state &&
    a.dirX === b.dirX &&
    a.dirY === b.dirY &&
    a.following === b.following &&
    a.befriendable === b.befriendable
  );
}
