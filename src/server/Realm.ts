import { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { applyPlayerModel } from "../characters/PlayerModels.js";
import {
  CHUNK_SIZE_PX,
  MAX_AUTOTILE_CHUNKS_PER_UPDATE,
  TICK_RATE,
  TILE_SIZE,
} from "../config/constants.js";
import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import { TerrainEditor } from "../editor/TerrainEditor.js";
import { BaddieSpawner } from "../entities/BaddieSpawner.js";
import {
  aabbOverlapsPropWalls,
  aabbOverlapsSolid,
  aabbsOverlap,
  getEntityAABB,
} from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { EntityManager } from "../entities/EntityManager.js";
import { findWalkableSpawn, spawnInitialChickens } from "../entities/EntitySpawner.js";
import { FishSpawner } from "../entities/FishSpawner.js";
import { GemSpawner } from "../entities/GemSpawner.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
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
  INTERIOR_WALL_TYPE,
  type InteriorIdentity,
  interiorGenerator,
} from "../interiors/GameplayInterior.js";
import {
  compileGameplayRoom,
  GameplayRoomEditor,
  type GameplayRoomState,
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
import type { FlushOptions, SavedMeta, SavedPlayerData } from "../persistence/SaveManager.js";
import { SaveManager } from "../persistence/SaveManager.js";
import { VehicleRecords } from "../persistence/VehicleRecords.js";
import type { WorldMeta } from "../persistence/WorldRegistry.js";
import { getGravityScale } from "../physics/Gravity.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { RailwayServices } from "../railway/RailwayServices.js";
import { RailwayStrategy } from "../railway/RailwayStrategy.js";
import type { Movement } from "../shared/Movement.js";
import type { ClientMessage } from "../shared/protocol.js";
import { visitShopper } from "../traffic/ShoppingVisits.js";
import { VehicleRegistry, type VehicleSource } from "../traffic/VehicleRegistry.js";
import type { IServerTransport } from "../transport/Transport.js";
import type { WorkContext } from "../wildlife/AnimalWorkSystem.js";
import { AnimalWorkSystem } from "../wildlife/AnimalWorkSystem.js";
import { OwnedBalls } from "../wildlife/OwnedBalls.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { World } from "../world/World.js";
import { AiPlanningScheduler } from "./AiPlanningScheduler.js";
import { around } from "./InterestManager.js";
import { MutationQueue } from "./MutationQueue.js";
import { mutationRange } from "./MutationRange.js";
import type { PlayerSession } from "./PlayerSession.js";
import { RealmActivity } from "./RealmActivity.js";
import { handleRealmCommand, type RealmCommandContext } from "./RealmCommands.js";
import {
  asInvalidInterior,
  checkSavedInterior,
  installCapacityGuards,
  installTrafficGuard,
  loadWildlifeReturns,
  savedRoomState,
} from "./RealmComposition.js";
import { RealmPhysics } from "./RealmPhysics.js";
import {
  dryRespawn,
  restoreDriving,
  restoreSavedBody,
  savedRespawn,
} from "./RealmPlayerRestore.js";
import { RealmPropActivity } from "./RealmPropActivity.js";
import { publishStreams, replicationStreams } from "./RealmPublication.js";
import { RealmReplicator } from "./RealmReplicator.js";
import { dismountPlayer, restoreSavedMount } from "./RealmRiding.js";
import { resolveSimulationGameplay } from "./RealmSimulation.js";
import { RealmStreaming } from "./RealmStreaming.js";
import { createRealmWorkContext } from "./RealmWildlife.js";
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
  private readonly physics = new RealmPhysics(this); // Stores `this` only; reads no Realm state.
  canPlaceTrain(
    cars: readonly Entity[],
    poses: readonly { x: number; y: number; angle: number }[],
  ) {
    return this.physics.canPlaceTrain(cars, poses);
  }
  /** The shared physics scene once a world is loaded. */
  get physicsScene() {
    return this.physics.scene;
  }
  recoverVehicle(id: number) {
    this.physics.recoverVehicle(id);
  }
  get collisionDiagnostics() {
    return this.physicsScene?.diagnostics ?? null;
  }
  get physicsState() {
    return this.physicsScene?.snapshot();
  }
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
      shedChunks: this.streaming?.shed ?? 0,
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
    return this.saveManager ? this.saveManager.loadPlayerData(session.persistId) : null;
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
    restoreSavedBody(player, saved);
    applyPlayerModel(player, session.playerModel);
    const respawn =
      savedRespawn(this, player, saved, spawnX, spawnY) ?? (await dryRespawn(this, spawnX, spawnY));
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
    restoreSavedMount(this, session, saved);
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
    const onFoot = saved?.driving
      ? restoreDriving(this, session, saved.driving, spawnX, spawnY)
      : undefined;
    if (onFoot) await onFoot;
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
      dismountPlayer(this, session);
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
    this.saveManager?.markPlayerDirty(session.persistId, this.playerData(session));
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
    this.records?.tick(dt);

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
    if (storagePaused) this.saveManager?.flush({ sweep: false });
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
    // One interest update per tick: dormant sessions keep their own neighbourhood
    // resident for reconnects but contribute no viewer range.
    this.updateVisibleChunks(
      [...this.sessions.values()]
        .filter((s) => !dormantClientIds.has(s.clientId))
        .map((s) => s.visibleRange),
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
        dismountPlayer(this, session);
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
      const { scene, participants, wasAirborne } = this.physics.step(
        active,
        activeSessions,
        controls,
        controlTicks,
        gravity,
      );
      this.physics.finish(participants, activeSessions, wasAirborne, scene);
      performanceMetrics.end("realm.entityPhysics", timing);
      resolveSimulationGameplay(this, active, participants, entityTickDts, work, scene);
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
    // One stream per (connection, realm), through its lowest live seat (226).
    const streams = replicationStreams(
      this.sessions.values(),
      (s) => !s.transitioning && !dormantClientIds.has(s.clientId),
    );
    publishStreams(transport, streams, this.vehicles.takeHorns(), broadcasting ? this : undefined);
  }

  /** Shared replication entry point for scheduled and manually stepped hosts: the stream
   * sent through `clientId`, with its connection's `others` seats here (226). */
  replicate(clientId: string, others: readonly PlayerSession[] = []) {
    for (const session of this.sessions.values())
      session.player.jumpInputState =
        (session.jumpConsumed ? 1 : 0) | (session.lastJumpHeld ? 2 : 0);
    const scene = this.physicsScene;
    this.physics.synchronizeForPublication(this.sessions.values());
    return this.replication.build(
      clientId,
      {
        roomState: this.roomState,
        world: this.world,
        entityManager: this.entityManager,
        propManager: this.propManager,
        sessions: this.sessions,
        tickCounter: this.tickCounter,
        simulationTime: this.worldAPI.time,
        tickRate: this.tickRate,
        ...(scene ? { physicsSnapshot: scene.snapshotAround.bind(scene) } : {}),
        playerNamesRevision: this.playerNamesRevision,
        editorCursorsRevision: this.editorCursorsRevision,
      },
      others,
    );
  }

  /** A seat's own session sync when it rides in another seat's stream. */
  syncSeat(session: PlayerSession) {
    return this.replication.seatSync(session, this.tickCounter, this.tickRate);
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
    handleRealmCommand(this.commandContext, session, msg);
  }

  private readonly commandContext: RealmCommandContext = {
    realm: this,
    random: () => (this.options.random ?? Math.random)(),
    roomGeometry: () => this.roomGeometry,
    editorCursorsChanged: () => {
      this.editorCursorsRevision++;
    },
  };

  async loadWorld(
    worldId: string,
    registry: IWorldRegistry,
    createStore: (id: string) => PersistenceStore,
    overrideMeta?: WorldMeta,
  ): Promise<{ cameraX: number; cameraY: number; cameraZoom: number }> {
    const worldMeta = overrideMeta ?? (await registry.getWorld(worldId));
    if (!worldMeta) throw new Error("World not found.");
    descriptorFromMetadata(worldMeta); // Reject unsupported identity before replacing live state.
    await this.closeLoadedWorld();
    await this.physics.reset();
    this.composeWorld(worldMeta);

    // Open persistence for this world
    const { saveManager, records } = this.openPersistence(createStore(worldId));
    await saveManager.open();
    this.ownedBalls = new OwnedBalls(this.entityManager, saveManager);
    await this.ownedBalls.load();
    records.acceptsRecord = (record) => this.ownedBalls.accepts(record);
    const savedMeta = await saveManager.loadMeta();
    await loadWildlifeReturns(this, saveManager, this.entityManager);
    this.restoreInterior(worldMeta, savedMeta);
    // Bind save accessors
    saveManager.bind(
      (key) => this.world.chunks.getChunkDataByKey(key),
      () => this.buildSaveMeta(),
    );
    this.proceduralProps.managed = true;
    this.streaming = this.createStreaming(records, saveManager);
    installTrafficGuard(this);

    this.railways =
      !this.interior && this.generator.terrain instanceof RailwayStrategy
        ? new RailwayServices(this, this.generator.terrain.railways)
        : undefined;

    console.log(
      `[tilefun] loadWorld ${worldId}: lazy world-container records, meta=${!!savedMeta}`,
    );
    const { cameraX, cameraY, cameraZoom, playerX, playerY } =
      await this.loadedPlacement(savedMeta);
    this.gemSpawner.reset(this.entityManager);
    this.baddieSpawner.reset(this.entityManager);
    this.fishSpawner.reset(this.entityManager);
    this.tentSpawner.reset();

    saveManager.markMetaDirty();
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

  /** Stop streaming, services and persistence of the previously loaded world. */
  private async closeLoadedWorld(): Promise<void> {
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
  }

  /** Create fresh world state with the correct generation strategy. */
  private composeWorld(worldMeta: WorldMeta): void {
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
  }

  /** Attach records, capacity guards, editors and mods to the composed world. */
  private openPersistence(store: PersistenceStore) {
    const saveManager = new SaveManager(store);
    this.saveManager = saveManager;
    const records = new RealmRecords(
      this.entityManager,
      this.propManager,
      saveManager,
      this.options.definitions,
    );
    this.records = records;
    this.entityManager.removalListeners.add((entity) => {
      this.previousActive.delete(entity);
      this.activity.invalidate();
    });
    installCapacityGuards(this);
    this.proceduralActors.persistent = true;
    this.proceduralActors.canGenerate = (id) => !this.records?.features.has(id);
    this.terrainEditor = new TerrainEditor(
      this.world,
      (key) => this.saveManager?.markChunkDirty(key),
      this.adjacency,
    );
    this.worldAPI = this.createWorldAPI();
    this.registerMods();
    return { saveManager, records };
  }

  /** A previously visited room owns its identity, layout and connections. */
  private restoreInterior(worldMeta: WorldMeta, savedMeta: SavedMeta | null): void {
    checkSavedInterior(this.interior, savedMeta?.interior);
    if (this.interior && savedMeta?.interior) {
      this.interior = savedMeta.interior;
      this.generator = interiorGenerator(this.interior, descriptorFromMetadata(worldMeta).seed);
    }
    const interior = this.interior;
    if (interior)
      asInvalidInterior(() => {
        const state = savedRoomState(interior, savedMeta);
        this.generator = withInteriorGems(this.generator, interior, state);
      });
  }

  private createStreaming(records: RealmRecords, saveManager: SaveManager): RealmStreaming {
    const trafficRecords = this.vehicleRegistry
      ? new VehicleRecords(this.vehicleRegistry, records, saveManager)
      : undefined;
    return new RealmStreaming(
      this.world,
      records,
      this.propManager,
      saveManager,
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
      (key, seeded) => this.populateChunk(key, seeded),
      trafficRecords,
    );
  }

  private populateChunk(key: string, seeded: boolean): void {
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
  }

  /** Saved or freshly found arrival and camera; interiors arrive at their door. */
  private async loadedPlacement(savedMeta: SavedMeta | null) {
    this.lastLoadedGems = savedMeta?.gemsCollected ?? 0;
    const placement = savedMeta
      ? {
          cameraX: savedMeta.cameraX,
          cameraY: savedMeta.cameraY,
          cameraZoom: savedMeta.cameraZoom,
          playerX: savedMeta.playerX,
          playerY: savedMeta.playerY,
        }
      : await this.firstPlacement();
    const interior = this.interior;
    if (interior) {
      placement.playerX = buildingDoor(interior).arrival.wx;
      placement.playerY = buildingDoor(interior).arrival.wy;
      placement.cameraX = placement.playerX;
      placement.cameraY = placement.playerY;
      asInvalidInterior(() => {
        const state = savedRoomState(interior, savedMeta);
        this.installRoom(state);
        this.roomEditor = new GameplayRoomEditor(state, (next) => this.installRoom(next));
      });
    }
    return placement;
  }

  /** Find a walkable spawn point for a world without saved metadata. */
  private async firstPlacement() {
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
    const playerX = tempPlayer.position.wx;
    const playerY = tempPlayer.position.wy;
    const regional = this.generation.type === "regional";
    if (this.options.ambientSpawns !== false && !this.interior && !regional)
      spawnInitialChickens(5, this.world, this.entityManager, 0, 0);
    return {
      cameraX: regional ? playerX : 0,
      cameraY: regional ? playerY : 0,
      cameraZoom: 1,
      playerX,
      playerY,
    };
  }

  async ensureReady(range: ChunkRange): Promise<void> {
    await this.requireStreaming().ensure(range);
    // Explicit readiness fences may load chunks after the ordinary budgeted pass.
    // Publish complete terrain even when authority will stay paused after reload.
    this.world.computeAutotile(this.blendGraph);
    this.vehicleRegistry?.populate([range]);
    await this.railways?.prepare([range]);
  }

  async flushAsync(options?: FlushOptions): Promise<void> {
    await this.mutations.drain();
    for (const session of this.sessions.values()) this.savePlayerData(session);
    this.saveManager?.markMetaDirty();
    await this.saveManager?.flushAsync(options);
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
    this.physics.dispose();
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
    // A visiting car's transient shopper walks only while its car is simulated.
    for (const state of this.vehicleRegistry?.states.values() ?? [])
      for (const e of [state.entity, visitShopper(state)])
        if (
          e &&
          streaming.demand.get(actorScope(e.position))?.activity &&
          streaming.supported(e, dt)
        )
          result.set(e, dt);
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
