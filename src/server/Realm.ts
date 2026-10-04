import { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { applyPlayerModel } from "../characters/PlayerModels.js";
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
import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
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
import { buildingDoor } from "../interiors/BuildingDoors.js";
import {
  furnitureAsset,
  INTERIOR_WALL_TYPE,
  type InteriorIdentity,
  InvalidInteriorError,
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
import { actorScope } from "../persistence/ActorRecords.js";
import type { IWorldRegistry } from "../persistence/IWorldRegistry.js";
import { PERSISTENCE_BUDGET } from "../persistence/PersistenceBudget.js";
import type { PersistenceStore } from "../persistence/PersistenceStore.js";
import { RealmRecords } from "../persistence/RealmRecords.js";
import type { InspectionState, SavedMeta, SavedPlayerData } from "../persistence/SaveManager.js";
import { SaveManager } from "../persistence/SaveManager.js";
import { TrafficRecords } from "../persistence/TrafficRecords.js";
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
import { RailwayStrategy } from "../railway/RailwayStrategy.js";
import { RailwaySystem } from "../railway/RailwaySystem.js";
import type { ClientMessage } from "../shared/protocol.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import { TrafficStrategy } from "../traffic/TrafficNetwork.js";
import { TrafficSystem } from "../traffic/TrafficSystem.js";
import type { IServerTransport } from "../transport/Transport.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { World } from "../world/World.js";
import { around } from "./InterestManager.js";
import { MutationQueue } from "./MutationQueue.js";
import { mutationRange } from "./MutationRange.js";
import type { PlayerSession } from "./PlayerSession.js";
import { RealmReplicator } from "./RealmReplicator.js";
import { RealmStreaming } from "./RealmStreaming.js";
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
export interface RealmOptions {
  definitions?: import("../persistence/ActorRecords.js").ActorDefinitions;
  physics?: () => import("../physics/PlayerMovement.js").MovementPhysicsParams;
  random?: () => number;
  ambientSpawns?: boolean;
}

export class Realm {
  get persistenceDiagnostics() {
    return {
      realmId: this.currentWorldId,
      loadedChunks: this.world.chunks.loadedCount,
      actors: this.entityManager.entities.length,
      activeActors: this.previousActive.size,
      props: this.propManager.props.length,
      features: this.records?.features.size ?? 0,
      holders: this.streaming?.residency.holders.size ?? 0,
      queuedEdits: this.mutations.count,
      residency: { ...this.streaming?.residency.metrics },
      storage: this.saveManager?.diagnostics ?? null,
    };
  }
  readonly mutations = new MutationQueue();
  private storageNotified = new WeakMap<PlayerSession, boolean>();

  admitMutation(
    session: PlayerSession,
    msg: ClientMessage,
    mutate: () => void,
  ): Promise<void> | undefined {
    const check = () => {
      if (session.retired || session.transitioning || session.realmId !== this.currentWorldId)
        throw new Error("The edit belongs to a realm you have left.");
      if (this.saveManager?.pressured)
        throw new Error("Saving is delayed. Please try the edit again when play resumes.");
    };
    check();
    const range = mutationRange(msg, session, this.treeBrush);
    const ready = !range || !this.streaming || this.streaming.rangeReady(range);
    return this.mutations.run(
      ready,
      async () => {
        if (range) await this.streaming?.ensure(range);
      },
      () => {
        check();
        mutate();
      },
    );
  }

  world: World;
  entityManager: EntityManager;
  propManager: PropManager;
  treeBrush: TreeBrushEditor;
  worldAPI: WorldAPIImpl;
  readonly blendGraph: BlendGraph;

  private adjacency: TerrainAdjacency;
  terrainEditor: TerrainEditor;
  saveManager: SaveManager | null = null;
  records: RealmRecords | null = null;
  streaming: RealmStreaming | null = null;
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
  traffic: TrafficSystem | null = null;
  railway: RailwaySystem | null = null;
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

  constructor(
    mods: Mod[],
    private readonly options: RealmOptions = {},
  ) {
    this.mods = mods;
    this.world = new World();
    this.entityManager = new EntityManager();
    this.propManager = new PropManager();
    this.traffic =
      this.generator?.terrain instanceof TrafficStrategy
        ? new TrafficSystem(
            this.world,
            this.entityManager,
            this.propManager,
            this.generator.terrain,
          )
        : null;
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

  /** Compiled ground for safe arrivals in edited rooms. */
  get indoorFloor() {
    return this.roomGeometry?.onFloor;
  }

  async preparePlayer(session: PlayerSession): Promise<SavedPlayerData | null> {
    const persistId = session.profileId || session.clientId;
    return this.saveManager ? this.saveManager.loadPlayerData(persistId) : null;
  }

  async addPlayer(session: PlayerSession, prepared?: SavedPlayerData | null): Promise<void> {
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

    if (this.streaming)
      await this.ensureReady(
        around(Math.floor(spawnX / CHUNK_SIZE_PX), Math.floor(spawnY / CHUNK_SIZE_PX), 3),
      );
    const player = createPlayer(spawnX, spawnY);
    applyPlayerModel(player, session.playerModel);
    this.entityManager.spawn(player);
    const ride = saved?.roofRide;
    if (
      ride &&
      this.traffic &&
      Number.isFinite(ride.offsetX) &&
      Number.isFinite(ride.offsetY) &&
      Math.hypot(ride.offsetX, ride.offsetY) < 40
    ) {
      const vehicle = [...this.traffic.states.values()].find(
        (s) => s.entity.proceduralId === ride.identity,
      )?.entity;
      if (vehicle?.collider) {
        player.position = {
          wx: vehicle.position.wx + ride.offsetX,
          wy: vehicle.position.wy + ride.offsetY,
        };
        player.wz = vehicle.collider.physicalHeight ?? 0;
        player.groundZ = player.wz;
      }
    }

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
    const mounted = saved?.mount ? this.records?.byId.get(saved.mount.id) : undefined;
    if (mounted && !("isProp" in mounted) && saved?.mount) {
      player.parentId = mounted.id;
      player.localOffsetX = saved.mount.offsetX;
      player.localOffsetY = saved.mount.offsetY;
      player.position = {
        wx: mounted.position.wx + saved.mount.offsetX,
        wy: mounted.position.wy + saved.mount.offsetY,
      };
      player.wz = saved.mount.wz;
      player.jumpZ = saved.mount.jumpZ;
      session.gameplaySession.mountId = mounted.id;
      if (mounted.wanderAI) mounted.wanderAI.state = "ridden";
    }
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
    this.saveManager.markPlayerDirty(persistId, this.playerData(session));
  }

  playerData(session: PlayerSession): SavedPlayerData {
    const mount = this.entityManager.byId.get(session.gameplaySession.mountId ?? -1);
    const support = roofSupport(session.player, this.entityManager.entities);
    const identity = support
      ? this.entityManager.entities.find((e) => e.id === support.id)?.proceduralId
      : undefined;
    return {
      ...(mount?.persistentId
        ? {
            mount: {
              id: mount.persistentId,
              offsetX: session.player.localOffsetX ?? 0,
              offsetY: session.player.localOffsetY ?? 0,
              wz: session.player.wz ?? 0,
              jumpZ: session.player.jumpZ ?? 0,
            },
          }
        : {}),
      ...(support && identity
        ? {
            roofRide: {
              identity,
              offsetX: session.player.position.wx - support.position.wx,
              offsetY: session.player.position.wy - support.position.wy,
            },
          }
        : {}),
      ...(this.interior ? { returnLocation: session.returnLocation } : {}),
      gemsCollected: session.gameplaySession.gemsCollected,
      x: session.player.position.wx,
      y: session.player.position.wy,
      cameraX: session.cameraX,
      cameraY: session.cameraY,
      cameraZoom: session.cameraZoom,
    };
  }

  /** Close persistence if the given worldId matches the currently loaded world. */
  async closePersistenceIfCurrent(worldId: string): Promise<void> {
    if (worldId === this.currentWorldId && this.saveManager) {
      await this.railway?.close();
      this.railway = null;
      await this.streaming?.close();
      await this.saveManager.close();
      this.saveManager = null;
    }
  }

  private sessionSupported(session: PlayerSession, dt: number): boolean {
    if (!this.streaming) return true;
    if (!this.streaming.supported(session.player, dt)) return false;
    const parent = this.entityManager.byId.get(session.player.parentId ?? -1);
    return (
      !parent ||
      (this.records?.group(parent) ?? [parent]).every((actor) =>
        this.streaming?.supported(actor, dt),
      )
    );
  }
  /** Run one simulation tick. */
  tick(
    dt: number,
    transport: IServerTransport,
    broadcasting: boolean,
    dormantClientIds: ReadonlySet<string>,
    globalStoragePaused = false,
  ): void {
    this.tickCounter++;
    const storagePaused = globalStoragePaused || (this.saveManager?.pressured ?? false);
    if (storagePaused) this.saveManager?.flush();
    for (const session of this.sessions.values()) {
      if ((this.storageNotified.get(session) ?? false) === storagePaused) continue;
      this.storageNotified.set(session, storagePaused);
      transport.send(session.clientId, {
        type: "storage-status",
        paused: storagePaused,
        message: storagePaused
          ? "Saving is delayed. Play will resume when your changes are safe."
          : "",
      });
    }
    if (this.streaming)
      this.streaming.update(
        [...this.sessions.values()]
          .filter((s) => !dormantClientIds.has(s.clientId))
          .map((s) => s.visibleRange),
        [...this.sessions.values()].filter((s) => !dormantClientIds.has(s.clientId)),
      );
    const movementPhysics = this.options.physics?.() ?? getMovementPhysicsParams();
    const preSteppedEntityIds = new Set<number>();

    // ── Phase 1: Process player inputs (per-session) ──
    // Drain each session's input queue and run full per-input simulation steps.
    // Entities stepped here are skipped in Phase 2 to avoid double simulation.
    for (const session of this.sessions.values()) {
      if (dormantClientIds.has(session.clientId) || session.transitioning || session.retired)
        continue;

      if (Date.now() < session.doorArrivalUntil) {
        session.lastProcessedInputSeq =
          session.inputQueue.at(-1)?.seq ?? session.lastProcessedInputSeq;
        session.inputQueue = [];
        continue;
      }
      if (!this.sessionSupported(session, dt)) continue;

      if (storagePaused) {
        session.lastProcessedInputSeq =
          session.inputQueue.at(-1)?.seq ?? session.lastProcessedInputSeq;
        session.inputQueue = [];
        continue;
      }

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
            Math.floor(aabb.left / CHUNK_SIZE_PX) - 1,
            Math.floor(aabb.top / CHUNK_SIZE_PX) - 1,
            Math.floor(aabb.right / CHUNK_SIZE_PX) + 1,
            Math.floor(aabb.bottom / CHUNK_SIZE_PX) + 1,
          );
        const queryEntities = (aabb: {
          left: number;
          top: number;
          right: number;
          bottom: number;
        }) =>
          this.entityManager.spatialHash.queryRange(
            Math.floor(aabb.left / CHUNK_SIZE_PX) - 1,
            Math.floor(aabb.top / CHUNK_SIZE_PX) - 1,
            Math.floor(aabb.right / CHUNK_SIZE_PX) + 1,
            Math.floor(aabb.bottom / CHUNK_SIZE_PX) + 1,
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
      (s) =>
        !storagePaused &&
        !s.debugPaused &&
        !s.transitioning &&
        Date.now() >= s.doorArrivalUntil &&
        !s.retired &&
        !dormantClientIds.has(s.clientId) &&
        this.sessionSupported(s, dt),
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
        for (const session of this.sessions.values()) {
          if (session.transitioning || session.retired || Date.now() < session.doorArrivalUntil)
            entityTickDts.delete(session.player);
        }

        // AI: pass nearest player position per entity (for chase/follow)
        const playerPositions = activeSessions.map((s) => s.player.position);
        const active = [...entityTickDts.keys()];
        const decisions = this.streaming ? this.decisionDts(entityTickDts, stepDt) : entityTickDts;
        this.entityManager.simulationEntities = active;
        this.propManager.simulationProps = this.propManager.props.filter(
          (prop) =>
            !this.streaming ||
            ((this.streaming.demand.get(actorScope(prop.position))?.activity ?? 0) > 0 &&
              this.streaming.supported(prop, stepDt)),
        );
        tickAllAI(active, playerPositions, decisions, this.options.random ?? Math.random);

        // ── TickService.preSimulation ──
        this.worldAPI.tick.firePre(stepDt);

        for (const service of this.railway?.services.values() ?? [])
          preSteppedEntityIds.add(service.entity.id);
        for (const vehicle of this.traffic?.states.values() ?? [])
          preSteppedEntityIds.add(vehicle.entity.id);
        for (const player of players) {
          if (preSteppedEntityIds.has(player.id)) continue;
          const support = roofSupport(player, this.entityManager.entities);
          if (support?.velocity) {
            player.position.wx += support.velocity.vx * stepDt;
            player.position.wy += support.velocity.vy * stepDt;
          }
        }
        this.entityManager.update(
          stepDt,
          (tx, ty) => this.world.getCollisionIfLoaded(tx, ty),
          players,
          this.propManager,
          entityTickDts,
          (tx, ty) => this.world.getHeightAt(tx, ty),
          preSteppedEntityIds,
        );

        this.traffic?.tick(stepDt, players, this.streaming ? new Set(active) : undefined);
        this.railway?.tick(stepDt, (range) => this.streaming?.rangeReady(range) ?? false);

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
          active,
        );

        for (const entity of entityTickDts.keys()) {
          if (
            entity.wanderAI ||
            entity.routeAI ||
            entity.velocity ||
            entity.deathTimer !== undefined
          )
            this.records?.changed(entity);
        }

        // ── TickService.postSimulation ──
        this.worldAPI.tick.firePost(stepDt);

        // ── TagService removal detection ──
        this.worldAPI.tags.tick();

        // ── OverlapService detection ──
        this.worldAPI.overlap.tick();
        this.entityManager.simulationEntities = undefined;
        this.propManager.simulationProps = undefined;
      }

      // Restore noclip colliders
      for (const [session, collider] of savedColliders) {
        session.player.collider = collider;
      }
    }

    // ── Phase 3: Spawners (per-session, near each player) ──
    for (const session of this.sessions.values()) {
      if (
        this.options.ambientSpawns === false ||
        dormantClientIds.has(session.clientId) ||
        this.interior ||
        this.generation.type === "regional"
      )
        continue;
      if (
        !storagePaused &&
        this.entityManager.entities.length < PERSISTENCE_BUDGET.actors - 100 &&
        !session.editorEnabled &&
        !session.debugPaused &&
        (!this.streaming || this.streaming.supported(session.player, dt))
      ) {
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
        const playerRange = this.streaming
          ? around(
              Math.floor(session.player.position.wx / CHUNK_SIZE_PX),
              Math.floor(session.player.position.wy / CHUNK_SIZE_PX),
              4,
            )
          : session.visibleRange;
        this.fishSpawner.update(dt, playerRange, this.entityManager, this.world);
      }
    }

    if (
      this.options.ambientSpawns !== false &&
      this.entityManager.entities.length < PERSISTENCE_BUDGET.actors - 100 &&
      !this.interior &&
      this.generation.type !== "regional" &&
      activeSessions.some((session) => !session.editorEnabled)
    ) {
      const activeProps = this.streaming
        ? this.propManager.props.filter(
            (prop) =>
              (this.streaming?.demand.get(actorScope(prop.position))?.activity ?? 0) > 0 &&
              this.streaming?.supported(prop, dt),
          )
        : this.propManager.props;
      this.tentSpawner.update(dt, this.propManager, this.entityManager, activeProps);
    }
    for (const session of activeSessions) this.savePlayerData(session);
    this.worldAPI.advanceTime(dt);

    // Broadcast state to all clients (serialized mode)
    if (broadcasting) {
      const ranges = [...this.sessions.values()]
        .filter((s) => !dormantClientIds.has(s.clientId))
        .map((s) => s.visibleRange);
      if (ranges.length || this.streaming) this.updateVisibleChunks(ranges);

      for (const session of this.sessions.values()) {
        if (dormantClientIds.has(session.clientId) || session.transitioning) continue;
        const replicationTiming = performanceMetrics.start();
        const messages = this.replicate(session.clientId);
        performanceMetrics.end("server.replication", replicationTiming);
        for (const msg of messages) {
          transport.send(session.clientId, msg);
        }
      }
    }
  }

  /** Shared replication entry point for scheduled and manually stepped hosts. */
  replicate(clientId: string) {
    return this.replication.build(clientId, {
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
    if (this.railway && this.streaming) {
      this.railway.update(
        [...this.sessions.values()]
          .filter((s) => !s.retired && !s.transitioning)
          .map((s) => s.player),
      );
      this.streaming.interest.set("railways", this.railway.tickets());
    }
    if (this.traffic) {
      this.traffic.visibleRanges = Array.isArray(range) ? range : [range as ChunkRange];
      const support = this.traffic.supportRanges([...this.sessions.values()].map((s) => s.player));
      if (support.length)
        range = [...(Array.isArray(range) ? range : [range as ChunkRange]), ...support];
    }
    if (this.streaming) {
      this.streaming.update(
        Array.isArray(range) ? range : [range as ChunkRange],
        this.sessions.values(),
      );
      this.world.computeAutotile(this.blendGraph, MAX_AUTOTILE_CHUNKS_PER_UPDATE);
      return;
    }
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

    if (this.interior || this.generation.type === "regional") {
      const placementTiming = performanceMetrics.start();
      this.proceduralProps.reconcile(
        this.generator,
        [...this.world.chunks.entries()].map(([key]) => key),
      );
      this.proceduralActors?.reconcile(
        this.generator,
        [...this.world.chunks.entries()].map(([key]) => key),
      );
      performanceMetrics.end("server.placements", placementTiming);
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

  inspectionState(): InspectionState {
    return {
      ...this.proceduralProps.save(),
      ...(this.traffic ? { traffic: this.traffic.save() } : {}),
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
    if (this.interior || this.generation.type === "regional")
      this.proceduralProps.reconcile(
        this.generator,
        [...this.world.chunks.entries()].map(([key]) => key),
      );
  }

  realizeProceduralActors(): void {
    if (this.streaming) return;
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
        session.doorIntent = { dx: msg.dx, dy: msg.dy, at: Date.now() };
        if (session.editorEnabled) {
          session.lastProcessedInputSeq = msg.seq;
          break;
        }
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
        const speedJitter = 1 + ((this.options.random ?? Math.random)() - 0.5) * 0.15; // ±7.5% speed
        const angleJitter = ((this.options.random ?? Math.random)() - 0.5) * 0.18; // ±~5° direction
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
        if (msg.enabled) {
          session.lastProcessedInputSeq =
            session.inputQueue.at(-1)?.seq ?? session.lastProcessedInputSeq;
          session.inputQueue.length = 0;
          session.player.velocity = { vx: 0, vy: 0 };
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
    await this.railway?.close();
    this.railway = null;
    await this.streaming?.close();
    this.streaming = null;
    // Close previous save manager
    if (this.saveManager) {
      await this.saveManager.close();
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
    this.traffic =
      this.generator?.terrain instanceof TrafficStrategy
        ? new TrafficSystem(
            this.world,
            this.entityManager,
            this.propManager,
            this.generator.terrain,
          )
        : null;
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
    this.records = new RealmRecords(
      this.entityManager,
      this.propManager,
      this.saveManager,
      this.options.definitions,
    );
    this.entityManager.removalListeners.add((entity) => this.previousActive.delete(entity));
    this.entityManager.canPlace = (wx, wy) =>
      Number.isFinite(wx) &&
      Number.isFinite(wy) &&
      !!this.world.chunks.get(Math.floor(wx / CHUNK_SIZE_PX), Math.floor(wy / CHUNK_SIZE_PX));
    this.entityManager.canSpawn = (entity) =>
      this.entityManager.entities.length < PERSISTENCE_BUDGET.actors &&
      !this.saveManager?.pressured &&
      this.entityManager.canPlace?.(entity.position.wx, entity.position.wy) !== false;
    this.propManager.canAdd = (prop) =>
      this.propManager.props.length < PERSISTENCE_BUDGET.props &&
      !this.saveManager?.pressured &&
      this.entityManager.canPlace?.(prop.position.wx, prop.position.wy) !== false;
    this.entityManager.beforeSpawn = (entity) => {
      if (
        !this.records?.isHydrating &&
        this.entityManager.canPlace?.(entity.position.wx, entity.position.wy) === false
      )
        throw new Error("Cannot spawn outside ready terrain.");
      if (this.entityManager.entities.length >= PERSISTENCE_BUDGET.actors)
        throw new Error("Local actor limit reached.");
    };
    this.propManager.beforeAdd = () => {
      if (this.propManager.props.length >= PERSISTENCE_BUDGET.props)
        throw new Error("Local prop limit reached.");
    };
    this.proceduralActors.persistent = true;
    this.proceduralActors.canGenerate = (id) => !this.records?.features.has(id);
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
      throw new InvalidInteriorError("Unsupported saved interior identity.");
    if (this.interior && savedMeta?.interior) {
      // A previously visited room owns its identity, layout and connections.
      this.interior = savedMeta.interior;
      this.generator = interiorGenerator(this.interior, descriptorFromMetadata(worldMeta).seed);
    }
    this.saveManager.bind(
      (key) => this.world.chunks.getChunkDataByKey(key),
      () => this.buildSaveMeta(),
    );
    this.proceduralProps.managed = true;
    const trafficRecords = this.traffic
      ? new TrafficRecords(this.traffic, this.records, this.saveManager)
      : undefined;
    this.streaming = new RealmStreaming(
      this.world,
      this.records,
      this.propManager,
      this.saveManager,
      (features) => {
        for (const feature of features) {
          if (feature.deleted) this.proceduralProps.deleted.add(feature.id);
          if (feature.edit) this.proceduralProps.edits.set(feature.id, feature.edit);
        }
      },
      (features, key) => {
        this.proceduralProps.forget(key);
        for (const feature of features) {
          this.proceduralProps.deleted.delete(feature.id);
          this.proceduralProps.edits.delete(feature.id);
        }
      },
      (key, seeded) => {
        this.proceduralProps.forget(key);
        if (this.interior || this.generation.type === "regional") {
          this.proceduralProps.reconcile(this.generator, [key]);
        } else if (!seeded && this.generation.type !== "flat") {
          const [cx = 0, cy = 0] = key.split(",").map(Number);
          for (const placement of this.generator.placements(cx, cy, new Set()).placements) {
            if (actorScope({ wx: placement.wx, wy: placement.wy }) !== key) continue;
            this.propManager.add(createProp(placement.propType, placement.wx, placement.wy));
          }
        }
        if (!seeded) this.proceduralActors.reconcile(this.generator, [key]);
      },
      trafficRecords,
    );

    this.railway =
      this.generator.terrain instanceof RailwayStrategy
        ? new RailwaySystem(
            this.generator.terrain.railways,
            this.world,
            this.entityManager,
            this.propManager,
            this.saveManager,
          )
        : null;
    if (this.traffic)
      this.traffic.canSpawn = (id, wx, wy) =>
        !this.records?.features.has(id) &&
        !this.saveManager?.pressured &&
        this.entityManager.entities.length < PERSISTENCE_BUDGET.actors - 16 &&
        !!this.streaming?.rangeReady(
          around(Math.floor(wx / CHUNK_SIZE_PX), Math.floor(wy / CHUNK_SIZE_PX), 1),
        );

    let cameraX = 0;
    let cameraY = 0;
    let cameraZoom = 1;
    let playerX = 0;
    let playerY = 0;

    console.log(
      `[tilefun] loadWorld ${worldId}: lazy world-container records, meta=${!!savedMeta}`,
    );
    if (savedMeta) {
      cameraX = savedMeta.cameraX;
      cameraY = savedMeta.cameraY;
      cameraZoom = savedMeta.cameraZoom;
      playerX = savedMeta.playerX;
      playerY = savedMeta.playerY;
      this.lastLoadedGems = savedMeta.gemsCollected ?? 0;
    } else {
      this.lastLoadedGems = 0;
      // Find a walkable spawn point using a temporary entity
      const start =
        this.generation.type === "regional"
          ? ((this.generator.terrain instanceof RailwayStrategy
              ? this.generator.terrain.railways.start()
              : undefined) ?? regionalStart(regionalWorld(this.generation.seed)))
          : { x: 0, y: 0 };
      const tempPlayer = createPlayer(start.x * TILE_SIZE, start.y * TILE_SIZE);
      await this.ensureReady(
        around(
          Math.floor(tempPlayer.position.wx / CHUNK_SIZE_PX),
          Math.floor(tempPlayer.position.wy / CHUNK_SIZE_PX),
          3,
        ),
      );
      findWalkableSpawn(tempPlayer, this.world);
      playerX = tempPlayer.position.wx;
      playerY = tempPlayer.position.wy;
      if (this.generation.type === "regional") {
        cameraX = playerX;
        cameraY = playerY;
      }
      if (
        this.options.ambientSpawns !== false &&
        !this.interior &&
        !(this.generation.type === "regional")
      )
        spawnInitialChickens(5, this.world, this.entityManager, 0, 0);
    }

    if (this.interior) {
      playerX = buildingDoor(this.interior).arrival.wx;
      playerY = buildingDoor(this.interior).arrival.wy;
      cameraX = playerX;
      cameraY = playerY;
      try {
        const state = savedMeta?.roomPlan
          ? parseGameplayRoom(savedMeta.roomPlan)
          : initialRoom(this.interior);
        this.installRoom(state);
        this.roomEditor = new GameplayRoomEditor(state, (next) => this.installRoom(next));
      } catch (error) {
        throw new InvalidInteriorError("Saved interior geometry is invalid.", { cause: error });
      }
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

    this.saveManager.markMetaDirty();
    this.currentWorldId = worldId;
    await registry.updateLastPlayed(this.interior?.parentWorldId ?? worldId);

    // Store loaded positions for addPlayer() to use
    this.lastLoadedCamera = { cameraX, cameraY, cameraZoom };
    this.lastLoadedPlayerPos = { wx: playerX, wy: playerY };
    await this.ensureReady(
      around(Math.floor(playerX / CHUNK_SIZE_PX), Math.floor(playerY / CHUNK_SIZE_PX), 3),
    );

    // Reset per-client delta tracking so all data gets re-sent
    this.replication.clear();

    return { cameraX, cameraY, cameraZoom };
  }

  async ensureReady(range: ChunkRange): Promise<void> {
    if (this.streaming) await this.streaming.ensure(range);
    else
      for (let cy = range.minCy; cy <= range.maxCy; cy++)
        for (let cx = range.minCx; cx <= range.maxCx; cx++) this.world.getChunk(cx, cy);
  }

  async flushAsync(): Promise<void> {
    await this.mutations.drain();
    await this.railway?.settle();
    for (const session of this.sessions.values()) this.savePlayerData(session);
    this.saveManager?.markMetaDirty();
    await this.saveManager?.flushAsync();
  }

  async flushTransfer(source: Realm | undefined): Promise<void> {
    const realms = [...new Set([source, this])].filter((realm): realm is Realm => !!realm);
    for (const realm of realms) {
      for (const session of realm.sessions.values()) realm.savePlayerData(session);
      realm.saveManager?.markMetaDirty();
    }
    await SaveManager.flushTogether(
      realms.flatMap((realm) => (realm.saveManager ? [realm.saveManager] : [])),
    );
  }

  flush(): void {
    for (const session of this.sessions.values()) this.savePlayerData(session);
    this.saveManager?.markMetaDirty();
    this.saveManager?.flush();
  }

  /** Teardown mods and close persistence. */
  async destroy(): Promise<void> {
    await this.mutations.drain();
    await this.railway?.close();
    this.railway = null;
    await this.streaming?.close();
    const saves = this.saveManager;
    try {
      await saves?.close();
    } catch (error) {
      this.streaming?.resume();
      throw error;
    }
    if (this.saveManager === saves) this.saveManager = null;
    for (const teardown of this.modTeardowns.values()) teardown();
    this.modTeardowns.clear();
    for (const entity of [...this.entityManager.entities])
      this.entityManager.remove(entity.id, false);
    for (const prop of [...this.propManager.props]) this.propManager.remove(prop.id, false);
    for (const [key] of this.world.chunks.entries()) this.world.chunks.remove(key);
    this.records?.features.clear();
    this.sessions.clear();
    this.replication.clear();
  }

  // ---- Riding helpers ----

  /** Dismount the player from their current mount. */
  private dismountPlayer(session: PlayerSession): void {
    const mountId = session.gameplaySession.mountId;
    if (mountId === null) return;

    const mount = this.entityManager.entities.find((e) => e.id === mountId);

    // Clear parent relationship
    Reflect.set(session.player, "parentId", undefined);
    Reflect.set(session.player, "localOffsetX", undefined);
    Reflect.set(session.player, "localOffsetY", undefined);
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
      Reflect.set(player, "jumpVZ", undefined);
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
      Reflect.set(p, "jumpVZ", undefined);
      Reflect.set(p, "jumpZ", undefined);
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
      // Use the first session for the bounded default spawn/camera hint
      if (!player) {
        cameraX = session.cameraX;
        cameraY = session.cameraY;
        cameraZoom = session.cameraZoom;
        gemsCollected = session.gameplaySession.gemsCollected;
        player = session.player;
      }
    }

    return {
      ...(this.interior
        ? { interior: this.interior, ...(this.roomState ? { roomPlan: this.roomState } : {}) }
        : {}),
      playerX: player?.position.wx ?? this.lastLoadedPlayerPos.wx,
      playerY: player?.position.wy ?? this.lastLoadedPlayerPos.wy,
      cameraX,
      cameraY,
      cameraZoom,
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
    if (this.streaming && this.records) {
      const groups = new Set<number>();
      for (const [key, demand] of this.streaming.demand) {
        if (!demand.activity || !this.streaming.residency.ready(key)) continue;
        for (const actor of this.records.buckets.get(key) ?? []) {
          if ("isProp" in actor) continue;
          const root = this.records.root(actor);
          if (groups.has(root.id)) continue;
          groups.add(root.id);
          const group = this.records.group(actor);
          if (group.every((member) => this.streaming?.supported(member, dt)))
            for (const member of group) result.set(member, dt);
        }
      }
      for (const session of sessions)
        if (this.streaming.supported(session.player, dt)) result.set(session.player, dt);
      for (const state of this.traffic?.states.values() ?? []) {
        if (
          this.streaming.demand.get(actorScope(state.entity.position))?.activity &&
          this.streaming.supported(state.entity, dt)
        )
          result.set(state.entity, dt);
      }
      return result;
    }
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

  private previousActive = new Set<Entity>();
  private decisionDts(active: ReadonlyMap<Entity, number>, dt: number): Map<Entity, number> {
    const decisions = new Map<Entity, number>();
    for (const entity of this.previousActive) if (!active.has(entity)) entity.tickAccumulator = 0;
    this.previousActive = new Set(active.keys());
    for (const entity of active.keys()) {
      const activity = this.streaming?.demand.get(
        this.records?.scope(entity) ?? actorScope(entity.position),
      )?.activity;
      if (activity === 2 || entity.type === "player") {
        decisions.set(entity, dt);
        entity.tickAccumulator = 0;
      } else {
        const accumulated = (entity.tickAccumulator ?? 0) + dt;
        if (accumulated >= Realm.MID_TICK_FRAMES / this.tickRate) {
          decisions.set(entity, accumulated);
          entity.tickAccumulator = 0;
        } else entity.tickAccumulator = accumulated;
      }
    }
    return decisions;
  }

  private buildStrategy(meta: WorldMeta | undefined): TerrainStrategy {
    this.generator = createGenerator(descriptorFromMetadata(meta));
    return this.generator.terrain;
  }
}
