import type { BlendGraph } from "../autotile/BlendGraph.js";
import {
  applyPlayerModel,
  isPlayerModel,
  normalizePlayerModel,
} from "../characters/PlayerModels.js";
import { TICK_RATE, TILE_SIZE } from "../config/constants.js";
import { ConsoleEngine } from "../console/ConsoleEngine.js";
import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import { baseGameMod } from "../game/base-game.js";
import {
  createDescriptor,
  descriptorFromMetadata,
  descriptorKey,
  type GenerationRequest,
  resolveCreation,
} from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { DistrictStrategy } from "../generation/regional/DistrictStrategy.js";
import type { Bounds } from "../generation/regional/RegionalPlanner.js";
import { buildingDoor, exteriorDoors, withBuildingLayout } from "../interiors/BuildingDoors.js";
import {
  atDoorThreshold,
  DOOR_FADE_MS,
  DOOR_WALK_MS,
  type DoorMotion,
  exteriorDoorWalkAnchor,
  towardDoor,
} from "../interiors/DoorTraversal.js";
import {
  exteriorEntrance,
  type InteriorIdentity,
  InvalidInteriorError,
  interiorRealmId,
  parseInteriorId,
} from "../interiors/GameplayInterior.js";
import type { IWorldRegistry, WorldMeta, WorldType } from "../persistence/IWorldRegistry.js";
import type { PersistenceStore } from "../persistence/PersistenceStore.js";
import { PLAYER_LOCATIONS_STORE, PlayerLocationStore } from "../persistence/PlayerLocationStore.js";
import { recreationGeneration, worldCompatibility } from "../persistence/WorldCompatibility.js";
import {
  type InspectionSnapshot,
  readInspection,
  validateInspection,
} from "../persistence/WorldInspection.js";
import { WorldStorePool } from "../persistence/WorldStorePool.js";
import { setServerPhysicsMult, setServerTickMs } from "../physics/PlayerMovement.js";
import type { ClientMessage, RealmInfo, WorldMapMessage } from "../shared/protocol.js";
import type { IServerTransport } from "../transport/Transport.js";
import { PlayerSession } from "./PlayerSession.js";
import { Realm } from "./Realm.js";
import { type RealmDestination, RealmTransitions } from "./RealmTransitions.js";
import { type Arrival, safeArrival } from "./SafeArrival.js";
import { ServerLoop } from "./ServerLoop.js";
import type { WorldAPIImpl } from "./WorldAPI.js";

const CURSOR_COLORS = [
  "#4fc3f7",
  "#ff8a65",
  "#81c784",
  "#ba68c8",
  "#fff176",
  "#f06292",
  "#4dd0e1",
  "#a1887f",
];

export interface GameServerDeps {
  registry: IWorldRegistry;
  createStore: (worldId: string) => PersistenceStore;
  /** Node hosts supply an explicit policy; in-browser hosts keep trusted co-op. */
  authorizeAdmin?: (clientId: string, token?: string) => boolean;
}

export class GameServer {
  teleport(session: PlayerSession, wx: number, wy: number): void {
    const realm = this.realms.get(session.realmId ?? "");
    if (
      !realm ||
      !Number.isFinite(wx) ||
      !Number.isFinite(wy) ||
      Math.abs(wx) > 2 ** 28 ||
      Math.abs(wy) > 2 ** 28
    )
      throw new Error("Invalid teleport destination.");
    const move = async () => {
      await realm.ensureReady({
        minCx: Math.floor(wx / 256) - 3,
        maxCx: Math.floor(wx / 256) + 3,
        minCy: Math.floor(wy / 256) - 3,
        maxCy: Math.floor(wy / 256) + 3,
      });
      if (session.realmId !== realm.currentWorldId || session.retired) return;
      realm.vehicles.exit(session, true);
      delete session.player.airMomentumX;
      delete session.player.airMomentumY;
      session.player.position = { wx, wy };
      realm.savePlayerData(session);
    };
    void this.trackOperation(move()).catch((error) =>
      this.transport.send(session.clientId, {
        type: "storage-status",
        paused: false,
        message: String(error),
      }),
    );
  }
  get persistenceDiagnostics() {
    return [...this.realms.values()].map((realm) => realm.persistenceDiagnostics);
  }
  completedTicks = 0;
  onLoopError: ((error: unknown) => void) | undefined;
  private readonly pendingOperations = new Set<Promise<unknown>>();

  /** Track durable/realm operations without holding ordinary command admission. */
  private trackOperation<T>(operation: Promise<T>): Promise<T> {
    this.pendingOperations.add(operation);
    void operation.then(
      () => this.pendingOperations.delete(operation),
      () => this.pendingOperations.delete(operation),
    );
    return operation;
  }

  /** Lifecycle fence only: ordinary input and interest never await this. */
  async settle(): Promise<void> {
    while (this.pendingOperations.size) await Promise.allSettled([...this.pendingOperations]);
  }

  /** Player speed multiplier (set via sv_speed cvar). */
  speedMultiplier = 1;
  /** Server time scale (set via sv_timescale cvar). */
  timeScale = 1;
  /** Current server command tick interval in ms. */
  private _tickMs = 1000 / TICK_RATE;
  /** Physics substeps per command tick. */
  private _physicsMult = 1;

  /** All active realms, keyed by worldId. */
  private readonly realms = new Map<string, Realm>();
  private readonly retiringRealms = new Map<string, Promise<void>>();
  private readonly loadingRealms = new Map<string, Promise<Realm>>();
  /** The default realm's worldId (set during init, used for new connections). */
  private defaultRealmId: string | null = null;
  /** Master session list — every connected player, regardless of realm. */
  private readonly sessions = new Map<string, PlayerSession>();
  private readonly transport: IServerTransport;
  private readonly registry: IWorldRegistry;
  private readonly createStore: (worldId: string) => PersistenceStore;
  private readonly authorizeAdmin: (clientId: string, token?: string) => boolean;
  private loop: ServerLoop | null = null;
  private locations: PlayerLocationStore | null = null;
  private lastCheckpoint = Date.now();
  private checkpointPending = false;
  /** When true, server broadcasts game state to clients after each tick. */
  broadcasting = false;
  /** Monotonic player number, incremented on each connect. */
  private nextPlayerNumber = 1;
  /** Sessions that disconnected but may reconnect within the grace period. */
  private dormantSessions = new Map<string, ReturnType<typeof setTimeout>>();
  private static readonly DORMANT_TIMEOUT_MS = 60_000;
  /** How long an empty (non-default) realm stays loaded before being destroyed. */
  private static readonly REALM_IDLE_TIMEOUT_MS = 5 * 60 * 1000;
  private serverConsole: ConsoleEngine | null = null;
  private readonly transitions = new RealmTransitions(
    (id) => this.realms.get(id),
    (session, realm) => this.saveLocation(session, realm),
    (oldId, newId) => {
      if (oldId) {
        this.tryUnloadRealm(oldId);
        this.broadcastRealmPlayerCount(oldId);
      }
      if (newId !== oldId) this.broadcastRealmPlayerCount(newId);
    },
  );

