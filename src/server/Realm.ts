import { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import {
  CHUNK_SIZE_PX,
  JUMP_VELOCITY,
  MAX_AUTOTILE_CHUNKS_PER_UPDATE,
  MAX_CHUNK_LOADS_PER_UPDATE,
  THROW_ANGLE,
  THROW_MAX_SPEED,
  THROW_MIN_SPEED,
  TICK_RATE,
  TILE_SIZE,
} from "../config/constants.js";
import { TerrainEditor } from "../editor/TerrainEditor.js";
import { BaddieSpawner } from "../entities/BaddieSpawner.js";
import { createBall } from "../entities/Ball.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import type { ColliderComponent, Entity } from "../entities/Entity.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { EntityManager } from "../entities/EntityManager.js";
import { findWalkableSpawn, spawnInitialChickens } from "../entities/EntitySpawner.js";
import { FishSpawner } from "../entities/FishSpawner.js";
import { GemSpawner } from "../entities/GemSpawner.js";
import { createPlayer } from "../entities/Player.js";
import { createProp, isPropType } from "../entities/PropFactories.js";
import { PropManager } from "../entities/PropManager.js";
import { TentSpawner } from "../entities/TentSpawner.js";
import { descriptorFromMetadata } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { ProceduralActors } from "../generation/ProceduralActors.js";
import { ProceduralProps } from "../generation/ProceduralProps.js";
import { regionalStart } from "../generation/regional/RegionalSpawn.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import type { TerrainStrategy } from "../generation/TerrainStrategy.js";
import {
  furnitureAsset,
  INTERIOR_ENTRY,
  INTERIOR_WALL_TYPE,
  type InteriorIdentity,
  interiorGenerator,
} from "../interiors/GameplayInterior.js";
import {
  compileGameplayRoom,
  GameplayRoomEditor,
  type GameplayRoomState,
  initialRoom,
  parseGameplayRoom,
  validateRoomOccupancy,
} from "../interiors/GameplayRoom.js";
import { TreeBrushEditor } from "../patterns/TreeBrushEditor.js";
import type { IWorldRegistry } from "../persistence/IWorldRegistry.js";
import type { PersistenceStore } from "../persistence/PersistenceStore.js";
import type { SavedMeta, SavedPlayerData } from "../persistence/SaveManager.js";
import { SaveManager } from "../persistence/SaveManager.js";
import type { WorldMeta } from "../persistence/WorldRegistry.js";
import { tickBallPhysics } from "../physics/BallPhysics.js";
import {
  applyFriction,
  getMovementPhysicsParams,
  initiateJump,
  MAX_INPUT_STEP_SECONDS,
  type PlayerStepOutcome,
  splitInputStepDurations,
  stepMountFromInput,
  stepPlayerFromInput,
  tickJumpGravity,
} from "../physics/PlayerMovement.js";
import { createMovementContext, createSurfaceSampler } from "../physics/SimulationEnvironment.js";
import { getSurfaceProperties } from "../physics/SurfaceFriction.js";
import { getSurfaceZ } from "../physics/surfaceHeight.js";
import type { ClientMessage } from "../shared/protocol.js";
import type { IServerTransport } from "../transport/Transport.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { World } from "../world/World.js";
import type { PlayerSession } from "./PlayerSession.js";
import { RealmReplicator } from "./RealmReplicator.js";
import { tickAllAI } from "./tickAllAI.js";
import type { Mod, Unsubscribe } from "./WorldAPI.js";
import { WorldAPIImpl } from "./WorldAPI.js";

function mergePlayerStepOutcomes(
  previous: PlayerStepOutcome,
  next: PlayerStepOutcome,
): PlayerStepOutcome {
  return {
    landed: previous.landed || next.landed,
    groundZ: next.groundZ,
    enteredWater: previous.enteredWater || next.enteredWater,
    endedGrounded: next.endedGrounded,
  };
}

/**
 * A Realm encapsulates all per-world server state:
 * World, EntityManager, PropManager, WorldAPI, persistence, spawners, etc.
 *
 * GameServer coordinates active realms; RealmReplicator owns their client baselines.
 */
export class Realm {
  world: World;
  entityManager: EntityManager;
  propManager: PropManager;
  treeBrush: TreeBrushEditor;
  worldAPI: WorldAPIImpl;
  readonly blendGraph: BlendGraph;

  private adjacency: TerrainAdjacency;
  terrainEditor: TerrainEditor;
  saveManager: SaveManager | null = null;
  private gemSpawner = new GemSpawner();
  private baddieSpawner = new BaddieSpawner();
  private fishSpawner = new FishSpawner();
  private tentSpawner = new TentSpawner();

  private generator = createGenerator(descriptorFromMetadata());
  get generation() {
    return this.generator.descriptor;
  }
  /** Tracks processed road intersections/segments for structure generation. */
  private processedStructureKeys = new Set<string>();
  private proceduralActors!: ProceduralActors;
  private proceduralProps: ProceduralProps;

  /** Sessions currently in this realm. */
  readonly sessions = new Map<string, PlayerSession>();
  /** Per-client delta tracking for bandwidth optimization. */
  private readonly replication = new RealmReplicator();
  /** Monotonic tick counter. */
  private tickCounter = 0;
  /** Bumped when sessions join/leave (affects playerNames). */
  private playerNamesRevision = 0;
  /** Bumped when any session's editor cursor or editor mode changes. */
  private editorCursorsRevision = 0;

  lastLoadedGems = 0;
  lastLoadedCamera = { cameraX: 0, cameraY: 0, cameraZoom: 1 };
  lastLoadedPlayerPos = { wx: 0, wy: 0 };
  currentWorldId: string | null = null;
  interior: InteriorIdentity | null = null;
  roomEditor: GameplayRoomEditor | null = null;
  private roomGeometry: ReturnType<typeof compileGameplayRoom> | null = null;
  get roomState() {
    return this.roomEditor?.state ?? null;
  }

  private installRoom(state: GameplayRoomState): void {
    if (!this.interior) throw new Error("Room editing requires an interior");
    const room = compileGameplayRoom(this.interior, state);
    validateRoomOccupancy(
      room,
      this.propManager.props,
      [...this.sessions.values()].map((s) => s.player),
    );
    const old = this.propManager.props.find((p) => p.type === INTERIOR_WALL_TYPE);
    if (old) this.propManager.remove(old.id, false);
    const wall = createProp(INTERIOR_WALL_TYPE, 0, 0);
    wall.walls = room.walls;
    wall.proceduralId = "interior:boundary";
    this.propManager.add(wall);
    this.roomGeometry = room;
    this.saveManager?.markMetaDirty();
  }

  /**
   * Timestamp (Date.now()) when the last player left this realm, or null if
   * the realm still has players. Used for idle-timeout unloading.
   */
  idleSince: number | null = null;

  /** Server tick rate in Hz (set by GameServer from sv_tickrate CVar). */
  tickRate = TICK_RATE;
  /** Physics substeps per command tick. */
  physicsMult = 1;

  private readonly mods: Mod[];
  private modTeardowns = new Map<string, Unsubscribe>();

  private static readonly BROADCAST_BUFFER_CHUNKS = 2;
  private static readonly MID_TICK_BUFFER = 6;
  private static readonly MID_TICK_FRAMES = 4;

  constructor(mods: Mod[]) {
    this.mods = mods;
    this.world = new World();
    this.entityManager = new EntityManager();
    this.propManager = new PropManager();
    this.treeBrush = new TreeBrushEditor(this.propManager, () => this.saveManager?.markMetaDirty());
    this.proceduralProps = new ProceduralProps(this.propManager, () =>
      this.saveManager?.markMetaDirty(),
    );
    this.proceduralActors = new ProceduralActors(
      this.entityManager,
      this.proceduralProps.deleted,
      () => this.saveManager?.markMetaDirty(),
    );
    this.blendGraph = new BlendGraph();
    this.adjacency = new TerrainAdjacency(this.blendGraph);
    this.terrainEditor = new TerrainEditor(this.world, () => {}, this.adjacency);
    this.worldAPI = this.createWorldAPI();
    this.registerMods();
  }

  /** Get the first player session (for single-player commands). */
  getFirstSession(): PlayerSession | undefined {
    return this.sessions.values().next().value;
  }

  /** Clear per-client delta tracking (forces full re-send). */
  clearClientRevisions(clientId: string): void {
    this.replication.clearClient(clientId);
  }

  /**
   * Add a player to this realm: create player entity, set up session state,
   * add to realm sessions map. Loads per-player data if available.
   */
  async preparePlayer(session: PlayerSession): Promise<SavedPlayerData | null> {
    const persistId = session.profileId || session.clientId;
    return this.saveManager ? this.saveManager.loadPlayerData(persistId) : null;
  }

  async addPlayer(session: PlayerSession, prepared?: SavedPlayerData | null): Promise<void> {
    // Evict any existing session in this realm with the same profileId (race-condition safety net)
    if (session.profileId) {
      for (const [otherId, other] of this.sessions) {
        if (otherId !== session.clientId && other.profileId === session.profileId) {
          console.log(
            `[tilefun:realm] evicting duplicate profileId=${session.profileId} old=${otherId} new=${session.clientId}`,
          );
          this.removePlayer(otherId);
          break;
        }
      }
    }

    // Try to load per-player saved data (prefer stable profileId over session clientId)
    const saved =
      prepared === undefined
        ? this.saveManager
          ? await this.preparePlayer(session)
          : null
        : prepared;

    if (this.interior) session.returnLocation = saved?.returnLocation ?? session.returnLocation;
    const spawnX = saved?.x ?? this.lastLoadedPlayerPos.wx;
    const spawnY = saved?.y ?? this.lastLoadedPlayerPos.wy;
    const gems = saved?.gemsCollected ?? this.lastLoadedGems;
    const camX = saved?.cameraX ?? this.lastLoadedCamera.cameraX;
    const camY = saved?.cameraY ?? this.lastLoadedCamera.cameraY;
    const camZoom = saved?.cameraZoom ?? this.lastLoadedCamera.cameraZoom;

    const player = createPlayer(spawnX, spawnY);
    this.entityManager.spawn(player);

    session.player = player;
    session.gameplaySession = {
      player,
      gemsCollected: gems,
      invincibilityTimer: 0,
      knockbackVx: 0,
      knockbackVy: 0,
      mountId: null,
      lastDismountedId: null,
      lastSafePosition: { wx: spawnX, wy: spawnY },
    };
    session.cameraX = camX;
    session.cameraY = camY;
    session.cameraZoom = camZoom;
    session.realmId = this.currentWorldId;

    // Seed a reasonable initial visible range near the camera
    const camCx = Math.floor(camX / CHUNK_SIZE_PX);
    const camCy = Math.floor(camY / CHUNK_SIZE_PX);
    session.visibleRange = {
      minCx: camCx - 3,
      minCy: camCy - 3,
      maxCx: camCx + 3,
      maxCy: camCy + 3,
    };

    this.sessions.set(session.clientId, session);
    this.clearClientRevisions(session.clientId);
    this.playerNamesRevision++;

    console.log(
      `[tilefun:realm] addPlayer client=${session.clientId} player.id=${player.id} editorEnabled=${session.editorEnabled} inputQueue=${session.inputQueue.length} worldId=${this.currentWorldId}`,
    );

    // Cancel idle timeout — realm is occupied again
    this.idleSince = null;
  }

  /**
   * Remove a player from this realm: save per-player data, remove entity,
   * clean up session state.
   * The session object itself is NOT deleted — it stays in GameServer's global map.
   */
  removePlayer(clientId: string): void {
    this.treeBrush.forget(clientId);
    this.roomEditor?.forget(clientId);
    const session = this.sessions.get(clientId);
    if (!session) return;

    // Auto-dismount before removing player
    if (session.gameplaySession.mountId !== null) {
      this.dismountPlayer(session);
    }

    // Preserve a fallback arrival even when the last player leaves this realm.
    this.lastLoadedPlayerPos = { ...session.player.position };
    this.lastLoadedCamera = {
      cameraX: session.cameraX,
      cameraY: session.cameraY,
      cameraZoom: session.cameraZoom,
    };
    this.lastLoadedGems = session.gameplaySession.gemsCollected;
    // Persist per-player data before removing
    this.savePlayerData(session);

    this.entityManager.remove(session.player.id);
    this.sessions.delete(clientId);
    this.clearClientRevisions(clientId);
    this.playerNamesRevision++;
    session.realmId = null;

    // Start idle timeout if this was the last player
    if (this.sessions.size === 0) {
      this.idleSince = Date.now();
    }
  }

  /** Reattach the original live player after an aborted transfer, preserving its entity ID. */
  restorePlayer(session: PlayerSession): void {
    this.entityManager.restore(session.player);
    this.sessions.set(session.clientId, session);
    this.clearClientRevisions(session.clientId);
    this.playerNamesRevision++;
    this.idleSince = null;
    this.savePlayerData(session);
  }

  /** Mark per-player data dirty so it gets persisted on next save tick. */
  savePlayerData(session: PlayerSession): void {
    if (!this.saveManager) return;
    const persistId = session.profileId || session.clientId;
    this.saveManager.markPlayerDirty(persistId, {
      ...(this.interior ? { returnLocation: session.returnLocation } : {}),
      gemsCollected: session.gameplaySession.gemsCollected,
      x: session.player.position.wx,
      y: session.player.position.wy,
      cameraX: session.cameraX,
      cameraY: session.cameraY,
      cameraZoom: session.cameraZoom,
    });
  }

  /** Close persistence if the given worldId matches the currently loaded world. */
  closePersistenceIfCurrent(worldId: string): void {
    if (worldId === this.currentWorldId && this.saveManager) {
      this.saveManager.flush();
      this.saveManager.close();
      this.saveManager = null;
    }
  }

  /** Run one simulation tick. */
  tick(
    dt: number,
    transport: IServerTransport,
    broadcasting: boolean,
    dormantClientIds: ReadonlySet<string>,
  ): void {
    this.tickCounter++;
    const movementPhysics = getMovementPhysicsParams();
    const preSteppedEntityIds = new Set<number>();

    // ── Phase 1: Process player inputs (per-session) ──
    // Drain each session's input queue and run full per-input simulation steps.
    // Entities stepped here are skipped in Phase 2 to avoid double simulation.
    for (const session of this.sessions.values()) {
      if (dormantClientIds.has(session.clientId)) continue;

      // ── Mount bookkeeping: auto-dismount if mount entity was removed ──
      if (session.gameplaySession.mountId !== null) {
        const mount = this.entityManager.entities.find(
          (e) => e.id === session.gameplaySession.mountId,
        );
        if (!mount) this.dismountPlayer(session);
      }

      if (!session.editorEnabled && session.inputQueue.length > 0) {
        const inputs = session.inputQueue;
        session.inputQueue = [];

        const getCollision = (tx: number, ty: number) => this.world.getCollisionIfLoaded(tx, ty);
        const getHeight = (tx: number, ty: number) => this.world.getHeightAt(tx, ty);
        const getTerrainAt = (tx: number, ty: number) => this.world.getBlendBaseAt(tx, ty);
        const getRoadAt = (tx: number, ty: number) => this.world.getRoadAt(tx, ty);
        const queryProps = (aabb: { left: number; top: number; right: number; bottom: number }) =>
          this.propManager.getPropsInChunkRange(
            Math.floor(aabb.left / CHUNK_SIZE_PX),
            Math.floor(aabb.top / CHUNK_SIZE_PX),
            Math.floor(aabb.right / CHUNK_SIZE_PX),
            Math.floor(aabb.bottom / CHUNK_SIZE_PX),
          );
        const queryEntities = (aabb: {
          left: number;
          top: number;
          right: number;
          bottom: number;
        }) =>
          this.entityManager.spatialHash.queryRange(
            Math.floor(aabb.left / CHUNK_SIZE_PX),
            Math.floor(aabb.top / CHUNK_SIZE_PX),
            Math.floor(aabb.right / CHUNK_SIZE_PX),
            Math.floor(aabb.bottom / CHUNK_SIZE_PX),
          );
        const sampleSurfaces = createSurfaceSampler({ queryProps, queryEntities });

        for (const input of inputs) {
          const inputDt = this.resolveInputStepDt(input.dtMs, dt);
          const stepDts = splitInputStepDurations(inputDt, MAX_INPUT_STEP_SECONDS);
          if (stepDts.length === 0) {
            session.lastProcessedInputSeq = input.seq;
            continue;
          }
          const mount =
            session.gameplaySession.mountId !== null
              ? (this.entityManager.entities.find(
                  (e) => e.id === session.gameplaySession.mountId,
                ) ?? null)
              : null;

          if (mount) {
            // Riding: first jump press dismounts (held jump won't retrigger until release).
            const jumpPressed = input.jumpPressed === true;
            if ((jumpPressed || input.jump) && !session.jumpConsumed) {
              this.dismountPlayer(session);
              session.jumpConsumed = true;
            } else {
              if (!input.jump) session.jumpConsumed = false;
              const mountExclude = new Set([session.player.id, mount.id]);
              const mountCtx = createMovementContext({
                getCollision,
                getHeight,
                getTerrainAt,
                getRoadAt,
                queryEntities,
                queryProps,
                movingEntity: mount,
                excludeIds: mountExclude,
                noclip: session.debugNoclip,
              });
              for (const stepDt of stepDts) {
                stepMountFromInput(
                  mount,
                  input,
                  stepDt,
                  mountCtx,
                  getHeight,
                  sampleSurfaces,
                  session.player,
                  this.physicsMult,
                );
              }
              // Position is derived from the mount when parented.
              if (session.player.velocity) {
                session.player.velocity.vx = 0;
                session.player.velocity.vy = 0;
              }
              this.updateLastSafePosition(session);
              preSteppedEntityIds.add(mount.id);
              preSteppedEntityIds.add(session.player.id);
            }
            session.lastJumpHeld = input.jump;
            session.lastProcessedInputSeq = input.seq;
            continue;
          }

          const playerExclude = new Set([session.player.id]);
          const playerCtx = createMovementContext({
            getCollision,
            getHeight,
            getTerrainAt,
            getRoadAt,
            queryEntities,
            queryProps,
            movingEntity: session.player,
            excludeIds: playerExclude,
            noclip: session.debugNoclip,
          });
          let nextState = {
            jumpConsumed: session.jumpConsumed,
            lastJumpHeld: session.lastJumpHeld,
          };
          let playerStepOutcome: PlayerStepOutcome = {
            landed: false,
            groundZ: session.player.groundZ ?? session.player.wz ?? 0,
            enteredWater: this.isEntityOnWater(session.player),
            endedGrounded: session.player.jumpVZ === undefined,
          };
          const heldInput =
            input.jumpPressed === undefined ? input : { ...input, jumpPressed: false };
          for (let i = 0; i < stepDts.length; i++) {
            const stepResult = stepPlayerFromInput(
              session.player,
              i === 0 ? input : heldInput,
              stepDts[i]!,
              playerCtx,
              getHeight,
              sampleSurfaces,
              nextState,
              movementPhysics,
              this.physicsMult,
            );
            nextState = stepResult.jumpState;
            playerStepOutcome = mergePlayerStepOutcomes(playerStepOutcome, stepResult.outcome);
          }
          session.jumpConsumed = nextState.jumpConsumed;
          session.lastJumpHeld = nextState.lastJumpHeld;
          this.updateLastSafePosition(session);
          this.handlePlayerStepOutcome(session, playerStepOutcome, getHeight, movementPhysics);
          preSteppedEntityIds.add(session.player.id);
          session.lastProcessedInputSeq = input.seq;
        }
      } else if (!session.editorEnabled && session.player.velocity) {
        // No input this tick (timing jitter) — apply friction only.
        // Don't call applyMovementPhysics here: it would set sprite.moving=false,
        // causing animation flicker on the client. Sprite state should only
        // change from actual player input, not from missing-input ticks.
        const airborne = session.player.jumpVZ !== undefined;
        if (airborne) {
          // Match predictor physics: apply air friction when platformerAir is enabled.
          if (movementPhysics.platformerAir) {
            applyFriction(session.player, dt, 1.0, movementPhysics);
          }
        } else {
          const surface = getSurfaceProperties(
            session.player.position.wx,
            session.player.position.wy,
            (tx, ty) => this.world.getBlendBaseAt(tx, ty),
            (tx, ty) => this.world.getRoadAt(tx, ty),
            (tx, ty) => this.world.getCollisionIfLoaded(tx, ty),
          );
          applyFriction(session.player, dt, surface.friction, movementPhysics);
        }
        // Also apply friction to mount when no input
        if (session.gameplaySession.mountId !== null) {
          const mount = this.entityManager.entities.find(
            (e) => e.id === session.gameplaySession.mountId,
          );
          if (mount?.velocity) {
            applyFriction(mount, dt, 1.0, movementPhysics);
          }
        }
      }
    }

    // ── Phase 2: AI + Physics (once, not per-session) ──
    // Previously this ran inside the per-session loop, meaning N sessions
    // caused N entity updates per tick — doubling/tripling movement speed.
    const activeSessions = [...this.sessions.values()].filter(
      (s) => !s.debugPaused && !dormantClientIds.has(s.clientId),
    );
    if (activeSessions.length > 0) {
      const physicsSteps = Math.max(1, this.physicsMult);
      const stepDt = dt / physicsSteps;
      const players = activeSessions.map((s) => s.player);

      // Noclip: temporarily remove player colliders for all physics substeps.
      const savedColliders = new Map<PlayerSession, ColliderComponent>();
      for (const session of activeSessions) {
        if (session.debugNoclip && session.player.collider) {
          savedColliders.set(session, session.player.collider);
          session.player.collider = null;
        }
      }

      const getHeight = (tx: number, ty: number) => this.world.getHeightAt(tx, ty);
      for (let step = 0; step < physicsSteps; step++) {
        // Merge entity tick tiers across all active sessions' visible ranges.
        const entityTickDts = this.computeEntityTickDtsMulti(activeSessions, stepDt);

        // AI: pass nearest player position per entity (for chase/follow)
        const playerPositions = activeSessions.map((s) => s.player.position);
        tickAllAI(this.entityManager.entities, playerPositions, entityTickDts, Math.random);

        // ── TickService.preSimulation ──
        this.worldAPI.tick.firePre(stepDt);

        this.entityManager.update(
          stepDt,
          (tx, ty) => this.world.getCollisionIfLoaded(tx, ty),
          players,
          this.propManager,
          entityTickDts,
          (tx, ty) => this.world.getHeightAt(tx, ty),
          preSteppedEntityIds,
        );

        // ── Jump physics for all players + mount detection on landing ──
        for (const session of activeSessions) {
          if (preSteppedEntityIds.has(session.player.id)) continue;
          const p = session.player;
          const nearbyProps = p.collider
            ? this.propManager.getPropsNearPosition(p.position, p.collider)
            : [];
          const nearbyEntities = p.collider
            ? (() => {
                const fp = getEntityAABB(p.position, p.collider!);
                return this.entityManager.spatialHash.queryRange(
                  Math.floor(fp.left / CHUNK_SIZE_PX),
                  Math.floor(fp.top / CHUNK_SIZE_PX),
                  Math.floor(fp.right / CHUNK_SIZE_PX),
                  Math.floor(fp.bottom / CHUNK_SIZE_PX),
                );
              })()
            : [];
          this.updateLastSafePosition(session);

          const gravity = tickJumpGravity(
            p,
            stepDt,
            getHeight,
            movementPhysics,
            nearbyProps,
            nearbyEntities,
          );
          this.handlePlayerStepOutcome(
            session,
            {
              landed: gravity.landed,
              groundZ: gravity.groundZ,
              enteredWater: gravity.landed && this.isEntityOnWater(p),
              endedGrounded: p.jumpVZ === undefined,
            },
            getHeight,
            movementPhysics,
          );
        }

        // ── Ball physics (gravity, bouncing, entity collision) ──
        tickBallPhysics(
          this.entityManager,
          stepDt,
          (tx, ty) => this.world.getCollisionIfLoaded(tx, ty),
          (tx, ty) => this.world.getHeightAt(tx, ty),
        );

        // ── TickService.postSimulation ──
        this.worldAPI.tick.firePost(stepDt);

        // ── TagService removal detection ──
        this.worldAPI.tags.tick();

        // ── OverlapService detection ──
        this.worldAPI.overlap.tick();
      }

      // Restore noclip colliders
      for (const [session, collider] of savedColliders) {
        session.player.collider = collider;
      }
    }

    // ── Phase 3: Spawners (per-session, near each player) ──
    for (const session of this.sessions.values()) {
      if (
        dormantClientIds.has(session.clientId) ||
        this.interior ||
        (this.generation.type === "regional" &&
          [
            "regional-v3",
            "regional-v4",
            "regional-v5",
            "regional-v6",
            "regional-v7",
            "regional-v8",
            "regional-v9",
            "regional-v10",
          ].includes(this.generation.version))
      )
        continue;
      if (!session.editorEnabled && !session.debugPaused) {
        this.gemSpawner.update(
          dt,
          session.player,
          session.visibleRange,
          this.entityManager,
          this.world,
        );
        this.baddieSpawner.update(
          dt,
          session.player,
          session.visibleRange,
          this.entityManager,
          this.world,
        );
        this.fishSpawner.update(dt, session.visibleRange, this.entityManager, this.world);
        this.tentSpawner.update(dt, this.propManager, this.entityManager);
      }
    }

    this.worldAPI.advanceTime(dt);

    // Broadcast state to all clients (serialized mode)
    if (broadcasting) {
      const ranges = [...this.sessions.values()]
        .filter((s) => !dormantClientIds.has(s.clientId))
        .map((s) => s.visibleRange);
      if (ranges.length) this.updateVisibleChunks(ranges);

      for (const session of this.sessions.values()) {
        if (dormantClientIds.has(session.clientId) || session.transitioning) continue;
        const messages = this.replication.build(session.clientId, {
          roomState: this.roomState,
          world: this.world,
          entityManager: this.entityManager,
          propManager: this.propManager,
          sessions: this.sessions,
          tickCounter: this.tickCounter,
          tickRate: this.tickRate,
          physicsMult: this.physicsMult,
          playerNamesRevision: this.playerNamesRevision,
          editorCursorsRevision: this.editorCursorsRevision,
        });
        for (const msg of messages) {
          transport.send(session.clientId, msg);
        }
      }
    }
  }

  /** Load/unload chunks for the given visible range and compute autotile. */
  updateVisibleChunks(range: ChunkRange | readonly ChunkRange[]): void {
    if (this.interior)
      range = {
        minCx: 0,
        minCy: 0,
        maxCx: Math.ceil(((this.roomState?.document.width ?? 5) * 32) / CHUNK_SIZE_PX) - 1,
        maxCy: Math.ceil(((this.roomState?.document.height ?? 5) * 32) / CHUNK_SIZE_PX) - 1,
      };
    const initialWarmLoad = this.world.chunks.loadedCount === 0;
    const maxLoads =
      this.world.chunks.loadedCount === 0 ? Number.POSITIVE_INFINITY : MAX_CHUNK_LOADS_PER_UPDATE;
    const maxAutotile = initialWarmLoad ? Number.POSITIVE_INFINITY : MAX_AUTOTILE_CHUNKS_PER_UPDATE;
    const chunksBefore = new Set<string>();
    if (this.generator.descriptor.type !== "flat") {
      for (const [key] of this.world.chunks.entries()) {
        chunksBefore.add(key);
      }
    }
    this.world.updateLoadedChunks(range, maxLoads);
    this.world.computeAutotile(this.blendGraph, maxAutotile);

    if (
      this.interior ||
      (this.generation.type === "regional" && this.generation.version !== "regional-v1")
    ) {
      this.proceduralProps.reconcile(
        this.generator,
        [...this.world.chunks.entries()].map(([key]) => key),
      );
      this.proceduralActors?.reconcile(
        this.generator,
        [...this.world.chunks.entries()].map(([key]) => key),
      );
      return;
    }
    // Generate structures for newly loaded chunks (only for worlds with roads)
    if (this.generator.descriptor.type !== "flat") {
      for (const [key] of this.world.chunks.entries()) {
        if (chunksBefore.has(key)) continue;
        const commaIdx = key.indexOf(",");
        const cx = Number(key.slice(0, commaIdx));
        const cy = Number(key.slice(commaIdx + 1));
        const { placements, newIntersectionKeys } = this.generator.placements(
          cx,
          cy,
          this.processedStructureKeys,
        );
        for (const k of newIntersectionKeys) {
          this.processedStructureKeys.add(k);
        }
        for (const p of placements) {
          const prop = createProp(p.propType, p.wx, p.wy);
          this.propManager.add(prop);
        }
      }
    }
  }

  inspectionState(): SavedMeta {
    return {
      ...this.proceduralProps.save(),
      playerX: 0,
      playerY: 0,
      cameraX: 0,
      cameraY: 0,
      cameraZoom: 1,
      nextEntityId: 1,
      entities: [
        ...this.entityManager.entities
          .filter((e) => e.type !== "player")
          .map((e) => ({
            type: e.type,
            wx: e.position.wx,
            wy: e.position.wy,
            ...(e.proceduralId ? { proceduralId: e.proceduralId } : {}),
          })),
        ...this.propManager.props
          .filter((p) => !p.proceduralId)
          .map((p) => ({ type: p.type, wx: p.position.wx, wy: p.position.wy })),
      ],
    };
  }

  realizeProceduralProps(): void {
    if (
      this.interior ||
      (this.generation.type === "regional" && this.generation.version !== "regional-v1")
    )
      this.proceduralProps.reconcile(
        this.generator,
        [...this.world.chunks.entries()].map(([key]) => key),
      );
  }

  realizeProceduralActors(): void {
    this.proceduralActors?.reconcile(
      this.generator,
      [...this.world.chunks.entries()].map(([key]) => key),
    );
  }

  /** Mark all chunks for re-render (debug mode changes). */
  invalidateAllChunks(): void {
    this.terrainEditor.invalidateAllChunks();
  }

  /** Handle a realm-scoped client message. */
  handleMessage(_clientId: string, session: PlayerSession, msg: ClientMessage): void {
    if (
      this.interior &&
      [
        "edit-terrain-tile",
        "edit-terrain-subgrid",
        "edit-terrain-corner",
        "edit-road",
        "edit-elevation",
        "edit-clear-terrain",
        "edit-clear-roads",
      ].includes(msg.type)
    )
      return;
    switch (msg.type) {
      case "player-input":
        session.inputQueue.push({
          dx: msg.dx,
          dy: msg.dy,
          sprinting: msg.sprinting,
          jump: msg.jump,
          seq: msg.seq,
          ...(msg.jumpPressed !== undefined ? { jumpPressed: msg.jumpPressed } : {}),
          ...(msg.dtMs !== undefined ? { dtMs: msg.dtMs } : {}),
        });
        break;

      case "player-interact":
        this.worldAPI.events.emit("player-interact", { wx: msg.wx, wy: msg.wy });
        break;

      case "throw-ball": {
        const player = session.player;
        const speed = THROW_MIN_SPEED + msg.force * (THROW_MAX_SPEED - THROW_MIN_SPEED);
        // Add random jitter so consecutive throws spread out
        const speedJitter = 1 + (Math.random() - 0.5) * 0.15; // ±7.5% speed
        const angleJitter = (Math.random() - 0.5) * 0.18; // ±~5° direction
        const baseAngle = Math.atan2(msg.dirY, msg.dirX) + angleJitter;
        const jitteredSpeed = speed * speedJitter;
        const xySpeed = jitteredSpeed * Math.cos(THROW_ANGLE);
        const zSpeed = jitteredSpeed * Math.sin(THROW_ANGLE);
        const ball = createBall(player.position.wx, player.position.wy);
        ball.velocity = { vx: Math.cos(baseAngle) * xySpeed, vy: Math.sin(baseAngle) * xySpeed };
        ball.wz = (player.wz ?? 0) + 8; // throw from chest height
        ball.jumpVZ = zSpeed;
        ball.jumpZ = 8;
        this.entityManager.spawn(ball);
        break;
      }

      case "edit-terrain-tile":
        this.terrainEditor.applyTileEdit(
          msg.tx,
          msg.ty,
          msg.terrainId,
          msg.paintMode,
          msg.bridgeDepth,
        );
        break;

      case "edit-terrain-subgrid":
        this.terrainEditor.applySubgridEdit(
          msg.gsx,
          msg.gsy,
          msg.terrainId,
          msg.paintMode,
          msg.bridgeDepth,
          msg.shape,
        );
        break;

      case "edit-terrain-corner":
        this.terrainEditor.applyCornerEdit(
          msg.gsx,
          msg.gsy,
          msg.terrainId,
          msg.paintMode,
          msg.bridgeDepth,
        );
        break;

      case "edit-road":
        this.terrainEditor.applyRoadEdit(msg.tx, msg.ty, msg.roadType, msg.paintMode);
        break;

      case "edit-elevation":
        this.terrainEditor.applyElevationEdit(msg.tx, msg.ty, msg.height, msg.gridSize);
        break;

      case "edit-spawn":
        this.handleSpawn(msg.entityType, msg.wx, msg.wy);
        break;

      case "edit-delete-entity":
        if (msg.entityId !== session.player.id) {
          this.entityManager.remove(msg.entityId);
          this.saveManager?.markMetaDirty();
        }
        break;

      case "edit-move-prop":
        if (this.interior) {
          const prop = this.propManager.props.find((p) => p.id === msg.propId);
          if (!prop || prop.type === INTERIOR_WALL_TYPE) break;
          if (!this.roomState) break;
          const room = this.roomGeometry;
          if (!room) break;
          try {
            const proposed = this.propManager.props.map((p) =>
              p.id === msg.propId ? { ...p, position: { wx: msg.wx, wy: msg.wy } } : p,
            );
            validateRoomOccupancy(
              room,
              proposed,
              [...this.sessions.values()].map((s) => s.player),
            );
          } catch {
            break;
          }
        }
        this.propManager.move(msg.propId, msg.wx, msg.wy);
        break;

      case "edit-delete-prop":
        if (this.propManager.props.find((p) => p.id === msg.propId)?.type === INTERIOR_WALL_TYPE)
          break;
        this.propManager.remove(msg.propId);
        this.saveManager?.markMetaDirty();
        break;

      case "edit-clear-terrain":
        this.terrainEditor.clearAllTerrain(msg.terrainId);
        break;

      case "edit-clear-roads":
        this.terrainEditor.clearAllRoads();
        break;

      case "set-editor-mode":
        session.editorEnabled = msg.enabled;
        if (!msg.enabled) session.editorCursor = null;
        this.editorCursorsRevision++;
        // Auto-dismount when entering editor mode
        if (msg.enabled && session.gameplaySession.mountId !== null) {
          this.dismountPlayer(session);
        }
        break;

      case "editor-cursor":
        session.editorCursor = {
          tileX: msg.tileX,
          tileY: msg.tileY,
          editorTab: msg.editorTab,
          brushMode: msg.brushMode,
        };
        this.editorCursorsRevision++;
        break;

      case "set-debug":
        session.debugPaused = msg.paused;
        session.debugNoclip = msg.noclip;
        break;

      case "visible-range":
        session.visibleRange = {
          minCx: msg.minCx,
          minCy: msg.minCy,
          maxCx: msg.maxCx,
          maxCy: msg.maxCy,
        };
        // Don't call updateVisibleChunks here — it uses a single session's
        // range which unloads chunks that OTHER sessions need, creating
        // invisible collision walls for far-away players. The tick method
        // already computes the union of all sessions' visible ranges and
        // calls updateVisibleChunks with that.
        break;

      case "flush":
        this.flush();
        break;

      case "invalidate-all-chunks":
        this.invalidateAllChunks();
        break;
    }
  }

  async loadWorld(
    worldId: string,
    registry: IWorldRegistry,
    createStore: (id: string) => PersistenceStore,
    overrideMeta?: WorldMeta,
  ): Promise<{ cameraX: number; cameraY: number; cameraZoom: number }> {
    const worldMeta = overrideMeta ?? (await registry.getWorld(worldId));
    if (!worldMeta) throw new Error("World not found.");
    descriptorFromMetadata(worldMeta); // Reject unsupported identity before replacing live state.
    // Close previous save manager
    if (this.saveManager) {
      this.saveManager.flush();
      this.saveManager.close();
    }

    // Create fresh world state with the correct generation strategy
    this.interior = worldMeta.interior ?? null;
    this.roomEditor = null;
    this.roomGeometry = null;
    const strategy = this.buildStrategy(worldMeta);
    if (this.interior)
      this.generator = interiorGenerator(this.interior, descriptorFromMetadata(worldMeta).seed);
    this.world = new World(this.interior ? this.generator.terrain : strategy);
    this.entityManager = new EntityManager();
    this.propManager = new PropManager();
    this.treeBrush = new TreeBrushEditor(this.propManager, () => this.saveManager?.markMetaDirty());
    this.proceduralProps = new ProceduralProps(this.propManager, () =>
      this.saveManager?.markMetaDirty(),
    );

    this.proceduralActors = new ProceduralActors(
      this.entityManager,
      this.proceduralProps.deleted,
      () => this.saveManager?.markMetaDirty(),
    );

    // Open persistence for this world
    const store = createStore(worldId);
    this.saveManager = new SaveManager(store);
    this.terrainEditor = new TerrainEditor(
      this.world,
      (key) => this.saveManager?.markChunkDirty(key),
      this.adjacency,
    );
    this.worldAPI = this.createWorldAPI();
    this.registerMods();

    await this.saveManager.open();
    const savedMeta = await this.saveManager.loadMeta();
    if (
      this.interior &&
      savedMeta?.interior &&
      (savedMeta.interior.version !== this.interior.version ||
        savedMeta.interior.featureId !== this.interior.featureId ||
        savedMeta.interior.parentWorldId !== this.interior.parentWorldId ||
        savedMeta.interior.floor !== this.interior.floor)
    )
      throw new Error("Unsupported saved interior identity.");
    const savedChunks = await this.saveManager.loadChunks();

    let cameraX = 0;
    let cameraY = 0;
    let cameraZoom = 1;
    let playerX = 0;
    let playerY = 0;

    console.log(`[tilefun] loadWorld ${worldId}: ${savedChunks.size} chunks, meta=${!!savedMeta}`);
    this.world.chunks.setSavedData(savedChunks);
    if (savedMeta) {
      this.proceduralProps.restore(savedMeta);
      cameraX = savedMeta.cameraX;
      cameraY = savedMeta.cameraY;
      cameraZoom = savedMeta.cameraZoom;
      playerX = savedMeta.playerX;
      playerY = savedMeta.playerY;
      for (const se of savedMeta.entities) {
        if (se.type === "player") continue;
        if (isPropType(se.type)) {
          this.propManager.add(createProp(se.type, se.wx, se.wy));
        } else {
          const factory = ENTITY_FACTORIES[se.type];
          if (factory) {
            this.entityManager.spawn(factory(se.wx, se.wy));
          }
        }
      }
      this.entityManager.setNextId(savedMeta.nextEntityId);
      this.lastLoadedGems = savedMeta.gemsCollected ?? 0;
    } else {
      this.lastLoadedGems = 0;
      // Find a walkable spawn point using a temporary entity
      const start =
        this.generation.type === "regional"
          ? regionalStart(regionalWorld(this.generation.seed))
          : { x: 0, y: 0 };
      const tempPlayer = createPlayer(start.x * TILE_SIZE, start.y * TILE_SIZE);
      findWalkableSpawn(tempPlayer, this.world);
      playerX = tempPlayer.position.wx;
      playerY = tempPlayer.position.wy;
      if (this.generation.type === "regional") {
        cameraX = playerX;
        cameraY = playerY;
      }
      if (
        !this.interior &&
        !(
          this.generation.type === "regional" &&
          [
            "regional-v3",
            "regional-v4",
            "regional-v5",
            "regional-v6",
            "regional-v7",
            "regional-v8",
            "regional-v9",
            "regional-v10",
          ].includes(this.generation.version)
        )
      )
        spawnInitialChickens(
          5,
          this.world,
          this.entityManager,
          this.generation.type === "regional" ? playerX : 0,
          this.generation.type === "regional" ? playerY : 0,
        );
    }

    if (this.interior) {
      playerX = INTERIOR_ENTRY.wx;
      playerY = INTERIOR_ENTRY.wy;
      cameraX = playerX;
      cameraY = playerY;
      const state = savedMeta?.roomPlan
        ? parseGameplayRoom(savedMeta.roomPlan)
        : initialRoom(this.interior);
      this.installRoom(state);
      this.roomEditor = new GameplayRoomEditor(state, (next) => this.installRoom(next));
    }
    this.gemSpawner.reset(this.entityManager);
    this.baddieSpawner.reset(this.entityManager);
    this.fishSpawner.reset(this.entityManager);
    this.tentSpawner.reset();
    this.processedStructureKeys.clear();

    // Bind save accessors
    this.saveManager.bind(
      (key) => this.world.chunks.getChunkDataByKey(key),
      () => this.buildSaveMeta(),
    );
    this.saveManager.onChunksSaved = (keys, getChunk) => {
      for (const key of keys) {
        const data = getChunk(key);
        if (data)
          this.world.chunks.updateSavedChunk(key, data.subgrid, data.roadGrid, data.heightGrid);
      }
    };

    this.currentWorldId = worldId;
    await registry.updateLastPlayed(this.interior?.parentWorldId ?? worldId);

    // Store loaded positions for addPlayer() to use
    this.lastLoadedCamera = { cameraX, cameraY, cameraZoom };
    this.lastLoadedPlayerPos = { wx: playerX, wy: playerY };

    // Reset per-client delta tracking so all data gets re-sent
    this.replication.clear();

    return { cameraX, cameraY, cameraZoom };
  }

  async flushAsync(): Promise<void> {
    this.saveManager?.markMetaDirty();
    await this.saveManager?.flushAsync();
  }

  flush(): void {
    this.saveManager?.markMetaDirty();
    this.saveManager?.flush();
  }

  /** Teardown mods and close persistence. */
  destroy(): void {
    for (const teardown of this.modTeardowns.values()) {
      teardown();
    }
    this.modTeardowns.clear();
    this.saveManager?.flush();
    this.saveManager?.close();
  }

  // ---- Riding helpers ----

  /** Dismount the player from their current mount. */
  private dismountPlayer(session: PlayerSession): void {
    const mountId = session.gameplaySession.mountId;
    if (mountId === null) return;

    const mount = this.entityManager.entities.find((e) => e.id === mountId);

    // Clear parent relationship
    delete session.player.parentId;
    delete session.player.localOffsetX;
    delete session.player.localOffsetY;
    session.gameplaySession.lastDismountedId = mountId;
    session.gameplaySession.mountId = null;

    // Dismount at current position (player was parented to mount)
    if (mount) {
      // Restore mount AI
      if (mount.wanderAI) {
        mount.wanderAI.state = "idle";
        mount.wanderAI.timer = 1.0;
      }
      if (mount.velocity) {
        mount.velocity.vx = 0;
        mount.velocity.vy = 0;
      }
      if (mount.sprite) mount.sprite.moving = false;
    }

    // Hop off from riding height — wz is already tracked by resolveParentedPositions
    session.player.jumpZ = (session.player.wz ?? 0) - (session.player.groundZ ?? 0);
    session.player.jumpVZ = JUMP_VELOCITY * 0.5;
    delete session.player.noShadow;
  }

  /** Check for rideable entities under the player on landing; mount if found. */
  private tryMountOnLanding(session: PlayerSession): void {
    const player = session.player;
    if (!player.collider) return;

    // Use an expanded AABB for mount detection. The 3D collision system prevents
    // the player from passing through the cow during jumps (Z-ranges overlap on
    // the ground), so the player lands adjacent to the cow rather than overlapping.
    // Expanding by a few pixels detects nearby rideable entities on landing.
    const MOUNT_MARGIN = 4;
    const playerBox = getEntityAABB(player.position, player.collider);
    const expandedBox = {
      left: playerBox.left - MOUNT_MARGIN,
      top: playerBox.top - MOUNT_MARGIN,
      right: playerBox.right + MOUNT_MARGIN,
      bottom: playerBox.bottom + MOUNT_MARGIN,
    };

    const skipId = session.gameplaySession.lastDismountedId;
    session.gameplaySession.lastDismountedId = null;

    for (const entity of this.entityManager.entities) {
      if (entity.id === player.id) continue;
      if (entity.id === skipId) continue; // just dismounted — don't re-mount
      if (!entity.tags?.has("rideable")) continue;
      if (entity.wanderAI?.state === "ridden") continue; // already ridden
      if (!entity.collider) continue;

      const entityBox = getEntityAABB(entity.position, entity.collider);
      if (!aabbsOverlap(expandedBox, entityBox)) continue;

      // Mount!
      session.gameplaySession.mountId = entity.id;
      player.parentId = entity.id;
      player.localOffsetX = 0;
      player.localOffsetY = 0;
      // Snap player position to mount immediately (don't wait for
      // resolveParentedPositions next tick) — avoids camera jump
      player.position.wx = entity.position.wx;
      player.position.wy = entity.position.wy;
      // Visual lift: set wz above mount so the renderer elevates the
      // player onto the mount's back. Use the mount's wz (not player.groundZ
      // which may include the cow's own walkable surface height, double-counting).
      player.wz = (entity.wz ?? 0) + 10;
      player.jumpZ = 10;
      delete player.jumpVZ;
      player.noShadow = true; // cow's shadow is bigger
      if (entity.wanderAI) {
        entity.wanderAI.state = "ridden";
        entity.wanderAI.following = false;
      }
      if (entity.velocity) {
        entity.velocity.vx = 0;
        entity.velocity.vy = 0;
      }
      if (player.velocity) {
        player.velocity.vx = 0;
        player.velocity.vy = 0;
      }
      // Reset player sprite to idle so the walking animation doesn't persist
      if (player.sprite) {
        player.sprite.moving = false;
        player.sprite.frameCol = 0;
        player.sprite.animTimer = 0;
      }
      break;
    }
  }

  // ---- Private ----

  /** Resolve per-input simulation dt (seconds), sanitized for server safety. */
  private resolveInputStepDt(dtMs: number | undefined, fallbackDt: number): number {
    if (dtMs === undefined) return fallbackDt;
    const seconds = dtMs / 1000;
    if (!Number.isFinite(seconds) || seconds <= 0) return fallbackDt;
    return seconds;
  }

  /** Save respawn-safe location while the player is grounded on non-water. */
  private updateLastSafePosition(session: PlayerSession): void {
    const p = session.player;
    if (p.jumpVZ !== undefined) return;
    if (this.isEntityOnWater(p)) return;
    session.gameplaySession.lastSafePosition = {
      wx: p.position.wx,
      wy: p.position.wy,
    };
  }

  /** Handle server-only side effects after applying a pure player simulation step. */
  private handlePlayerStepOutcome(
    session: PlayerSession,
    outcome: PlayerStepOutcome,
    getHeight: (tx: number, ty: number) => number,
    movementPhysics = getMovementPhysicsParams(),
  ): void {
    if (!outcome.landed) return;
    const p = session.player;
    if (outcome.enteredWater) {
      const safe = session.gameplaySession.lastSafePosition;
      if (safe) {
        p.position.wx = safe.wx;
        p.position.wy = safe.wy;
        p.wz = getSurfaceZ(safe.wx, safe.wy, getHeight);
        p.groundZ = p.wz;
      }
      delete p.jumpVZ;
      delete p.jumpZ;
      // Brief invincibility flash so the respawn is visible.
      session.gameplaySession.invincibilityTimer = 0.75;
      return;
    }

    if (!outcome.endedGrounded) return;

    // Quake-style: jump immediately on landing if held and not consumed.
    if (session.lastJumpHeld && !session.jumpConsumed) {
      initiateJump(p, movementPhysics);
      session.jumpConsumed = true;
      return;
    }

    if (session.gameplaySession.mountId === null) {
      this.tryMountOnLanding(session);
    }
  }

  private isEntityOnWater(entity: Entity): boolean {
    const tx = Math.floor(entity.position.wx / TILE_SIZE);
    const ty = Math.floor(entity.position.wy / TILE_SIZE);
    return (this.world.getCollisionIfLoaded(tx, ty) & CollisionFlag.Water) !== 0;
  }

  /** Build per-tick frame + on-change sync events for a specific client. */
  private handleSpawn(entityType: string, wx: number, wy: number): void {
    let changed = false;
    if (this.interior && (!furnitureAsset(entityType) || !this.roomState)) return;
    if (isPropType(entityType)) {
      const prop = createProp(entityType, wx, wy);
      if (this.interior && this.roomGeometry) {
        try {
          validateRoomOccupancy(
            this.roomGeometry,
            [...this.propManager.props, prop],
            [...this.sessions.values()].map((s) => s.player),
          );
        } catch {
          return;
        }
      }
      // Skip if the new prop's collider would overlap an existing prop
      if (
        prop.collider &&
        this.propManager.overlapsAnyProp(getEntityAABB(prop.position, prop.collider))
      ) {
        return;
      }
      this.propManager.add(prop);
      changed = true;
    } else {
      const factory = ENTITY_FACTORIES[entityType];
      if (factory) {
        this.entityManager.spawn(factory(wx, wy));
        changed = true;
      }
    }
    if (changed) {
      this.saveManager?.markMetaDirty();
    }
  }

  private buildSaveMeta(): SavedMeta {
    // Use first session's camera (single-player for now)
    let cameraX = this.lastLoadedCamera.cameraX;
    let cameraY = this.lastLoadedCamera.cameraY;
    let cameraZoom = this.lastLoadedCamera.cameraZoom;
    let gemsCollected = this.lastLoadedGems;
    let player: Entity | undefined;

    for (const session of this.sessions.values()) {
      // Persist per-player data for all players
      this.savePlayerData(session);
      // Use first session for realm-level meta (backward compat)
      if (!player) {
        cameraX = session.cameraX;
        cameraY = session.cameraY;
        cameraZoom = session.cameraZoom;
        gemsCollected = session.gameplaySession.gemsCollected;
        player = session.player;
      }
    }

    const entities = this.entityManager.entities
      .filter((e) => !e.proceduralId)
      .map((e) => ({
        type: e.type,
        wx: e.position.wx,
        wy: e.position.wy,
      }));
    for (const p of this.propManager.props) {
      if (p.proceduralId) continue;
      entities.push({ type: p.type, wx: p.position.wx, wy: p.position.wy });
    }

    return {
      ...this.proceduralProps.save(),
      ...(this.interior
        ? { interior: this.interior, ...(this.roomState ? { roomPlan: this.roomState } : {}) }
        : {}),
      playerX: player?.position.wx ?? this.lastLoadedPlayerPos.wx,
      playerY: player?.position.wy ?? this.lastLoadedPlayerPos.wy,
      cameraX,
      cameraY,
      cameraZoom,
      entities,
      nextEntityId: this.entityManager.getNextId(),
      gemsCollected,
    };
  }

  private registerMods(): void {
    for (const teardown of this.modTeardowns.values()) {
      teardown();
    }
    this.modTeardowns.clear();
    for (const mod of this.mods) {
      try {
        const teardown = mod.register(this.worldAPI);
        this.modTeardowns.set(mod.name, teardown);
      } catch (err) {
        console.error(`[tilefun] Failed to register mod "${mod.name}":`, err);
      }
    }
  }

  private createWorldAPI(): WorldAPIImpl {
    return new WorldAPIImpl(
      this.world,
      this.entityManager,
      this.propManager,
      this.terrainEditor,
      () => {
        for (const session of this.sessions.values()) {
          return session;
        }
        return undefined;
      },
    );
  }

  /**
   * Compute per-entity tick dts across multiple sessions.
   * An entity is "near" if it's near ANY player, "mid" if near any mid range, etc.
   */
  private computeEntityTickDtsMulti(
    sessions: readonly PlayerSession[],
    dt: number,
  ): Map<Entity, number> {
    const result = new Map<Entity, number>();
    const nearBuf = Realm.BROADCAST_BUFFER_CHUNKS;
    const midBuf = nearBuf + Realm.MID_TICK_BUFFER;
    const midInterval = Realm.MID_TICK_FRAMES / this.tickRate;

    // Collect all player entities so we always tick them
    const playerSet = new Set(sessions.map((s) => s.player));

    for (const entity of this.entityManager.entities) {
      if (playerSet.has(entity)) {
        result.set(entity, dt);
        continue;
      }

      const cx = Math.floor(entity.position.wx / CHUNK_SIZE_PX);
      const cy = Math.floor(entity.position.wy / CHUNK_SIZE_PX);

      // Check if entity is near ANY session's visible range
      let isNear = false;
      let isMid = false;
      for (const session of sessions) {
        const range = session.visibleRange;
        if (
          cx >= range.minCx - nearBuf &&
          cx <= range.maxCx + nearBuf &&
          cy >= range.minCy - nearBuf &&
          cy <= range.maxCy + nearBuf
        ) {
          isNear = true;
          break;
        }
        if (
          cx >= range.minCx - midBuf &&
          cx <= range.maxCx + midBuf &&
          cy >= range.minCy - midBuf &&
          cy <= range.maxCy + midBuf
        ) {
          isMid = true;
        }
      }

      if (isNear) {
        result.set(entity, dt);
        entity.tickAccumulator = 0;
        continue;
      }

      if (isMid) {
        const acc = (entity.tickAccumulator ?? 0) + dt;
        if (acc >= midInterval) {
          result.set(entity, acc);
          entity.tickAccumulator = 0;
        } else {
          entity.tickAccumulator = acc;
        }
        continue;
      }

      // Far tier: frozen
      entity.tickAccumulator = 0;
    }

    return result;
  }

  private buildStrategy(meta: WorldMeta | undefined): TerrainStrategy {
    this.generator = createGenerator(descriptorFromMetadata(meta));
    return this.generator.terrain;
  }
}
