import { TICK_RATE } from "../config/constants.js";
import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import { setSpriteClipElapsed, tickSpriteAnimation } from "../entities/spriteAnimation.js";
import { getGravityScale, setGravityScale } from "../physics/Gravity.js";
import type { CameraPresentationTime } from "../rendering/CameraFollow.js";
import { applyEntityDelta } from "../shared/entityDelta.js";
import type {
  BufferedMessage,
  FrameMessage,
  RemoteEditorCursor,
  SyncChunksMessage,
  SyncCVarsMessage,
  SyncEditorCursorsMessage,
  SyncInvincibilityMessage,
  SyncPlayerNamesMessage,
  SyncPropsMessage,
  SyncSessionMessage,
} from "../shared/protocol.js";
import { applyChunkSnapshot, deserializeEntity, deserializeProp } from "../shared/serialization.js";
import { Chunk } from "../world/Chunk.js";
import type { World } from "../world/World.js";
import type { PlayerPredictor, ReconcileDiagnostics } from "./PlayerPredictor.js";
import { RemotePresentation } from "./RemotePresentation.js";
import { type BufferedSeatSync, type SeatSyncMessage, StreamSeats } from "./StreamSeats.js";

export interface ClientStateView {
  readonly roomState?: import("../interiors/GameplayRoom.js").GameplayRoomState | null;
  readonly interior?: import("../interiors/GameplayInterior.js").InteriorIdentity | null;
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
  /** Raw server player position (before client prediction). */
  readonly serverPlayerPosition?: { wx: number; wy: number; wz?: number } | undefined;
  /** Last reconciliation correction (predicted - server, before replay). */
  readonly predictionCorrection?:
    | { wx: number; wy: number; wz: number; vx: number; vy: number; jumpVZ: number }
    | undefined;
  /** Last detailed reconciliation sample. */
  readonly predictionDiagnostics?: ReconcileDiagnostics | undefined;
  /** Rolling reconcile stats for debug overlay. */
  readonly reconcileStats?: ReconcileStats | undefined;
}

interface ReconcileStats {
  samples: number;
  notable: number;
  avgPosErr: number;
  maxPosErr: number;
  threshold: number;
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
 * Client state view: maintains a local copy of game state,
 * updated from ServerMessage broadcasts. All data has gone through
 * JSON serialization — no shared object references with the server.
 */
export class RemoteStateView implements ClientStateView {
  roomState: import("../interiors/GameplayRoom.js").GameplayRoomState | null = null;
  interior: import("../interiors/GameplayInterior.js").InteriorIdentity | null = null;
  private _world: World;
  private _entityMap: Map<number, Entity> = new Map();
  private authoritativeClipPhases = new Map<number, number>();
  private _entities: Entity[] = [];
  private _props: Prop[] = [];
  private _playerEntityId = -1;
  private _gemsCollected = 0;
  private _invincibilityTimer = 0;
  private _invincibilityStartTick = -1;
  private _invincibilityDurationTicks = 0;
  private _invincibilityTickRate = TICK_RATE;
  private _editorEnabled = true;
  private _remoteCursors: RemoteEditorCursor[] = [];
  private _playerNames: Record<number, string> = {};
  private _pendingStates: (BufferedMessage | BufferedSeatSync)[] = [];
  private _predictor: PlayerPredictor | null = null;
  private _stateAppliedThisTick = false;
  private _serverTick = 0;
  private _simulationTime: number | undefined;
  private _physicsState: import("../physics/PhysicsState.js").PhysicsState | undefined;
  get physicsState() {
    return this._physicsState;
  }
  private _lastProcessedInputSeq = 0;
  private _mountEntityId: number | undefined = undefined;
  private _reconcileStats: ReconcileStats | undefined;
  /** The seats the stream carries and each guest's own session sync (226). */
  readonly seats = new StreamSeats();
  private presentation = new RemotePresentation();
  private presentedEntities: Entity[] | null = null;
  cameraPresentation: CameraPresentationTime = { time: 0, domain: "remote" };

  /** Borrow display-only poses during render; end before simulation/input work. */
  beginPresentation(now: number, alpha: number, paused = false): void {
    this.cameraPresentation = this._predictor?.presentationClock(now) ?? {
      time: now,
      domain: "remote",
    };
    const entities = this.presentation.sample(this._entities, now, paused);
    this.presentedEntities = this._predictor?.presentEntities(alpha, entities) ?? entities;
  }
  endPresentation(): void {
    this.presentedEntities = null;
  }
  resetPresentationClock(resetAnimations = false): void {
    this.presentation.resetClock();
    // Local animation ticks may lead the last authority snapshot. An explicit
    // authority clock fence must freeze at that snapshot, just like position.
    if (resetAnimations)
      for (const [id, phase] of this.authoritativeClipPhases) {
        const entity = this._entityMap.get(id);
        if (entity) setSpriteClipElapsed(entity, phase);
      }
  }

