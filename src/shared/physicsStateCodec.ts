import {
  MAX_PREDICTION_BODIES,
  type PhysicsBodyKind,
  type PhysicsBodyState,
  type PhysicsState,
} from "../physics/PhysicsState.js";

const KINDS: readonly PhysicsBodyKind[] = ["character", "vehicle", "loose", "fixed"];
const POSITIONS = ["x", "y", "z"] as const;
const PREVIOUS = ["prevX", "prevY", "prevZ"] as const;
const FIELDS = [
  "vx",
  "vy",
  "vz",
  "heading",
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
] as const;
const BODY_BYTES = 105;
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
      ? HEADER_BYTES + state.bodies.length * BODY_BYTES + state.contacts.length * CONTACT_BYTES
      : 0)
  );
}
function uint(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > NONE) throw Error("Invalid physics integer");
  return value;
}
function finite(value: number) {
  if (!Number.isFinite(value)) throw Error("Non-finite physics state");
  return value;
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
      groundZ: 0,
      desiredVx: 0,
      desiredVy: 0,
      normalX: 0,
      normalY: 1,
      normalZ: 0,
    };
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
        (field === "altitude" && !(flags & 16)) ||
        (field === "desiredHeading" && !(flags & 32)) ||
        (field === "desiredDriveSpeed" && !(flags & 64)) ||
        (field === "desiredSteering" && !(flags & 128))
      )
        continue;
      body[field] = value;
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
