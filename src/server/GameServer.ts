import type { BlendGraph } from "../autotile/BlendGraph.js";
import {
  applyPlayerModel,
  isPlayerModel,
  normalizePlayerModel,
} from "../characters/PlayerModels.js";
import { CHUNK_SIZE_PX, TICK_RATE, TILE_SIZE } from "../config/constants.js";
import { ConsoleEngine } from "../console/ConsoleEngine.js";
import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import type { EntityManager } from "../entities/EntityManager.js";
import type { PropManager } from "../entities/PropManager.js";
import {
  descriptorFromMetadata,
  type GenerationRequest,
  resolveCreation,
} from "../generation/GenerationDescriptor.js";
import type { Bounds } from "../generation/regional/RegionalPlanner.js";
import { parseInteriorId } from "../interiors/GameplayInterior.js";
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
import type { ClientMessage, WorldMapMessage } from "../shared/protocol.js";
import {
  isRequest,
  type RequestMessage,
  type RequestOf,
  type RequestType,
  type ResponsePayload,
  responseTo,
} from "../shared/requests.js";
import type { ConnectionIdentity, IServerTransport } from "../transport/Transport.js";
import { DoorTransitions } from "./DoorTransitions.js";
import type { PlayerSession } from "./PlayerSession.js";
import type { Realm } from "./Realm.js";
import { RealmDirectory } from "./RealmDirectory.js";
import { RealmTransitions } from "./RealmTransitions.js";
import { ResidentTraffic } from "./ResidentTraffic.js";
import { resumeDestination } from "./ResumeDestination.js";
import type { Arrival } from "./SafeArrival.js";
import { ServerLoop } from "./ServerLoop.js";
import { SessionRegistry } from "./SessionRegistry.js";
import type { WorldAPIImpl } from "./WorldAPI.js";

/** A request's work and reply, answered through `GameServer.respond`. */
interface RequestContext<R extends RequestMessage> {
  msg: R;
  session: PlayerSession;
  respond<T>(work: () => T | Promise<T>, reply: (value: T) => ResponsePayload<R> | null): void;
}

const noFields = () => ({});
const ADMIN_REQUIRED = "Server administration requires an admin token.";

/** Chat shares the RCON channel but carries no administrative capability. */
function privileged(msg: RequestMessage): boolean {
  return (
    msg.type === "create-world" ||
    msg.type === "recreate-world" ||
    msg.type === "delete-world" ||
    msg.type === "rename-world" ||
    (msg.type === "rcon" &&
      (typeof msg.command !== "string" || !/^\/?say(?:\s|$)/i.test(msg.command.trim())))
  );
}

/** Realm mutations pass storage admission before they apply. */
function isMutation(msg: ClientMessage): boolean {
  return (
    msg.type.startsWith("edit-") ||
    msg.type === "throw-ball" ||
    msg.type === "vehicle-emergency" ||
    msg.type === "vehicle-horn" ||
    msg.type === "player-interact"
  );
}

function adminToken(msg: RequestMessage): string | undefined {
  return "adminToken" in msg ? msg.adminToken : undefined;
}

