import type { ColliderComponent, Direction } from "./Entity.js";

// ---- Static definition types ----

/** Static sprite asset metadata, shared via ENTITY_DEFS registry. */
export interface SpriteDef {
  sheetKey: string;
  spriteWidth: number;
  spriteHeight: number;
  frameCount: number;
  frameDuration: number;
  drawOffsetY?: number;
}

/** Static AI config, shared via ENTITY_DEFS registry. */
export interface WanderAIDef {
  idleMin: number;
  idleMax: number;
  walkMin: number;
  walkMax: number;
  speed: number;
  directional: boolean;
  chaseRange?: number;
  chaseSpeed?: number;
  hostile?: boolean;
  befriendable?: boolean;
  followDistance?: number;
  followLeash?: number;
  rideSpeed?: number;
}

/** Static collider shape. Alias for ColliderComponent (all fields are static). */
export type ColliderDef = ColliderComponent;

/** Static asset/config metadata for an entity type. */
export interface EntityDef {
  sprite: SpriteDef | null;
  collider: ColliderDef | null;
  wanderAI: WanderAIDef | null;
  sortOffsetY?: number;
  weight?: number;
  noShadow?: boolean;
  hasVelocity: boolean;
  initialMoving?: boolean;
}

// ---- Dynamic state types (serialized per-tick) ----

/** Dynamic sprite state — serialized per-tick in EntitySnapshot.
 * Animation fields (animTimer, frameCol) are NOT serialized — the client
 * computes animation locally from `moving`, `frameDuration`, and `frameCount`.
 */
export interface SpriteState {
  direction: Direction;
  moving: boolean;
  frameRow: number;
  flipX?: boolean;
  /** Only present when differs from def (e.g. player sprint). */
  frameDuration?: number;
}

/** Dynamic AI state — serialized per-tick in EntitySnapshot.
 * The AI `timer` is NOT serialized — only needed server-side for state transitions.
 */
export interface WanderAIState {
  state: string;
  dirX: number;
  dirY: number;
  following?: boolean;
}

// ---- Shared helper for person entities ----

function personDef(n: number): EntityDef {
  return {
    sprite: {
      sheetKey: `person${n}`,
      spriteWidth: 16,
      spriteHeight: 32,
      frameCount: 6,
      frameDuration: 140,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 10,
      height: 6,
      physicalHeight: 24,
      clientSolid: true,
    },
    wanderAI: {
      idleMin: 1.5,
      idleMax: 5.0,
      walkMin: 1.0,
      walkMax: 3.0,
      speed: 20,
      directional: true,
    },
    weight: 70,
    hasVelocity: true,
  };
}

function wormDef(n: number): EntityDef {
  return {
    sprite: {
      sheetKey: `worm${n}`,
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 6,
      frameDuration: 180,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 8,
      height: 6,
      physicalHeight: 4,
    },
    wanderAI: {
      idleMin: 2.0,
      idleMax: 6.0,
      walkMin: 1.0,
      walkMax: 3.0,
      speed: 8,
      directional: true,
    },
    hasVelocity: true,
  };
}

// ---- ENTITY_DEFS registry ----

