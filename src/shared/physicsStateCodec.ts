import { yawRotation } from "../physics/BodyRotation.js";
import {
  MAX_PREDICTION_BODIES,
  type PhysicsBodyKind,
  type PhysicsBodyState,
  type PhysicsState,
} from "../physics/PhysicsState.js";
import { excavatorActionFromId, excavatorActionId } from "./ExcavatorInput.js";

const KINDS: readonly PhysicsBodyKind[] = ["character", "vehicle", "loose", "fixed"];
const POSITIONS = ["x", "y", "z"] as const;
const PREVIOUS = ["prevX", "prevY", "prevZ"] as const;
const FIELDS = [
  "vx",
  "vy",
  "vz",
  "heading",
  "prevHeading",
  "groundZ",
  "desiredVx",
  "desiredVy",
  "normalX",
  "normalY",
  "normalZ",
  "altitude",
  "desiredHeading",
  "desiredDriveSpeed",
  "desiredSteering",
  "inheritedVx",
  "inheritedVy",
] as const;
const BODY_BYTES = 118;
const LEGACY_EXCAVATOR_BYTES = 8;
const EXCAVATOR_BYTES = 20;
const ROTATION_BYTES = 44; // Current and previous quaternions and angular velocity.
const VEHICLE_BYTES = 1 + ROTATION_BYTES + 8; // Flags, rotation and bed angles.
const JUMP_QUEUED = 1;
const LOOSE_ROTATION = 2;
const LOOSE_SLEEPING = 4;
const HEADER_BYTES = 16;
const CONTACT_BYTES = 8;
const MAX_CONTACTS = (MAX_PREDICTION_BODIES * (MAX_PREDICTION_BODIES - 1)) / 2;
const NONE = 0xffff_ffff;

export function physicsStateBytes(state?: PhysicsState): number {
  if (state && state.bodies.length > MAX_PREDICTION_BODIES)
    throw Error("Physics snapshot exceeds local body limit");
  if (state && state.contacts.length > MAX_CONTACTS)
    throw Error("Physics snapshot exceeds contact limit");
  return (
    1 +
    (state
      ? HEADER_BYTES +
        state.bodies.reduce(
          (bytes, b) =>
            bytes +
            BODY_BYTES +
            (b.kind === "vehicle"
              ? VEHICLE_BYTES +
                (b.excavatorPose === undefined ? 0 : EXCAVATOR_BYTES + (b.excavatorHeld ? 1 : 0))
              : b.kind === "loose" && b.rotation
                ? ROTATION_BYTES
                : 0),
          0,
        ) +
        state.contacts.length * CONTACT_BYTES
      : 0)
  );
}
function uint(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > NONE) throw Error("Invalid physics integer");
  return value;
}
const bedAngles = (body: PhysicsBodyState) => [body.bedTilt ?? 0, body.bedTarget ?? 0];
/** Optional numerical fields are absent when zero, as a level dump bed. */
function nonzero(values: Record<string, number>) {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== 0));
}
function finite(value: number) {
  if (!Number.isFinite(value)) throw Error("Non-finite physics state");
  return value;
}
function writeBodyRotation(view: DataView, offset: number, body: PhysicsBodyState) {
  for (const value of [
    ...(body.rotation ?? yawRotation(body.heading)),
    ...(body.prevRotation ?? body.rotation ?? yawRotation(body.prevHeading)),
    ...(body.angularVelocity ?? [0, 0, 0]),
  ]) {
    view.setFloat32(offset, finite(Math.fround(value)), true);
    offset += 4;
  }
  return offset;
}

function readBodyRotation(view: DataView, offset: number, body: PhysicsBodyState) {
  if (offset + ROTATION_BYTES > view.byteLength) throw Error("Invalid physics rotation length");
  const read = () => {
    const value = finite(view.getFloat32(offset, true));
    offset += 4;
    return value;
  };
  body.rotation = [read(), read(), read(), read()];
  body.prevRotation = [read(), read(), read(), read()];
  body.angularVelocity = [read(), read(), read()];
  return offset;
}

