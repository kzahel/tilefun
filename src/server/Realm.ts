import { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { CHUNK_SIZE_PX, RENDER_DISTANCE, TICK_RATE } from "../config/constants.js";
import { TerrainEditor } from "../editor/TerrainEditor.js";
import { BaddieSpawner } from "../entities/BaddieSpawner.js";
import {
  type AABB,
  aabbOverlapsAnyEntity,
  aabbOverlapsPropWalls,
  getEntityAABB,
  getSpeedMultiplier,
  resolveCollision,
} from "../entities/collision.js";
import type { ColliderComponent, Entity } from "../entities/Entity.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { EntityManager } from "../entities/EntityManager.js";
import { findWalkableSpawn, spawnInitialChickens } from "../entities/EntitySpawner.js";
import { GemSpawner } from "../entities/GemSpawner.js";
import { createPlayer, updatePlayerFromInput } from "../entities/Player.js";
import { createProp, isPropType } from "../entities/PropFactories.js";
import { PropManager } from "../entities/PropManager.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { OnionStrategy } from "../generation/OnionStrategy.js";
import { DEFAULT_ROAD_PARAMS } from "../generation/RoadGenerator.js";
import type { TerrainStrategy } from "../generation/TerrainStrategy.js";
import type { IWorldRegistry } from "../persistence/IWorldRegistry.js";
import type { PersistenceStore } from "../persistence/PersistenceStore.js";
import type { SavedMeta } from "../persistence/SaveManager.js";
import { SaveManager } from "../persistence/SaveManager.js";
import type { WorldMeta, WorldType } from "../persistence/WorldRegistry.js";
import type { ClientMessage, GameStateMessage, RemoteEditorCursor } from "../shared/protocol.js";
import { serializeChunk, serializeEntity, serializeProp } from "../shared/serialization.js";
import type { IServerTransport } from "../transport/Transport.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { World } from "../world/World.js";
import type { PlayerSession } from "./PlayerSession.js";
import { tickAllAI } from "./tickAllAI.js";
import type { Mod, Unsubscribe } from "./WorldAPI.js";
import { WorldAPIImpl } from "./WorldAPI.js";

/**
 * A Realm encapsulates all per-world server state:
 * World, EntityManager, PropManager, WorldAPI, persistence, spawners, etc.
 *
 * In the single-world case, GameServer holds one Realm and delegates to it.
 * In multi-world mode (future), GameServer holds multiple Realms.
 */
export class Realm {
  world: World;
  entityManager: EntityManager;
  propManager: PropManager;
  worldAPI: WorldAPIImpl;
  readonly blendGraph: BlendGraph;

  private adjacency: TerrainAdjacency;
  terrainEditor: TerrainEditor;
  saveManager: SaveManager | null = null;
  private gemSpawner = new GemSpawner();
  private baddieSpawner = new BaddieSpawner();

  /** Sessions currently in this realm. */
  readonly sessions = new Map<string, PlayerSession>();
  /** Per-client chunk revision tracking for delta sync. */
  private clientChunkRevisions = new Map<string, Map<string, number>>();
  /** Monotonic tick counter. */
  private tickCounter = 0;

  lastLoadedGems = 0;
  lastLoadedCamera = { cameraX: 0, cameraY: 0, cameraZoom: 1 };
  currentWorldId: string | null = null;

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

  /** Clear per-client chunk revision tracking (forces full re-send). */
  clearClientRevisions(clientId: string): void {
    this.clientChunkRevisions.delete(clientId);
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

    // ── Phase 1: Process player inputs (per-session) ──
    // Drain each session's input queue and set player velocity.
    // This must happen before physics so EntityManager sees correct velocities.
    for (const session of this.sessions.values()) {
      if (dormantClientIds.has(session.clientId)) continue;
      if (!session.editorEnabled && session.inputQueue.length > 0) {
        const inputs = session.inputQueue;
        session.inputQueue = [];
        const getCollision = (tx: number, ty: number) => this.world.getCollisionIfLoaded(tx, ty);
        const blockMask = CollisionFlag.Solid | CollisionFlag.Water;

        // Extra blocker for simplified collision — props + solid entities.
        // Matches makeExtraBlocker in EntityManager but without push mechanics.
        const playerExclude = new Set([session.player.id]);
        const extraBlocker = (aabb: AABB): boolean => {
          const minCx = Math.floor(aabb.left / CHUNK_SIZE_PX);
          const maxCx = Math.floor(aabb.right / CHUNK_SIZE_PX);
          const minCy = Math.floor(aabb.top / CHUNK_SIZE_PX);
          const maxCy = Math.floor(aabb.bottom / CHUNK_SIZE_PX);
          for (const prop of this.propManager.getPropsInChunkRange(minCx, minCy, maxCx, maxCy)) {
            if (aabbOverlapsPropWalls(aabb, prop.position, prop)) return true;
          }
          const nearby = this.entityManager.spatialHash.queryRange(minCx, minCy, maxCx, maxCy);
          return aabbOverlapsAnyEntity(aabb, playerExclude, nearby);
        };

        // Process extra inputs (all but last) with simplified collision.
        // This handles the case where timing jitter causes 2+ client ticks
        // between server ticks — without this, inputs are lost and prediction
        // diverges, causing visible jitter.
        for (let i = 0; i < inputs.length - 1; i++) {
          const input = inputs[i]!;
          updatePlayerFromInput(session.player, input, dt);
          if (session.player.velocity && session.player.collider && !session.debugNoclip) {
            const speedMult = getSpeedMultiplier(session.player.position, getCollision);
            const pdx = session.player.velocity.vx * dt * speedMult;
            const pdy = session.player.velocity.vy * dt * speedMult;
            resolveCollision(session.player, pdx, pdy, getCollision, blockMask, extraBlocker);
          } else if (session.player.velocity) {
            session.player.position.wx += session.player.velocity.vx * dt;
            session.player.position.wy += session.player.velocity.vy * dt;
          }
          session.lastProcessedInputSeq = input.seq;
        }

        // Last input goes through normal path (EntityManager handles movement
        // including push mechanics, entity-entity collision, etc.)
        const lastInput = inputs[inputs.length - 1]!;
        updatePlayerFromInput(session.player, lastInput, dt);
        session.lastProcessedInputSeq = lastInput.seq;
      } else if (!session.editorEnabled && session.player.velocity) {
        // No input this tick (timing jitter between client RAF and server
        // setInterval). Zero velocity so EntityManager.update() doesn't
        // advance the player — the client didn't predict any movement for
        // this tick either, so the server must stay in sync.
        session.player.velocity.vx = 0;
        session.player.velocity.vy = 0;
      }
    }

    // ── Phase 2: AI + Physics (once, not per-session) ──
    // Previously this ran inside the per-session loop, meaning N sessions
    // caused N entity updates per tick — doubling/tripling movement speed.
    const activeSessions = [...this.sessions.values()].filter(
      (s) => !s.debugPaused && !dormantClientIds.has(s.clientId),
    );
    if (activeSessions.length > 0) {
      // Merge entity tick tiers across all active sessions' visible ranges
      const entityTickDts = this.computeEntityTickDtsMulti(activeSessions, dt);

      // AI: pass nearest player position per entity (for chase/follow)
      const playerPositions = activeSessions.map((s) => s.player.position);
      tickAllAI(this.entityManager.entities, playerPositions, entityTickDts, Math.random);

      // ── TickService.preSimulation ──
      this.worldAPI.tick.firePre(dt);

      // Noclip: temporarily remove player colliders
      const savedColliders = new Map<PlayerSession, ColliderComponent>();
      for (const session of activeSessions) {
        if (session.debugNoclip && session.player.collider) {
          savedColliders.set(session, session.player.collider);
          session.player.collider = null;
        }
      }

      const players = activeSessions.map((s) => s.player);
      this.entityManager.update(
        dt,
        (tx, ty) => this.world.getCollisionIfLoaded(tx, ty),
        players,
        this.propManager,
        entityTickDts,
      );

      // Restore noclip colliders
      for (const [session, collider] of savedColliders) {
        session.player.collider = collider;
      }

      // ── TickService.postSimulation ──
      this.worldAPI.tick.firePost(dt);

      // ── TagService removal detection ──
      this.worldAPI.tags.tick();

      // ── OverlapService detection ──
      this.worldAPI.overlap.tick();
    }

    // ── Phase 3: Spawners (per-session, near each player) ──
    for (const session of this.sessions.values()) {
      if (dormantClientIds.has(session.clientId)) continue;
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
      }
    }

    this.worldAPI.advanceTime(dt);

    // Broadcast state to all clients (serialized mode)
    if (broadcasting) {
      // Compute the union of all sessions' visible ranges so that one
      // session's updateVisibleChunks can't unload another session's chunks.
      let unionRange: ChunkRange | null = null;
      for (const session of this.sessions.values()) {
        if (dormantClientIds.has(session.clientId)) continue;
        const r = session.visibleRange;
        if (r) {
          if (!unionRange) {
            unionRange = { minCx: r.minCx, minCy: r.minCy, maxCx: r.maxCx, maxCy: r.maxCy };
          } else {
            unionRange.minCx = Math.min(unionRange.minCx, r.minCx);
            unionRange.minCy = Math.min(unionRange.minCy, r.minCy);
            unionRange.maxCx = Math.max(unionRange.maxCx, r.maxCx);
            unionRange.maxCy = Math.max(unionRange.maxCy, r.maxCy);
          }
        }
      }
      if (unionRange) {
        this.updateVisibleChunks(unionRange);
      }

      for (const session of this.sessions.values()) {
        if (dormantClientIds.has(session.clientId)) continue;
        const msg = this.buildGameState(session.clientId);
        transport.send(session.clientId, msg);
      }
    }
  }

  /** Load/unload chunks for the given visible range and compute autotile. */
  updateVisibleChunks(range: ChunkRange): void {
    this.world.updateLoadedChunks(range);
    this.world.computeAutotile(this.blendGraph);
  }

  /** Mark all chunks for re-render (debug mode changes). */
  invalidateAllChunks(): void {
    this.terrainEditor.invalidateAllChunks();
  }

  /** Handle a realm-scoped client message. */
  handleMessage(_clientId: string, session: PlayerSession, msg: ClientMessage): void {
    switch (msg.type) {
      case "player-input":
        session.inputQueue.push({
          dx: msg.dx,
          dy: msg.dy,
          sprinting: msg.sprinting,
          seq: msg.seq,
        });
        break;

      case "player-interact":
        this.worldAPI.events.emit("player-interact", { wx: msg.wx, wy: msg.wy });
        break;

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

      case "edit-delete-prop":
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
        break;

      case "editor-cursor":
        session.editorCursor = {
          tileX: msg.tileX,
          tileY: msg.tileY,
          editorTab: msg.editorTab,
          brushMode: msg.brushMode,
        };
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
        this.updateVisibleChunks(session.visibleRange);
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
  ): Promise<{ cameraX: number; cameraY: number; cameraZoom: number }> {
    // Close previous save manager
    if (this.saveManager) {
      this.saveManager.flush();
      this.saveManager.close();
    }

    // Create fresh world state with the correct generation strategy
    const worldMeta = await registry.getWorld(worldId);
    this.world = new World(this.buildStrategy(worldMeta));
    this.entityManager = new EntityManager();
    this.propManager = new PropManager();

    // Create player and session
    const player = createPlayer(0, 0);
    this.entityManager.spawn(player);

    // Update all sessions with new player
    for (const session of this.sessions.values()) {
      session.player = player;
      session.gameplaySession = {
        player,
        gemsCollected: 0,
        invincibilityTimer: 0,
        knockbackVx: 0,
        knockbackVy: 0,
      };
    }

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
    const savedChunks = await this.saveManager.loadChunks();

    let cameraX = 0;
    let cameraY = 0;
    let cameraZoom = 1;

    console.log(`[tilefun] loadWorld ${worldId}: ${savedChunks.size} chunks, meta=${!!savedMeta}`);
    if (savedMeta && savedChunks.size > 0) {
      this.world.chunks.setSavedData(savedChunks);
      cameraX = savedMeta.cameraX;
      cameraY = savedMeta.cameraY;
      cameraZoom = savedMeta.cameraZoom;
      player.position.wx = savedMeta.playerX;
      player.position.wy = savedMeta.playerY;
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
      for (const session of this.sessions.values()) {
        session.gameplaySession.gemsCollected = this.lastLoadedGems;
      }
    } else {
      this.lastLoadedGems = 0;
      findWalkableSpawn(player, this.world);
      spawnInitialChickens(5, this.world, this.entityManager);
    }

    this.gemSpawner.reset(this.entityManager);
    this.baddieSpawner.reset(this.entityManager);

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
    await registry.updateLastPlayed(worldId);

    // Store and apply camera to sessions
    this.lastLoadedCamera = { cameraX, cameraY, cameraZoom };
    for (const session of this.sessions.values()) {
      session.cameraX = cameraX;
      session.cameraY = cameraY;
      session.cameraZoom = cameraZoom;
    }

    // Reset per-client chunk tracking so all chunks get re-sent
    this.clientChunkRevisions.clear();

    return { cameraX, cameraY, cameraZoom };
  }

  flush(): void {
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

  // ---- Private ----

  /** Build a game-state message for a specific client, with delta chunk sync. */
  private buildGameState(clientId: string): GameStateMessage {
    const session = this.sessions.get(clientId);
    if (!session) throw new Error(`No session for ${clientId}`);

    // Track which chunk revisions this client has seen
    let revisions = this.clientChunkRevisions.get(clientId);
    if (!revisions) {
      revisions = new Map();
      this.clientChunkRevisions.set(clientId, revisions);
    }

    // Collect loaded chunk keys and build delta updates.
    // Only include chunks within this session's visible range (+ RENDER_DISTANCE
    // buffer) so we don't send chunks loaded for other sessions.
    const range = session.visibleRange;
    const chunkBuf = RENDER_DISTANCE;
    const cMinCx = range.minCx - chunkBuf;
    const cMaxCx = range.maxCx + chunkBuf;
    const cMinCy = range.minCy - chunkBuf;
    const cMaxCy = range.maxCy + chunkBuf;

    const loadedChunkKeys: string[] = [];
    const chunkUpdates = [];
    for (const [key, chunk] of this.world.chunks.entries()) {
      const commaIdx = key.indexOf(",");
      const cx = Number(key.slice(0, commaIdx));
      const cy = Number(key.slice(commaIdx + 1));
      if (cx < cMinCx || cx > cMaxCx || cy < cMinCy || cy > cMaxCy) continue;
      loadedChunkKeys.push(key);
      const lastRev = revisions.get(key) ?? -1;
      if (chunk.revision > lastRev) {
        chunkUpdates.push(serializeChunk(cx, cy, chunk));
        revisions.set(key, chunk.revision);
      }
    }

    // Clean up revisions for chunks no longer in this session's range
    for (const key of revisions.keys()) {
      const ci = key.indexOf(",");
      const kcx = Number(key.slice(0, ci));
      const kcy = Number(key.slice(ci + 1));
      if (kcx < cMinCx || kcx > cMaxCx || kcy < cMinCy || kcy > cMaxCy) {
        revisions.delete(key);
      }
    }

    // Filter entities and props to those near the player's viewport
    const buf = Realm.BROADCAST_BUFFER_CHUNKS;
    const nearbyEntities = this.entityManager.spatialHash.queryRange(
      range.minCx - buf,
      range.minCy - buf,
      range.maxCx + buf,
      range.maxCy + buf,
    );
    // Ensure the player entity is always included
    if (!nearbyEntities.includes(session.player)) {
      nearbyEntities.push(session.player);
    }
    const nearbyProps = this.propManager.getPropsInChunkRange(
      range.minCx - buf,
      range.minCy - buf,
      range.maxCx + buf,
      range.maxCy + buf,
    );

    // Collect other players' editor cursors
    const editorCursors: RemoteEditorCursor[] = [];
    const playerNames: Record<number, string> = {};
    for (const [otherId, other] of this.sessions) {
      playerNames[other.player.id] = other.displayName;
      if (otherId === clientId || !other.editorEnabled || !other.editorCursor) continue;
      editorCursors.push({
        displayName: other.displayName,
        color: other.cursorColor,
        tileX: other.editorCursor.tileX,
        tileY: other.editorCursor.tileY,
        editorTab: other.editorCursor.editorTab,
        brushMode: other.editorCursor.brushMode,
      });
    }

    return {
      type: "game-state",
      serverTick: this.tickCounter,
      lastProcessedInputSeq: session.lastProcessedInputSeq,
      entities: nearbyEntities.map(serializeEntity),
      props: nearbyProps.map(serializeProp),
      playerEntityId: session.player.id,
      gemsCollected: session.gameplaySession.gemsCollected,
      invincibilityTimer: session.gameplaySession.invincibilityTimer,
      editorEnabled: session.editorEnabled,
      loadedChunkKeys,
      chunkUpdates,
      editorCursors,
      playerNames,
    };
  }

  private handleSpawn(entityType: string, wx: number, wy: number): void {
    let changed = false;
    if (isPropType(entityType)) {
      const prop = createProp(entityType, wx, wy);
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
    let cameraX = 0;
    let cameraY = 0;
    let cameraZoom = 1;
    let gemsCollected = 0;
    let player: Entity | undefined;

    for (const session of this.sessions.values()) {
      cameraX = session.cameraX;
      cameraY = session.cameraY;
      cameraZoom = session.cameraZoom;
      gemsCollected = session.gameplaySession.gemsCollected;
      player = session.player;
      break;
    }

    const entities = this.entityManager.entities.map((e) => ({
      type: e.type,
      wx: e.position.wx,
      wy: e.position.wy,
    }));
    for (const p of this.propManager.props) {
      entities.push({ type: p.type, wx: p.position.wx, wy: p.position.wy });
    }

    return {
      playerX: player?.position.wx ?? 0,
      playerY: player?.position.wy ?? 0,
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
    const midInterval = Realm.MID_TICK_FRAMES / TICK_RATE;

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
    const type: WorldType = meta?.worldType ?? "generated";
    const seed = meta?.seed ?? 42;
    const roadParams = { ...DEFAULT_ROAD_PARAMS, ...meta?.roadParams };
    switch (type) {
      case "flat":
        return new FlatStrategy();
      case "island":
        return new OnionStrategy(seed, 12, roadParams);
      default:
        return new OnionStrategy(seed, 0, roadParams);
    }
  }
}
