import type { PaintMode, SubgridShape } from "../editor/EditorMode.js";

// ---- Client → Server messages ----

export type ClientMessage =
  | {
      type: "player-input";
      dx: number;
      dy: number;
      sprinting: boolean;
    }
  | {
      type: "player-interact";
      wx: number;
      wy: number;
    }
  | {
      type: "edit-terrain-tile";
      tx: number;
      ty: number;
      terrainId: number | null;
      paintMode: PaintMode;
      bridgeDepth: number;
    }
  | {
      type: "edit-terrain-subgrid";
      gsx: number;
      gsy: number;
      terrainId: number | null;
      paintMode: PaintMode;
      bridgeDepth: number;
      shape: SubgridShape;
    }
  | {
      type: "edit-terrain-corner";
      gsx: number;
      gsy: number;
      terrainId: number | null;
      paintMode: PaintMode;
      bridgeDepth: number;
    }
  | {
      type: "edit-road";
      tx: number;
      ty: number;
      roadType: number;
      paintMode: PaintMode;
    }
  | {
      type: "edit-elevation";
      tx: number;
      ty: number;
      height: number;
      gridSize: number;
    }
  | {
      type: "edit-spawn";
      wx: number;
      wy: number;
      entityType: string;
    }
  | { type: "edit-delete-entity"; entityId: number }
  | { type: "edit-delete-prop"; propId: number }
  | { type: "edit-clear-terrain"; terrainId: number }
  | { type: "edit-clear-roads" }
  | { type: "set-editor-mode"; enabled: boolean }
  | { type: "set-debug"; paused: boolean; noclip: boolean }
  | {
      type: "visible-range";
      minCx: number;
      minCy: number;
      maxCx: number;
      maxCy: number;
    };

// ---- Snapshot types for serialized state sync ----

export interface ChunkSnapshot {
  cx: number;
  cy: number;
  revision: number;
  subgrid: number[];
  roadGrid: number[];
  heightGrid: number[];
  terrain: number[];
  detail: number[];
  blendBase: number[];
  blendLayers: number[];
  collision: number[];
}

export interface EntitySnapshot {
  id: number;
  type: string;
  position: { wx: number; wy: number };
  sortOffsetY?: number;
  velocity: { vx: number; vy: number } | null;
  sprite: {
    sheetKey: string;
    frameCol: number;
    frameRow: number;
    animTimer: number;
    frameDuration: number;
    frameCount: number;
    direction: number;
    moving: boolean;
    spriteWidth: number;
    spriteHeight: number;
  } | null;
  collider: {
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
    solid?: boolean;
  } | null;
  wanderAI: {
    state: string;
    timer: number;
    dirX: number;
    dirY: number;
    idleMin: number;
    idleMax: number;
    walkMin: number;
    walkMax: number;
    speed: number;
    directional: boolean;
    chaseRange?: number;
    chaseSpeed?: number;
    hostile?: boolean;
    following?: boolean;
    followDistance?: number;
    followLeash?: number;
    befriendable?: boolean;
  } | null;
  flashHidden?: boolean;
  noShadow?: boolean;
  deathTimer?: number;
}

export interface PropSnapshot {
  id: number;
  type: string;
  position: { wx: number; wy: number };
  sprite: {
    sheetKey: string;
    frameCol: number;
    frameRow: number;
    spriteWidth: number;
    spriteHeight: number;
  };
  collider: {
    offsetX: number;
    offsetY: number;
    width: number;
    height: number;
  } | null;
  walls: { offsetX: number; offsetY: number; width: number; height: number }[] | null;
  sortOffsetY?: number;
}

export interface GameStateMessage {
  type: "game-state";
  entities: EntitySnapshot[];
  props: PropSnapshot[];
  playerEntityId: number;
  gemsCollected: number;
  invincibilityTimer: number;
  editorEnabled: boolean;
  loadedChunkKeys: string[];
  chunkUpdates: ChunkSnapshot[];
}

// ---- Server → Client messages ----

export type ServerMessage =
  | { type: "player-assigned"; entityId: number }
  | GameStateMessage
  | { type: "world-loaded"; cameraX: number; cameraY: number; cameraZoom: number };
