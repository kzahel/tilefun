import { BlendGraph } from "../autotile/BlendGraph.js";
import { TerrainAdjacency } from "../autotile/TerrainAdjacency.js";
import { CHUNK_SIZE_PX, TICK_RATE } from "../config/constants.js";
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
import { baseGameMod } from "../game/base-game.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { OnionStrategy } from "../generation/OnionStrategy.js";
import { DEFAULT_ROAD_PARAMS } from "../generation/RoadGenerator.js";
import type { TerrainStrategy } from "../generation/TerrainStrategy.js";
import { IdbPersistenceStore } from "../persistence/IdbPersistenceStore.js";
import type { SavedMeta } from "../persistence/SaveManager.js";
import { SaveManager } from "../persistence/SaveManager.js";
import {
  dbNameForWorld,
  type WorldMeta,
  WorldRegistry,
  type WorldType,
} from "../persistence/WorldRegistry.js";
import type { ClientMessage, GameStateMessage } from "../shared/protocol.js";
import { serializeChunk, serializeEntity, serializeProp } from "../shared/serialization.js";
import type { IServerTransport } from "../transport/Transport.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import { World } from "../world/World.js";
import { PlayerSession } from "./PlayerSession.js";
import { ServerLoop } from "./ServerLoop.js";
import { tickAllAI } from "./tickAllAI.js";
import type { Mod, Unsubscribe } from "./WorldAPI.js";
import { WorldAPIImpl } from "./WorldAPI.js";

export class GameServer {
  world: World;
  entityManager: EntityManager;
  propManager: PropManager;
  worldAPI: WorldAPIImpl;

  readonly blendGraph: BlendGraph;
  private adjacency: TerrainAdjacency;
  private terrainEditor: TerrainEditor;
  private saveManager: SaveManager | null = null;
  private registry: WorldRegistry;
  private currentWorldId: string | null = null;
  private gemSpawner = new GemSpawner();
  private baddieSpawner = new BaddieSpawner();
  private sessions = new Map<string, PlayerSession>();
  private transport: IServerTransport;
  private lastLoadedGems = 0;
  private lastLoadedCamera = { cameraX: 0, cameraY: 0, cameraZoom: 1 };
  private loop: ServerLoop | null = null;
  /** Tracks which chunk revisions each client has received (for delta sync). */
  private clientChunkRevisions = new Map<string, Map<string, number>>();
  /** When true, server broadcasts game state to clients after each tick. */
  broadcasting = false;
  /** Monotonic tick counter, incremented each tick. */
  private tickCounter = 0;
  private readonly mods: Mod[] = [baseGameMod];
  private modTeardowns = new Map<string, Unsubscribe>();

  constructor(transport: IServerTransport) {
    this.transport = transport;
    this.world = new World();
    this.entityManager = new EntityManager();
    this.propManager = new PropManager();
    this.blendGraph = new BlendGraph();
    this.adjacency = new TerrainAdjacency(this.blendGraph);
    this.terrainEditor = new TerrainEditor(this.world, () => {}, this.adjacency);
    this.registry = new WorldRegistry();
    this.worldAPI = this.createWorldAPI();
    this.registerMods();
  }

  async init(): Promise<void> {
    // Register transport handlers
    this.start();

    await this.registry.open();

    // Load most recent world, or create a default one
    const worlds = await this.registry.listWorlds();
    const firstWorld = worlds[0];
    if (firstWorld) {
      console.log("[tilefun] loading existing world:", firstWorld.id, firstWorld.name);
      await this.loadWorld(firstWorld.id);
    } else {
      console.warn("[tilefun] no worlds found in registry — creating new world");
      const meta = await this.registry.createWorld("My World");
      await this.loadWorld(meta.id);
    }
  }