  // ── Delegation getters for backward compatibility ──
  // External code (LocalStateView, tests, serverCommands) accesses these fields.
  // They delegate to the default realm.

  private get activeRealm(): Realm {
    const selectedId = this.sessions.get("local")?.realmId ?? this.defaultRealmId;
    const realm = selectedId ? this.realms.get(selectedId) : undefined;
    if (!realm) throw new Error("No active realm");
    return realm;
  }

  get worldInterior() {
    return this.activeRealm.interior;
  }
  get worldRoomState() {
    return this.activeRealm.roomState;
  }
  get worldGeneration() {
    return this.activeRealm.generation;
  }

  get world() {
    return this.activeRealm.world;
  }
  get entityManager(): EntityManager {
    return this.activeRealm.entityManager;
  }
  get propManager(): PropManager {
    return this.activeRealm.propManager;
  }
  get worldAPI(): WorldAPIImpl {
    return this.activeRealm.worldAPI;
  }
  get blendGraph(): BlendGraph {
    return this.activeRealm.blendGraph;
  }

  constructor(transport: IServerTransport, deps: GameServerDeps) {
    this.transport = transport;
    this.authorizeAdmin = deps.authorizeAdmin ?? (() => true);
    this.registry = deps.registry;
    const stores = new WorldStorePool(deps.createStore);
    this.createStore = (id) => stores.realm(id, parseInteriorId(id)?.parentWorldId ?? id);
    // Create a default realm (will be loaded with a world in init() or loadWorld())
    const defaultRealm = new Realm([baseGameMod]);
    // Use a sentinel key until a real world is loaded
    defaultRealm.currentWorldId = "__default__";
    this.realms.set("__default__", defaultRealm);
    this.defaultRealmId = "__default__";
  }

  async inspectWorld(
    worldId: string,
    coordinates: { cx: number; cy: number }[],
    bounds: Bounds,
  ): Promise<InspectionSnapshot> {
    validateInspection(coordinates, bounds);
    const meta = await this.registry.getWorld(worldId);
    if (!meta) throw new Error("World not found.");
    const generation = descriptorFromMetadata(meta);
    const live = this.realms.get(worldId);
    const store = live?.saveManager?.store ?? this.createStore(worldId);
    if (!live?.saveManager) await store.open();
    try {
      await live?.saveManager?.flushSnapshot();
      const snapshot = await readInspection(store, generation, coordinates, bounds);
      if (live) {
        for (const c of coordinates) {
          const chunk = live.world.getChunkIfLoaded(c.cx, c.cy);
          if (!chunk) continue;
          snapshot.chunks = snapshot.chunks.filter(
            (saved) => saved.cx !== c.cx || saved.cy !== c.cy,
          );
          snapshot.chunks.push({
            ...c,
            subgrid: Array.from(chunk.subgrid),
            roadGrid: Array.from(chunk.roadGrid),
            heightGrid: Array.from(chunk.heightGrid),
          });
        }
        snapshot.coverage = "live authority";
      }
      return snapshot;
    } finally {
      if (!live?.saveManager) await store.close();
    }
  }

  /** Initialize the server-side console engine with server commands. */
  initConsole(): void {
    const console_ = new ConsoleEngine();
    this.serverConsole = console_;
    import("../console/serverCommands.js").then(({ registerServerCommands }) => {
      registerServerCommands(console_, this);
      console.log("[tilefun] server console initialized");
    });
  }

  /** Get the first player session (for single-player commands). */
  getFirstSession(): PlayerSession | undefined {
    return this.activeRealm.getFirstSession();
  }

  async init(): Promise<void> {
    // Register transport handlers
    this.start();
    this.initConsole();

    await this.registry.open();
    this.locations = new PlayerLocationStore(this.createStore(PLAYER_LOCATIONS_STORE));

    // Load most recent world, or create a default one
    const worlds = await this.registry.listWorlds();
    const firstWorld = worlds.find((world) => !worldCompatibility(world));
    if (firstWorld) {
      console.log("[tilefun] loading existing world:", firstWorld.id, firstWorld.name);
      await this.loadWorldIntoDefaultRealm(firstWorld.id);
    } else {
      console.warn("[tilefun] no worlds found in registry — creating new world");
      const meta = await this.createWorld("My World", undefined, undefined, { choice: "regional" });
      await this.loadWorldIntoDefaultRealm(meta.id);
    }
  }

  /** Register transport handlers. */
  start(): void {
    this.transport.onMessage((clientId, msg) => {
      this.handleMessage(clientId, msg);
    });

    this.transport.onConnect((clientId, identity) => {
      // Cancel any dormant cleanup timer for this clientId
      const dormantTimer = this.dormantSessions.get(clientId);
      if (dormantTimer) {
        clearTimeout(dormantTimer);
        this.dormantSessions.delete(clientId);
      }

      // Reconnection: reuse existing session and player entity
      const existingSession = this.sessions.get(clientId);
      if (existingSession?.retired) {
        this.transport.send(clientId, {
          type: "kicked",
          reason: "This player connection is being replaced.",
        });
        return;
      }
      if (existingSession && !existingSession.realmId && !existingSession.transitioning) {
        void this.trackOperation(this.buildRealmList()).then((realms) => {
          this.transport.send(clientId, { type: "realm-list", realms });
        });
        return;
      }
      if (
        existingSession &&
        !existingSession.retired &&
        (existingSession.realmId || existingSession.transitioning)
      ) {
        const reconnect = () => {
          if (existingSession.retired) return;
          const realm = this.realms.get(existingSession.realmId ?? "");
          if (!realm) return;
          existingSession.lastProcessedInputSeq = 0;
          existingSession.inputQueue = [];
          this.transport.send(clientId, {
            type: "player-assigned",
            entityId: existingSession.player.id,
          });
          this.transport.send(clientId, {
            type: "world-loaded",
            generation: realm.generation,
            ...(realm.interior ? { interior: realm.interior } : {}),
            ...(realm.currentWorldId ? { worldId: realm.currentWorldId } : {}),
            cameraX: existingSession.player.position.wx,
            cameraY: existingSession.player.position.wy,
            cameraZoom: existingSession.cameraZoom,
          });
          realm.clearClientRevisions(clientId);
        };
        if (existingSession.transitioning)
          void this.trackOperation(existingSession.transitionDone.then(reconnect));
        else reconnect();
        return;
      }

      // New connection: create session
      const session = new PlayerSession(clientId);
      const num = this.nextPlayerNumber++;
      session.playerNumber = num;
      session.displayName = identity?.displayName ?? `Player ${num}`;
      if (identity) session.profileId = identity.profileId;
      session.cursorColor = CURSOR_COLORS[(num - 1) % CURSOR_COLORS.length] ?? "#ffffff";

      // Add to global sessions map
      this.sessions.set(clientId, session);
      if (identity) this.identify(session, identity.profileId, identity.displayName);

      if (clientId === "local") {
        // Single-player: auto-join default realm immediately
        const realm = this.activeRealm;
        const joining = this.locations
          ? this.transitions.move(session, () =>
              this.resumeDestination(session, realm.currentWorldId ?? ""),
            )
          : realm.addPlayer(session);
        this.trackOperation<unknown>(joining)
          .then(() => {
            if (session.retired) return;
            const realm = this.realms.get(session.realmId ?? "");
            if (!realm) throw new Error("Player destination unavailable.");
            console.log(
              `[tilefun] local client connected as ${session.displayName} (${realm.sessions.size} in realm)`,
            );

            this.transport.send(clientId, {
              type: "player-assigned",
              entityId: session.player.id,
            });
            this.transport.send(clientId, {
              type: "world-loaded",
              generation: realm.generation,
              ...(realm.interior ? { interior: realm.interior } : {}),
              ...(realm.currentWorldId ? { worldId: realm.currentWorldId } : {}),
              cameraX: session.player.position.wx,
              cameraY: session.player.position.wy,
              cameraZoom: session.cameraZoom,
            });
          })
          .catch((error) => {
            this.onLoopError?.(error);
            this.transport.send(clientId, {
              type: "kicked",
              reason: `Could not restore player: ${String(error)}`,
            });
          });
      } else {
        // Multiplayer: start in lobby, send realm list
        console.log(`[tilefun] client connected: ${clientId} as ${session.displayName} (lobby)`);

        this.trackOperation(this.buildRealmList()).then((realms) => {
          this.transport.send(clientId, { type: "realm-list", realms });
        });
      }
    });

    this.transport.onDisconnect((clientId) => {
      if (clientId === "local") return;

      const session = this.sessions.get(clientId);
      if (!session) return;

      // Zero velocity so the dormant player entity doesn't drift
      if (session.player?.velocity) {
        session.player.velocity.vx = 0;
        session.player.velocity.vy = 0;
      }

      console.log(
        `[tilefun] client disconnected: ${clientId} (${session.displayName}), dormant for ${GameServer.DORMANT_TIMEOUT_MS / 1000}s`,
      );

      // Keep session alive for a grace period to allow reconnection (e.g. page refresh)
      const timer = setTimeout(() => {
        this.dormantSessions.delete(clientId);
        const s = this.sessions.get(clientId);
        if (s) {
          // Remove from whatever realm the session is in
          if (s.realmId) {
            const realm = this.realms.get(s.realmId);
            if (realm) {
              const realmId = s.realmId;
              realm.removePlayer(clientId);
              this.tryUnloadRealm(realmId);
            }
          }
          this.sessions.delete(clientId);
          console.log(`[tilefun] dormant session expired: ${clientId} (${s.displayName})`);
        }
      }, GameServer.DORMANT_TIMEOUT_MS);

      this.dormantSessions.set(clientId, timer);
      this.flush();
    });
  }