  constructor(world: World) {
    this._world = world;
  }

  /** Attach a predictor so that playerEntity and entities use predicted position. */
  setPredictor(predictor: PlayerPredictor | null): void {
    if (this._predictor !== predictor) this._predictor?.clearPredicted();
    this._predictor = predictor;
  }

  /** Whether client prediction currently has an active player entity. */
  get hasPredictedPlayer(): boolean {
    return !!this._predictor?.player;
  }

  /** Whether new server state was applied during the most recent applyPending() call. */
  get stateAppliedThisTick(): boolean {
    return this._stateAppliedThisTick;
  }

  /** Server tick number from the latest game state. */
  get gravityScale() {
    return getGravityScale();
  }

  get simulationTime(): number | undefined {
    return this._simulationTime;
  }

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

  /** Buffer a guest seat's own session sync, applied in order with the stream (226). */
  bufferSeatSync(seat: number, message: SeatSyncMessage): void {
    this._pendingStates.push({ type: "seat", seat, message });
  }

  /** Apply any buffered messages. Call at the start of each client update tick. */
  get pendingMessageCount(): number {
    return this._pendingStates.length;
  }

  applyPending(): void {
    this._stateAppliedThisTick = false;
    if (this._pendingStates.length === 0) return;
    const until = performance.now() + 2;
    let applied = 0;
    for (const msg of this._pendingStates) {
      const timing = performanceMetrics.start();
      this.applyMessage(msg);
      performanceMetrics.end("client.apply", timing);
      applied++;
      if (applied >= 64 || performance.now() >= until) break;
    }
    this._pendingStates.splice(0, applied);
    this._stateAppliedThisTick = true;
  }

  /** Dispatch a buffered message to the appropriate handler. */
  applyMessage(msg: BufferedMessage | BufferedSeatSync): void {
    switch (msg.type) {
      case "seat":
        this.seats.apply(msg.seat, msg.message);
        break;
      case "frame":
        this.applyFrame(msg);
        break;
      case "sync-room":
        this.roomState = msg.room;
        break;
      case "sync-session":
        this.applySyncSession(msg);
        break;
      case "sync-invincibility":
        this.applySyncInvincibility(msg);
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
  applyFrame(msg: FrameMessage, receivedAt = performance.now() / 1000): void {
    if (
      this._physicsState &&
      msg.physics &&
      (msg.physics.epoch < this._physicsState.epoch ||
        (msg.physics.epoch === this._physicsState.epoch && msg.serverTick < this._serverTick))
    )
      return;

    // Log state transitions that matter for debugging realm-switch movement bug
    if (msg.playerEntityId !== this._playerEntityId) {
      console.log(
        `[tilefun:rsv] playerEntityId changed: ${this._playerEntityId} → ${msg.playerEntityId}`,
      );
    }

    // Always-present fields
    this._playerEntityId = msg.playerEntityId;
    this.seats.frame(msg);
    this._serverTick = msg.serverTick;
    this._simulationTime = msg.simulationTime;
    this._physicsState = msg.physics;
    this._lastProcessedInputSeq = msg.lastProcessedInputSeq;
    this.updateInvincibilityTimer();

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
        this.authoritativeClipPhases.delete(id);
      }
    }

    // Process baselines — new entities (full snapshots)
    if (msg.entityBaselines) {
      for (const snapshot of msg.entityBaselines) {
        const entity = deserializeEntity(snapshot);
        // New entity — no prev position for interpolation
        this._entityMap.set(entity.id, entity);
        const phase = snapshot.spriteState?.clipElapsedMs;
        if (phase === undefined) this.authoritativeClipPhases.delete(entity.id);
        else this.authoritativeClipPhases.set(entity.id, phase);
      }
    }

    // Process deltas — update changed fields on existing entities
    if (msg.entityDeltas) {
      for (const delta of msg.entityDeltas) {
        const entity = this._entityMap.get(delta.id);
        if (entity) {
          applyEntityDelta(entity, delta);
          if (delta.spriteState !== undefined) {
            const phase = delta.spriteState?.clipElapsedMs;
            if (phase === undefined) this.authoritativeClipPhases.delete(entity.id);
            else this.authoritativeClipPhases.set(entity.id, phase);
          }
        }
      }
    }

    // Rebuild flat entity array from map
    this._entities = Array.from(this._entityMap.values());
    this.presentation.record(
      this._entities,
      msg.simulationTime ?? (msg.serverTick * (1000 / TICK_RATE)) / 1000,
      receivedAt,
    );
  }