  /** Register transport handlers. */
  start(): void {
    this.transport.onMessage((clientId, msg) => {
      this.handleMessage(clientId, msg);
    });

    this.transport.onConnect((clientId) => {
      // Use the existing player from loadWorld if available
      const existingPlayer = this.entityManager.entities.find((e) => e.type === "player");
      const player = existingPlayer ?? createPlayer(0, 0);
      if (!existingPlayer) {
        this.entityManager.spawn(player);
      }
      const session = new PlayerSession(clientId, player);
      session.gameplaySession.gemsCollected = this.lastLoadedGems;
      session.cameraX = this.lastLoadedCamera.cameraX;
      session.cameraY = this.lastLoadedCamera.cameraY;
      session.cameraZoom = this.lastLoadedCamera.cameraZoom;
      this.sessions.set(clientId, session);

      // Send initial camera position so client knows where to look
      this.transport.send(clientId, {
        type: "world-loaded",
        cameraX: this.lastLoadedCamera.cameraX,
        cameraY: this.lastLoadedCamera.cameraY,
        cameraZoom: this.lastLoadedCamera.cameraZoom,
      });
    });

    this.transport.onDisconnect((clientId) => {
      this.sessions.delete(clientId);
      this.clientChunkRevisions.delete(clientId);
    });
  }

  getLocalSession(): PlayerSession {
    const session = this.sessions.get("local");
    if (!session) throw new Error("No local session");
    return session;
  }

  /** Start independent tick loop (for serialized/remote mode). */
  startLoop(): void {
    if (this.loop) return;
    this.broadcasting = true;
    this.loop = new ServerLoop((dt) => {
      this.tick(dt);
    });
    this.loop.start();
  }

  /** Stop independent tick loop. */
  stopLoop(): void {
    this.loop?.stop();
    this.loop = null;
    this.broadcasting = false;
  }

