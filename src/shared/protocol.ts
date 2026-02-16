import type { PaintMode, SubgridShape } from "../editor/EditorTypes.js";
import type { SpriteState, WanderAIState } from "../entities/EntityDefs.js";
import type { PropCollider } from "../entities/Prop.js";
import type { WorldMeta, WorldType } from "../persistence/WorldRegistry.js";
import type { EntityDelta } from "./entityDelta.js";

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
  velocity: { vx: number; vy: number } | null;
  spriteState: SpriteState | null;
  wanderAIState: WanderAIState | null;
  flashHidden?: boolean;
  noShadow?: boolean;
  deathTimer?: number;
  jumpZ?: number;
  jumpVZ?: number;
  wz?: number;
  parentId?: number;
  localOffsetX?: number;
  localOffsetY?: number;
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
  platformerAir: boolean;
  timeScale: number;
}

// ---- Per-tick frame message (hot path — future unreliable channel) ----

export interface FrameMessage {
  type: "frame";
  serverTick: number;
  lastProcessedInputSeq: number;
  playerEntityId: number;
  entityBaselines?: EntitySnapshot[];
  entityDeltas?: EntityDelta[];
  entityExits?: number[];
}

// ---- Sync events (on-change only — future reliable channel) ----

export interface SyncSessionMessage {
  type: "sync-session";
  gemsCollected: number;
  invincibilityTimer: number;
  editorEnabled: boolean;
  /** null = not riding. Absence of entire SyncSession = unchanged. */
  mountEntityId: number | null;
}

export interface SyncChunksMessage {
  type: "sync-chunks";
  loadedChunkKeys?: string[];
  chunkUpdates?: ChunkSnapshot[];
}

export interface SyncPropsMessage {
  type: "sync-props";
  props: PropSnapshot[];
}

export interface SyncCVarsMessage {
  type: "sync-cvars";
  cvars: PhysicsCVars;
}

export interface SyncPlayerNamesMessage {
  type: "sync-player-names";
  playerNames: Record<number, string>;
}

export interface SyncEditorCursorsMessage {
  type: "sync-editor-cursors";
  editorCursors: RemoteEditorCursor[];
}

export type SyncMessage =
  | SyncSessionMessage
  | SyncChunksMessage
  | SyncPropsMessage
  | SyncCVarsMessage
  | SyncPlayerNamesMessage
  | SyncEditorCursorsMessage;

/** Union of all bufferable messages (frame + sync). */
export type BufferedMessage = FrameMessage | SyncMessage;

// ---- Server → Client messages ----

export type ServerMessage =
  | { type: "player-assigned"; entityId: number }
  | { type: "kicked"; reason: string }
  | FrameMessage
  | SyncMessage
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
