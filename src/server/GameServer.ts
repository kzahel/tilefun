import type { BlendGraph } from "../autotile/BlendGraph.js";
import { TICK_RATE } from "../config/constants.js";
import { ConsoleEngine } from "../console/ConsoleEngine.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import { baseGameMod } from "../game/base-game.js";
import {
  createDescriptor,
  descriptorFromMetadata,
  type GenerationRequest,
  resolveCreation,
} from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { DistrictStrategy } from "../generation/regional/DistrictStrategy.js";
import type { Bounds } from "../generation/regional/RegionalPlanner.js";
import {
  exteriorEntrance,
  INTERIOR_ENTRY,
  INTERIOR_EXIT,
  type InteriorIdentity,
  interiorRealmId,
  parseInteriorId,
} from "../interiors/GameplayInterior.js";
import { IdbPersistenceStore } from "../persistence/IdbPersistenceStore.js";
import type { IWorldRegistry } from "../persistence/IWorldRegistry.js";
import type { PersistenceStore } from "../persistence/PersistenceStore.js";
import {
  type InspectionSnapshot,
  inspectionOverlays,
  readInspection,
  validateInspection,
} from "../persistence/WorldInspection.js";
import {
  dbNameForWorld,
  type WorldMeta,
  WorldRegistry,
  type WorldType,
} from "../persistence/WorldRegistry.js";
import { setServerPhysicsMult, setServerTickMs } from "../physics/PlayerMovement.js";
import type { ClientMessage, RealmInfo } from "../shared/protocol.js";
import type { IServerTransport } from "../transport/Transport.js";
import { PlayerSession } from "./PlayerSession.js";
import { Realm } from "./Realm.js";
import { RealmTransitions } from "./RealmTransitions.js";
import type { Arrival } from "./SafeArrival.js";
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
}

export class GameServer {
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
  private readonly loadingRealms = new Map<string, Promise<Realm>>();
  /** The default realm's worldId (set during init, used for new connections). */
  private defaultRealmId: string | null = null;
  /** Master session list — every connected player, regardless of realm. */
  private readonly sessions = new Map<string, PlayerSession>();
  private readonly transport: IServerTransport;
  private readonly registry: IWorldRegistry;
  private readonly createStore: (worldId: string) => PersistenceStore;
  private loop: ServerLoop | null = null;
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

