import type { PaintMode, SubgridShape } from "../editor/EditorTypes.js";
import type { SpriteState, WanderAIState } from "../entities/EntityDefs.js";
import type { PropCollider } from "../entities/Prop.js";
import type {
  GenerationDescriptor,
  GenerationRequest,
} from "../generation/GenerationDescriptor.js";
import type { FacadePiece } from "../generation/regional/BuildingRecipes.js";
import type { WorldMeta, WorldType } from "../persistence/WorldRegistry.js";
import type { BodyRotation } from "../physics/BodyRotation.js";
import type { RailPath } from "../railway/RailPath.js";
import type { EntityDelta } from "./entityDelta.js";

/** Requested outdoor arrival point, validated by the server before a realm change. */
export interface Arrival {
  x: number;
  y: number;
  generation: GenerationDescriptor;
}

// ---- Realm browser types ----

export interface RealmInfo {
  id: string;
  name: string;
  playerCount: number;
  worldType?: WorldType;
  generation?: GenerationDescriptor;
  incompatibleReason?: string | undefined;
  createdAt: number;
  lastPlayedAt: number;
}

// ---- Device seats (226) ----

/** Local players one device connection may seat; seat 0 is the connection's own player. */
export const MAX_SEATS = 4;

/** Another seat's movement in a device's input packet; seat 0's rides in the packet's fields. */
export interface SeatMovement {
  seat: number;
  dx: number;
  dy: number;
  sprinting: boolean;
  jump: boolean;
  jumpPressed?: boolean;
  reversing?: boolean;
  relativeDriving?: boolean;
}

// ---- Client → Server messages ----

export type VehicleHornMessage = {
  type: "vehicle-horn";
  vehicleId: number;
  active: boolean;
  wx: number;
  wy: number;
  kind: "car" | "heavy" | "train";
};

export type ClientMessage =
  | { type: "call-train"; requestId: number; benchId: number }
  | { type: "vehicle-horn"; active: boolean }
  | { type: "enter-vehicle"; requestId: number; entityId: number }
  | { type: "exit-vehicle"; requestId: number }
  | { type: "recover-vehicle"; requestId: number; entityId: number }
  | {
      type: "vehicle-equipment";
      requestId: number;
      entityId: number;
      action: import("../traffic/VehicleEquipment.js").EquipmentAction;
    }
  | {
      type: "edit-room";
      roomId: string;
      expectedRevision: number;
      edit: import("../patterns/PatternDocument.js").PatternEdit;
    }
  | {
      type: "edit-room-history";
      roomId: string;
      expectedRevision: number;
      direction: "undo" | "redo";
    }
  | {
      type: "edit-pattern";
      start: { x: number; y: number };
      end: { x: number; y: number };
      erase: boolean;
    }
  | { type: "edit-pattern-history"; direction: "undo" | "redo" }
  | {
      type: "player-input";
      seq: number;
      dx: number;
      dy: number;
      sprinting: boolean;
      jump: boolean;
      /** Discrete jump edge since the previous command sample. */
      jumpPressed?: boolean;
      reversing?: boolean;
      relativeDriving?: boolean;
      /** Every other joined seat's movement on the same device tick (226). */
      seats?: SeatMovement[];
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
      paintSchemeId?: string;
    }
  | { type: "edit-delete-entity"; entityId: number }
  | { type: "edit-delete-prop"; propId: number }
  | { type: "edit-move-prop"; propId: number; wx: number; wy: number }
  | { type: "edit-clear-terrain"; terrainId: number }
  | { type: "edit-clear-roads" }
  | { type: "set-editor-mode"; enabled: boolean }
  | { type: "set-debug"; paused: boolean }
  | {
      type: "visible-range";
      minCx: number;
      minCy: number;
      maxCx: number;
      maxCy: number;
    }
  | { type: "flush" }
  | { type: "invalidate-all-chunks" }
  | { type: "load-world"; requestId: number; worldId: string; arrival?: Arrival }
  | {
      type: "create-world";
      requestId: number;
      name: string;
      generation?: GenerationRequest;
      worldType?: WorldType;
      seed?: number;
      adminToken?: string;
    }
  | { type: "recreate-world"; requestId: number; worldId: string; adminToken?: string }
  | { type: "delete-world"; requestId: number; worldId: string; adminToken?: string }
  | { type: "list-worlds"; requestId: number }
  | { type: "rename-world"; requestId: number; worldId: string; name: string; adminToken?: string }
  | { type: "rcon"; requestId: number; command: string; adminToken?: string }
  | {
      type: "editor-cursor";
      tileX: number;
      tileY: number;
      editorTab: string;
      brushMode: string;
    }
  | { type: "vehicle-emergency"; action: "toggle" | "style" }
  | { type: "throw-ball"; dirX: number; dirY: number; force: number }
  | { type: "identify"; displayName: string; profileId?: string; playerModel?: string }
  | { type: "set-player-model"; requestId: number; model: string }
  | { type: "list-realms"; requestId: number }
  | { type: "get-world-map"; requestId: number }
  | { type: "join-realm"; requestId: number; worldId: string; arrival?: Arrival; resume?: boolean }
  | { type: "leave-realm"; requestId: number }
  | {
      type: "enter-building";
      requestId: number;
      featureId: string;
      doorId?: string;
      walkThrough?: boolean;
    }
  | { type: "exit-building"; requestId: number; doorId?: string; walkThrough?: boolean }
  /** A message from one of the device's other seats (226); seat 0 sends without one. */
  | { type: "seat"; seat: number; message: ClientMessage }
  | {
      type: "join-seat";
      requestId: number;
      seat: number;
      displayName?: string;
      playerModel?: string;
    }
  | { type: "leave-seat"; requestId: number; seat: number };