  /** Apply session sync (gems, editor, mount). */
  private applySyncSession(msg: SyncSessionMessage): void {
    if (msg.editorEnabled !== this._editorEnabled) {
      console.log(
        `[tilefun:rsv] editorEnabled changed: ${this._editorEnabled} → ${msg.editorEnabled}`,
      );
    }
    this._gemsCollected = msg.gemsCollected;
    this._editorEnabled = msg.editorEnabled;
    this._mountEntityId = msg.mountEntityId ?? undefined;
  }

  /** Apply invincibility start/reset event and reconstruct countdown locally. */
  private applySyncInvincibility(msg: SyncInvincibilityMessage): void {
    this._invincibilityStartTick = msg.startTick;
    this._invincibilityDurationTicks = msg.durationTicks;
    this._invincibilityTickRate = TICK_RATE;
    this.updateInvincibilityTimer();
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
    this.presentation.clear();
    this.endPresentation();
    this.roomState = null;
    console.log(
      `[tilefun:rsv] clear() — playerEntityId=${this._playerEntityId}, pendingStates=${this._pendingStates.length}, predictor=${!!this._predictor?.player}, editorEnabled=${this._editorEnabled}, chunks=${this._world.chunks.loadedCount}`,
    );
    this._entityMap.clear();
    this.authoritativeClipPhases.clear();
    this._simulationTime = undefined;
    this._physicsState = undefined;
    this._entities = [];
    this._props = [];
    this._playerEntityId = -1;
    this.seats.clear();
    this._gemsCollected = 0;
    this._invincibilityTimer = 0;
    this._invincibilityStartTick = -1;
    this._invincibilityDurationTicks = 0;
    this._invincibilityTickRate = TICK_RATE;
    this._remoteCursors = [];
    this._playerNames = {};
    this._pendingStates.length = 0; // Fix: clear stale pending state from old realm
    this._predictor?.clearPredicted();
    this._reconcileStats = undefined;
    // Clear all loaded chunks
    for (const [key] of this._world.chunks.entries()) {
      this._world.chunks.remove(key);
    }
  }

  get world(): World {
    return this._world;
  }
  get entities(): readonly Entity[] {
    if (this.presentedEntities) return this.presentedEntities;
    const predictor = this._predictor;
    if (!predictor?.player) return this._entities;
    const predicted = predictor.presentationPlayer ?? predictor.player;
    const predictedMount = predictor.mount;
    const playerId = this._playerEntityId;
    const mountId = predictedMount?.id ?? -1;
    return this._entities.map((e) => {
      if (e.id === playerId) return predicted;
      if (e.id === mountId && predictedMount) {
        predictedMount.prevPosition = predictor.mountPrevPosition;
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

  /** Display pose for cameras/overlays. playerEntity always stays on physics. */
  get presentedPlayerEntity(): Entity {
    return (
      this.presentedEntities?.find((e) => e.id === this._playerEntityId) ??
      this._predictor?.presentationPlayer ??
      this.playerEntity
    );
  }
  get gemsCollected(): number {
    return this._gemsCollected;
  }
  get invincibilityTimer(): number {
    return this._invincibilityTimer;
  }

  private updateInvincibilityTimer(): void {
    if (this._invincibilityDurationTicks <= 0 || this._invincibilityStartTick < 0) {
      this._invincibilityTimer = 0;
      return;
    }
    const elapsedTicks = Math.max(0, this._serverTick - this._invincibilityStartTick);
    const remainingTicks = this._invincibilityDurationTicks - elapsedTicks;
    if (remainingTicks <= 0) {
      this._invincibilityTimer = 0;
      this._invincibilityDurationTicks = 0;
      this._invincibilityStartTick = -1;
      return;
    }
    this._invincibilityTimer = remainingTicks / this._invincibilityTickRate;
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
  get predictionDiagnostics(): ReconcileDiagnostics | undefined {
    return this._predictor?.lastReconcileDiagnostics ?? undefined;
  }
  get reconcileStats() {
    return this._reconcileStats;
  }
  setReconcileStats(stats: ReconcileStats): void {
    this._reconcileStats = stats;
  }
  /** Mount entity ID from the latest server state (undefined when not riding). */
  get mountEntityId(): number | undefined {
    return this._mountEntityId;
  }
  /** Server tick rate in Hz (fixed by the shared physics clock). */
  get tickRate(): number {
    return TICK_RATE;
  }
  /** Server command tick interval in ms (fixed by the shared physics clock). */
  get tickMs(): number {
    return 1000 / TICK_RATE;
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
    for (const entity of this._entities) tickSpriteAnimation(entity, dt);
  }
}
