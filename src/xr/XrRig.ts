/**
 * Where a headset's room sits in the world (tactical 252). Pure maths, no
 * WebXR types.
 *
 * Room axes are WebXR's: metres, X right, Y up, −Z forward, origin on the floor.
 * World axes are the game's: world pixels, X east, Y south, Z up; a heading of 0
 * faces east and grows turning right (see `FirstPersonCamera`).
 */

/** The room's floor origin in the world, the heading its −Z looks along, and
 * the world pixels one metre covers. */
export interface XrRig {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pixelsPerMetre: number;
}

/** The head in the room. `yaw` turns right from the room's forward; `pitch`
 * looks up. */
export interface XrHead {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
}

/** A head pose from a column-major rigid transform (`XRRigidTransform.matrix`). */
export function headFromMatrix(m: ArrayLike<number>): XrHead {
  // The view looks along its own −Z: the third column, negated.
  const fx = -(m[8] ?? 0),
    fy = -(m[9] ?? 0),
    fz = -(m[10] ?? -1);
  return {
    x: m[12] ?? 0,
    y: m[13] ?? 0,
    z: m[14] ?? 0,
    // Looking straight up or down has no heading of its own; atan2(0, 0) is 0.
    yaw: Math.atan2(fx, -fz),
    pitch: Math.asin(Math.max(-1, Math.min(1, fy))),
  };
}

/** A room point (metres) in the world. */
export function roomToWorld(
  rig: XrRig,
  p: { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  const c = Math.cos(rig.yaw),
    s = Math.sin(rig.yaw);
  const forward = -p.z * rig.pixelsPerMetre,
    right = p.x * rig.pixelsPerMetre;
  // Facing east (yaw 0), right is south.
  return {
    x: rig.x + forward * c - right * s,
    y: rig.y + forward * s + right * c,
    z: rig.z + p.y * rig.pixelsPerMetre,
  };
}

/** The rig that puts room point `p` at world point `at`. */
export function rigThrough(
  at: { x: number; y: number; z: number },
  p: { x: number; y: number; z: number },
  yaw: number,
  pixelsPerMetre: number,
): XrRig {
  const offset = roomToWorld({ x: 0, y: 0, z: 0, yaw, pixelsPerMetre }, p);
  return { x: at.x - offset.x, y: at.y - offset.y, z: at.z - offset.z, yaw, pixelsPerMetre };
}

/** The head's heading in the world. */
export function headHeading(rig: XrRig, head: XrHead): number {
  return rig.yaw + head.yaw;
}

/**
 * The room's transform in the 3D scene's axes (X east, Y north, Z up: game Y
 * mirrored), column-major, for the parent of the headset's cameras. Scale is
 * part of it: the cameras' own poses are in metres.
 */
export function rigMatrix(rig: XrRig): number[] {
  const c = Math.cos(rig.yaw),
    s = Math.sin(rig.yaw),
    k = rig.pixelsPerMetre;
  // Room X is the heading's right (−sin, cos) and room Z is behind it, both with
  // their game Y negated for the scene; room Y is up.
  return [-s * k, -c * k, 0, 0, 0, 0, k, 0, -c * k, s * k, 0, 0, rig.x, -rig.y, rig.z, 1];
}

/** Stick deflection that starts a snap turn, and the one that re-arms it. */
const SNAP_ON = 0.6;
const SNAP_OFF = 0.3;
export const SNAP_TURN = Math.PI / 6;

/**
 * Snap turning: one fixed turn per flick of the stick, never a smooth rotation
 * of the world. Returns the turn to apply this tick; `state.armed` carries over.
 */
export function snapTurn(state: { armed: boolean }, stickX: number): number {
  if (Math.abs(stickX) < SNAP_OFF) state.armed = true;
  if (!state.armed || Math.abs(stickX) < SNAP_ON) return 0;
  state.armed = false;
  return Math.sign(stickX) * SNAP_TURN;
}

/** Share of the table's half-width the player may walk before the table follows. */
export const TABLE_DEAD_ZONE = 0.3;
/** The follow settles in about half a second. */
const TABLE_GLIDE_RATE = 6;

/**
 * The tabletop's anchor follows the player: still while the player stays inside
 * the dead zone, then gliding until it is back over them. Mutates `anchor`;
 * `state.gliding` carries over.
 */
export function followAnchor(
  anchor: { x: number; y: number; z: number },
  player: { x: number; y: number; z: number },
  halfWidth: number,
  dt: number,
  state: { gliding: boolean },
): void {
  const dx = player.x - anchor.x,
    dy = player.y - anchor.y;
  const distance = Math.hypot(dx, dy);
  // A teleport or a door: nothing to glide over.
  if (distance > halfWidth * 2) {
    anchor.x = player.x;
    anchor.y = player.y;
    anchor.z = player.z;
    state.gliding = false;
    return;
  }
  if (distance > halfWidth * TABLE_DEAD_ZONE) state.gliding = true;
  if (!state.gliding) return;
  const step = 1 - Math.exp(-TABLE_GLIDE_RATE * dt);
  anchor.x += dx * step;
  anchor.y += dy * step;
  anchor.z += (player.z - anchor.z) * step;
  if (Math.hypot(player.x - anchor.x, player.y - anchor.y) < 1) state.gliding = false;
}

export const TABLE_SCALE_MIN = 250;
export const TABLE_SCALE_MAX = 2000;
/** Full deflection halves or doubles the miniature in about a second. */
const TABLE_SCALE_RATE = 0.7;

/** The tabletop's world pixels per metre after a tick of the scale stick
 * (pushed forward, `stickY` < 0, brings the world closer: fewer pixels a metre). */
export function scaleTable(pixelsPerMetre: number, stickY: number, dt: number): number {
  if (Math.abs(stickY) < SNAP_OFF) return pixelsPerMetre;
  const next = pixelsPerMetre * Math.exp(stickY * TABLE_SCALE_RATE * dt);
  return Math.max(TABLE_SCALE_MIN, Math.min(TABLE_SCALE_MAX, next));
}