  /** Iterate all connected sessions (including dormant). */
  getSessions(): IterableIterator<PlayerSession> {
    return this.sessions.values();
  }

  /** Check if a session is dormant (disconnected, awaiting reconnect). */
  isDormant(clientId: string): boolean {
    return this.dormantSessions.has(clientId);
  }

  /** A world-scoped roster: never expose other worlds or disconnected sessions. */
  private async worldMap(session: PlayerSession, requestId: number): Promise<WorldMapMessage> {
    const current = session.realmId ? this.realms.get(session.realmId) : undefined;
    const worldId = current?.interior?.parentWorldId ?? session.realmId;
    if (!current || !worldId) throw new Error("Join a world before opening the map.");
    if (session.transitioning) throw new Error("Wait for travel to finish before opening the map.");
    const meta = await this.registry.getWorld(worldId);
    if (!meta) throw new Error("World unavailable.");
    if (session.realmId !== current.currentWorldId)
      throw new Error("The world changed. Reopen the map.");
    const players: WorldMapMessage["players"] = [];
    for (const other of this.sessions.values()) {
      if (this.isDormant(other.clientId) || !other.realmId || other.transitioning) continue;
      const realm = this.realms.get(other.realmId);
      const indoors = realm?.interior?.parentWorldId === worldId;
      if (other.realmId !== worldId && !indoors) continue;
      const position = indoors ? other.returnLocation : null;
      if (indoors && !position) continue;
      players.push({
        playerNumber: other.playerNumber,
        entityId: other.player.id,
        name: other.displayName,
        color: other.cursorColor,
        x: position ? position.x : other.player.position.wx / TILE_SIZE,
        y: position ? position.y : other.player.position.wy / TILE_SIZE,
        self: other === session,
        indoors,
      });
    }
    return {
      type: "world-map",
      requestId,
      worldId,
      name: meta.name,
      generation: descriptorFromMetadata(meta),
      players,
    };
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
    this.loop = new ServerLoop(
      (dt) => {
        this.tick(dt);
      },
      this.tickRate,
      (error) => this.onLoopError?.(error),
    );
    this.loop.start();
  }

  /** Stop independent tick loop. */
  stopLoop(): void {
    this.loop?.stop();
    this.loop = null;
    this.broadcasting = false;
  }

  /** Update server command tick rate (Hz, legacy compatibility). */
  setTickRate(hz: number): void {
    if (hz <= 0) return;
    this.setTickMs(1000 / hz);
  }

  /** Update server command tick interval in milliseconds. */
  setTickMs(ms: number): void {
    if (ms <= 0) return;
    if (Math.abs(ms - this._tickMs) < 1e-9) return;
    const prevMs = this._tickMs;
    this._tickMs = ms;
    setServerTickMs(ms);
    this.loop?.setTickMs(ms);
    for (const realm of this.realms.values()) {
      realm.tickRate = 1000 / ms;
      realm.physicsMult = this._physicsMult;
    }
    console.log(
      `[tilefun:server] tick changed: ${prevMs.toFixed(3)}ms (${(1000 / prevMs).toFixed(2)}Hz) -> ${ms.toFixed(3)}ms (${(1000 / ms).toFixed(2)}Hz)`,
    );
  }

  setPhysicsMult(mult: number): void {
    const next = Math.max(1, Math.floor(mult));
    if (next === this._physicsMult) return;
    const prev = this._physicsMult;
    this._physicsMult = next;
    setServerPhysicsMult(this._physicsMult);
    for (const realm of this.realms.values()) {
      realm.physicsMult = this._physicsMult;
    }
    console.log(`[tilefun:server] physics substeps changed: ${prev} -> ${this._physicsMult}`);
  }

  get tickRate(): number {
    return 1000 / this._tickMs;
  }

  get tickMs(): number {
    return this._tickMs;
  }

  get physicsMult(): number {
    return this._physicsMult;
  }

  /** Run one simulation tick. Iterates ALL active realms. */
  tick(dt: number): void {
    const timing = performanceMetrics.start();
    const scaledDt = dt * this.timeScale;
    const dormantIds = new Set(this.dormantSessions.keys());
    for (const realm of this.realms.values()) {
      realm.tick(
        scaledDt,
        this.transport,
        this.broadcasting && (this.transport.canSend?.() ?? true),
        dormantIds,
        this.locations?.pressured ?? false,
      );
    }
    if (this.locations && !this.checkpointPending && Date.now() - this.lastCheckpoint >= 5000) {
      this.lastCheckpoint = Date.now();
      this.checkpointPending = true;
      void this.trackOperation(this.flushAsync())
        .catch((error) => this.reportStorageFailure(error))
        .finally(() => {
          this.checkpointPending = false;
        });
    }
    this.completedTicks++;
    this.checkIdleRealms();
    performanceMetrics.end("server.tick", timing);
  }

