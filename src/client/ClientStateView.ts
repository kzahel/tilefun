import { TICK_RATE } from "../config/constants.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import {
  setAccelerate,
  setAirAccelerate,
  setAirWishCap,
  setFriction,
  setGravityScale,
  setNoBunnyHop,
  setPlatformerAir,
  setSmallJumps,
  setStopSpeed,
  setTimeScale,
} from "../physics/PlayerMovement.js";
import type { GameServer } from "../server/GameServer.js";
import { applyEntityDelta } from "../shared/entityDelta.js";
import type {
  BufferedMessage,
  FrameMessage,
  RemoteEditorCursor,
  SyncChunksMessage,
  SyncCVarsMessage,
  SyncEditorCursorsMessage,
  SyncPlayerNamesMessage,
  SyncPropsMessage,
  SyncSessionMessage,
} from "../shared/protocol.js";
import { applyChunkSnapshot, deserializeEntity, deserializeProp } from "../shared/serialization.js";
import { Chunk } from "../world/Chunk.js";
import type { World } from "../world/World.js";
import type { PlayerPredictor } from "./PlayerPredictor.js";

export interface ClientStateView {
  readonly world: World;
  readonly entities: readonly Entity[];
  readonly props: readonly Prop[];
  readonly playerEntity: Entity;
  readonly gemsCollected: number;
  readonly invincibilityTimer: number;
  readonly editorEnabled: boolean;
  readonly remoteCursors: readonly RemoteEditorCursor[];
  /** Entity ID → display name for player entities. */
  readonly playerNames: Record<number, string>;
  /** Raw server player position (before client prediction). Undefined in local mode. */
  readonly serverPlayerPosition?: { wx: number; wy: number; wz?: number } | undefined;
  /** Last reconciliation correction (predicted - server, before replay). Undefined in local mode. */
  readonly predictionCorrection?:
    | { wx: number; wy: number; wz: number; vx: number; vy: number; jumpVZ: number }
    | undefined;
}

/**
 * Local-mode state view: returns direct references to GameServer's objects.
 * Zero-copy, zero-overhead.
 */
export class LocalStateView implements ClientStateView {
  constructor(private readonly server: GameServer) {}

  get world(): World {
    return this.server.world;
  }
  get entities(): readonly Entity[] {
    return this.server.entityManager.entities;
  }
  get props(): readonly Prop[] {
    return this.server.propManager.props;
  }
  get playerEntity(): Entity {
    return this.server.getLocalSession().player;
  }
  get gemsCollected(): number {
    return this.server.getLocalSession().gameplaySession.gemsCollected;
  }
  get invincibilityTimer(): number {
    return this.server.getLocalSession().gameplaySession.invincibilityTimer;
  }
  get editorEnabled(): boolean {
    return this.server.getLocalSession().editorEnabled;
  }
  get remoteCursors(): readonly RemoteEditorCursor[] {
    return [];
  }
  get playerNames(): Record<number, string> {
    return {};
  }
}

/** Placeholder entity returned before server has sent state. */
const PLACEHOLDER_ENTITY: Entity = {
  id: -1,
  type: "player",
  position: { wx: 0, wy: 0 },
  velocity: null,
  sprite: null,
  collider: null,
  wanderAI: null,
};

/**
 * Serialized-mode state view: maintains a local copy of game state,
 * updated from ServerMessage broadcasts. All data has gone through
 * JSON serialization — no shared object references with the server.
 */
export class RemoteStateView implements ClientStateView {
  private _world: World;
  private _entityMap: Map<number, Entity> = new Map();
  private _entities: Entity[] = [];
  private _props: Prop[] = [];
  private _playerEntityId = -1;
  private _gemsCollected = 0;
  private _invincibilityTimer = 0;
  private _editorEnabled = true;
  private _remoteCursors: RemoteEditorCursor[] = [];
  private _playerNames: Record<number, string> = {};
  private _pendingStates: BufferedMessage[] = [];
  private _predictor: PlayerPredictor | null = null;
  private _stateAppliedThisTick = false;
  private _serverTick = 0;
  private _lastProcessedInputSeq = 0;
  private _mountEntityId: number | undefined = undefined;
  private _tickRate = TICK_RATE;

  constructor(world: World) {
    this._world = world;
  }

  /** Attach a predictor so that playerEntity and entities use predicted position. */
  setPredictor(predictor: PlayerPredictor | null): void {
    this._predictor = predictor;
  }

  /** Whether new server state was applied during the most recent applyPending() call. */
  get stateAppliedThisTick(): boolean {
    return this._stateAppliedThisTick;
  }

  /** Server tick number from the latest game state. */
  get serverTick(): number {
    return this._serverTick;
  }

  /** Last processed input sequence number from the latest game state. */
  get lastProcessedInputSeq(): number {
    return this._lastProcessedInputSeq;
  }

  /** Get the raw server player entity (for reconciliation, bypasses predictor). */
  get serverPlayerEntity(): Entity {
    return this._entities.find((e) => e.id === this._playerEntityId) ?? PLACEHOLDER_ENTITY;
  }

