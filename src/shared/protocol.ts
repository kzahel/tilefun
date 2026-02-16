import type { PaintMode, SubgridShape } from "../editor/EditorTypes.js";
import type { ColliderComponent, SpriteComponent, WanderAIComponent } from "../entities/Entity.js";
import type { PropCollider } from "../entities/Prop.js";
import type { WorldMeta, WorldType } from "../persistence/WorldRegistry.js";

// ---- Realm browser types ----

export interface RealmInfo {
  id: string;
  name: string;
  playerCount: number;
  worldType?: WorldType;
  createdAt: number;
  lastPlayedAt: number;
}

// ---- Client → Server messages ----

export type ClientMessage =
  | {
      type: "player-input";
      seq: number;
      dx: number;
      dy: number;
      sprinting: boolean;
      jump: boolean;
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
    }
  | { type: "flush" }
  | { type: "invalidate-all-chunks" }
  | { type: "load-world"; requestId: number; worldId: string }
  | {
      type: "create-world";
      requestId: number;
      name: string;
      worldType?: WorldType;
      seed?: number;
    }
  | { type: "delete-world"; requestId: number; worldId: string }
  | { type: "list-worlds"; requestId: number }
  | { type: "rename-world"; requestId: number; worldId: string; name: string }
  | { type: "rcon"; requestId: number; command: string }
  | {
      type: "editor-cursor";
      tileX: number;
      tileY: number;
      editorTab: string;
      brushMode: string;
    }
  | { type: "throw-ball"; dirX: number; dirY: number; force: number }
  | { type: "identify"; displayName: string; profileId?: string }
  | { type: "list-realms"; requestId: number }
  | { type: "join-realm"; requestId: number; worldId: string }
  | { type: "leave-realm"; requestId: number };

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
  sprite: SpriteComponent | null;
  collider: ColliderComponent | null;
  wanderAI: WanderAIComponent | null;
  flashHidden?: boolean;
  noShadow?: boolean;
  deathTimer?: number;
  jumpZ?: number;
  jumpVZ?: number;
  wz?: number;
  parentId?: number;
  localOffsetX?: number;
  localOffsetY?: number;
  weight?: number;
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
  collider: PropCollider | null;
  sortOffsetY?: number;
}

export interface RemoteEditorCursor {
  displayName: string;
  color: string;
  tileX: number;
  tileY: number;
  editorTab: string;
  brushMode: string;
}

/** Physics CVar values that affect client-side prediction. */
export interface PhysicsCVars {
  gravity: number;
  friction: number;
  accelerate: number;
  airAccelerate: number;
  airWishCap: number;
  stopSpeed: number;
  noBunnyHop: boolean;
  smallJumps: boolean;
  timeScale: number;
}

export interface GameStateMessage {
  type: "game-state";
  serverTick: number;
  lastProcessedInputSeq: number;
  entities: EntitySnapshot[];
  props: PropSnapshot[];
  playerEntityId: number;
  gemsCollected: number;
  invincibilityTimer: number;
  editorEnabled: boolean;
  loadedChunkKeys: string[];
  chunkUpdates: ChunkSnapshot[];
  editorCursors: RemoteEditorCursor[];
  /** Entity ID → display name for all player entities. */
  playerNames: Record<number, string>;
  /** Entity ID of the player's mount (undefined when not riding). */
  mountEntityId?: number;
  /** Server physics CVars for client prediction sync. */
  cvars: PhysicsCVars;
}

// ---- Server → Client messages ----

export type ServerMessage =
  | { type: "player-assigned"; entityId: number }
  | { type: "kicked"; reason: string }
  | GameStateMessage
  | {
      type: "world-loaded";
      requestId?: number;
      worldId?: string;
      cameraX: number;
      cameraY: number;
      cameraZoom: number;
    }
  | { type: "world-created"; requestId: number; meta: WorldMeta }
  | { type: "world-deleted"; requestId: number }
  | { type: "world-list"; requestId: number; worlds: WorldMeta[] }
  | { type: "world-renamed"; requestId: number }
  | { type: "rcon-response"; requestId: number; output: string[]; error?: boolean }
  | { type: "realm-list"; requestId?: number; realms: RealmInfo[] }
  | {
      type: "realm-joined";
      requestId: number;
      worldId: string;
      cameraX: number;
      cameraY: number;
      cameraZoom: number;
    }
  | { type: "realm-left"; requestId: number }
  | { type: "realm-player-count"; worldId: string; count: number }
  | { type: "chat"; sender: string; text: string };