export function writePhysicsState(view: DataView, offset: number, state?: PhysicsState): number {
  physicsStateBytes(state);
  view.setUint8(offset++, state ? 1 : 0);
  if (!state) return offset;
  for (const value of [state.epoch, state.tick, state.omitted]) {
    view.setUint32(offset, uint(value), true);
    offset += 4;
  }
  view.setUint16(offset, state.bodies.length, true);
  offset += 2;
  view.setUint16(offset, state.contacts.length, true);
  offset += 2;
  const ids = new Set<number>();
  for (const body of state.bodies) {
    if (ids.has(body.id)) throw Error("Duplicate physics body");
    ids.add(body.id);
    view.setUint32(offset, uint(body.id), true);
    offset += 4;
    view.setUint32(offset, body.supportId === undefined ? NONE : uint(body.supportId), true);
    offset += 4;
    view.setUint32(offset, body.controlUntil === undefined ? NONE : uint(body.controlUntil), true);
    offset += 4;
    const kind = KINDS.indexOf(body.kind);
    if (kind < 0) throw Error("Invalid physics body kind");
    view.setUint8(
      offset++,
      kind |
        (body.jumpHeld ? 4 : 0) |
        (body.grounded ? 8 : 0) |
        (body.altitude === undefined ? 0 : 16) |
        (body.desiredHeading === undefined ? 0 : 32) |
        (body.desiredDriveSpeed === undefined ? 0 : 64) |
        (body.desiredSteering === undefined ? 0 : 128),
    );
    const looseRotates = body.kind === "loose" && body.rotation !== undefined;
    view.setUint8(
      offset++,
      (body.jumpQueued ? JUMP_QUEUED : 0) |
        (looseRotates ? LOOSE_ROTATION | (body.sleeping ? LOOSE_SLEEPING : 0) : 0),
    );
    for (const field of POSITIONS) {
      view.setFloat64(offset, finite(body[field]), true);
      offset += 8;
    }
    for (let axis = 0; axis < POSITIONS.length; axis++) {
      // A one-tick displacement retains precision at large world coordinates
      // without sending another three absolute float64 positions per body.
      const field = PREVIOUS[axis] as (typeof PREVIOUS)[number];
      const position = POSITIONS[axis] as (typeof POSITIONS)[number];
      view.setFloat32(offset, finite(Math.fround(body[field] - body[position])), true);
      offset += 4;
    }
    for (const field of FIELDS) {
      view.setFloat32(offset, finite(Math.fround(body[field] ?? 0)), true);
      offset += 4;
    }
    if (body.kind === "vehicle") {
      const hasExcavator = body.excavatorPose !== undefined;
      const held = hasExcavator && body.excavatorHeld;
      view.setUint8(offset++, (body.sleeping ? 1 : 0) | (hasExcavator ? 6 : 0) | (held ? 8 : 0));
      offset = writeBodyRotation(view, offset, body);
      for (const value of bedAngles(body)) {
        view.setFloat32(offset, finite(Math.fround(value)), true);
        offset += 4;
      }
      if (body.excavatorPose !== undefined) {
        view.setFloat64(offset, finite(body.excavatorPose), true);
        view.setFloat64(offset + 8, finite(body.excavatorTarget ?? -1), true);
        view.setFloat32(offset + 16, finite(body.excavatorRate ?? 0), true);
        offset += EXCAVATOR_BYTES;
        if (held) view.setUint8(offset++, excavatorActionId(held));
      }
    } else if (looseRotates) offset = writeBodyRotation(view, offset, body);
  }
  const pairs = new Set<string>();
  for (const [a, b] of state.contacts) {
    if (!ids.has(a) || !ids.has(b) || a >= b || pairs.has(`${a}:${b}`))
      throw Error("Invalid physics contact identity");
    pairs.add(`${a}:${b}`);
    view.setUint32(offset, uint(a), true);
    view.setUint32(offset + 4, uint(b), true);
    offset += CONTACT_BYTES;
  }
  return offset;
}
export function readPhysicsState(
  view: DataView,
  offset: number,
): [PhysicsState | undefined, number] {
  const present = view.getUint8(offset++);
  if (present === 0) return [undefined, offset];
  if (present !== 1) throw Error("Invalid physics snapshot presence");
  const epoch = view.getUint32(offset, true);
  offset += 4;
  const tick = view.getUint32(offset, true);
  offset += 4;
  const omitted = view.getUint32(offset, true);
  offset += 4;
  const count = view.getUint16(offset, true);
  offset += 2;
  const contactCount = view.getUint16(offset, true);
  offset += 2;
  if (
    count > MAX_PREDICTION_BODIES ||
    contactCount > MAX_CONTACTS ||
    offset + count * BODY_BYTES + contactCount * CONTACT_BYTES > view.byteLength
  )
    throw Error("Invalid physics snapshot body count/length");
  const bodies: PhysicsBodyState[] = [],
    ids = new Set<number>();
  for (let i = 0; i < count; i++) {
    const id = view.getUint32(offset, true);
    offset += 4;
    const supportId = view.getUint32(offset, true);
    offset += 4;
    const controlUntil = view.getUint32(offset, true);
    offset += 4;
    const flags = view.getUint8(offset++),
      kind = KINDS[flags & 3];
    if (!kind || ids.has(id)) throw Error("Invalid physics body flags/identity");
    ids.add(id);
    const body: PhysicsBodyState = {
      id,
      kind,
      jumpHeld: !!(flags & 4),
      grounded: !!(flags & 8),
      x: 0,
      y: 0,
      z: 0,
      prevX: 0,
      prevY: 0,
      prevZ: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      heading: 0,
      prevHeading: 0,
      groundZ: 0,
      desiredVx: 0,
      desiredVy: 0,
      normalX: 0,
      normalY: 1,
      normalZ: 0,
    };
    const bodyFlags = view.getUint8(offset++);
    const looseRotates = (bodyFlags & LOOSE_ROTATION) !== 0;
    if (
      bodyFlags > (JUMP_QUEUED | LOOSE_ROTATION | LOOSE_SLEEPING) ||
      (looseRotates && kind !== "loose") ||
      (bodyFlags & LOOSE_SLEEPING && !looseRotates)
    )
      throw Error("Invalid physics body extra flags");
    if (bodyFlags & JUMP_QUEUED) body.jumpQueued = true;
    if (supportId !== NONE) body.supportId = supportId;
    if (controlUntil !== NONE) body.controlUntil = controlUntil;
    for (const field of POSITIONS) {
      body[field] = finite(view.getFloat64(offset, true));
      offset += 8;
    }
    for (let axis = 0; axis < POSITIONS.length; axis++) {
      const field = PREVIOUS[axis] as (typeof PREVIOUS)[number];
      const position = POSITIONS[axis] as (typeof POSITIONS)[number];
      body[field] = body[position] + finite(view.getFloat32(offset, true));
      offset += 4;
    }
    for (const field of FIELDS) {
      const value = finite(view.getFloat32(offset, true));
      offset += 4;
      if (
        ((field === "inheritedVx" || field === "inheritedVy") && value === 0) ||
        (field === "altitude" && !(flags & 16)) ||
        (field === "desiredHeading" && !(flags & 32)) ||
        (field === "desiredDriveSpeed" && !(flags & 64)) ||
        (field === "desiredSteering" && !(flags & 128))
      )
        continue;
      body[field] = value;
    }
    if (kind === "vehicle") {
      if (offset + VEHICLE_BYTES > view.byteLength) throw Error("Invalid physics vehicle length");
      const vehicleFlags = view.getUint8(offset++);
      if (
        vehicleFlags > 15 ||
        (vehicleFlags & 4 && !(vehicleFlags & 2)) ||
        (vehicleFlags & 8 && !(vehicleFlags & 4))
      )
        throw Error("Invalid physics vehicle flags");
      body.sleeping = !!(vehicleFlags & 1);
      offset = readBodyRotation(view, offset, body);
      Object.assign(
        body,
        nonzero({
          bedTilt: finite(view.getFloat32(offset, true)),
          bedTarget: finite(view.getFloat32(offset + 4, true)),
        }),
      );
      offset += 8;
      if (vehicleFlags & 4) {
        if (offset + EXCAVATOR_BYTES > view.byteLength)
          throw Error("Invalid physics excavator length");
        body.excavatorPose = finite(view.getFloat64(offset, true));
        const target = finite(view.getFloat64(offset + 8, true));
        if (target !== -1) body.excavatorTarget = target;
        const rate = finite(view.getFloat32(offset + 16, true));
        if (rate) body.excavatorRate = rate;
        offset += EXCAVATOR_BYTES;
        if (vehicleFlags & 8) {
          if (offset >= view.byteLength) throw Error("Invalid physics excavator length");
          const action = excavatorActionFromId(view.getUint8(offset++));
          if (!action) throw Error("Invalid excavator direction");
          body.excavatorHeld = action;
        }
      } else if (vehicleFlags & 2) {
        if (offset + LEGACY_EXCAVATOR_BYTES > view.byteLength)
          throw Error("Invalid physics excavator length");
        body.excavatorPose = view.getUint32(offset, true);
        const target = view.getUint32(offset + 4, true);
        if (target !== NONE) body.excavatorTarget = target;
        offset += LEGACY_EXCAVATOR_BYTES;
      }
    } else if (looseRotates) {
      body.sleeping = (bodyFlags & LOOSE_SLEEPING) !== 0;
      offset = readBodyRotation(view, offset, body);
    }
    bodies.push(body);
  }
  const contacts: [number, number][] = [],
    pairs = new Set<string>();
  for (let i = 0; i < contactCount; i++) {
    const a = view.getUint32(offset, true),
      b = view.getUint32(offset + 4, true);
    offset += CONTACT_BYTES;
    if (!ids.has(a) || !ids.has(b) || a >= b || pairs.has(`${a}:${b}`))
      throw Error("Invalid physics contact identity");
    pairs.add(`${a}:${b}`);
    contacts.push([a, b]);
  }
  return [{ epoch, tick, omitted, bodies, contacts }, offset];
}