  /** Load/unload chunks for the given visible range and compute autotile. */
  updateVisibleChunks(range: { minCx: number; minCy: number; maxCx: number; maxCy: number }): void {
    this.activeRealm.updateVisibleChunks(range);
  }

  /** Mark all chunks for re-render (debug mode changes). */
  invalidateAllChunks(): void {
    this.activeRealm.invalidateAllChunks();
  }

  /**
   * Get or create a realm for the given worldId.
   * If a realm is already loaded for this world, returns it.
   * Otherwise, creates a new Realm and loads the world into it.
   */
  private async getOrCreateRealm(worldId: string): Promise<Realm> {
    const retiring = this.retiringRealms.get(worldId);
    if (retiring) await retiring;
    const existing = this.realms.get(worldId);
    if (existing) {
      if (!existing.sessions.size) existing.idleSince = Date.now();
      return existing;
    }

    const pending = this.loadingRealms.get(worldId);
    if (pending) return pending;
    const loading = (async () => {
      const realm = new Realm([baseGameMod]);
      realm.tickRate = this.tickRate;
      realm.physicsMult = this._physicsMult;
      try {
        await realm.loadWorld(
          worldId,
          this.registry,
          this.createStore,
          await this.realmMetadata(worldId),
        );
        realm.idleSince = Date.now();
        this.realms.set(worldId, realm);
        return realm;
      } catch (error) {
        await realm.destroy();
        throw error;
      }
    })();
    this.loadingRealms.set(worldId, loading);
    try {
      return await loading;
    } finally {
      this.loadingRealms.delete(worldId);
    }
  }

  /**
   * Load a world into the default realm (used during init and for backward compat).
   * Re-keys the realm in the map from its old key to the new worldId.
   */
  private async loadWorldIntoDefaultRealm(
    worldId: string,
  ): Promise<{ cameraX: number; cameraY: number; cameraZoom: number }> {
    await this.realmMetadata(worldId);
    const realm = this.activeRealm;

    // Re-key in the realms map
    if (this.defaultRealmId && this.defaultRealmId !== worldId) {
      this.realms.delete(this.defaultRealmId);
    }
    this.realms.set(worldId, realm);
    this.defaultRealmId = worldId;

    const cam = await realm.loadWorld(worldId, this.registry, this.createStore);
    return cam;
  }

  private async saveLocation(session: PlayerSession, realm: Realm): Promise<void> {
    if (!this.locations || !session.realmId) return;
    await this.locations.save(session.profileId || session.clientId, {
      version: 1,
      realmId: session.realmId,
      parentWorldId: realm.interior?.parentWorldId ?? session.realmId,
      generation: realm.generation,
      player: realm.playerData(session),
    });
  }

  /** Takeovers serialize behind the old connection's transfer before reading its location. */
  private identify(session: PlayerSession, profileId?: string, displayName?: string): void {
    if (profileId) {
      if (session.profileId && session.profileId !== profileId) {
        this.transport.send(session.clientId, {
          type: "kicked",
          reason: "Reconnect to change player profile.",
        });
        return;
      }
      session.profileId = profileId;
      const replaced = [...this.sessions.values()].filter(
        (other) => other !== session && other.profileId === profileId && !other.retired,
      );
      for (const other of replaced) other.retired = true;
      if (replaced.length)
        session.identityReady = this.trackOperation(
          (async () => {
            try {
              for (const other of replaced) {
                await other.identityReady;
                await other.transitionDone;
                const realm = this.realms.get(other.realmId ?? "");
                if (realm) {
                  await realm.flushAsync();
                  await this.saveLocation(other, realm);
                  realm.removePlayer(other.clientId);
                }
                if (this.sessions.get(other.clientId) === other)
                  this.sessions.delete(other.clientId);
                const timer = this.dormantSessions.get(other.clientId);
                if (timer) clearTimeout(timer);
                this.dormantSessions.delete(other.clientId);
                this.transport.send(other.clientId, {
                  type: "kicked",
                  reason: "Logged in from another connection",
                });
              }
            } catch (error) {
              // Save failure must leave the old live player usable, not silently evict it.
              for (const other of replaced)
                if (this.sessions.get(other.clientId) === other) other.retired = false;
              session.retired = true;
              if (this.sessions.get(session.clientId) === session)
                this.sessions.delete(session.clientId);
              this.transport.send(session.clientId, {
                type: "kicked",
                reason: "Could not save the previous connection. Try again.",
              });
              throw error;
            }
          })(),
        );
    }
    if (
      displayName &&
      ![...this.sessions.values()].some(
        (other) => other !== session && !other.retired && other.displayName === displayName,
      )
    )
      session.displayName = displayName;
  }

  private async resumeDestination(
    session: PlayerSession,
    fallbackId: string,
  ): Promise<RealmDestination> {
    const saved = await this.locations?.load(session.profileId || session.clientId);
    if (saved) {
      let meta: WorldMeta | undefined;
      try {
        meta = await this.realmMetadata(saved.realmId);
      } catch (error) {
        console.warn("[tilefun] Saved player destination is unavailable", error);
      }
      if (
        meta &&
        (meta.interior?.parentWorldId ?? meta.id) === saved.parentWorldId &&
        descriptorKey(descriptorFromMetadata(meta)) === descriptorKey(saved.generation)
      ) {
        let realm: Realm | undefined;
        try {
          realm = await this.getOrCreateRealm(saved.realmId);
        } catch (error) {
          if (!(error instanceof InvalidInteriorError)) throw error;
          console.warn("[tilefun] Saved interior is invalid", error);
        }
        if (realm)
          try {
            const arrival = {
              x: saved.player.x / TILE_SIZE,
              y: saved.player.y / TILE_SIZE,
              generation: realm.generation,
            };
            const position = await safeArrival(realm, arrival);
            const exact = position.wx === saved.player.x && position.wy === saved.player.y;
            return {
              realm,
              allowInterior: true,
              // Resume exact saved progress, including moving-roof support. A relocated
              // fallback is explicit ground travel and must discard that old support.
              ...(exact ? {} : { arrival }),
              savedPlayer: saved.player,
              returnLocation: saved.player.returnLocation ?? null,
            };
          } catch (error) {
            console.warn("[tilefun] Saved player position is invalid", error);
          }
      }
      // A removed/invalid interior falls back to its parent, never another player's latest world.
      const savedParent = await this.registry.getWorld(saved.parentWorldId);
      if (savedParent && !worldCompatibility(savedParent)) {
        const realm = await this.getOrCreateRealm(saved.parentWorldId);
        const fallback = saved.player.returnLocation;
        if (fallback?.worldId === saved.parentWorldId) {
          try {
            await safeArrival(realm, fallback);
            return { realm, arrival: fallback, returnLocation: null };
          } catch {
            /* Use the parent's saved visit if its old doorway is no longer safe. */
          }
        }
        return { realm, returnLocation: null };
      }
    }
    return { realm: await this.getOrCreateRealm(fallbackId), returnLocation: null };
  }