export const ENTITY_DEFS: Record<string, EntityDef> = {
  player: {
    sprite: {
      sheetKey: "player",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 4,
      frameDuration: 150,
      drawOffsetY: -2,
    },
    collider: {
      offsetX: 0,
      offsetY: -3,
      width: 10,
      height: 6,
      clientSolid: true,
      physicalHeight: 12,
    },
    wanderAI: null,
    weight: 30,
    hasVelocity: true,
  },
  ball: {
    sprite: {
      sheetKey: "ball",
      spriteWidth: 8,
      spriteHeight: 8,
      frameCount: 1,
      frameDuration: 100,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 4,
      height: 4,
      solid: false,
      physicalHeight: 4,
    },
    wanderAI: null,
    weight: 0.5,
    hasVelocity: true,
  },
  chicken: {
    sprite: {
      sheetKey: "chicken",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 4,
      frameDuration: 200,
    },
    collider: {
      offsetX: 0,
      offsetY: -5,
      width: 10,
      height: 6,
      physicalHeight: 8,
    },
    wanderAI: {
      idleMin: 1.0,
      idleMax: 4.0,
      walkMin: 1.0,
      walkMax: 3.0,
      speed: 20,
      directional: false,
      befriendable: true,
      followDistance: 20,
    },
    weight: 2,
    hasVelocity: true,
  },
  cow: {
    sprite: {
      sheetKey: "cow",
      spriteWidth: 32,
      spriteHeight: 32,
      frameCount: 3,
      frameDuration: 250,
    },
    collider: {
      offsetX: 0,
      offsetY: -5,
      width: 22,
      height: 10,
      physicalHeight: 10,
    },
    wanderAI: {
      idleMin: 2.0,
      idleMax: 5.0,
      walkMin: 1.0,
      walkMax: 3.0,
      speed: 12,
      directional: false,
      befriendable: true,
      followDistance: 24,
      rideSpeed: 30,
    },
    sortOffsetY: -5,
    weight: 500,
    hasVelocity: true,
  },
  pigeon: {
    sprite: {
      sheetKey: "pigeon",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 6,
      frameDuration: 150,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 8,
      height: 6,
      physicalHeight: 6,
    },
    wanderAI: {
      idleMin: 1.5,
      idleMax: 5.0,
      walkMin: 0.5,
      walkMax: 2.0,
      speed: 15,
      directional: false,
    },
    hasVelocity: true,
  },
  pigeon2: {
    sprite: {
      sheetKey: "pigeon2",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 6,
      frameDuration: 150,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 8,
      height: 6,
      physicalHeight: 6,
    },
    wanderAI: {
      idleMin: 1.5,
      idleMax: 5.0,
      walkMin: 0.5,
      walkMax: 2.0,
      speed: 15,
      directional: false,
    },
    hasVelocity: true,
  },
  fish1: {
    sprite: {
      sheetKey: "fish1",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 12,
      frameDuration: 180,
    },
    collider: null,
    wanderAI: null,
    noShadow: true,
    hasVelocity: false,
    initialMoving: true,
  },
  fish2: {
    sprite: {
      sheetKey: "fish2",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 12,
      frameDuration: 180,
    },
    collider: null,
    wanderAI: null,
    noShadow: true,
    hasVelocity: false,
    initialMoving: true,
  },
  fish3: {
    sprite: {
      sheetKey: "fish3",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 14,
      frameDuration: 180,
    },
    collider: null,
    wanderAI: null,
    noShadow: true,
    hasVelocity: false,
    initialMoving: true,
  },
  campfire: {
    sprite: {
      sheetKey: "campfire",
      spriteWidth: 16,
      spriteHeight: 32,
      frameCount: 6,
      frameDuration: 150,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 12,
      height: 8,
      clientSolid: true,
      physicalHeight: 16,
    },
    wanderAI: null,
    hasVelocity: false,
    initialMoving: true,
  },
  gem: {
    sprite: {
      sheetKey: "gem",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 4,
      frameDuration: 150,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 10,
      height: 10,
      solid: false,
      physicalHeight: 4,
    },
    wanderAI: null,
    hasVelocity: false,
    initialMoving: true,
  },
  "ghost-friendly": {
    sprite: {
      sheetKey: "ghost-friendly",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 4,
      frameDuration: 200,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 10,
      height: 8,
      solid: false,
      physicalHeight: 10,
    },
    wanderAI: {
      idleMin: 1.0,
      idleMax: 3.0,
      walkMin: 1.0,
      walkMax: 2.5,
      speed: 15,
      directional: false,
      befriendable: true,
      followDistance: 24,
    },
    hasVelocity: true,
    initialMoving: true,
  },
  "ghost-angry": {
    sprite: {
      sheetKey: "ghost-angry",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 4,
      frameDuration: 150,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 10,
      height: 8,
      solid: false,
      physicalHeight: 10,
    },
    wanderAI: {
      idleMin: 0.5,
      idleMax: 2.0,
      walkMin: 1.0,
      walkMax: 3.0,
      speed: 15,
      directional: false,
      chaseRange: 80,
      chaseSpeed: 35,
      hostile: true,
    },
    hasVelocity: true,
    initialMoving: true,
  },
  "egg-nest": {
    sprite: {
      sheetKey: "egg-nest",
      spriteWidth: 16,
      spriteHeight: 16,
      frameCount: 4,
      frameDuration: 400,
    },
    collider: null,
    wanderAI: null,
    hasVelocity: false,
    initialMoving: true,
  },
  crow: {
    sprite: {
      sheetKey: "crow",
      spriteWidth: 32,
      spriteHeight: 32,
      frameCount: 6,
      frameDuration: 150,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 10,
      height: 6,
      physicalHeight: 12,
    },
    wanderAI: {
      idleMin: 1.0,
      idleMax: 4.0,
      walkMin: 0.5,
      walkMax: 2.0,
      speed: 22,
      directional: true,
    },
    hasVelocity: true,
  },
  seagull: {
    sprite: {
      sheetKey: "seagull",
      spriteWidth: 32,
      spriteHeight: 32,
      frameCount: 6,
      frameDuration: 160,
    },
    collider: {
      offsetX: 0,
      offsetY: 0,
      width: 10,
      height: 6,
      physicalHeight: 12,
    },
    wanderAI: {
      idleMin: 1.5,
      idleMax: 5.0,
      walkMin: 0.5,
      walkMax: 2.5,
      speed: 18,
      directional: true,
    },
    hasVelocity: true,
  },
  worm1: wormDef(1),
  worm2: wormDef(2),
  worm3: wormDef(3),
  worm4: wormDef(4),
  person1: personDef(1),
  person2: personDef(2),
  person3: personDef(3),
  person4: personDef(4),
  person5: personDef(5),
  person6: personDef(6),
  person7: personDef(7),
  person8: personDef(8),
  person9: personDef(9),
  person10: personDef(10),
  person11: personDef(11),
  person12: personDef(12),
  person13: personDef(13),
  person14: personDef(14),
  person15: personDef(15),
  person16: personDef(16),
  person17: personDef(17),
  person18: personDef(18),
  person19: personDef(19),
  person20: personDef(20),
};