// ---- Snapshot types for serialized state sync ----

export interface ChunkSnapshot {
  railPaths?: RailPath[];
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
  /** Passive XY departure velocity while airborne; total velocity includes it. */

  /** Authoritative jump-button latch: bit 0 consumed, bit 1 held. */
  jumpInputState?: number;
  /** Emergency lights enabled and selected siren style; see EmergencyVehicle. */
  emergencyState?: number;
  /** Driven-car nose angle in world radians, retained while parked. */
  vehicleHeading?: number;
  bodyRotation?: BodyRotation;
  /** Replicated coherent prescribed-body group; never inferred from private service identity. */
  physicsGroupId?: number;
  paintSchemeId?: string;

  /** Hinged dump bed angle/target in radians; the shared physics step owns the clock. */
  vehicleBedTilt?: number;
  vehicleBedTarget?: number;
  towTargetId?: number;
  towedBy?: number;
  vehicleRamp?: number;
  transportLoadId?: number;
  transportedBy?: number;
  wz?: number;
  parentId?: number;
  localOffsetX?: number;
  localOffsetY?: number;
}

export interface PropSnapshot {
  proceduralId?: string;
  id: number;
  type: string;
  position: { wx: number; wy: number };
  sprite: {
    parts?: readonly FacadePiece[];
    sheetKey: string;
    frameCol: number;
    frameRow: number;
    spriteWidth: number;
    spriteHeight: number;
  };
  collider: PropCollider | null;
  sortOffsetY?: number;
  walls?: PropCollider[];
}

export interface RemoteEditorCursor {
  displayName: string;
  color: string;
  tileX: number;
  tileY: number;
  editorTab: string;
  brushMode: string;
}

/** Tile coordinates for connected players, independent of camera interest ranges. */
export interface WorldMapPlayer {
  /** Stable across realm changes; entity IDs are only unique within one realm. */
  playerNumber: number;
  entityId: number;
  name: string;
  color: string;
  x: number;
  y: number;
  self: boolean;
  indoors: boolean;
}