  private async realmMetadata(worldId: string): Promise<WorldMeta | undefined> {
    const known = await this.registry.getWorld(worldId);
    if (known) {
      if (worldCompatibility(known)) throw new Error(worldCompatibility(known));
      return known;
    }
    const parsed = parseInteriorId(worldId);
    if (!parsed) return undefined;
    const parent = await this.registry.getWorld(parsed.parentWorldId);
    if (!parent) throw new Error("Parent world not found.");
    if (worldCompatibility(parent)) throw new Error(worldCompatibility(parent));
    const generation = descriptorFromMetadata(parent);
    if (generation.type !== "regional")
      throw new Error("This generator has no enterable building plans.");
    const match = /^settlement:(-?\d+):(-?\d+):/.exec(parsed.featureId);
    if (!match) throw new Error("Invalid building owner.");
    const terrain = createGenerator(generation).terrain;
    if (!(terrain instanceof DistrictStrategy))
      throw new Error("World has no enterable districts.");
    const source = terrain.districts;
    const lot = source
      .owner(Number(match[1]), Number(match[2]))
      ?.blocks.flatMap((b) => b.lots)
      .find((l) => l.id === parsed.featureId);
    if (!lot) throw new Error("Building is absent from the pinned district plan.");
    const interior: InteriorIdentity = withBuildingLayout(
      {
        version: "interior-v1",
        ...parsed,
        buildingType: lot.buildingType,
        floor: 0,
        returnX: lot.entrance.x,
        returnY: lot.entrance.y,
      },
      { wx: lot.anchor.x * TILE_SIZE, wy: lot.anchor.y * TILE_SIZE },
    );
    return {
      ...parent,
      id: worldId,
      name: lot.buildingType,
      generation: createDescriptor("flat", generation.seed),
      interior,
    };
  }

  private async enterBuilding(
    _clientId: string,
    session: PlayerSession,
    featureId: string,
    doorId = "street",
    walkThrough = false,
  ): Promise<void> {
    let overlay: DoorMotion["overlay"];
    await this.transitions.move(session, async () => {
      const realm = session.realmId ? this.realms.get(session.realmId) : undefined;
      if (!realm || realm.interior || !realm.currentWorldId)
        throw new Error("No exterior world selected.");
      realm.realizeProceduralProps();
      const prop = realm.propManager.props.find((p) => p.proceduralId === featureId);
      if (!prop || !exteriorEntrance(prop)) throw new Error("Building is unavailable.");
      if (walkThrough) {
        const threshold = exteriorDoors(prop).find((d) => d.id === doorId)?.outside;
        if (!threshold) throw new Error("Unknown building door.");
        this.validateDoorApproach(session, threshold, true);
      }
      const destination = await this.getOrCreateRealm(
        interiorRealmId(realm.currentWorldId, featureId),
      );
      if (!destination.interior) throw new Error("Building interior unavailable.");
      // Older rooms keep their single physical exit. A newly discoverable facade
      // door can still enter that saved room through its original landing.
      const legacyAlias =
        !destination.interior.layout &&
        !destination.interior.doors?.some((door) => door.id === doorId) &&
        exteriorDoors(prop).some((door) => door.id === doorId);
      const connection = buildingDoor(destination.interior, legacyAlias ? "street" : doorId);
      const door =
        exteriorDoors(prop).find((door) => door.id === doorId)?.outside ?? connection.outside;
      if (
        Math.hypot(session.player.position.wx - door.wx, session.player.position.wy - door.wy) >
          32 ||
        (session.player.wz ?? 0) > 8
      )
        throw new Error("Stand near the building entrance to enter.");
      if (walkThrough) {
        if (prop.type.includes("butcher"))
          overlay = { kind: "butcher", wx: door.wx, wy: prop.position.wy };
      }
      return {
        ...(walkThrough
          ? {
              beforeTransfer: () => this.departDoor(session, exteriorDoorWalkAnchor(door), overlay),
            }
          : {}),
        realm: destination,
        allowInterior: true,
        arrival: {
          x: connection.arrival.wx / TILE_SIZE,
          y: connection.arrival.wy / TILE_SIZE,
          generation: destination.generation,
        },
        returnLocation: {
          worldId: realm.currentWorldId,
          x: door.wx / 16,
          y: door.wy / 16,
          generation: realm.generation,
        },
      };
    });
    if (walkThrough) this.arriveDoor(session, true);
  }

  private async exitBuilding(
    _clientId: string,
    session: PlayerSession,
    doorId = "street",
    walkThrough = false,
  ): Promise<void> {
    let overlay: DoorMotion["overlay"];
    let emergence: DoorMotion["from"] | undefined;
    await this.transitions.move(session, async () => {
      const realm = session.realmId ? this.realms.get(session.realmId) : undefined;
      if (!realm?.interior) throw new Error("You are not in an interior.");
      const connection = buildingDoor(realm.interior, doorId);
      if (
        Math.hypot(
          session.player.position.wx - connection.inside.wx,
          session.player.position.wy - connection.inside.wy,
        ) > 40
      )
        throw new Error("Return to the interior doorway to leave.");
      if (walkThrough) this.validateDoorApproach(session, connection.inside, false);
      const parent = await this.getOrCreateRealm(realm.interior.parentWorldId);
      parent.realizeProceduralProps();
      const prop = parent.propManager.props.find(
        (p) => p.proceduralId === realm.interior?.featureId,
      );
      const outside =
        (prop ? exteriorDoors(prop).find((door) => door.id === doorId)?.outside : undefined) ??
        connection.outside;
      emergence = exteriorDoorWalkAnchor(outside);
      const position = {
        worldId: connection.outsideRealmId,
        x: outside.wx / TILE_SIZE,
        y: outside.wy / TILE_SIZE,
        generation: parent.generation,
      };
      return {
        ...(walkThrough
          ? {
              beforeTransfer: () => {
                // SafeArrival has now loaded the outdoor chunks. The facade may
                // have been evicted while everyone was inside the building.
                const facade = parent.propManager.props.find(
                  (p) => p.proceduralId === realm.interior?.featureId,
                );
                if (facade?.type.includes("butcher"))
                  overlay = { kind: "butcher", wx: outside.wx, wy: facade.position.wy };
                return this.departDoor(session, {
                  wx: connection.inside.wx,
                  wy: connection.inside.wy + 16,
                });
              },
            }
          : {}),
        realm: await this.getOrCreateRealm(position.worldId),
        arrival: position,
        returnLocation: null,
      };
    });
    if (walkThrough) this.arriveDoor(session, false, overlay, emergence);
  }