  /** Run one simulation tick. In local mode, called by client's update(). */
  tick(dt: number): void {
    this.tickCounter++;

    for (const session of this.sessions.values()) {
      // 1. Apply player inputs (drain queue — process ALL queued inputs)
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
          updatePlayerFromInput(session.player, inputs[i], dt);
          if (session.player.velocity && session.player.collider && !session.debugNoclip) {
            const speedMult = getSpeedMultiplier(session.player.position, getCollision);
            const pdx = session.player.velocity.vx * dt * speedMult;
            const pdy = session.player.velocity.vy * dt * speedMult;
            resolveCollision(session.player, pdx, pdy, getCollision, blockMask, extraBlocker);
          } else if (session.player.velocity) {
            session.player.position.wx += session.player.velocity.vx * dt;
            session.player.position.wy += session.player.velocity.vy * dt;
          }
          session.lastProcessedInputSeq = inputs[i].seq;
        }

        // Last input goes through normal path (EntityManager handles movement
        // including push mechanics, entity-entity collision, etc.)
        const lastInput = inputs[inputs.length - 1];
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

      // 2. AI + Physics (skip if paused)
      if (!session.debugPaused) {
        // Compute per-entity tick tiers (near=every frame, mid=accumulated, far=frozen)
        const entityTickDts = this.computeEntityTickDts(session.player, session.visibleRange, dt);

        tickAllAI(this.entityManager.entities, session.player.position, entityTickDts, Math.random);

        // ── TickService.preSimulation ──
        this.worldAPI.tick.firePre(dt);

        // Noclip: temporarily remove player collider
        let savedCollider: ColliderComponent | null = null;
        if (session.debugNoclip && session.player.collider) {
          savedCollider = session.player.collider;
          session.player.collider = null;
        }

        this.entityManager.update(
          dt,
          (tx, ty) => this.world.getCollisionIfLoaded(tx, ty),
          session.player,
          this.propManager,
          entityTickDts,
        );

        if (savedCollider) {
          session.player.collider = savedCollider;
        }

        // ── TickService.postSimulation ──
        this.worldAPI.tick.firePost(dt);

        // ── TagService removal detection ──
        this.worldAPI.tags.tick();

        // ── OverlapService detection ──
        this.worldAPI.overlap.tick();
      }

      // 3. Spawners + gameplay (play mode only, not paused)
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
    if (this.broadcasting) {
      for (const session of this.sessions.values()) {
        // Compute autotile for chunks in this client's visible range
        if (session.visibleRange) {
          this.updateVisibleChunks(session.visibleRange);
        }
        const msg = this.buildGameState(session.clientId);
        this.transport.send(session.clientId, msg);
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

  async loadWorld(
    worldId: string,
  ): Promise<{ cameraX: number; cameraY: number; cameraZoom: number }> {
    // Close previous save manager
    if (this.saveManager) {
      this.saveManager.flush();
      this.saveManager.close();
    }

    // Create fresh world state with the correct generation strategy
    const worldMeta = await this.registry.getWorld(worldId);
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
    const dbName = dbNameForWorld(worldId);
    const store = new IdbPersistenceStore(dbName, ["chunks", "meta"]);
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
    await this.registry.updateLastPlayed(worldId);

    // Store and apply camera to sessions
    this.lastLoadedCamera = { cameraX, cameraY, cameraZoom };
    for (const session of this.sessions.values()) {
      session.cameraX = cameraX;
      session.cameraY = cameraY;
      session.cameraZoom = cameraZoom;
    }

    // Reset per-client chunk tracking so all chunks get re-sent
    this.clientChunkRevisions.clear();

    // Notify connected clients of the new world/camera position
    if (this.broadcasting) {
      this.transport.broadcast({
        type: "world-loaded",
        cameraX,
        cameraY,
        cameraZoom,
      });
    }

    return { cameraX, cameraY, cameraZoom };
  }

  async createWorld(name: string, worldType?: WorldType, seed?: number): Promise<WorldMeta> {
    return this.registry.createWorld(name, worldType, seed);
  }

  async deleteWorld(id: string): Promise<void> {
    // Close the SaveManager connection BEFORE deleting the database,
    // otherwise indexedDB.deleteDatabase() blocks on the open connection.
    if (id === this.currentWorldId && this.saveManager) {
      this.saveManager.flush();
      this.saveManager.close();
      this.saveManager = null;
    }
    await this.registry.deleteWorld(id);
  }

  async listWorlds(): Promise<WorldMeta[]> {
    return this.registry.listWorlds();
  }

  async renameWorld(id: string, name: string): Promise<void> {
    await this.registry.renameWorld(id, name);
  }

  flush(): void {
    this.saveManager?.flush();
  }

  destroy(): void {
    for (const teardown of this.modTeardowns.values()) {
      teardown();
    }
    this.modTeardowns.clear();
    this.stopLoop();
    this.saveManager?.flush();
    this.saveManager?.close();
    this.transport.close();
  }

  /**
   * Number of extra chunks beyond the client's visible range to include
   * when filtering entities/props for broadcast. Prevents pop-in at edges.
   */
  private static readonly BROADCAST_BUFFER_CHUNKS = 2;

  /** Extra chunks beyond broadcast range that get reduced tick rate. */
  private static readonly MID_TICK_BUFFER = 6;
  /** Frames between ticks for mid-tier entities. */
  private static readonly MID_TICK_FRAMES = 4;

  /**
   * Compute per-entity tick dts based on distance from the player's viewport.
   * Near entities tick every frame; mid-tier entities accumulate dt and tick
   * every few frames with the accumulated value; far entities are frozen.
   */
  private computeEntityTickDts(player: Entity, range: ChunkRange, dt: number): Map<Entity, number> {
    const result = new Map<Entity, number>();
    const nearBuf = GameServer.BROADCAST_BUFFER_CHUNKS;
    const midBuf = nearBuf + GameServer.MID_TICK_BUFFER;
    const midInterval = GameServer.MID_TICK_FRAMES / TICK_RATE;

    for (const entity of this.entityManager.entities) {
      if (entity === player) {
        result.set(entity, dt);
        continue;
      }

      const cx = Math.floor(entity.position.wx / CHUNK_SIZE_PX);
      const cy = Math.floor(entity.position.wy / CHUNK_SIZE_PX);

      // Near tier: within visible range + broadcast buffer → every frame
      if (
        cx >= range.minCx - nearBuf &&
        cx <= range.maxCx + nearBuf &&
        cy >= range.minCy - nearBuf &&
        cy <= range.maxCy + nearBuf
      ) {
        result.set(entity, dt);
        entity.tickAccumulator = 0;
        continue;
      }

      // Mid tier: within extended range → reduced tick rate with accumulated dt
      if (
        cx >= range.minCx - midBuf &&
        cx <= range.maxCx + midBuf &&
        cy >= range.minCy - midBuf &&
        cy <= range.maxCy + midBuf
      ) {
        const acc = (entity.tickAccumulator ?? 0) + dt;
        if (acc >= midInterval) {
          result.set(entity, acc);
          entity.tickAccumulator = 0;
        } else {
          entity.tickAccumulator = acc;
        }
        continue;
      }

      // Far tier: frozen (not in map, velocity zeroed by tickAllAI)
      entity.tickAccumulator = 0;
    }

    return result;
  }

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

    // Collect loaded chunk keys and build delta updates
    const loadedChunkKeys: string[] = [];
    const chunkUpdates = [];
    for (const [key, chunk] of this.world.chunks.entries()) {
      loadedChunkKeys.push(key);
      const lastRev = revisions.get(key) ?? -1;
      if (chunk.revision > lastRev) {
        const commaIdx = key.indexOf(",");
        const cx = Number(key.slice(0, commaIdx));
        const cy = Number(key.slice(commaIdx + 1));
        chunkUpdates.push(serializeChunk(cx, cy, chunk));
        revisions.set(key, chunk.revision);
      }
    }

    // Clean up revisions for unloaded chunks
    for (const key of revisions.keys()) {
      if (
        !this.world.chunks.get(
          Number(key.slice(0, key.indexOf(","))),
          Number(key.slice(key.indexOf(",") + 1)),
        )
      ) {
        revisions.delete(key);
      }
    }

    // Filter entities and props to those near the player's viewport
    const buf = GameServer.BROADCAST_BUFFER_CHUNKS;
    const range = session.visibleRange;
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
    };
  }

  // ---- Private ----

  private handleMessage(clientId: string, msg: ClientMessage): void {
    const session = this.sessions.get(clientId);
    if (!session) return;

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
        this.handleInteract(msg.wx, msg.wy);
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

      case "load-world":
        this.loadWorld(msg.worldId).then((cam) => {
          this.transport.send(clientId, {
            type: "world-loaded",
            requestId: msg.requestId,
            cameraX: cam.cameraX,
            cameraY: cam.cameraY,
            cameraZoom: cam.cameraZoom,
          });
        });
        break;

      case "create-world":
        this.createWorld(msg.name, msg.worldType, msg.seed).then((meta) => {
          this.transport.send(clientId, {
            type: "world-created",
            requestId: msg.requestId,
            meta,
          });
        });
        break;

      case "delete-world":
        this.deleteWorld(msg.worldId).then(() => {
          this.transport.send(clientId, {
            type: "world-deleted",
            requestId: msg.requestId,
          });
        });
        break;

      case "list-worlds":
        this.listWorlds().then((worlds) => {
          this.transport.send(clientId, {
            type: "world-list",
            requestId: msg.requestId,
            worlds,
          });
        });
        break;

      case "rename-world":
        this.renameWorld(msg.worldId, msg.name).then(() => {
          this.transport.send(clientId, {
            type: "world-renamed",
            requestId: msg.requestId,
          });
        });
        break;
    }
  }

  private handleInteract(wx: number, wy: number): void {
    this.worldAPI.events.emit("player-interact", { wx, wy });
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