function vehicleId(entityId: number): number {
  if (!Number.isSafeInteger(entityId)) throw new Error("Invalid vehicle.");
  return entityId;
}

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
        minCx: Math.floor(wx / CHUNK_SIZE_PX) - 3,
        maxCx: Math.floor(wx / CHUNK_SIZE_PX) + 3,
        minCy: Math.floor(wy / CHUNK_SIZE_PX) - 3,
        maxCy: Math.floor(wy / CHUNK_SIZE_PX) + 3,
      });
      if (session.realmId !== realm.currentWorldId || session.retired) return;
      realm.vehicles.exit(session, true);

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

  /** Reply to a failed request so the client's pending request settles. */
  private requestFailed(clientId: string, requestId: number | undefined) {
    return (error: unknown) =>
      this.transport.send(clientId, {
        type: "request-error",
        requestId: requestId ?? 0, // malformed id-less privileged messages
        message: error instanceof Error ? error.message : String(error),
      });
  }

  /**
   * Answer one request: `work` runs now; a promise result is tracked and replied to once
   * it settles, a plain result replies immediately. Every failure answers `request-error`;
   * a `null` reply sends nothing (the session was replaced mid-request).
   */
  private respond<R extends RequestMessage, T>(
    session: PlayerSession,
    msg: R,
    work: () => T | Promise<T>,
    reply: (value: T) => ResponsePayload<R> | null,
  ): void {
    const failed = this.requestFailed(session.clientId, msg.requestId);
    const send = (value: T) => {
      const payload = reply(value);
      if (payload) this.transport.send(session.clientId, responseTo(msg, payload));
    };
    try {
      const result = work();
      if (result instanceof Promise) void this.trackOperation(result).then(send).catch(failed);
      else send(result);
    } catch (error) {
      failed(error);
    }
  }

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

  /** All active realms, keyed by worldId. */
  private readonly realms: RealmDirectory;
  /** Master session list — every connected player, regardless of realm. */
  private readonly sessions: SessionRegistry;
  private readonly residents: ResidentTraffic;
  private readonly doors: DoorTransitions;
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
  private serverConsole: ConsoleEngine | null = null;
  rconSender: PlayerSession | null = null; // Console commands act where the sender is.
  private readonly transitions = new RealmTransitions(
    (id) => this.realms.get(id),
    (session, realm) => this.saveLocation(session, realm),
    (oldId, newId) => {
      if (oldId) {
        this.realms.tryUnload(oldId);
        this.broadcastRealmPlayerCount(oldId);
      }
      if (newId !== oldId) this.broadcastRealmPlayerCount(newId);
    },
  );

  // ── Delegation getters: the rcon sender's realm, else the local/default realm ──

  private get activeRealm(): Realm {
    const id =
      (this.rconSender ?? this.sessions.get("local"))?.realmId ?? this.realms.defaultRealmId;
    const realm = id ? this.realms.get(id) : undefined;
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
    const track = <T>(operation: Promise<T>) => this.trackOperation(operation);
    const reportStorageFailure = (error: unknown) => this.reportStorageFailure(error);
    this.realms = new RealmDirectory({
      registry: this.registry,
      createStore: this.createStore,
      track,
      reportStorageFailure,
    });
    this.sessions = new SessionRegistry({
      transport,
      realms: this.realms,
      track,
      saveLocation: (session, realm) => this.saveLocation(session, realm),
    });
    this.residents = new ResidentTraffic({ realms: this.realms, track, reportStorageFailure });
    this.doors = new DoorTransitions({
      realms: this.realms,
      sessions: this.sessions,
      transport,
      transitions: this.transitions,
    });
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
  private async initConsole(): Promise<void> {
    const console_ = new ConsoleEngine();
    this.serverConsole = console_;
    const { registerServerCommands } = await import("../console/serverCommands.js");
    registerServerCommands(console_, this);
    console.log("[tilefun] server console initialized");
  }

  /** Get the first player session (for single-player commands). */
  getFirstSession(): PlayerSession | undefined {
    return this.rconSender ?? this.activeRealm.getFirstSession();
  }

  async init(): Promise<void> {
    // Register transport handlers
    this.start();
    await this.initConsole();

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

    this.transport.onConnect((clientId, identity) => this.connect(clientId, identity));

    this.transport.onDisconnect((clientId) => {
      if (this.sessions.disconnect(clientId)) this.flush();
    });
  }

  private connect(clientId: string, identity?: ConnectionIdentity): void {
    const admission = this.sessions.admit(clientId, identity);
    if (admission.kind === "retired")
      this.transport.send(clientId, {
        type: "kicked",
        reason: "This player connection is being replaced.",
      });
    else if (admission.kind === "lobby") this.sendRealmList(clientId);
    else if (admission.kind === "rejoin") this.rejoin(admission.session);
    else if (clientId === "local")
      // Single-player: auto-join default realm immediately
      this.joinLocal(admission.session);
    else {
      // Multiplayer: start in lobby, send realm list
      console.log(
        `[tilefun] client connected: ${clientId} as ${admission.session.displayName} (lobby)`,
      );
      this.sendRealmList(clientId);
    }
  }

  private sendRealmList(clientId: string): void {
    void this.trackOperation(this.realms.realmList())
      .then((realms) => {
        this.transport.send(clientId, { type: "realm-list", realms });
      })
      .catch((error) => {
        console.error("[tilefun] realm list failed:", error);
        this.transport.send(clientId, { type: "realm-list", realms: [] });
      });
  }

  /** Reconnection: reuse the existing session and player entity once any transfer settles. */
  private rejoin(session: PlayerSession): void {
    const reconnect = () => {
      if (session.retired) return;
      const realm = this.realms.get(session.realmId ?? "");
      if (!realm) return;
      session.lastProcessedInputSeq = 0;
      session.controls.reset(0);
      session.inputQueue = [];
      this.sendWorldLoaded(session, realm);
      realm.clearClientRevisions(session.clientId);
    };
    if (!session.transitioning) reconnect();
    else
      void this.trackOperation(session.transitionDone.then(reconnect)).catch((error) =>
        console.error("[tilefun] reconnect after transition failed:", error),
      );
  }

  private joinLocal(session: PlayerSession): void {
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
        this.sendWorldLoaded(session, realm);
      })
      .catch((error) => {
        this.onLoopError?.(error);
        this.transport.send(session.clientId, {
          type: "kicked",
          reason: `Could not restore player: ${String(error)}`,
        });
      });
  }

  private sendWorldLoaded(session: PlayerSession, realm: Realm): void {
    this.transport.send(session.clientId, {
      type: "player-assigned",
      entityId: session.player.id,
    });
    this.transport.send(session.clientId, {
      type: "world-loaded",
      generation: realm.generation,
      ...(realm.interior ? { interior: realm.interior } : {}),
      ...(realm.currentWorldId ? { worldId: realm.currentWorldId } : {}),
      cameraX: session.player.position.wx,
      cameraY: session.player.position.wy,
      cameraZoom: session.cameraZoom,
    });
  }

  /** Iterate all connected sessions (including dormant). */
  getSessions(): IterableIterator<PlayerSession> {
    return this.sessions.values();
  }

  /** Check if a session is dormant (disconnected, awaiting reconnect). */
  isDormant(clientId: string): boolean {
    return this.sessions.isDormant(clientId);
  }

  /** A world-scoped roster: never expose other worlds or disconnected sessions. */
  private async worldMap(
    session: PlayerSession,
  ): Promise<ResponsePayload<RequestOf<"get-world-map">>> {
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

  get tickRate(): number {
    return TICK_RATE;
  }
  get tickMs(): number {
    return 1000 / TICK_RATE;
  }

  /** Run one simulation tick. Iterates ALL active realms. */
  tick(dt: number): void {
    const timing = performanceMetrics.start();
    dt = 1 / TICK_RATE;
    const dormantIds = this.sessions.dormantIds();
    this.residents.prepare(dormantIds);
    for (const realm of this.realms.values()) {
      realm.tick(
        dt,
        this.transport,
        this.broadcasting && (this.transport.canSend?.() ?? true),
        dormantIds,
        this.locations?.pressured ?? false,
      );
    }
    this.residents.crossDoors();
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
    this.realms.checkIdle(this.residents.moving);
    performanceMetrics.end("server.tick", timing);
  }

  /** Load a world into the default realm (used during init and for backward compat). */
  private loadWorldIntoDefaultRealm(
    worldId: string,
  ): Promise<{ cameraX: number; cameraY: number; cameraZoom: number }> {
    return this.realms.loadIntoDefault(worldId, () => this.activeRealm);
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

  private resumeDestination(session: PlayerSession, fallbackId: string) {
    return resumeDestination(
      { locations: this.locations, registry: this.registry, realms: this.realms },
      session,
      fallbackId,
    );
  }

  private movePlayerToRealm(session: PlayerSession, worldId: string, arrival?: Arrival) {
    return this.transitions.move(session, async () => ({
      realm: await this.realms.getOrCreate(worldId),
      ...(arrival ? { arrival } : {}),
      returnLocation: null,
    }));
  }

  /** Reply to a completed realm transition with the arrival the client rebuilds its view from. */
  private arrival(session: PlayerSession) {
    return () => {
      if (session.retired) return null;
      const realm = session.realmId ? this.realms.get(session.realmId) : undefined;
      if (!realm) throw new Error("Destination realm unavailable.");
      this.transport.send(session.clientId, {
        type: "player-assigned",
        entityId: session.player.id,
      });
      return {
        worldId: session.realmId ?? "",
        generation: realm.generation,
        interior: realm.interior ?? undefined,
        cameraX: session.player.position.wx,
        cameraY: session.player.position.wy,
        cameraZoom: session.cameraZoom,
      };
    };
  }

  /**
   * Load a world into the default realm (in-process tests only; clients use join-realm).
   * Moves the local player to the target world's realm.
   */
  async loadWorld(
    worldId: string,
    arrival?: Arrival,
  ): Promise<{ cameraX: number; cameraY: number; cameraZoom: number }> {
    const localSession = this.sessions.get("local");
    if (localSession) {
      return this.movePlayerToRealm(localSession, worldId, arrival);
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
      this.realms.defaultRealmId && this.realms.defaultRealmId !== id
        ? this.realms.defaultRealmId
        : ((await this.registry.listWorlds()).find((w) => w.id !== id && !worldCompatibility(w))
            ?.id ?? null);
    for (const [, realm] of affected)
      for (const session of [...realm.sessions.values()]) {
        if (fallback) {
          await this.movePlayerToRealm(session, fallback);
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
    if (this.realms.defaultRealmId === id) this.realms.defaultRealmId = fallback;
    await this.registry.deleteWorld(id);
  }

  async listWorlds(): Promise<WorldMeta[]> {
    return this.registry.listWorlds();
  }

  async renameWorld(id: string, name: string): Promise<void> {
    await this.registry.renameWorld(id, name);
  }

  /** Broadcast realm-player-count to all connected non-dormant clients. */
  private broadcastRealmPlayerCount(worldId: string): void {
    const realm = this.realms.get(worldId);
    const count = realm?.sessions.size ?? 0;
    for (const cid of this.sessions.awakeClientIds())
      this.transport.send(cid, { type: "realm-player-count", worldId, count });
  }

  /** Broadcast a chat message to all connected (non-dormant) clients. */
  broadcastChat(sender: string, text: string): void {
    for (const cid of this.sessions.awakeClientIds())
      this.transport.send(cid, { type: "chat", sender, text });
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
    this.sessions.clearDormant();
    await this.settle();
    const realms = [...this.realms.values()];
    await Promise.all(realms.map((realm) => realm.streaming?.close()));
    try {
      await this.flushAsync();
    } catch (error) {
      for (const realm of realms) realm.streaming?.resume();
      throw error;
    }
    for (const [id, realm] of this.realms.entries()) {
      await realm.destroy();
      this.realms.delete(id);
    }
    await this.locations?.close();
    this.registry.close();
    this.transport.close();
  }

  // ---- Private ----

  /** The compiler requires one handler per request type; each answers through `respond`. */
  private readonly requests: {
    [K in RequestType]: (request: RequestContext<RequestOf<K>>) => void;
  } = {
    "call-train": ({ msg, session, respond }) =>
      respond(async () => {
        const realm = session.realmId ? this.realms.get(session.realmId) : undefined;
        if (
          !realm?.railways ||
          session.transitioning ||
          realm.saveManager?.pressured ||
          !Number.isSafeInteger(msg.benchId)
        )
          throw new Error("Train service is unavailable right now.");
        await realm.railways.call(session, msg.benchId);
      }, noFields),
    "enter-vehicle": ({ msg, session, respond }) =>
      respond(
        () => this.controlVehicle(session, (v) => v.enter(session, vehicleId(msg.entityId))),
        noFields,
      ),
    "recover-vehicle": ({ msg, session, respond }) =>
      respond(
        () => this.controlVehicle(session, (v) => v.recover(session, vehicleId(msg.entityId))),
        noFields,
      ),
    "exit-vehicle": ({ session, respond }) =>
      respond(() => this.controlVehicle(session, (v) => v.exit(session)), noFields),
    "set-player-model": ({ msg, session, respond }) =>
      respond(
        () => {
          if (!isPlayerModel(msg.model)) throw new Error("Unknown player model.");
          session.playerModel = msg.model;
          if (session.player) applyPlayerModel(session.player, msg.model);
        },
        () => ({ model: msg.model }),
      ),
    "get-world-map": ({ session, respond }) =>
      respond(
        () => this.worldMap(session),
        (map) => map,
      ),
    "load-world": ({ msg, session, respond }) =>
      respond(
        () => this.movePlayerToRealm(session, msg.worldId, msg.arrival),
        this.arrival(session),
      ),
    "join-realm": ({ msg, session, respond }) =>
      respond(
        () =>
          msg.resume && !session.realmId
            ? this.transitions.move(session, () => this.resumeDestination(session, msg.worldId))
            : this.movePlayerToRealm(session, msg.worldId, msg.arrival),
        this.arrival(session),
      ),
    "enter-building": ({ msg, session, respond }) =>
      respond(
        () => this.doors.enter(session, msg.featureId, msg.doorId, msg.walkThrough),
        this.arrival(session),
      ),
    "exit-building": ({ msg, session, respond }) =>
      respond(() => this.doors.exit(session, msg.doorId, msg.walkThrough), this.arrival(session)),
    "leave-realm": ({ session, respond }) => respond(() => this.leaveRealm(session), noFields),
    "list-realms": ({ respond }) =>
      respond(
        () => this.realms.realmList(),
        (realms) => ({ realms }),
      ),
    "create-world": ({ msg, respond }) =>
      respond(
        () => this.createWorld(msg.name, msg.worldType, msg.seed, msg.generation),
        (meta) => ({ meta }),
      ),
    "recreate-world": ({ msg, respond }) =>
      respond(
        () => this.recreateWorld(msg.worldId),
        (meta) => ({ meta }),
      ),
    "delete-world": ({ msg, respond }) => respond(() => this.deleteWorld(msg.worldId), noFields),
    "list-worlds": ({ respond }) =>
      respond(
        () => this.listWorlds(),
        (worlds) => ({ worlds }),
      ),
    "rename-world": ({ msg, respond }) =>
      respond(() => this.renameWorld(msg.worldId, msg.name), noFields),
    rcon: ({ msg, session, respond }) =>
      respond(
        () => this.runRcon(session, msg.command),
        (output) => ({ output }),
      ),
  };

  private handleRequest<K extends RequestType>(
    type: K,
    msg: RequestOf<K>,
    session: PlayerSession,
  ): void {
    this.requests[type]({
      msg,
      session,
      respond: (work, reply) => this.respond(session, msg, work, reply),
    });
  }

  private controlVehicle(session: PlayerSession, control: (vehicles: Realm["vehicles"]) => void) {
    const realm = session.realmId ? this.realms.get(session.realmId) : undefined;
    if (!realm || session.transitioning || realm.saveManager?.pressured)
      throw new Error("Vehicle control is unavailable right now.");
    control(realm.vehicles);
  }

  private leaveRealm(session: PlayerSession): void {
    if (session.transitioning) throw new Error("A realm transition is already running.");
    if (!session.realmId) return;
    const leftRealmId = session.realmId;
    const realm = this.realms.get(leftRealmId);
    if (realm) {
      realm.removePlayer(session.clientId);
      this.realms.tryUnload(leftRealmId);
    }
    this.broadcastRealmPlayerCount(leftRealmId);
  }

  private runRcon(session: PlayerSession, command: unknown): string[] {
    if (typeof command !== "string" || command.length > 2048)
      throw new Error("Invalid console command.");
    if (!this.serverConsole) return ["Server console not initialized"];
    this.rconSender = session;
    try {
      return this.serverConsole.execServer(command);
    } finally {
      this.rconSender = null;
    }
  }

  private identifyModel(session: PlayerSession, msg: Extract<ClientMessage, { type: "identify" }>) {
    this.sessions.identify(session, msg.profileId, msg.displayName);
    if (!msg.profileId || session.profileId === msg.profileId) {
      session.playerModel = normalizePlayerModel(msg.playerModel);
      if (session.player) applyPlayerModel(session.player, session.playerModel);
    }
  }

  private handleMessage(clientId: string, msg: ClientMessage): void {
    const session = this.sessions.get(clientId);
    if (!session || session.retired) return;

    if (isRequest(msg)) {
      if (!privileged(msg) || this.authorizeAdmin(clientId, adminToken(msg)))
        this.handleRequest(msg.type, msg, session);
      else this.requestFailed(clientId, msg.requestId)(new Error(ADMIN_REQUIRED));
      return;
    }
    if (msg.type === "identify") {
      this.identifyModel(session, msg);
      return;
    }
    if (msg.type === "flush") {
      this.flush();
      return;
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
    if (isMutation(msg)) {
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
