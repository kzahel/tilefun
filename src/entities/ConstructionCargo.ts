import { Direction, type Entity } from "./Entity.js";
import type { EntityDef } from "./EntityDefs.js";

export const CONSTRUCTION_PALLET = "construction-pallet";
export const CONSTRUCTION_CRATE = "construction-crate";
export const CONSTRUCTION_BLOCK = "construction-block";
export const WRECKING_BALL = "construction-wrecking-ball";

function cargoDef(
  sheetKey: string,
  spriteWidth: number,
  spriteHeight: number,
  width: number,
  depth: number,
  z: number,
) {
  return {
    sprite: {
      sheetKey,
      spriteWidth,
      spriteHeight,
      frameCount: 1,
      frameDuration: 1000,
      drawOffsetY: depth / 2,
    },
    collider: { width, height: depth, physicalHeight: z, offsetX: 0, offsetY: depth / 2 },
    wanderAI: null,
    hasVelocity: true,
  } satisfies EntityDef;
}

const woodenCrate = cargoDef(CONSTRUCTION_PALLET, 32, 24, 24, 17, 12);

export const CONSTRUCTION_CARGO = {
  [CONSTRUCTION_PALLET]: woodenCrate,
  [CONSTRUCTION_CRATE]: {
    ...woodenCrate,
    collider: { ...woodenCrate.collider, width: 19, height: 15, physicalHeight: 18, offsetY: 7.5 },
  },
  [CONSTRUCTION_BLOCK]: cargoDef(CONSTRUCTION_BLOCK, 26, 28, 20, 16, 14),
  [WRECKING_BALL]: cargoDef(WRECKING_BALL, 20, 22, 16, 16, 16),
};

type Cargo = keyof typeof CONSTRUCTION_CARGO;

export const isWoodenCargo = (
  type: string,
): type is typeof CONSTRUCTION_PALLET | typeof CONSTRUCTION_CRATE =>
  type === CONSTRUCTION_PALLET || type === CONSTRUCTION_CRATE;

export function isConstructionCargo(type: string): type is Cargo {
  return Object.hasOwn(CONSTRUCTION_CARGO, type);
}

export function createConstructionCargo(type: Cargo, wx: number, wy: number): Entity {
  const { sprite, collider } = CONSTRUCTION_CARGO[type];
  return {
    id: 0,
    type,
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      ...sprite,
      direction: Direction.Down,
      frameCol: 0,
      frameRow: 0,
      animTimer: 0,
      moving: false,
    },
    collider: { ...collider },
    wanderAI: null,
  };
}
