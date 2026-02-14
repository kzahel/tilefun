import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { GameServer } from "../server/GameServer.js";
import type { GameStateMessage, RemoteEditorCursor } from "../shared/protocol.js";
import { applyChunkSnapshot, deserializeEntity, deserializeProp } from "../shared/serialization.js";
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
    if (this._pendingState && this._pendingState.chunkUpdates.length > 0) {
      // Merge: keep old chunk updates, let new ones override for same cx,cy
      const merged = new Map<string, (typeof msg.chunkUpdates)[0]>();
      for (const cu of this._pendingState.chunkUpdates) {
        merged.set(`${cu.cx},${cu.cy}`, cu);
      }
      for (const cu of msg.chunkUpdates) {
        merged.set(`${cu.cx},${cu.cy}`, cu);
      }
      msg = { ...msg, chunkUpdates: Array.from(merged.values()) };
    }
    this._pendingState = msg;
  }

  /** Apply any buffered game-state. Call at the start of each client update tick. */
  applyPending(): void {
    this._stateAppliedThisTick = false;
    if (!this._pendingState) return;
    this.applyGameState(this._pendingState);
    this._pendingState = null;
    this._stateAppliedThisTick = true;
  }

  /** Apply a full game-state message from the server. */
  applyGameState(msg: GameStateMessage): void {
    // Log state transitions that matter for debugging realm-switch movement bug
    if (msg.playerEntityId !== this._playerEntityId) {
      console.log(
        `[tilefun:rsv] playerEntityId changed: ${this._playerEntityId} → ${msg.playerEntityId}`,
      );
    }
    if (msg.editorEnabled !== this._editorEnabled) {
      console.log(
        `[tilefun:rsv] editorEnabled changed: ${this._editorEnabled} → ${msg.editorEnabled}`,
      );
    }

    // Save old positions for render interpolation (match by entity ID)
    const prevPositions = new Map<number, { wx: number; wy: number }>();
    for (const e of this._entities) {
      prevPositions.set(e.id, { wx: e.position.wx, wy: e.position.wy });
    }

    this._entities = msg.entities.map(deserializeEntity);
    this._props = msg.props.map(deserializeProp);

    // Restore prev positions onto new entities for interpolation
    for (const e of this._entities) {
      const prev = prevPositions.get(e.id);
      if (prev) e.prevPosition = prev;
    }
    this._playerEntityId = msg.playerEntityId;
    this._gemsCollected = msg.gemsCollected;
    this._invincibilityTimer = msg.invincibilityTimer;
    this._editorEnabled = msg.editorEnabled;
    this._remoteCursors = msg.editorCursors;
    this._playerNames = msg.playerNames;
    this._serverTick = msg.serverTick;
    this._lastProcessedInputSeq = msg.lastProcessedInputSeq;

    // Apply chunk updates (delta — only new/changed chunks)
    for (const cs of msg.chunkUpdates) {
      let chunk = this._world.chunks.get(cs.cx, cs.cy);
      if (!chunk) {
        chunk = this._world.chunks.getOrCreate(cs.cx, cs.cy);
      }
      applyChunkSnapshot(chunk, cs);
    }

    // Unload chunks the server no longer has loaded
    const loadedSet = new Set(msg.loadedChunkKeys);
    for (const [key] of this._world.chunks.entries()) {
      if (!loadedSet.has(key)) {
        this._world.chunks.remove(key);
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
    const playerId = this._playerEntityId;
    return this._entities.map((e) => (e.id === playerId ? predicted : e));
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
}
