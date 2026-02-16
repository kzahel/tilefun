import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import {
  setAccelerate,
  setAirAccelerate,
  setAirWishCap,
  setFriction,
  setGravityScale,
  setNoBunnyHop,
  setSmallJumps,
  setStopSpeed,
  setTimeScale,
} from "../physics/PlayerMovement.js";
import type { GameServer } from "../server/GameServer.js";
import type { GameStateMessage, RemoteEditorCursor } from "../shared/protocol.js";
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
  private _entities: Entity[] = [];
  private _props: Prop[] = [];
  private _playerEntityId = -1;
  private _gemsCollected = 0;
  private _invincibilityTimer = 0;
  private _editorEnabled = true;
  private _remoteCursors: RemoteEditorCursor[] = [];
  private _playerNames: Record<number, string> = {};
  private _pendingState: GameStateMessage | null = null;
  private _predictor: PlayerPredictor | null = null;
  private _stateAppliedThisTick = false;
  private _serverTick = 0;
  private _lastProcessedInputSeq = 0;
  private _mountEntityId: number | undefined = undefined;

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
   * Buffer a game-state message for deferred application.
   * Call applyPending() during the client update tick to apply it,
   * ensuring entity and camera updates are synchronized.
   *
   * If a previous game-state is still pending, its chunk updates are
   * merged into the new message so delta chunk data is never lost
   * (the server's revision tracking considers them sent).
   */
  bufferGameState(msg: GameStateMessage): void {
    if (this._pendingState) {
      // Merge delta fields: { ...old, ...new } preserves old values for fields
      // absent in the new message (undefined-valued keys aren't own properties
      // after JSON round-trip, so spread won't overwrite with undefined).
      const merged = { ...this._pendingState, ...msg };

      // Special merge for chunkUpdates: append, don't replace
      const oldChunks = this._pendingState.chunkUpdates;
      if (oldChunks?.length) {
        const chunkMap = new Map<string, (typeof oldChunks)[0]>();
        for (const cu of oldChunks) chunkMap.set(`${cu.cx},${cu.cy}`, cu);
        if (msg.chunkUpdates) {
          for (const cu of msg.chunkUpdates) chunkMap.set(`${cu.cx},${cu.cy}`, cu);
        }
        merged.chunkUpdates = Array.from(chunkMap.values());
      }

      this._pendingState = merged;
    } else {
      this._pendingState = msg;
    }
  }

  /** Apply any buffered game-state. Call at the start of each client update tick. */
  applyPending(): void {
    this._stateAppliedThisTick = false;
    if (!this._pendingState) return;
    this.applyGameState(this._pendingState);
    this._pendingState = null;
    this._stateAppliedThisTick = true;
  }

  /** Apply a game-state message from the server (delta-aware: absent fields = unchanged). */
  applyGameState(msg: GameStateMessage): void {
    // Log state transitions that matter for debugging realm-switch movement bug
    if (msg.playerEntityId !== this._playerEntityId) {
      console.log(
        `[tilefun:rsv] playerEntityId changed: ${this._playerEntityId} → ${msg.playerEntityId}`,
      );
    }
    if (msg.editorEnabled !== undefined && msg.editorEnabled !== this._editorEnabled) {
      console.log(
        `[tilefun:rsv] editorEnabled changed: ${this._editorEnabled} → ${msg.editorEnabled}`,
      );
    }

    // Save old state for render interpolation (match by entity ID)
    const prevState = new Map<number, { wx: number; wy: number; jumpZ: number; wz: number }>();
    for (const e of this._entities) {
      prevState.set(e.id, {
        wx: e.position.wx,
        wy: e.position.wy,
        jumpZ: e.jumpZ ?? 0,
        wz: e.wz ?? 0,
      });
    }

    // Always-present fields
    this._entities = msg.entities.map(deserializeEntity);
    this._playerEntityId = msg.playerEntityId;
    this._serverTick = msg.serverTick;
    this._lastProcessedInputSeq = msg.lastProcessedInputSeq;

    // Restore prev state onto new entities for interpolation
    for (const e of this._entities) {
      const prev = prevState.get(e.id);
      if (prev) {
        e.prevPosition = { wx: prev.wx, wy: prev.wy };
        e.prevJumpZ = prev.jumpZ;
        e.prevWz = prev.wz;
      }
    }

    // Delta fields — only update when present (absent = unchanged)
    if (msg.props !== undefined) this._props = msg.props.map(deserializeProp);
    if (msg.gemsCollected !== undefined) this._gemsCollected = msg.gemsCollected;
    if (msg.invincibilityTimer !== undefined) this._invincibilityTimer = msg.invincibilityTimer;
    if (msg.editorEnabled !== undefined) this._editorEnabled = msg.editorEnabled;
    if (msg.editorCursors !== undefined) this._remoteCursors = msg.editorCursors;
    if (msg.playerNames !== undefined) this._playerNames = msg.playerNames;
    if (msg.mountEntityId !== undefined) this._mountEntityId = msg.mountEntityId ?? undefined;

    // Sync server physics CVars so client prediction matches server movement.
    if (msg.cvars !== undefined) {
      setGravityScale(msg.cvars.gravity);
      setFriction(msg.cvars.friction);
      setAccelerate(msg.cvars.accelerate);
      setAirAccelerate(msg.cvars.airAccelerate);
      setAirWishCap(msg.cvars.airWishCap);
      setStopSpeed(msg.cvars.stopSpeed);
      setNoBunnyHop(msg.cvars.noBunnyHop);
      setSmallJumps(msg.cvars.smallJumps);
      setTimeScale(msg.cvars.timeScale);
    }

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

  /** Clear all cached state (e.g., when switching worlds). */
  clear(): void {
    console.log(
      `[tilefun:rsv] clear() — playerEntityId=${this._playerEntityId}, pendingState=${!!this._pendingState}, predictor=${!!this._predictor?.player}, editorEnabled=${this._editorEnabled}, chunks=${this._world.chunks.loadedCount}`,
    );
    this._entities = [];
    this._props = [];
    this._playerEntityId = -1;
    this._gemsCollected = 0;
    this._invincibilityTimer = 0;
    this._remoteCursors = [];
    this._playerNames = {};
    this._pendingState = null; // Fix: clear stale pending state from old realm
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

  /** Raw server entities (not replaced by predictor). Used for reconciliation. */
  get serverEntities(): readonly Entity[] {
    return this._entities;
  }
}
