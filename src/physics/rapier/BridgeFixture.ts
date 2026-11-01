/** Metres, Y-up. One geometric description supplies render meshes and colliders. */
export interface PhysicsShape {
  id: string;
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  low: number;
  high: number;
  thickness: number;
  color: number;
}

export const BRIDGE_HEIGHT = 2.5;
export const SECTION_LENGTH = 4;
export const RAMP_LENGTH = 8;
export const PLAYER_RADIUS = 0.28;
export const PLAYER_HALF_HEIGHT = 0.35;
export const PLAYER_FOOT_OFFSET = PLAYER_RADIUS + PLAYER_HALF_HEIGHT;
export type PhysicsStart = "ramp" | "deck" | "underpass" | "platform" | "far";

export function bridgeSections(value: number): number {
  return Math.max(2, Math.min(256, Math.round(Number.isFinite(value) ? value : 8)));
}

export function physicsStart(sections: number, start: PhysicsStart) {
  const length = bridgeSections(sections) * SECTION_LENGTH;
  switch (start) {
    case "deck":
      return { x: 2, y: BRIDGE_HEIGHT + PLAYER_FOOT_OFFSET + 0.06, z: 0 };
    case "underpass":
      return { x: length / 2, y: PLAYER_FOOT_OFFSET + 0.06, z: 5 };
    case "platform":
      return { x: -3, y: PLAYER_FOOT_OFFSET + 0.06, z: 7 };
    case "far":
      return { x: length + 10, y: PLAYER_FOOT_OFFSET + 0.06, z: 0 };
    default:
      return { x: -11, y: PLAYER_FOOT_OFFSET + 0.06, z: 0 };
  }
}

export function bridgeFixture(count: number): PhysicsShape[] {
  const sections = bridgeSections(count),
    length = sections * SECTION_LENGTH;
  const shapes: PhysicsShape[] = [];
  const slab = (
    id: string,
    x: number,
    y: number,
    z: number,
    width: number,
    depth: number,
    low: number,
    high: number,
    thickness: number,
    color: number,
  ) => shapes.push({ id, x, y, z, width, depth, low, high, thickness, color });
  slab("ground", length / 2, 0, 0, length + 56, 32, 0, 0, 0.5, 0x718d69);
  slab("ramp-west", -4, 0, 0, 8, 4, 0, BRIDGE_HEIGHT, 0.25, 0xd5b27a);
  slab("ramp-east", length + 4, 0, 0, 8, 4, BRIDGE_HEIGHT, 0, 0.25, 0xd5b27a);
  for (let i = 0; i < sections; i++) {
    const x = (i + 0.5) * SECTION_LENGTH;
    slab(
      `deck-${i}`,
      x,
      0,
      0,
      4,
      4,
      BRIDGE_HEIGHT,
      BRIDGE_HEIGHT,
      0.25,
      i % 2 ? 0xadc5cd : 0x94b5c2,
    );
    for (const z of [-1.95, 1.95])
      slab(`curb-${i}-${z}`, x, 0, z, 4, 0.12, 2.7, 2.7, 0.2, 0xe2ce98);
    if (i % 2 === 0)
      for (const z of [-1.7, 1.7])
        slab(`pier-${i}-${z}`, x, 0, z, 0.4, 0.4, 2.25, 2.25, 2.25, 0x617987);
  }
  slab("platform-landing", -3, 0, 9, 4, 2, 2.5, 2.5, 0.25, 0xd5b27a);
  return shapes;
}

/** Eight corners of a slab, whose upper/lower faces may slope along X. */
export function slabVertices(shape: PhysicsShape): Float32Array {
  const w = shape.width / 2,
    d = shape.depth / 2;
  return new Float32Array([
    -w,
    shape.low,
    -d,
    w,
    shape.high,
    -d,
    w,
    shape.high,
    d,
    -w,
    shape.low,
    d,
    -w,
    shape.low - shape.thickness,
    -d,
    w,
    shape.high - shape.thickness,
    -d,
    w,
    shape.high - shape.thickness,
    d,
    -w,
    shape.low - shape.thickness,
    d,
  ]);
}

export const SLAB_INDICES = [
  0, 3, 2, 0, 2, 1, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6,
  1, 6, 5,
];
