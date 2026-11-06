import { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { applyPlayerModel } from "../characters/PlayerModels.js";
import {
  CHUNK_SIZE_PX,
  ELEVATION_PX,
  JUMP_VELOCITY,
  MAX_AUTOTILE_CHUNKS_PER_UPDATE,
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
import {
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  aabbsOverlap,
  getEntityAABB,
} from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { EntityManager } from "../entities/EntityManager.js";
import { findWalkableSpawn, spawnInitialChickens } from "../entities/EntitySpawner.js";
import { FishSpawner } from "../entities/FishSpawner.js";
import { GemSpawner } from "../entities/GemSpawner.js";
import { createPlayer, updatePlayerSpriteFromInput } from "../entities/Player.js";
import { createProp, isPropType } from "../entities/PropFactories.js";
import { PropManager } from "../entities/PropManager.js";
import { TentSpawner } from "../entities/TentSpawner.js";
import { descriptorFromMetadata } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { ProceduralActors } from "../generation/ProceduralActors.js";
import { ProceduralProps } from "../generation/ProceduralProps.js";
import { NaturalStrategy } from "../generation/regional/NaturalStrategy.js";
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
import { withInteriorGems } from "../interiors/InteriorGems.js";
import { updateResident } from "../interiors/ResidentBehavior.js";
import { TreeBrushEditor } from "../patterns/TreeBrushEditor.js";
import { actorScope } from "../persistence/ActorRecords.js";
import type { IWorldRegistry } from "../persistence/IWorldRegistry.js";
import { PERSISTENCE_BUDGET } from "../persistence/PersistenceBudget.js";
import type { PersistenceStore } from "../persistence/PersistenceStore.js";
import { RealmRecords } from "../persistence/RealmRecords.js";
import type { SavedMeta, SavedPlayerData } from "../persistence/SaveManager.js";
import { SaveManager } from "../persistence/SaveManager.js";
import { VehicleRecords } from "../persistence/VehicleRecords.js";
import type { WorldMeta } from "../persistence/WorldRegistry.js";
import { tickSharedBallGameplay } from "../physics/BallGameplay.js";
import { rotationsEqual } from "../physics/BodyRotation.js";
import { getGravityScale } from "../physics/Gravity.js";
import {
  launchBody,
  setBodyPose,
  setHorizontalVelocity,
  setVerticalVelocity,
  teleportBody,
} from "../physics/PhysicalEdits.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { PhysicsScene } from "../physics/PhysicsScene.js";
import { playerMotionIntent, vehicleMotionIntent } from "../physics/PlayerControls.js";
import { getSurfaceZ } from "../physics/surfaceHeight.js";
import { RailwayServices } from "../railway/RailwayServices.js";
import { RailwayStrategy } from "../railway/RailwayStrategy.js";
import type { Movement } from "../shared/Movement.js";
import type { ClientMessage } from "../shared/protocol.js";
import { VehicleRegistry, type VehicleSource } from "../traffic/VehicleRegistry.js";
import type { IServerTransport } from "../transport/Transport.js";
import type { WorkContext } from "../wildlife/AnimalWorkSystem.js";
import { AnimalWorkSystem } from "../wildlife/AnimalWorkSystem.js";
import { startleDeer } from "../wildlife/deerInteractions.js";
import { tickFoodSources } from "../wildlife/FoodGrowth.js";
import { freshBallWork } from "../wildlife/ForageResources.js";
import { setFaunaRidden, startleFauna } from "../wildlife/faunaInteractions.js";
import { startleFrog } from "../wildlife/frogInteractions.js";
import { startleMallard } from "../wildlife/mallardInteractions.js";
import { OwnedBalls } from "../wildlife/OwnedBalls.js";
import { resolvePredatorCatches, startlePredator } from "../wildlife/predatorAI.js";
import { startleRabbit } from "../wildlife/rabbitInteractions.js";
import { startleRobin } from "../wildlife/robinInteractions.js";
import {
  type PendingWildlifeRespawn,
  tickWildlifeRespawns,
  WILDLIFE_RESPAWN_LIMIT,
  WILDLIFE_RESPAWN_SCOPE,
} from "../wildlife/WildlifeRespawns.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { World } from "../world/World.js";
import { AiPlanningScheduler } from "./AiPlanningScheduler.js";
import { around } from "./InterestManager.js";
import { MutationQueue } from "./MutationQueue.js";
import { mutationRange } from "./MutationRange.js";
import type { PlayerSession } from "./PlayerSession.js";
import { RealmActivity } from "./RealmActivity.js";
import { RealmPropActivity } from "./RealmPropActivity.js";
import { RealmReplicator } from "./RealmReplicator.js";
import { RealmStreaming } from "./RealmStreaming.js";
import { createRealmWorkContext } from "./RealmWildlife.js";
import { safeArrival } from "./SafeArrival.js";
import { tickAllAI } from "./tickAllAI.js";
import { VehicleControl } from "./VehicleControl.js";
import type { Mod, Unsubscribe } from "./WorldAPI.js";
import { WorldAPIImpl } from "./WorldAPI.js";

/**
 * A Realm encapsulates all per-world server state:
 * World, EntityManager, PropManager, WorldAPI, persistence, spawners, etc.
 *
 * GameServer coordinates active realms; RealmReplicator owns their client baselines.
 */
export interface RealmOptions {
  /** Temporary review-world composition; ordinary saved worlds omit it. */
  landscape?: import("../generation/regional/NaturalLandscape.js").LandscapeProfile;
  definitions?: import("../persistence/ActorRecords.js").ActorDefinitions;
  gravity?: () => number;
  random?: () => number;
  ambientSpawns?: boolean;
  vehicleSource?: VehicleSource;
}

export class Realm {
  railways: RailwayServices | undefined;
  canPlaceTrain(
    cars: readonly Entity[],
    poses: readonly { x: number; y: number; angle: number }[],
  ) {
    return (
      this.physicsScene?.canPlaceTrain(cars, poses, {
        getCollision: (x, y) => this.world.getCollisionIfLoaded(x, y),
        getHeight: (x, y) => this.world.getHeightAt(x, y),
        queryProps: (b) =>
          this.propManager.getPropsInChunkRange(
            Math.floor(b.left / CHUNK_SIZE_PX),
            Math.floor(b.top / CHUNK_SIZE_PX),
            Math.floor(b.right / CHUNK_SIZE_PX),
            Math.floor(b.bottom / CHUNK_SIZE_PX),
          ),
        geometryVersion: this.geometryVersion,
      }) ?? false
    );
  }
  private physicsScene: PhysicsScene | undefined;
  recoverVehicle(id: number) {
    if (!this.physicsScene) throw Error("Physics is not ready.");
    this.physicsScene.recoverVehicle(id);
  }
  private physicsParticipants: Entity[] = [];
  get collisionDiagnostics() {
    return this.physicsScene?.diagnostics ?? null;
  }
  get physicsState() {
    return this.physicsScene?.snapshot();
  }
  private geometryVersion = (cx: number, cy: number) => {
    const chunk = this.world.getChunkIfLoaded(cx, cy);
    return {
      identity: chunk,
      revision: `${chunk?.revision}:${chunk?.visualRevision}:${chunk?.physicsRevision}:${this.propManager.revision}`,
    };
  };
  get persistenceDiagnostics() {
    return {
      realmId: this.currentWorldId,
      collision: this.collisionDiagnostics,
      loadedChunks: this.world.chunks.loadedCount,
      actors: this.entityManager.entities.length,
      activeActors: this.previousActive.size,
      props: this.propManager.props.length,
      features: this.records?.features.size ?? 0,
      holders: this.streaming?.residency.holders.size ?? 0,
      queuedEdits: this.mutations.count,
      residency: this.streaming?.residency.diagnostics() ?? null,
      transitioningPlayers: [...this.sessions.values()].filter((session) => session.transitioning)
        .length,
      storage: this.saveManager?.diagnostics ?? null,
    };
  }
  readonly mutations = new MutationQueue();
  readonly vehicles = new VehicleControl(this);
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
    const ready = !range || this.requireStreaming().rangeReady(range);
    return this.mutations.run(
      ready,
      async () => {
        if (range) await this.requireStreaming().ensure(range);
      },
      () => {
        check();
        mutate();
      },
    );
  }

  world: World;
  entityManager: EntityManager;
  animalWork: AnimalWorkSystem;
  ownedBalls: OwnedBalls;
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
  private proceduralActors!: ProceduralActors;
  vehicleRegistry: VehicleRegistry | null = null;
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
  /** At most nearby visited rooms/door trips; supplied by GameServer. */
  readonly backgroundResidents = new Set<Entity>();

  residentCanOccupy(entity: Entity, position: { wx: number; wy: number }, actors = false): boolean {
    if (!entity.collider) return false;
    const box = getEntityAABB(position, entity.collider);
    if (
      this.roomGeometry &&
      !this.roomGeometry.onFloor({
        x: box.left,
        y: box.top,
        width: box.right - box.left,
        height: box.bottom - box.top,
      })
    )
      return false;
    if (
      !this.world.chunks.get(
        Math.floor(position.wx / CHUNK_SIZE_PX),
        Math.floor(position.wy / CHUNK_SIZE_PX),
      )
    )
      return false;
    if (
      aabbOverlapsSolid(
        box,
        (tx, ty) => this.world.getCollisionIfLoaded(tx, ty),
        CollisionFlag.Solid | CollisionFlag.Water,
      )
    )
      return false;
    if (
      this.propManager
        .getPropsNearPosition(position, entity.collider)
        .some((prop) =>
          aabbOverlapsPropWalls(box, prop.position, prop, 0, entity.collider?.physicalHeight ?? 24),
        )
    )
      return false;
    return (
      !actors ||
      !this.entityManager.entities.some(
        (other) =>
          other !== entity &&
          other.collider &&
          aabbsOverlap(box, getEntityAABB(other.position, other.collider)),
      )
    );
  }
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
      this.entityManager.entities.filter((e) => e.type === "player" || e.resident),
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

  /** Server tick rate in Hz (fixed by the shared physics clock). */
  readonly tickRate = TICK_RATE;

  private readonly mods: Mod[];
  private modTeardowns = new Map<string, Unsubscribe>();

  private static readonly MID_TICK_FRAMES = 4;

  constructor(
    mods: Mod[],
    private readonly options: RealmOptions = {},
  ) {
    this.mods = mods;
    this.world = new World();
    this.entityManager = new EntityManager();
    this.animalWork = new AnimalWorkSystem(this.entityManager);
    this.ownedBalls = new OwnedBalls(this.entityManager);
    this.propManager = new PropManager();
    const trafficRoutes =
      this.options.vehicleSource ??
      (this.generator?.terrain instanceof NaturalStrategy ? this.generator.terrain : undefined);
    this.vehicleRegistry = this.interior
      ? null
      : new VehicleRegistry(this.world, this.entityManager, this.propManager, trafficRoutes ?? {});
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

    await this.ensureReady(
      around(Math.floor(spawnX / CHUNK_SIZE_PX), Math.floor(spawnY / CHUNK_SIZE_PX), 3),
    );
    const player = createPlayer(spawnX, spawnY);
    if (saved?.wz !== undefined && Number.isFinite(saved.wz)) {
      player.wz = saved.wz;
      player.groundZ =
        saved.groundZ !== undefined && Number.isFinite(saved.groundZ) ? saved.groundZ : saved.wz;
      if (saved.jumpVZ !== undefined && Number.isFinite(saved.jumpVZ)) {
        player.jumpVZ = saved.jumpVZ;
        const motion = saved.airborneVelocity;
        if (motion && Number.isFinite(motion.vx) && Number.isFinite(motion.vy)) {
          player.velocity = { vx: motion.vx, vy: motion.vy };
        }
        player.jumpZ = saved.wz - (player.groundZ ?? saved.wz);
      }
    }
    applyPlayerModel(player, session.playerModel);
    const savedSafe = saved?.lastSafePosition;
    let respawn =
      savedSafe && [savedSafe.wx, savedSafe.wy, savedSafe.wz ?? 0].every(Number.isFinite)
        ? { ...savedSafe }
        : {
            wx: spawnX,
            wy: spawnY,
            wz: player.wz ?? getSurfaceZ(spawnX, spawnY, (x, y) => this.world.getHeightAt(x, y)),
          };
    if (!savedSafe && player.jumpVZ !== undefined && this.isEntityOnWater({ ...player, wz: 0 })) {
      // Old airborne records have no supported history. Use the existing bounded
      // admission search instead of making the airborne position a respawn loop.
      const dry = await safeArrival(this, {
        x: spawnX / TILE_SIZE,
        y: spawnY / TILE_SIZE,
        generation: this.generation,
      });
      respawn = { ...dry, wz: getSurfaceZ(dry.wx, dry.wy, (x, y) => this.world.getHeightAt(x, y)) };
    }
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
      lastSafePosition: respawn,
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
      setFaunaRidden(mounted, true);
      player.noShadow = true;
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
    if (saved?.driving) {
      const vehicle = this.entityManager.entities.find(
        (e) => e.proceduralId === saved.driving?.identity,
      );
      const exit = saved.driving.exit;
      const fallback =
        exit && Number.isFinite(exit.wx) && Number.isFinite(exit.wy)
          ? exit
          : { wx: spawnX, wy: spawnY };
      if (vehicle && this.vehicles.available(vehicle.id)) {
        session.gameplaySession.lastSafePosition = { ...fallback };
        this.vehicles.enter(session, vehicle.id, true);
      } else await this.vehicles.restoreOnFoot(session, fallback);
    }
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
    const driven = this.vehicles.get(session);
    return {
      ...(driven?.proceduralId
        ? {
            driving: {
              identity: driven.proceduralId,
              exit: session.gameplaySession.lastSafePosition,
            },
          }
        : {}),
      ...(!driven && mount?.persistentId
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
      ...(this.interior ? { returnLocation: session.returnLocation } : {}),
      lastSafePosition: session.gameplaySession.lastSafePosition
        ? { ...session.gameplaySession.lastSafePosition }
        : null,
      gemsCollected: session.gameplaySession.gemsCollected,
      x: session.player.position.wx,
      y: session.player.position.wy,
      ...(session.player.wz === undefined ? {} : { wz: session.player.wz }),
      ...(session.player.groundZ === undefined ? {} : { groundZ: session.player.groundZ }),
      ...(session.player.jumpVZ === undefined
        ? {}
        : {
            jumpVZ: session.player.jumpVZ,
            ...(session.player.velocity
              ? {
                  airborneVelocity: {
                    ...session.player.velocity,
                  },
                }
              : {}),
          }),
      cameraX: session.cameraX,
      cameraY: session.cameraY,
      cameraZoom: session.cameraZoom,
    };
  }

  private sessionSupported(session: PlayerSession, dt: number): boolean {
    const streaming = this.requireStreaming();
    if (!streaming.supported(session.player, dt)) return false;
    const parent = this.entityManager.byId.get(session.player.parentId ?? -1);
    return (
      !parent || streaming.records.group(parent).every((actor) => streaming.supported(actor, dt))
    );
  }

  /** Every loaded realm streams; only an unloaded realm lacks it. */
  private requireStreaming(): RealmStreaming {
    if (!this.streaming) throw new Error("Realm world is not loaded.");
    return this.streaming;
  }
  /** Run one simulation tick. */
  tick(
    dt: number,
    transport: IServerTransport,
    broadcasting: boolean,
    dormantClientIds: ReadonlySet<string>,
    globalStoragePaused = false,
  ): void {
    // Nothing simulates before loadWorld creates the streamed world.
    if (!this.streaming) return;
    dt = PHYSICS_DT;
    this.tickCounter++;
    const storagePaused = this.prepareTick(transport, dormantClientIds, globalStoragePaused);
    const gravity = this.options.gravity?.() ?? getGravityScale();
    const { controls, controlTicks } = this.admitControls(storagePaused, dormantClientIds);

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
    if (activeSessions.length > 0 || (!storagePaused && this.backgroundResidents.size > 0))
      this.simulate(activeSessions, controls, controlTicks, storagePaused, gravity);

    this.updateSpawners(activeSessions, storagePaused, dormantClientIds);
    for (const session of activeSessions) this.savePlayerData(session);
    this.worldAPI.advanceTime(dt);

    this.publishState(transport, dormantClientIds, broadcasting);
  }

  private prepareTick(
    transport: IServerTransport,
    dormantClientIds: ReadonlySet<string>,
    globalStoragePaused: boolean,
  ) {
    if (this.tickCounter % 120 === 1 && this.railways) {
      const ranges = [...this.sessions.values()]
        .filter((s) => !s.retired && !s.transitioning)
        .map((s) => s.visibleRange);
      void this.railways
        .prepare(ranges, true)
        .catch((error) => console.error("Train service preparation failed", error));
    }
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
    this.requireStreaming().update(
      [...this.sessions.values()]
        .filter((s) => !dormantClientIds.has(s.clientId))
        .map((s) => s.visibleRange),
      [...this.sessions.values()].filter((s) => !dormantClientIds.has(s.clientId)),
    );
    if (this.tickCounter % 120 === 0)
      this.vehicleRegistry?.populate(
        [...this.sessions.values()]
          .filter((s) => !s.retired && !s.transitioning)
          .map((s) =>
            around(
              Math.floor(s.player.position.wx / CHUNK_SIZE_PX),
              Math.floor(s.player.position.wy / CHUNK_SIZE_PX),
              2,
            ),
          ),
      );
    return storagePaused;
  }

  private admitControls(storagePaused: boolean, dormantClientIds: ReadonlySet<string>) {
    const controls = new Map<number, Movement>();
    const controlTicks = new Map<number, number>();
    for (const session of this.sessions.values()) {
      const blocked =
        storagePaused ||
        session.editorEnabled ||
        session.debugPaused ||
        session.transitioning ||
        session.retired ||
        dormantClientIds.has(session.clientId) ||
        Date.now() < session.doorArrivalUntil ||
        !this.sessionSupported(session, PHYSICS_DT);
      if (blocked) {
        session.lastProcessedInputSeq =
          session.inputQueue.at(-1)?.seq ?? session.lastProcessedInputSeq;
        session.controls.reset(session.lastProcessedInputSeq);
        session.inputQueue = [];
        continue;
      }
      const admitted = session.controls.admit(session.inputQueue, this.tickCounter);
      session.inputQueue = [];
      session.lastProcessedInputSeq = Math.max(session.lastProcessedInputSeq, admitted.ack);
      session.lastJumpHeld = admitted.movement.jump;
      session.jumpConsumed = admitted.movement.jump;
      if (
        !this.vehicles.get(session) &&
        session.gameplaySession.mountId !== null &&
        admitted.movement.jumpPressed
      )
        this.dismountPlayer(session);
      controls.set(session.player.id, admitted.movement);
      controlTicks.set(session.player.id, admitted.expiresIn);
    }

    return { controls, controlTicks };
  }

  private selectSimulationEntities(
    activeSessions: readonly PlayerSession[],
    storagePaused: boolean,
  ) {
    // Merge entity tick tiers across all active sessions' visible ranges.
    const entityTickDts = this.computeEntityTickDtsMulti(activeSessions, PHYSICS_DT);
    if (!storagePaused)
      for (const e of this.backgroundResidents)
        if (this.requireStreaming().supported(e, PHYSICS_DT)) entityTickDts.set(e, PHYSICS_DT);
    for (const car of this.railways?.bodies() ?? []) entityTickDts.set(car, PHYSICS_DT);
    for (const [e] of entityTickDts) if (e.resident?.transferring) entityTickDts.delete(e);
    for (const session of this.sessions.values()) {
      if (session.transitioning || session.retired || Date.now() < session.doorArrivalUntil)
        entityTickDts.delete(session.player);
    }

    return entityTickDts;
  }

  /** Ordered simulation phases; only advancePhysics integrates the world. */
  private simulate(
    activeSessions: readonly PlayerSession[],
    controls: ReadonlyMap<number, Movement>,
    controlTicks: ReadonlyMap<number, number>,
    storagePaused: boolean,
    gravity: number,
  ) {
    const stepDt = PHYSICS_DT;
    const entityTickDts = this.selectSimulationEntities(activeSessions, storagePaused);
    const active = [...entityTickDts.keys()];
    const decisions = this.decisionDts(entityTickDts, stepDt);
    this.entityManager.simulationEntities = active;
    this.propManager.simulationProps = this.propActivity.select(
      this.propManager,
      this.requireStreaming(),
    );
    try {
      const work = createRealmWorkContext(this, entityTickDts, activeSessions);
      this.updateDecisions(active, activeSessions, entityTickDts, decisions, work);
      this.worldAPI.tick.firePre(stepDt);
      const timing = performanceMetrics.start();
      const { scene, participants, wasAirborne } = this.advancePhysics(
        active,
        activeSessions,
        controls,
        controlTicks,
        gravity,
      );
      this.finishPhysics(participants, activeSessions, wasAirborne, scene);
      performanceMetrics.end("realm.entityPhysics", timing);
      this.resolveSimulationGameplay(active, participants, entityTickDts, work, scene);
    } finally {
      this.entityManager.simulationEntities = undefined;
      this.propManager.simulationProps = undefined;
    }
  }

  private updateDecisions(
    active: Entity[],
    activeSessions: readonly PlayerSession[],
    entityTickDts: ReadonlyMap<Entity, number>,
    decisions: ReadonlyMap<Entity, number>,
    work: WorkContext,
  ) {
    const playerPositions = activeSessions.map((s) => s.player.position);
    const wildlifeEnvironment = work.environment;
    const aiTiming = performanceMetrics.start();
    tickAllAI(
      active,
      playerPositions,
      decisions,
      this.options.random ?? Math.random,
      wildlifeEnvironment,
      this.robinTurn++,
      this.aiPlanning,
    );
    performanceMetrics.end("realm.ai", aiTiming);

    for (const [entity, elapsed] of entityTickDts)
      if (entity.resident && entity.wanderAI?.state !== "scared")
        updateResident(entity, elapsed, (p) => this.residentCanOccupy(entity, p, true), active);
  }

  private advancePhysics(
    active: Entity[],
    activeSessions: readonly PlayerSession[],
    controls: ReadonlyMap<number, Movement>,
    controlTicks: ReadonlyMap<number, number>,
    gravity: number,
  ) {
    const players = activeSessions.map((s) => s.player);
    const intents = this.entityManager.collectMotionIntents(active, PHYSICS_DT, (x, y) =>
      this.world.getCollisionIfLoaded(x, y),
    );
    for (const [id, intent] of this.railways?.plan() ?? []) intents.set(id, intent);
    const wasAirborne = new Set(players.filter((p) => p.jumpVZ !== undefined).map((p) => p.id));
    for (const [id, intent] of this.vehicleRegistry?.traffic.plan(
      active,
      this.physicsScene?.physicsTick ?? 0,
    ) ?? [])
      intents.set(id, intent);
    for (const session of activeSessions) {
      const movement = controls.get(session.player.id);
      if (!movement) continue;
      const vehicle = this.vehicles.get(session);
      const mount =
        session.gameplaySession.mountId === null
          ? undefined
          : this.entityManager.byId.get(session.gameplaySession.mountId);
      const controlled = vehicle ?? mount ?? session.player;
      intents.set(controlled.id, {
        ...(vehicle ? vehicleMotionIntent(vehicle, movement) : playerMotionIntent(movement)),
        controlUntil:
          (this.physicsScene?.physicsTick ?? 0) + (controlTicks.get(session.player.id) ?? 0),
      });
      // Facing/animation is intent-derived; readback publishes physical velocity.
      if (!vehicle) updatePlayerSpriteFromInput(session.player, movement);
    }
    const participants = active.filter(
      (e) => this.entityManager.byId.get(e.id) === e && !e.tags?.has("passage"),
    );
    const scene = this.physicsScene;
    if (!scene) throw Error("Realm physics is not initialized");
    this.physicsParticipants = participants;
    scene.synchronize(participants);
    scene.step(
      intents,
      {
        getCollision: (x, y) => this.world.getCollisionIfLoaded(x, y),
        getHeight: (x, y) => this.world.getHeightAt(x, y),
        queryProps: (bounds) =>
          this.propManager.getPropsInChunkRange(
            Math.floor(bounds.left / CHUNK_SIZE_PX),
            Math.floor(bounds.top / CHUNK_SIZE_PX),
            Math.floor(bounds.right / CHUNK_SIZE_PX),
            Math.floor(bounds.bottom / CHUNK_SIZE_PX),
          ),
        geometryVersion: this.geometryVersion,
      },
      gravity,
    );
    this.railways?.finish();
    return { scene, participants, wasAirborne };
  }

  private finishPhysics(
    participants: Entity[],
    activeSessions: readonly PlayerSession[],
    wasAirborne: ReadonlySet<number>,
    scene: PhysicsScene,
  ) {
    const stepDt = PHYSICS_DT;
    const players = activeSessions.map((s) => s.player);
    const getHeight = (x: number, y: number) => this.world.getHeightAt(x, y);
    this.entityManager.finishPhysics(participants, players, stepDt, (x, y) =>
      this.world.getCollisionIfLoaded(x, y),
    );
    for (const session of activeSessions) {
      const p = session.player;
      this.updateLastSafePosition(session);
      const supportId = scene.bodyState(p.id)?.supportId;
      const support = this.entityManager.byId.get(supportId ?? -1);
      this.handlePlayerStepOutcome(
        session,
        {
          landed: wasAirborne.has(p.id) && p.jumpVZ === undefined,
          groundZ: p.groundZ ?? 0,
          enteredWater: p.jumpVZ === undefined && this.isEntityOnWater(p),
          endedGrounded: p.jumpVZ === undefined,
          ...(support?.fauna ||
          support?.predator ||
          support?.deer ||
          support?.robin ||
          support?.rabbit ||
          support?.frog ||
          support?.mallard
            ? { wildlifeContactId: support.id }
            : {}),
        },
        getHeight,
      );
    }
  }

  private resolveSimulationGameplay(
    active: Entity[],
    participants: Entity[],
    entityTickDts: ReadonlyMap<Entity, number>,
    work: WorkContext,
    scene: PhysicsScene,
  ) {
    const stepDt = PHYSICS_DT;
    const wildlifeEnvironment = work.environment;
    const workPlayers = work.players;
    const workReady = work.ready;
    const playerPositions = workPlayers.map((p) => p.entity.position);
    tickWildlifeRespawns(this.entityManager, stepDt, wildlifeEnvironment, playerPositions);
    resolvePredatorCatches(this.entityManager, active, wildlifeEnvironment, playerPositions);
    this.animalWork.resolveCatches(active, {
      environment: wildlifeEnvironment,
      players: workPlayers,
      ready: workReady,
    });

    // Route/parking clocks no longer own poses. Persist shared readback for cars.
    for (const e of participants) {
      const car = this.vehicleRegistry?.states.get(e.id);
      if (!car) continue;
      if (
        e.position.wx !== e.prevPosition?.wx ||
        e.position.wy !== e.prevPosition?.wy ||
        e.wz !== e.prevWz ||
        e.vehicleHeading !== e.prevVehicleHeading ||
        !rotationsEqual(e.bodyRotation, e.prevBodyRotation)
      )
        this.vehicleRegistry?.onChange?.(car, false);
    }
    this.vehicles.sync();

    tickFoodSources(this.entityManager, entityTickDts, wildlifeEnvironment, workReady);

    // Contacts trigger gameplay; they never run another ball integration.
    tickSharedBallGameplay(this.entityManager, participants, scene, (x, y) =>
      this.world.getCollisionIfLoaded(x, y),
    );
    this.animalWork.syncAll(active);
    this.ownedBalls.sync(active);

    for (const entity of entityTickDts.keys()) {
      if (entity.wanderAI || entity.routeAI || entity.velocity || entity.deathTimer !== undefined)
        this.records?.changed(entity);
    }

    // ── TickService.postSimulation ──
    this.worldAPI.tick.firePost(stepDt);

    // ── TagService removal detection ──
    this.worldAPI.tags.tick();

    // ── OverlapService detection ──
    this.worldAPI.overlap.tick();
  }

  private updateSpawners(
    activeSessions: readonly PlayerSession[],
    storagePaused: boolean,
    dormantClientIds: ReadonlySet<string>,
  ) {
    const dt = PHYSICS_DT;
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
        this.requireStreaming().supported(session.player, dt)
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
        const playerRange = around(
          Math.floor(session.player.position.wx / CHUNK_SIZE_PX),
          Math.floor(session.player.position.wy / CHUNK_SIZE_PX),
          4,
        );
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
      const activeProps = this.propActivity.select(this.propManager, this.requireStreaming());
      this.tentSpawner.update(dt, this.propManager, this.entityManager, activeProps);
    }
  }

  private publishState(
    transport: IServerTransport,
    dormantClientIds: ReadonlySet<string>,
    broadcasting: boolean,
  ) {
    for (const horn of this.vehicles.takeHorns()) {
      for (const session of this.sessions.values())
        if (
          !session.transitioning &&
          !dormantClientIds.has(session.clientId) &&
          Math.hypot(session.player.position.wx - horn.wx, session.player.position.wy - horn.wy) <
            750
        )
          transport.send(session.clientId, horn);
    }
    // Broadcast state to all clients
    if (broadcasting) {
      const ranges = [...this.sessions.values()]
        .filter((s) => !dormantClientIds.has(s.clientId))
        .map((s) => s.visibleRange);
      this.updateVisibleChunks(ranges);

      for (const session of this.sessions.values()) {
        if (dormantClientIds.has(session.clientId) || session.transitioning) continue;
        // Check before building: replication advances this client's last-sent baseline.
        if (transport.canSend && !transport.canSend(session.clientId)) continue;
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
    for (const session of this.sessions.values())
      session.player.jumpInputState =
        (session.jumpConsumed ? 1 : 0) | (session.lastJumpHeld ? 2 : 0);
    const scene = this.physicsScene;
    // A paused/manual publication may follow boarding, exit or an explicit edit
    // before the next clock tick. Refresh membership/edits without integrating,
    // so entity baselines and numerical physics describe the same bodies.
    const admitted = new Map(this.physicsParticipants.map((e) => [e.id, e]));
    for (const session of this.sessions.values()) {
      if (session.retired || session.transitioning) continue;
      for (const e of [
        session.player,
        this.vehicles.get(session),
        this.entityManager.byId.get(session.gameplaySession.mountId ?? -1),
      ])
        if (e) admitted.set(e.id, e);
    }
    scene?.synchronize(
      [...admitted.values()].filter(
        (e) => this.entityManager.byId.get(e.id) === e && !e.tags?.has("passage"),
      ),
    );
    return this.replication.build(clientId, {
      roomState: this.roomState,
      world: this.world,
      entityManager: this.entityManager,
      propManager: this.propManager,
      sessions: this.sessions,
      tickCounter: this.tickCounter,
      simulationTime: this.worldAPI.time,
      tickRate: this.tickRate,
      ...(scene
        ? {
            physicsSnapshot: (anchorId: number, visible: ReadonlySet<number>) =>
              scene.snapshotAround(anchorId, visible),
          }
        : {}),
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
    this.requireStreaming().update(
      Array.isArray(range) ? range : [range as ChunkRange],
      this.sessions.values(),
    );
    this.world.computeAutotile(this.blendGraph, MAX_AUTOTILE_CHUNKS_PER_UPDATE);
  }

  realizeProceduralProps(): void {
    if (this.interior || this.generation.type === "regional")
      this.proceduralProps.reconcile(
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
          ...(msg.reversing === true ? { reversing: true } : {}),
          ...(msg.relativeDriving === true ? { relativeDriving: true } : {}),
          seq: msg.seq,
          ...(msg.jumpPressed !== undefined ? { jumpPressed: msg.jumpPressed } : {}),
        });
        break;

      case "player-interact":
        this.worldAPI.events.emit("player-interact", { wx: msg.wx, wy: msg.wy });
        break;

      case "vehicle-horn": {
        this.vehicles.honk(session, msg.active);
        break;
      }
      case "vehicle-emergency": {
        this.vehicles.emergency(session, msg.action);
        break;
      }
      case "throw-ball": {
        if (this.vehicles.get(session)) break;
        const player = session.player;
        const speed = THROW_MIN_SPEED + msg.force * (THROW_MAX_SPEED - THROW_MIN_SPEED);
        // Add random jitter so consecutive throws spread out
        const speedJitter = 1 + ((this.options.random ?? Math.random)() - 0.5) * 0.15; // ±7.5% speed
        const angleJitter = ((this.options.random ?? Math.random)() - 0.5) * 0.18; // ±~5° direction
        const baseAngle = Math.atan2(msg.dirY, msg.dirX) + angleJitter;
        const jitteredSpeed = speed * speedJitter;
        const xySpeed = jitteredSpeed * Math.cos(THROW_ANGLE);
        const zSpeed = jitteredSpeed * Math.sin(THROW_ANGLE);
        const owner = session.profileId || session.clientId;
        const reusable = this.entityManager.entities.find(
          (e) =>
            e.type === "ball" &&
            e.workItem?.returned &&
            e.workItem.owner === owner &&
            e.parentId === undefined &&
            Math.hypot(e.position.wx - player.position.wx, e.position.wy - player.position.wy) < 36,
        );
        const ball = reusable ?? createBall(player.position.wx, player.position.wy);
        // Start beyond the fixed player hull instead of spawning a physical
        // projectile inside its thrower. A blocked hand cannot create a body in a wall.
        const radius = (ball.collider?.width ?? 4) / 2;
        const dx = Math.cos(baseAngle),
          dy = Math.sin(baseAngle),
          c = player.collider;
        const reach = c
          ? Math.min(
              (c.width / 2 + radius + 0.1) / Math.max(1e-6, Math.abs(dx)),
              (c.height / 2 + radius + 0.1) / Math.max(1e-6, Math.abs(dy)),
            )
          : radius + 1;
        const x = player.position.wx + (c?.offsetX ?? 0) + dx * reach;
        const y = player.position.wy + (c?.offsetY ?? 0) - (c?.height ?? 0) / 2 + dy * reach;
        const z = (player.wz ?? 0) + 8;
        if (this.physicsScene && !this.physicsScene.canPlaceSphere(x, y, z, radius, reusable?.id))
          break;
        const position = {
          wx: x - (ball.collider?.offsetX ?? 0),
          wy: y - (ball.collider?.offsetY ?? 0) + (ball.collider?.height ?? 4) / 2,
        };
        setBodyPose(ball, position);
        const order = ball.workItem?.ballOrder;
        ball.workItem = {
          ...freshBallWork(owner, player.position),
          ...(order !== undefined ? { ballOrder: order } : {}),
        };
        if (!this.ownedBalls.admit(owner, ball)) break;
        delete ball.deathTimer;
        ball.ballThrowerId = player.id;
        setBodyPose(ball, { wz: z });
        launchBody(ball, {
          vx: Math.cos(baseAngle) * xySpeed,
          vy: Math.sin(baseAngle) * xySpeed,
          vz: zSpeed,
        });
        ball.jumpZ = 8;
        if (!reusable) this.entityManager.spawn(ball);
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
        if (msg.entityType.startsWith("vehicle-v1:") && !session.editorEnabled) break;
        this.handleSpawn(msg.entityType, msg.wx, msg.wy, msg.paintSchemeId);
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
              this.entityManager.entities.filter((e) => e.type === "player" || e.resident),
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

          setHorizontalVelocity(session.player, { vx: 0, vy: 0 });
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

      default:
        // GameServer handles the remaining message types before delegating here.
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
    await this.streaming?.close();
    this.streaming = null;
    this.activity.clear();
    this.propActivity.clear();
    // Close previous save manager
    this.railways?.dispose();
    this.railways = undefined;
    if (this.saveManager) {
      await this.saveManager.close();
    }

    this.physicsScene?.dispose();
    this.physicsScene = await PhysicsScene.create();
    this.physicsParticipants = [];

    // Create fresh world state with the correct generation strategy
    this.interior = worldMeta.interior ?? null;
    this.roomEditor = null;
    this.roomGeometry = null;
    const strategy = this.buildStrategy(worldMeta);
    if (this.interior)
      this.generator = interiorGenerator(this.interior, descriptorFromMetadata(worldMeta).seed);
    this.world = new World(this.interior ? this.generator.terrain : strategy);
    this.entityManager = new EntityManager();
    this.animalWork = new AnimalWorkSystem(this.entityManager);
    this.ownedBalls = new OwnedBalls(this.entityManager);
    this.propManager = new PropManager();
    const trafficRoutes =
      this.options.vehicleSource ??
      (this.generator?.terrain instanceof NaturalStrategy ? this.generator.terrain : undefined);
    this.vehicleRegistry = this.interior
      ? null
      : new VehicleRegistry(this.world, this.entityManager, this.propManager, trafficRoutes ?? {});
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
    this.entityManager.removalListeners.add((entity) => {
      this.previousActive.delete(entity);
      this.activity.invalidate();
    });
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
    this.ownedBalls = new OwnedBalls(this.entityManager, this.saveManager);
    await this.ownedBalls.load();
    this.records.acceptsRecord = (record) => this.ownedBalls.accepts(record);
    const savedMeta = await this.saveManager.loadMeta();
    const returns = await this.saveManager.loadRecords("meta", WILDLIFE_RESPAWN_SCOPE);
    if (returns.size > WILDLIFE_RESPAWN_LIMIT)
      throw new Error("Wildlife return queue exceeds its limit.");
    for (const [key, value] of returns) {
      const job = value as PendingWildlifeRespawn;
      if (
        !key.startsWith("wildlife-respawn:") ||
        !job.actor?.state.naturalSpawnId ||
        !Number.isFinite(job.remaining) ||
        job.remaining < 0
      )
        throw new Error("Invalid wildlife return record.");
      this.entityManager.wildlifeRespawns.set(job.actor.persistentId, job);
    }
    this.entityManager.onWildlifeRespawnChanged = (id, job) => {
      const key = `wildlife-respawn:${id}`;
      this.saveManager?.markRecordDirty("meta", key, () => ({
        collection: "meta",
        key,
        scope: WILDLIFE_RESPAWN_SCOPE,
        ...(job ? { value: structuredClone(job) } : { value: null, deleted: true }),
      }));
    };
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
    if (this.interior) {
      try {
        const state = savedMeta?.roomPlan
          ? parseGameplayRoom(savedMeta.roomPlan)
          : initialRoom(this.interior);
        this.generator = withInteriorGems(this.generator, this.interior, state);
      } catch (error) {
        throw new InvalidInteriorError("Saved interior geometry is invalid.", { cause: error });
      }
    }
    this.saveManager.bind(
      (key) => this.world.chunks.getChunkDataByKey(key),
      () => this.buildSaveMeta(),
    );
    this.proceduralProps.managed = true;
    const trafficRecords = this.vehicleRegistry
      ? new VehicleRecords(this.vehicleRegistry, this.records, this.saveManager)
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
        // Exploration gems and track additions also populate visited chunks. Stable
        // origin records suppress moved/deleted finds; other populations seed once.
        if (!seeded || this.interior || this.generation.type === "regional")
          this.proceduralActors.reconcile(this.generator, [key], seeded);
      },
      trafficRecords,
    );

    if (this.vehicleRegistry)
      this.vehicleRegistry.canSpawn = (id, wx, wy) =>
        !this.records?.features.has(id) &&
        !this.saveManager?.pressured &&
        this.entityManager.entities.length < PERSISTENCE_BUDGET.actors - 16 &&
        !!this.streaming?.rangeReady(
          around(Math.floor(wx / CHUNK_SIZE_PX), Math.floor(wy / CHUNK_SIZE_PX), 1),
        );

    this.railways =
      !this.interior && this.generator.terrain instanceof RailwayStrategy
        ? new RailwayServices(this, this.generator.terrain.railways)
        : undefined;
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
    await this.requireStreaming().ensure(range);
    // Explicit readiness fences may load chunks after the ordinary budgeted pass.
    // Publish complete terrain even when authority will stay paused after reload.
    this.world.computeAutotile(this.blendGraph);
    this.vehicleRegistry?.populate([range]);
    await this.railways?.prepare([range]);
  }

  async flushAsync(): Promise<void> {
    await this.mutations.drain();
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
    this.railways?.dispose();
    this.railways = undefined;
    await this.mutations.drain();
    await this.streaming?.close();
    const saves = this.saveManager;
    try {
      await saves?.close();
    } catch (error) {
      this.streaming?.resume();
      throw error;
    }
    if (this.saveManager === saves) this.saveManager = null;
    this.physicsScene?.dispose();
    this.physicsScene = undefined;
    this.physicsParticipants = [];
    for (const teardown of this.modTeardowns.values()) teardown();
    this.modTeardowns.clear();
    for (const entity of [...this.entityManager.entities])
      this.entityManager.remove(entity.id, false);
    for (const prop of [...this.propManager.props]) this.propManager.remove(prop.id, false);
    for (const [key] of this.world.chunks.entries()) this.world.chunks.remove(key);
    this.records?.features.clear();
    this.sessions.clear();
    this.activity.clear();
    this.propActivity.clear();
    this.replication.clear();
  }

  // ---- Riding helpers ----

  /** Dismount the player from their current mount. */
  private dismountPlayer(session: PlayerSession): void {
    if (this.vehicles.get(session)) {
      this.vehicles.exit(session, true);
      return;
    }
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
      setFaunaRidden(mount, false);
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
    setVerticalVelocity(session.player, JUMP_VELOCITY * 0.5);
    delete session.player.noShadow;
  }

  /** Check for rideable entities under the player on landing; mount if found. */
  private tryMountOnLanding(session: PlayerSession, contactId?: number): void {
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
      // Wildlife mounts require an actual landing on their back, not nearby ground.
      if (entity.fauna && entity.id !== contactId) continue;
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
      const rideHeight = entity.collider.physicalHeight ?? 10;
      player.wz = (entity.wz ?? 0) + rideHeight;
      player.jumpZ = rideHeight;

      Reflect.set(player, "jumpVZ", undefined);
      player.noShadow = true; // cow's shadow is bigger
      if (entity.wanderAI) {
        entity.wanderAI.state = "ridden";
        entity.wanderAI.following = false;
      }
      setFaunaRidden(entity, true);
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

  /** Save a supported respawn pose above dry ground or an elevated deck. */
  private updateLastSafePosition(session: PlayerSession): void {
    const p = session.player;
    if (p.jumpVZ !== undefined) return;
    if (this.isEntityOnWater(p)) return;
    session.gameplaySession.lastSafePosition = {
      wx: p.position.wx,
      wy: p.position.wy,
      wz: p.wz ?? 0,
    };
  }

  private handlePlayerStepOutcome(
    session: PlayerSession,
    outcome: {
      landed: boolean;
      enteredWater: boolean;
      endedGrounded: boolean;
      groundZ: number;
      wildlifeContactId?: number;
    },
    getHeight: (tx: number, ty: number) => number,
  ): void {
    if (!outcome.landed && !outcome.enteredWater) return;
    const p = session.player;
    if (outcome.wildlifeContactId !== undefined) {
      const animal = this.entityManager.byId.get(outcome.wildlifeContactId);
      if (animal) {
        if (session.gameplaySession.mountId === null && animal.tags?.has("rideable")) {
          this.tryMountOnLanding(session, animal.id);
          if (session.gameplaySession.mountId !== null) {
            this.records?.changed(animal);
            return;
          }
        }
        if (animal.predator) startlePredator(animal, p.position);
        else if (animal.fauna) startleFauna(animal, p.position);
        else if (animal.deer) startleDeer(animal, p.position);
        else if (animal.robin) startleRobin(animal, p.position);
        else if (animal.rabbit) startleRabbit(animal, p.position);
        else if (animal.frog) startleFrog(animal, p.position);
        else startleMallard(animal, p.position);
        this.records?.changed(animal);
      }
      return;
    }
    if (outcome.enteredWater) {
      const safe = session.gameplaySession.lastSafePosition;
      if (safe) {
        teleportBody(p, {
          wx: safe.wx,
          wy: safe.wy,
          wz: safe.wz ?? getSurfaceZ(safe.wx, safe.wy, getHeight),
        });
      } else {
        delete p.jumpVZ;
        delete p.jumpZ;
      }
      // Brief invincibility flash so the respawn is visible.
      session.gameplaySession.invincibilityTimer = 0.75;
      return;
    }

    if (!outcome.endedGrounded) return;

    if (session.gameplaySession.mountId === null) {
      this.tryMountOnLanding(session);
    }
  }

  private isEntityOnWater(entity: Entity): boolean {
    const tx = Math.floor(entity.position.wx / TILE_SIZE);
    const ty = Math.floor(entity.position.wy / TILE_SIZE);
    return (
      (this.world.getCollisionIfLoaded(tx, ty) & CollisionFlag.Water) !== 0 &&
      (entity.wz ?? 0) <= this.world.getHeightAt(tx, ty) * ELEVATION_PX + 0.15
    );
  }

  /** Build per-tick frame + on-change sync events for a specific client. */
  private handleSpawn(entityType: string, wx: number, wy: number, paintSchemeId?: string): void {
    let changed = false;
    if (this.interior && (!furnitureAsset(entityType) || !this.roomState)) return;
    if (entityType.startsWith("vehicle-v1:")) {
      changed = !!this.vehicleRegistry?.place(
        entityType.slice(11),
        wx,
        wy,
        undefined,
        paintSchemeId,
      );
    } else if (isPropType(entityType)) {
      const prop = createProp(entityType, wx, wy);
      if (this.interior && this.roomGeometry) {
        try {
          validateRoomOccupancy(
            this.roomGeometry,
            [...this.propManager.props, prop],
            this.entityManager.entities.filter((e) => e.type === "player" || e.resident),
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
      (entityId) => {
        for (const session of this.sessions.values()) {
          if (entityId === undefined || session.player.id === entityId) return session;
        }
        return undefined;
      },
    );
  }

  /** Supported players and active vehicles, plus streamed actors admitted by activity demand. */
  private computeEntityTickDtsMulti(
    sessions: readonly PlayerSession[],
    dt: number,
  ): Map<Entity, number> {
    const streaming = this.requireStreaming();
    const result = new Map<Entity, number>();
    for (const session of sessions)
      if (streaming.supported(session.player, dt)) result.set(session.player, dt);
    for (const state of this.vehicleRegistry?.states.values() ?? []) {
      if (
        streaming.demand.get(actorScope(state.entity.position))?.activity &&
        streaming.supported(state.entity, dt)
      )
        result.set(state.entity, dt);
    }
    return this.activity.select(streaming.records, streaming, sessions, result, dt);
  }

  private previousActive = new Set<Entity>();
  private readonly activity = new RealmActivity();
  private readonly propActivity = new RealmPropActivity();
  private robinTurn = 0;
  private readonly aiPlanning = new AiPlanningScheduler();
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
    this.generator = createGenerator(descriptorFromMetadata(meta), this.options.landscape);
    return this.generator.terrain;
  }
}