export interface WorldMapMessage {
  type: "world-map";
  requestId: number;
  worldId: string;
  name: string;
  generation: GenerationDescriptor;
  players: WorldMapPlayer[];
}

/** Physics CVar values that affect client-side prediction. */
export interface PhysicsCVars {
  gravity: number;
}

// ---- Per-tick frame message (hot path — future unreliable channel) ----

export interface FrameMessage {
  /** Same physics tick for all bodies admitted to local replay. */
  physics?: import("../physics/PhysicsState.js").PhysicsState;
  type: "frame";
  serverTick: number;
  /** Elapsed authoritative simulation seconds; independent of changing tick rate. */
  simulationTime?: number;
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
  editorEnabled: boolean;
  /** null = not riding. Absence of entire SyncSession = unchanged. */
  mountEntityId: number | null;
}

/** Event-style invincibility sync: countdown is reconstructed client-side. */
export interface SyncInvincibilityMessage {
  type: "sync-invincibility";
  /** Server tick when invincibility started/reset. */
  startTick: number;
  /** Duration in ticks at the server tick rate when the event was emitted. */
  durationTicks: number;
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
  | { type: "sync-room"; room: import("../interiors/GameplayRoom.js").GameplayRoomState | null }
  | SyncSessionMessage
  | SyncInvincibilityMessage
  | SyncChunksMessage
  | SyncPropsMessage
  | SyncCVarsMessage
  | SyncPlayerNamesMessage
  | SyncEditorCursorsMessage;

/** Union of all bufferable messages (frame + sync). */
export type BufferedMessage = FrameMessage | SyncMessage;

// ---- Server → Client messages ----

export type ServerMessage =
  | VehicleHornMessage
  | { type: "vehicle-controlled"; requestId: number }
  | import("../interiors/DoorTraversal.js").DoorMotion
  | { type: "storage-status"; paused: boolean; message: string }
  | ({ type: "room-edit-status" } & import("../interiors/GameplayRoom.js").RoomEditStatus)
  | ({ type: "pattern-edit-status" } & import("../patterns/TreeBrushEditor.js").TreeBrushStatus)
  | { type: "player-assigned"; entityId: number }
  | WorldMapMessage
  | { type: "kicked"; reason: string }
  | FrameMessage
  | SyncMessage
  | {
      type: "world-loaded";
      interior?: import("../interiors/GameplayInterior.js").InteriorIdentity | undefined;
      generation?: GenerationDescriptor;
      requestId?: number;
      worldId?: string;
      cameraX: number;
      cameraY: number;
      cameraZoom: number;
    }
  | { type: "request-error"; requestId: number; message: string }
  | { type: "world-created"; requestId: number; meta: WorldMeta }
  | { type: "world-deleted"; requestId: number }
  | { type: "world-list"; requestId: number; worlds: WorldMeta[] }
  | { type: "world-renamed"; requestId: number }
  | { type: "rcon-response"; requestId: number; output: string[]; error?: boolean }
  | { type: "realm-list"; requestId?: number; realms: RealmInfo[] }
  | {
      type: "realm-joined";
      interior?: import("../interiors/GameplayInterior.js").InteriorIdentity | undefined;
      generation?: GenerationDescriptor;
      requestId: number;
      worldId: string;
      cameraX: number;
      cameraY: number;
      cameraZoom: number;
    }
  | { type: "realm-left"; requestId: number }
  | { type: "player-model-set"; requestId: number; model: string }
  | { type: "realm-player-count"; worldId: string; count: number }
  | { type: "chat"; sender: string; text: string }
  /** A message for one of the device's other seats (226); seat 0's arrive without one. */
  | { type: "seat"; seat: number; message: ServerMessage }
  | { type: "seat-joined"; requestId: number; seat: number; entityId: number }
  | { type: "seat-left"; requestId: number; seat: number };