  constructor(transport: IServerTransport, deps?: GameServerDeps) {
    this.transport = transport;
    this.registry = deps?.registry ?? new WorldRegistry();
    this.createStore =
      deps?.createStore ??
      ((worldId) =>
        new IdbPersistenceStore(dbNameForWorld(worldId), ["chunks", "meta", "players"]));
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
    const store = this.createStore(worldId);
    await store.open();
    try {
      const snapshot = await readInspection(store, generation, coordinates, bounds);
      if (live) {
        const overlay = live.inspectionState();
        Object.assign(snapshot, inspectionOverlays(generation, bounds, overlay));
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
      store.close();
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

    // Load most recent world, or create a default one
    const worlds = await this.registry.listWorlds();
    const firstWorld = worlds[0];
    if (firstWorld) {
      console.log("[tilefun] loading existing world:", firstWorld.id, firstWorld.name);
      await this.loadWorldIntoDefaultRealm(firstWorld.id);
    } else {
      console.warn("[tilefun] no worlds found in registry — creating new world");
      const meta = await this.registry.createWorld("My World");
      await this.loadWorldIntoDefaultRealm(meta.id);
    }
  }

  /** Register transport handlers. */
  start(): void {
    this.transport.onMessage((clientId, msg) => {
      this.handleMessage(clientId, msg);
    });

    this.transport.onConnect((clientId) => {
      // Cancel any dormant cleanup timer for this clientId
      const dormantTimer = this.dormantSessions.get(clientId);
      if (dormantTimer) {
        clearTimeout(dormantTimer);
        this.dormantSessions.delete(clientId);
      }

      // Reconnection: reuse existing session and player entity
      const existingSession = this.sessions.get(clientId);
      if (existingSession?.realmId) {
        const realm = this.realms.get(existingSession.realmId);
        if (realm) {
          console.log(
            `[tilefun] client reconnected: ${clientId} as ${existingSession.displayName}`,
          );
          // Reset input tracking — the reconnected client starts inputSeq at 0,
          // so the old lastProcessedInputSeq would cause the client to discard
          // its entire input buffer during reconciliation (rubber-banding).
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
          // Reset chunk revisions so all chunks get re-sent to the fresh connection
          realm.clearClientRevisions(clientId);
          return;
        }
      }

      // New connection: create session
      const session = new PlayerSession(clientId);
      const num = this.nextPlayerNumber++;
      session.playerNumber = num;
      session.displayName = `Player ${num}`;
      session.cursorColor = CURSOR_COLORS[(num - 1) % CURSOR_COLORS.length] ?? "#ffffff";

      // Add to global sessions map
      this.sessions.set(clientId, session);

      if (clientId === "local") {
        // Single-player: auto-join default realm immediately
        const realm = this.activeRealm;
        realm.addPlayer(session).then(() => {
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
        });
      } else {
        // Multiplayer: start in lobby, send realm list
        console.log(`[tilefun] client connected: ${clientId} as ${session.displayName} (lobby)`);

        this.buildRealmList().then((realms) => {
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
              realm.removePlayer(clientId);
              this.tryUnloadRealm(s.realmId);
            }
          }
          this.sessions.delete(clientId);
          console.log(`[tilefun] dormant session expired: ${clientId} (${s.displayName})`);
        }
      }, GameServer.DORMANT_TIMEOUT_MS);

      this.dormantSessions.set(clientId, timer);
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
    const scaledDt = dt * this.timeScale;
    const dormantIds = new Set(this.dormantSessions.keys());
    for (const realm of this.realms.values()) {
      realm.tick(scaledDt, this.transport, this.broadcasting, dormantIds);
    }
    this.checkIdleRealms();
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
    const existing = this.realms.get(worldId);
    if (existing) return existing;

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
        realm.destroy();
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

  private async realmMetadata(worldId: string): Promise<WorldMeta | undefined> {
    const known = await this.registry.getWorld(worldId);
    if (known) return known;
    const parsed = parseInteriorId(worldId);
    if (!parsed) return undefined;
    const parent = await this.registry.getWorld(parsed.parentWorldId);
    if (!parent) throw new Error("Parent world not found.");
    const generation = descriptorFromMetadata(parent);
    if (generation.type !== "regional" || generation.version === "regional-v1")
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
    const interior: InteriorIdentity = {
      version: "interior-v1",
      ...parsed,
      buildingType: lot.buildingType,
      floor: 0,
      returnX: lot.entrance.x,
      returnY: lot.entrance.y,
    };
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
  ): Promise<void> {
    await this.transitions.move(session, async () => {
      const realm = session.realmId ? this.realms.get(session.realmId) : undefined;
      if (!realm || realm.interior || !realm.currentWorldId)
        throw new Error("No exterior world selected.");
      realm.realizeProceduralProps();
      const prop = realm.propManager.props.find((p) => p.proceduralId === featureId);
      const door = prop ? exteriorEntrance(prop) : null;
      if (
        !door ||
        Math.hypot(session.player.position.wx - door.wx, session.player.position.wy - door.wy) >
          32 ||
        (session.player.wz ?? 0) > 8
      )
        throw new Error("Stand near the building entrance to enter.");
      const destination = await this.getOrCreateRealm(
        interiorRealmId(realm.currentWorldId, featureId),
      );
      return {
        realm: destination,
        allowInterior: true,
        arrival: {
          x: INTERIOR_ENTRY.wx / 16,
          y: INTERIOR_ENTRY.wy / 16,
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
  }

  private async exitBuilding(_clientId: string, session: PlayerSession): Promise<void> {
    await this.transitions.move(session, async () => {
      const realm = session.realmId ? this.realms.get(session.realmId) : undefined;
      if (!realm?.interior) throw new Error("You are not in an interior.");
      if (
        Math.hypot(
          session.player.position.wx - INTERIOR_EXIT.wx,
          session.player.position.wy - INTERIOR_EXIT.wy,
        ) > 40
      )
        throw new Error("Return to the interior doorway to leave.");
      const parent = await this.getOrCreateRealm(realm.interior.parentWorldId);
      const position = session.returnLocation ?? {
        worldId: realm.interior.parentWorldId,
        x: realm.interior.returnX,
        y: realm.interior.returnY,
        generation: parent.generation,
      };
      return {
        realm: await this.getOrCreateRealm(position.worldId),
        arrival: position,
        returnLocation: null,
      };
    });
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
    void operation
      .then(() => {
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
        realm.destroy();
        this.realms.delete(worldId);
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

  async deleteWorld(id: string): Promise<void> {
    const affected = [...this.realms.entries()].filter(
      ([key, realm]) => key === id || realm.interior?.parentWorldId === id,
    );
    const fallback =
      this.defaultRealmId && this.defaultRealmId !== id
        ? this.defaultRealmId
        : ((await this.registry.listWorlds()).find((w) => w.id !== id)?.id ?? null);
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
      realm.destroy();
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
    for (const realm of this.realms.values()) await realm.flushAsync();
  }

  flush(): void {
    for (const realm of this.realms.values()) {
      realm.flush();
    }
  }

  destroy(): void {
    for (const timer of this.dormantSessions.values()) {
      clearTimeout(timer);
    }
    this.dormantSessions.clear();
    for (const realm of this.realms.values()) {
      realm.destroy();
    }
    this.realms.clear();
    this.stopLoop();
    this.transport.close();
  }

  // ---- Private ----

  private handleMessage(clientId: string, msg: ClientMessage): void {
    const session = this.sessions.get(clientId);
    if (!session) return;

    // Global messages handled by GameServer
    switch (msg.type) {
      case "enter-building":
      case "exit-building": {
        const operation =
          msg.type === "enter-building"
            ? this.enterBuilding(clientId, session, msg.featureId)
            : this.exitBuilding(clientId, session);
        this.respondToTransition(clientId, session, msg.requestId, "realm-joined", operation);
        return;
      }
      case "identify":
        if (msg.profileId) {
          session.profileId = msg.profileId;
          // Evict any other session with the same profileId (profile takeover)
          for (const [otherId, other] of this.sessions) {
            if (otherId !== clientId && other.profileId === msg.profileId) {
              console.log(
                `[tilefun] evicting duplicate profile ${msg.profileId}: old=${otherId} new=${clientId}`,
              );
              this.transport.send(otherId, {
                type: "kicked",
                reason: "Logged in from another connection",
              });
              if (other.realmId) {
                const realm = this.realms.get(other.realmId);
                realm?.removePlayer(otherId);
              }
              this.sessions.delete(otherId);
            }
          }
        }
        if (msg.displayName) {
          // Check if the requested name would duplicate another session's name.
          // If so, keep the server-assigned numbered name.
          const isDuplicate = [...this.sessions.values()].some(
            (s) => s !== session && s.displayName === msg.displayName,
          );
          if (!isDuplicate) {
            session.displayName = msg.displayName;
          }
        }
        return;

      case "load-world":
      case "join-realm":
        this.respondToTransition(
          clientId,
          session,
          msg.requestId,
          msg.type === "load-world" ? "world-loaded" : "realm-joined",
          this.movePlayerToRealm(clientId, session, msg.worldId, msg.arrival),
        );
        return;

      case "list-realms":
        void this.buildRealmList().then((realms) =>
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
        this.createWorld(msg.name, msg.worldType, msg.seed, msg.generation)
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

      case "delete-world":
        this.deleteWorld(msg.worldId)
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
        this.listWorlds().then((worlds) => {
          this.transport.send(clientId, {
            type: "world-list",
            requestId: msg.requestId,
            worlds,
          });
        });
        return;

      case "rename-world":
        this.renameWorld(msg.worldId, msg.name).then(() => {
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
          const lines = this.serverConsole.execServer(msg.command);
          this.serverConsole.rconSenderName = null;
          output.push(...lines);
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
    if (!session.realmId) return;
    const realm = this.realms.get(session.realmId);
    if (!realm) return;
    realm.handleMessage(clientId, session, msg);
  }
}