  /**
   * Buffer a message for deferred application.
   * Call applyPending() during the client update tick to apply it,
   * ensuring entity and camera updates are synchronized.
   *
   * Messages are queued and applied in order — entity delta protocol
   * requires sequential application (baselines/deltas/exits are relative
   * to the previous tick's state).
   */
  bufferMessage(msg: BufferedMessage): void {
    this._pendingStates.push(msg);
  }

  /** Apply any buffered messages. Call at the start of each client update tick. */
  applyPending(): void {
    this._stateAppliedThisTick = false;
    if (this._pendingStates.length === 0) return;
    for (const msg of this._pendingStates) {
      this.applyMessage(msg);
    }
    this._pendingStates.length = 0;
    this._stateAppliedThisTick = true;
  }

  /** Dispatch a buffered message to the appropriate handler. */
  applyMessage(msg: BufferedMessage): void {
    switch (msg.type) {
      case "frame":
        this.applyFrame(msg);
        break;
      case "sync-session":
        this.applySyncSession(msg);
        break;
      case "sync-chunks":
        this.applySyncChunks(msg);
        break;
      case "sync-props":
        this.applySyncProps(msg);
        break;
      case "sync-cvars":
        this.applySyncCVars(msg);
        break;
      case "sync-player-names":
        this.applySyncPlayerNames(msg);
        break;
      case "sync-editor-cursors":
        this.applySyncEditorCursors(msg);
        break;
    }
  }

  /** Apply a per-tick frame message (entity delta protocol). */
  applyFrame(msg: FrameMessage): void {
    // Log state transitions that matter for debugging realm-switch movement bug
    if (msg.playerEntityId !== this._playerEntityId) {
      console.log(
        `[tilefun:rsv] playerEntityId changed: ${this._playerEntityId} → ${msg.playerEntityId}`,
      );
    }

    // Always-present fields
    this._playerEntityId = msg.playerEntityId;
    this._serverTick = msg.serverTick;
    this._lastProcessedInputSeq = msg.lastProcessedInputSeq;

    // Save prev positions for interpolation before applying updates
    for (const e of this._entityMap.values()) {
      e.prevPosition = { wx: e.position.wx, wy: e.position.wy };
      e.prevJumpZ = e.jumpZ ?? 0;
      e.prevWz = e.wz ?? 0;
    }

    // Process exits — remove entities that left visibility
    if (msg.entityExits) {
      for (const id of msg.entityExits) {
        this._entityMap.delete(id);
      }
    }

    // Process baselines — new entities (full snapshots)
    if (msg.entityBaselines) {
      for (const snapshot of msg.entityBaselines) {
        const entity = deserializeEntity(snapshot);
        // New entity — no prev position for interpolation
        this._entityMap.set(entity.id, entity);
      }
    }

    // Process deltas — update changed fields on existing entities
    if (msg.entityDeltas) {
      for (const delta of msg.entityDeltas) {
        const entity = this._entityMap.get(delta.id);
        if (entity) {
          applyEntityDelta(entity, delta);
        }
      }
    }

    // Rebuild flat entity array from map
    this._entities = Array.from(this._entityMap.values());
  }

  /** Apply session sync (gems, invincibility, editor, mount). */
  private applySyncSession(msg: SyncSessionMessage): void {
    if (msg.editorEnabled !== this._editorEnabled) {
      console.log(
        `[tilefun:rsv] editorEnabled changed: ${this._editorEnabled} → ${msg.editorEnabled}`,
      );
    }
    this._gemsCollected = msg.gemsCollected;
    this._invincibilityTimer = msg.invincibilityTimer;
    this._editorEnabled = msg.editorEnabled;
    this._mountEntityId = msg.mountEntityId ?? undefined;
  }

  /** Apply chunk sync (terrain data and/or loaded chunk set). */
  private applySyncChunks(msg: SyncChunksMessage): void {
    // Apply chunk updates (delta — only new/changed chunks).
    // Use put() instead of getOrCreate() to avoid invalidateNeighborAutotile()
    // which would reset autotileComputed on already-applied neighbor chunks.
    if (msg.chunkUpdates !== undefined) {
      for (const cs of msg.chunkUpdates) {
        let chunk = this._world.chunks.get(cs.cx, cs.cy);
        if (!chunk) {
          chunk = new Chunk();
          this._world.chunks.put(cs.cx, cs.cy, chunk);
        }
        applyChunkSnapshot(chunk, cs);
      }
    }

    // Unload chunks the server no longer has loaded
    if (msg.loadedChunkKeys !== undefined) {
      const loadedSet = new Set(msg.loadedChunkKeys);
      for (const [key] of this._world.chunks.entries()) {
        if (!loadedSet.has(key)) {
          this._world.chunks.remove(key);
        }
      }
    }
  }

  /** Apply props sync. */
  private applySyncProps(msg: SyncPropsMessage): void {
    this._props = msg.props.map(deserializeProp);
  }