  private validateDoorApproach(
    session: PlayerSession,
    door: { wx: number; wy: number },
    entering: boolean,
  ) {
    if (
      session.editorEnabled ||
      session.gameplaySession.mountId !== null ||
      Date.now() < session.doorArrivalUntil ||
      (session.player.wz ?? 0) > 1 ||
      Date.now() - session.doorIntent.at > 500 ||
      !towardDoor(session.doorIntent.dx, session.doorIntent.dy, entering) ||
      // Allow one tile of prediction lead along the approach, never sideways.
      !atDoorThreshold(session.player.position, door, entering, TILE_SIZE)
    )
      throw new Error("Walk toward the doorway to enter.");
  }
  private sendDoorMotion(
    session: PlayerSession,
    phase: DoorMotion["phase"],
    from: DoorMotion["from"],
    to: DoorMotion["to"],
    overlay?: DoorMotion["overlay"],
    revealMs?: number,
  ) {
    for (const recipient of this.sessions.values()) {
      if (recipient.realmId !== session.realmId || recipient.retired) continue;
      this.transport.send(recipient.clientId, {
        type: "door-motion",
        phase,
        actorId: session.player.id,
        actorClientId: session.clientId,
        realmId: session.realmId ?? "",
        self: recipient === session,
        from,
        to,
        duration: DOOR_WALK_MS,
        ...(revealMs && recipient === session ? { revealMs } : {}),
        ...(overlay ? { overlay } : {}),
      });
    }
  }
  private async departDoor(
    session: PlayerSession,
    to: DoorMotion["to"],
    overlay?: DoorMotion["overlay"],
  ) {
    const from = { ...session.player.position };
    session.player.velocity = { vx: 0, vy: 0 };
    session.inputQueue = [];
    this.sendDoorMotion(session, "depart", from, to, overlay);
    // Presentation only: durable authority remains at the collision-checked source.
    // This bounded wait also settles during dev reload/shutdown; it needs no simulation ticks.
    await new Promise((resolve) => setTimeout(resolve, DOOR_WALK_MS + DOOR_FADE_MS));
  }
  private arriveDoor(
    session: PlayerSession,
    entering: boolean,
    overlay?: DoorMotion["overlay"],
    emergence?: DoorMotion["from"],
  ) {
    const to = { ...session.player.position };
    const from = emergence ?? { wx: to.wx, wy: to.wy + (entering ? 16 : -16) };
    session.doorArrivalUntil = Date.now() + DOOR_WALK_MS + DOOR_FADE_MS;
    session.inputQueue = [];
    session.player.velocity = { vx: 0, vy: 0 };
    this.sendDoorMotion(session, "arrive", from, to, overlay, emergence ? DOOR_FADE_MS : undefined);
  }

  private movePlayerToRealm(
    _clientId: string,
    session: PlayerSession,
    worldId: string,
    arrival?: Arrival,
  ) {
    return this.transitions.move(session, async () => ({
      realm: await this.getOrCreateRealm(worldId),
      ...(arrival ? { arrival } : {}),
      returnLocation: null,
    }));
  }