  /** Apply physics CVars sync for client prediction. */
  private applySyncCVars(msg: SyncCVarsMessage): void {
    setGravityScale(msg.cvars.gravity);
    setFriction(msg.cvars.friction);
    setAccelerate(msg.cvars.accelerate);
    setAirAccelerate(msg.cvars.airAccelerate);
    setAirWishCap(msg.cvars.airWishCap);
    setStopSpeed(msg.cvars.stopSpeed);
    setNoBunnyHop(msg.cvars.noBunnyHop);
    setSmallJumps(msg.cvars.smallJumps);
    setPlatformerAir(msg.cvars.platformerAir);
    setTimeScale(msg.cvars.timeScale);
    this._tickRate = msg.cvars.tickRate;
  }

  /** Apply player names sync. */
  private applySyncPlayerNames(msg: SyncPlayerNamesMessage): void {
    this._playerNames = msg.playerNames;
  }

  /** Apply editor cursors sync. */
  private applySyncEditorCursors(msg: SyncEditorCursorsMessage): void {
    this._remoteCursors = msg.editorCursors;
  }

  /** Clear all cached state (e.g., when switching worlds). */
  clear(): void {
    console.log(
      `[tilefun:rsv] clear() — playerEntityId=${this._playerEntityId}, pendingStates=${this._pendingStates.length}, predictor=${!!this._predictor?.player}, editorEnabled=${this._editorEnabled}, chunks=${this._world.chunks.loadedCount}`,
    );
    this._entityMap.clear();
    this._entities = [];
    this._props = [];
    this._playerEntityId = -1;
    this._gemsCollected = 0;
    this._invincibilityTimer = 0;
    this._remoteCursors = [];
    this._playerNames = {};
    this._pendingStates.length = 0; // Fix: clear stale pending state from old realm
    this._predictor?.clearPredicted();
    // Clear all loaded chunks
    for (const [key] of this._world.chunks.entries()) {
      this._world.chunks.remove(key);
    }
  }

  get world(): World {
    return this._world;
  }
  get entities(): readonly Entity[] {
    if (!this._predictor?.player) return this._entities;
    const predicted = this._predictor.player;
    const predictedMount = this._predictor.mount;
    const playerId = this._playerEntityId;
    const mountId = predictedMount?.id ?? -1;
    return this._entities.map((e) => {
      if (e.id === playerId) return predicted;
      if (e.id === mountId && predictedMount) {
        predictedMount.prevPosition = this._predictor!.mountPrevPosition;
        return predictedMount;
      }
      return e;
    });
  }
  get props(): readonly Prop[] {
    return this._props;
  }
  get playerEntity(): Entity {
    if (this._predictor?.player) return this._predictor.player;
    return this._entities.find((e) => e.id === this._playerEntityId) ?? PLACEHOLDER_ENTITY;
  }
  get gemsCollected(): number {
    return this._gemsCollected;
  }
  get invincibilityTimer(): number {
    return this._invincibilityTimer;
  }
  get editorEnabled(): boolean {
    return this._editorEnabled;
  }
  get remoteCursors(): readonly RemoteEditorCursor[] {
    return this._remoteCursors;
  }
  get playerNames(): Record<number, string> {
    return this._playerNames;
  }
  get serverPlayerPosition(): { wx: number; wy: number; wz?: number } | undefined {
    const sp = this._entities.find((e) => e.id === this._playerEntityId);
    if (!sp) return undefined;
    const pos: { wx: number; wy: number; wz?: number } = { wx: sp.position.wx, wy: sp.position.wy };
    if (sp.wz !== undefined) pos.wz = sp.wz;
    return pos;
  }
  get predictionCorrection() {
    return this._predictor?.lastCorrection;
  }
  /** Mount entity ID from the latest server state (undefined when not riding). */
  get mountEntityId(): number | undefined {
    return this._mountEntityId;
  }
  /** Server tick rate in Hz (synced from sv_tickrate CVar). */
  get tickRate(): number {
    return this._tickRate;
  }

  /** Raw server entities (not replaced by predictor). Used for reconciliation. */
  get serverEntities(): readonly Entity[] {
    return this._entities;
  }

  /**
   * Tick sprite animations client-side. Called every client update tick.
   * Replicates the server's EntityManager animation logic (Phase 5 in its tick)
   * so that animTimer/frameCol stay correct without being serialized.
   */
  tickAnimations(dt: number): void {
    const dtMs = dt * 1000;
    for (const entity of this._entities) {
      const sprite = entity.sprite;
      if (sprite && sprite.frameCount > 1) {
        if (sprite.moving) {
          sprite.animTimer += dtMs;
          if (sprite.animTimer >= sprite.frameDuration) {
            sprite.animTimer -= sprite.frameDuration;
            sprite.frameCol = (sprite.frameCol + 1) % sprite.frameCount;
          }
        } else {
          sprite.frameCol = 0;
          sprite.animTimer = 0;
        }
      }
    }
  }
}