  private respondToTransition(
    clientId: string,
    session: PlayerSession,
    requestId: number,
    type: "world-loaded" | "realm-joined",
    operation: Promise<unknown>,
  ): void {
    void this.trackOperation(operation)
      .then(() => {
        if (session.retired) return;
        const realm = session.realmId ? this.realms.get(session.realmId) : undefined;
        if (!realm) throw new Error("Destination realm unavailable.");
        this.transport.send(clientId, { type: "player-assigned", entityId: session.player.id });
        this.transport.send(clientId, {
          type,
          requestId,
          worldId: session.realmId ?? "",
          generation: realm.generation,
          interior: realm.interior ?? undefined,
          cameraX: session.player.position.wx,
          cameraY: session.player.position.wy,
          cameraZoom: session.cameraZoom,
        });
      })
      .catch((error) =>
        this.transport.send(clientId, {
          type: "request-error",
          requestId,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
  }

  /**
   * Mark a non-default realm as idle when it has no players.
   * The realm stays loaded for REALM_IDLE_TIMEOUT_MS to allow quick rejoin.
   * Actual cleanup happens in checkIdleRealms() during tick().
   */
  private tryUnloadRealm(worldId: string): void {
    if (worldId === this.defaultRealmId) return;
    const realm = this.realms.get(worldId);
    if (!realm || realm.sessions.size > 0) return;

    // Realm.removePlayer already sets idleSince — just log for visibility
    console.log(
      `[tilefun] realm idle, will unload in ${GameServer.REALM_IDLE_TIMEOUT_MS / 1000}s: ${worldId}`,
    );
  }

  /**
   * Check all non-default realms for idle timeout expiration and destroy them.
   * Called from tick().
   */
  private checkIdleRealms(): void {
    const now = Date.now();
    for (const [worldId, realm] of this.realms) {
      if (worldId === this.defaultRealmId) continue;
      if (realm.idleSince === null) continue;
      if (now - realm.idleSince >= GameServer.REALM_IDLE_TIMEOUT_MS) {
        console.log(`[tilefun] unloading idle realm: ${worldId}`);
        realm.idleSince = null;
        const retiring = (async () => {
          try {
            await realm.flushAsync();
            if (realm.sessions.size) return;
            await realm.destroy();
            this.realms.delete(worldId);
          } catch (error) {
            realm.idleSince = Date.now();
            throw error;
          }
        })();
        this.retiringRealms.set(worldId, retiring);
        void this.trackOperation(retiring.finally(() => this.retiringRealms.delete(worldId))).catch(
          (error) => this.reportStorageFailure(error),
        );
      }
    }
  }

  /**
   * Public loadWorld for backward compat (used by GameClient in local/non-serialized mode).
   * Moves the local player to the target world's realm.
   */
  async loadWorld(
    worldId: string,
    arrival?: Arrival,
  ): Promise<{ cameraX: number; cameraY: number; cameraZoom: number }> {
    const localSession = this.sessions.get("local");
    if (localSession) {
      return this.movePlayerToRealm("local", localSession, worldId, arrival);
    }
    // Fallback: load into default realm (no sessions yet)
    return this.loadWorldIntoDefaultRealm(worldId);
  }

  async createWorld(
    name: string,
    worldType?: WorldType,
    seed?: number,
    generation?: GenerationRequest,
  ): Promise<WorldMeta> {
    const resolved = generation ? resolveCreation(generation) : undefined;
    return this.registry.createWorld(name, worldType, seed, undefined, resolved);
  }

  async recreateWorld(id: string): Promise<WorldMeta> {
    const previous = await this.registry.getWorld(id);
    if (!previous) throw new Error("World not found.");
    // Deliberately keep the original; existing delete-world handles explicit disposal.
    return this.createWorld(
      `${previous.name} (recreated)`,
      undefined,
      undefined,
      recreationGeneration(previous),
    );
  }

  async deleteWorld(id: string): Promise<void> {
    const affected = [...this.realms.entries()].filter(
      ([key, realm]) => key === id || realm.interior?.parentWorldId === id,
    );
    const fallback =
      this.defaultRealmId && this.defaultRealmId !== id
        ? this.defaultRealmId
        : ((await this.registry.listWorlds()).find((w) => w.id !== id && !worldCompatibility(w))
            ?.id ?? null);
    for (const [, realm] of affected)
      for (const session of [...realm.sessions.values()]) {
        if (fallback) {
          await this.movePlayerToRealm(session.clientId, session, fallback);
          const target = this.realms.get(fallback);
          this.transport.send(session.clientId, {
            type: "player-assigned",
            entityId: session.player.id,
          });
          this.transport.send(session.clientId, {
            type: "world-loaded",
            worldId: fallback,
            generation: target?.generation ?? descriptorFromMetadata(),
            cameraX: session.cameraX,
            cameraY: session.cameraY,
            cameraZoom: session.cameraZoom,
          });
        } else {
          realm.removePlayer(session.clientId);
          this.transport.send(session.clientId, { type: "realm-left", requestId: 0 });
        }
      }
    for (const [key, realm] of affected) {
      await realm.flushAsync();
      await realm.destroy();
      this.realms.delete(key);
    }
    if (this.defaultRealmId === id) this.defaultRealmId = fallback;
    await this.registry.deleteWorld(id);
  }

  async listWorlds(): Promise<WorldMeta[]> {
    return this.registry.listWorlds();
  }

  async renameWorld(id: string, name: string): Promise<void> {
    await this.registry.renameWorld(id, name);
  }

  /** Build a RealmInfo list: all registered worlds with live player counts. */
  private async buildRealmList(): Promise<RealmInfo[]> {
    const worlds = await this.registry.listWorlds();
    return worlds.map((w): RealmInfo => {
      const info: RealmInfo = {
        id: w.id,
        name: w.name,
        playerCount: this.realms.get(w.id)?.sessions.size ?? 0,
        createdAt: w.createdAt,
        lastPlayedAt: w.lastPlayedAt,
      };
      info.incompatibleReason = worldCompatibility(w);
      info.generation = descriptorFromMetadata(w);
      return info;
    });
  }

  /** Broadcast realm-player-count to all connected non-dormant clients. */
  private broadcastRealmPlayerCount(worldId: string): void {
    const realm = this.realms.get(worldId);
    const count = realm?.sessions.size ?? 0;
    const dormantIds = new Set(this.dormantSessions.keys());
    for (const [cid] of this.sessions) {
      if (dormantIds.has(cid)) continue;
      this.transport.send(cid, { type: "realm-player-count", worldId, count });
    }
  }

  /** Broadcast a chat message to all connected (non-dormant) clients. */
  broadcastChat(sender: string, text: string): void {
    const dormantIds = new Set(this.dormantSessions.keys());
    for (const [cid] of this.sessions) {
      if (dormantIds.has(cid)) continue;
      this.transport.send(cid, { type: "chat", sender, text });
    }
  }

  async flushAsync(): Promise<void> {
    this.lastCheckpoint = Date.now();
    try {
      for (const realm of this.realms.values()) await realm.flushAsync();
      for (const session of this.sessions.values()) {
        const realm = this.realms.get(session.realmId ?? "");
        if (realm && !session.transitioning && !session.retired)
          await this.saveLocation(session, realm);
      }
    } catch (error) {
      this.reportStorageFailure(error);
      throw error;
    }
  }

  private reportStorageFailure(error: unknown): void {
    console.error("[tilefun] Storage delayed; retained for retry", error);
    for (const session of this.sessions.values()) {
      const paused =
        (this.locations?.pressured ?? false) ||
        (this.realms.get(session.realmId ?? "")?.saveManager?.pressured ?? false);
      this.transport.send(session.clientId, {
        type: "storage-status",
        paused,
        message: paused
          ? "Saving is delayed. Your changes are retained; retrying automatically."
          : "A background world save is delayed; its changes are retained for retry.",
      });
    }
  }

  flush(): void {
    void this.trackOperation(this.flushAsync()).catch((error) => {
      this.reportStorageFailure(error);
    });
  }

  async destroy(): Promise<void> {
    this.stopLoop();
    for (const timer of this.dormantSessions.values()) clearTimeout(timer);
    this.dormantSessions.clear();
    await this.settle();
    const realms = [...this.realms.values()];
    await Promise.all(realms.map((realm) => realm.streaming?.close()));
    try {
      await this.flushAsync();
    } catch (error) {
      for (const realm of realms) realm.streaming?.resume();
      throw error;
    }
    for (const [id, realm] of this.realms) {
      await realm.destroy();
      this.realms.delete(id);
    }
    await this.locations?.close();
    this.registry.close();
    this.transport.close();
  }

  // ---- Private ----

  private handleMessage(clientId: string, msg: ClientMessage): void {
    const session = this.sessions.get(clientId);
    if (!session || session.retired) return;

    // Chat shares the RCON channel but carries no administrative capability.
    const privileged =
      msg.type === "create-world" ||
      msg.type === "recreate-world" ||
      msg.type === "delete-world" ||
      msg.type === "rename-world" ||
      (msg.type === "rcon" &&
        (typeof msg.command !== "string" || !/^\/?say(?:\s|$)/i.test(msg.command.trim())));
    if (
      privileged &&
      !this.authorizeAdmin(clientId, "adminToken" in msg ? msg.adminToken : undefined)
    ) {
      this.transport.send(clientId, {
        type: "request-error",
        requestId: "requestId" in msg ? msg.requestId : 0,
        message: "Server administration requires an admin token.",
      });
      return;
    }
    if (msg.type === "rcon" && (typeof msg.command !== "string" || msg.command.length > 2048)) {
      this.transport.send(clientId, {
        type: "request-error",
        requestId: msg.requestId,
        message: "Invalid console command.",
      });
      return;
    }

    // Global messages handled by GameServer
    switch (msg.type) {
      case "call-train": {
        const realm = session.realmId ? this.realms.get(session.realmId) : undefined;
        void this.trackOperation(
          realm
            ? realm.callTrain(session, msg.benchId)
            : Promise.reject(Error("Train unavailable.")),
        )
          .then(() =>
            this.transport.send(clientId, { type: "train-called", requestId: msg.requestId }),
          )
          .catch((error) =>
            this.transport.send(clientId, {
              type: "request-error",
              requestId: msg.requestId,
              message: error instanceof Error ? error.message : String(error),
            }),
          );
        return;
      }
      case "enter-vehicle":
      case "exit-vehicle": {
        try {
          const realm = session.realmId ? this.realms.get(session.realmId) : undefined;
          if (!realm || session.transitioning || realm.saveManager?.pressured)
            throw Error("Vehicle control is unavailable right now.");
          if (msg.type === "enter-vehicle") {
            if (!Number.isSafeInteger(msg.entityId)) throw Error("Invalid vehicle.");
            realm.vehicles.enter(session, msg.entityId);
          } else realm.vehicles.exit(session);
          this.transport.send(clientId, { type: "vehicle-controlled", requestId: msg.requestId });
        } catch (error) {
          this.transport.send(clientId, {
            type: "request-error",
            requestId: msg.requestId,
            message: error instanceof Error ? error.message : String(error),
          });
        }
        return;
      }
      case "get-world-map":
        void this.trackOperation(this.worldMap(session, msg.requestId))
          .then((map) => this.transport.send(clientId, map))
          .catch((error) =>
            this.transport.send(clientId, {
              type: "request-error",
              requestId: msg.requestId,
              message: error instanceof Error ? error.message : String(error),
            }),
          );
        return;
      case "enter-building":
      case "exit-building": {
        const operation =
          msg.type === "enter-building"
            ? this.enterBuilding(clientId, session, msg.featureId, msg.doorId, msg.walkThrough)
            : this.exitBuilding(clientId, session, msg.doorId, msg.walkThrough);
        this.respondToTransition(clientId, session, msg.requestId, "realm-joined", operation);
        return;
      }
      case "identify":
        this.identify(session, msg.profileId, msg.displayName);
        if (!msg.profileId || session.profileId === msg.profileId) {
          session.playerModel = normalizePlayerModel(msg.playerModel);
          if (session.player) applyPlayerModel(session.player, session.playerModel);
        }
        return;
      case "set-player-model":
        if (!isPlayerModel(msg.model)) {
          this.transport.send(clientId, {
            type: "request-error",
            requestId: msg.requestId,
            message: "Unknown player model.",
          });
          return;
        }
        session.playerModel = msg.model;
        if (session.player) applyPlayerModel(session.player, msg.model);
        this.transport.send(clientId, {
          type: "player-model-set",
          requestId: msg.requestId,
          model: msg.model,
        });
        return;
      case "flush":
        this.flush();
        return;

      case "load-world":
      case "join-realm":
        this.respondToTransition(
          clientId,
          session,
          msg.requestId,
          msg.type === "load-world" ? "world-loaded" : "realm-joined",
          msg.type === "join-realm" && msg.resume && !session.realmId
            ? this.transitions.move(session, () => this.resumeDestination(session, msg.worldId))
            : this.movePlayerToRealm(clientId, session, msg.worldId, msg.arrival),
        );
        return;

      case "list-realms":
        void this.trackOperation(this.buildRealmList()).then((realms) =>
          this.transport.send(clientId, {
            type: "realm-list",
            requestId: msg.requestId,
            realms,
          }),
        );
        return;

      case "leave-realm":
        if (session.transitioning) {
          this.transport.send(clientId, {
            type: "request-error",
            requestId: msg.requestId,
            message: "A realm transition is already running.",
          });
          return;
        }
        if (session.realmId) {
          const leftRealmId = session.realmId;
          const realm = this.realms.get(leftRealmId);
          if (realm) {
            realm.removePlayer(clientId);
            this.tryUnloadRealm(leftRealmId);
          }
          this.broadcastRealmPlayerCount(leftRealmId);
        }
        this.transport.send(clientId, {
          type: "realm-left",
          requestId: msg.requestId,
        });
        return;

      case "create-world":
        this.trackOperation(this.createWorld(msg.name, msg.worldType, msg.seed, msg.generation))
          .then((meta) => {
            this.transport.send(clientId, {
              type: "world-created",
              requestId: msg.requestId,
              meta,
            });
          })
          .catch((error) =>
            this.transport.send(clientId, {
              type: "request-error",
              requestId: msg.requestId,
              message: error instanceof Error ? error.message : String(error),
            }),
          );
        return;

      case "recreate-world":
        this.trackOperation(this.recreateWorld(msg.worldId))
          .then((meta) =>
            this.transport.send(clientId, {
              type: "world-created",
              requestId: msg.requestId,
              meta,
            }),
          )
          .catch((error) =>
            this.transport.send(clientId, {
              type: "request-error",
              requestId: msg.requestId,
              message: String(error),
            }),
          );
        return;

      case "delete-world":
        this.trackOperation(this.deleteWorld(msg.worldId))
          .then(() => {
            this.transport.send(clientId, {
              type: "world-deleted",
              requestId: msg.requestId,
            });
          })
          .catch((error) =>
            this.transport.send(clientId, {
              type: "request-error",
              requestId: msg.requestId,
              message: String(error),
            }),
          );
        return;

      case "list-worlds":
        this.trackOperation(this.listWorlds()).then((worlds) => {
          this.transport.send(clientId, {
            type: "world-list",
            requestId: msg.requestId,
            worlds,
          });
        });
        return;

      case "rename-world":
        this.trackOperation(this.renameWorld(msg.worldId, msg.name)).then(() => {
          this.transport.send(clientId, {
            type: "world-renamed",
            requestId: msg.requestId,
          });
        });
        return;

      case "rcon": {
        const output: string[] = [];
        if (this.serverConsole) {
          this.serverConsole.rconSenderName = session.displayName || clientId;
          try {
            output.push(...this.serverConsole.execServer(msg.command));
          } finally {
            this.serverConsole.rconSenderName = null;
          }
        } else {
          output.push("Server console not initialized");
        }
        this.transport.send(clientId, {
          type: "rcon-response",
          requestId: msg.requestId,
          output,
        });
        return;
      }
    }

    // set-editor-mode is handled at the GameServer level so it works even
    // before the session has joined a realm (the initial PlayScene.onEnter
    // fires before the async addPlayer resolves and sets realmId).
    if (msg.type === "set-editor-mode") {
      session.editorEnabled = msg.enabled;
      if (!msg.enabled) session.editorCursor = null;
    }

    // Realm-scoped messages: find the session's realm and delegate
    if (!session.realmId || session.transitioning) return;
    const realm = this.realms.get(session.realmId);
    if (!realm) return;
    if (
      Date.now() < session.doorArrivalUntil &&
      msg.type.startsWith("player-") &&
      msg.type !== "player-input"
    )
      return;
    const dispatch = () => {
      if (msg.type === "edit-room" || msg.type === "edit-room-history") {
        const editor = realm.roomEditor;
        const status =
          !editor || !session.editorEnabled || msg.roomId !== realm.currentWorldId
            ? {
                error: "Room editing requires the indoor editor.",
                canUndo: false,
                canRedo: false,
                revision: editor?.state.revision ?? 0,
              }
            : msg.type === "edit-room"
              ? editor.edit(clientId, msg.expectedRevision, msg.edit)
              : editor.travel(clientId, msg.expectedRevision, msg.direction);
        this.transport.send(clientId, { type: "room-edit-status", ...status });
        return;
      }
      if (msg.type === "edit-pattern" || msg.type === "edit-pattern-history") {
        const status =
          !session.editorEnabled || realm.interior
            ? realm.treeBrush.status(
                clientId,
                "Outdoor pattern editing requires the outdoor editor.",
              )
            : msg.type === "edit-pattern"
              ? realm.treeBrush.edit(clientId, msg)
              : realm.treeBrush.travel(clientId, msg.direction);
        this.transport.send(clientId, { type: "pattern-edit-status", ...status });
        return;
      }
      realm.handleMessage(clientId, session, msg);
    };
    if (
      msg.type.startsWith("edit-") ||
      msg.type === "throw-ball" ||
      msg.type === "player-interact"
    ) {
      const report = (error: unknown) =>
        this.transport.send(clientId, {
          type: "storage-status",
          paused: false,
          message: error instanceof Error ? error.message : "The edit could not be applied.",
        });
      try {
        if (this.locations?.pressured)
          throw new Error("Saving is delayed. Please try again when play resumes.");
        const pending = realm.admitMutation(session, msg, dispatch);
        if (pending) void this.trackOperation(pending).catch(report);
      } catch (error) {
        report(error);
      }
    } else dispatch();
  }
}
