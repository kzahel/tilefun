import type { BlendGraph } from "../autotile/BlendGraph.js";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import { ConsoleEngine } from "../console/ConsoleEngine.js";
import type { Entity } from "../entities/Entity.js";
import type { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import type { PropManager } from "../entities/PropManager.js";
import { baseGameMod } from "../game/base-game.js";
import { IdbPersistenceStore } from "../persistence/IdbPersistenceStore.js";
import type { IWorldRegistry } from "../persistence/IWorldRegistry.js";
import type { PersistenceStore } from "../persistence/PersistenceStore.js";
import {
  dbNameForWorld,
  type WorldMeta,
  WorldRegistry,
  type WorldType,
} from "../persistence/WorldRegistry.js";
import type { ClientMessage } from "../shared/protocol.js";
import type { IServerTransport } from "../transport/Transport.js";
import { PlayerSession } from "./PlayerSession.js";
import { Realm } from "./Realm.js";
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

  private activeRealm: Realm;
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
  private serverConsole: ConsoleEngine | null = null;

  // ── Delegation getters for backward compatibility ──
  // External code (LocalStateView, tests, serverCommands) accesses these fields.
  // They now live on the active Realm.

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
      ((worldId) => new IdbPersistenceStore(dbNameForWorld(worldId), ["chunks", "meta"]));
    this.activeRealm = new Realm([baseGameMod]);
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
      // Cancel any dormant cleanup timer for this clientId
      const dormantTimer = this.dormantSessions.get(clientId);
      if (dormantTimer) {
        clearTimeout(dormantTimer);
        this.dormantSessions.delete(clientId);
      }

      // Reconnection: reuse existing session and player entity
      const existingSession = this.activeRealm.sessions.get(clientId);
      if (existingSession) {
        console.log(`[tilefun] client reconnected: ${clientId} as ${existingSession.displayName}`);
        this.transport.send(clientId, {
          type: "player-assigned",
          entityId: existingSession.player.id,
        });
        this.transport.send(clientId, {
          type: "world-loaded",
          cameraX: existingSession.cameraX,
          cameraY: existingSession.cameraY,
          cameraZoom: existingSession.cameraZoom,
        });
        // Reset chunk revisions so all chunks get re-sent to the fresh connection
        this.activeRealm.clearClientRevisions(clientId);
        return;
      }

      // New connection: create player entity and session
      let player: Entity;
      const existingPlayer = this.activeRealm.entityManager.entities.find(
        (e) => e.type === "player",
      );
      if (clientId === "local" && existingPlayer) {
        player = existingPlayer;
      } else {
        player = createPlayer(
          this.activeRealm.lastLoadedCamera.cameraX,
          this.activeRealm.lastLoadedCamera.cameraY,
        );
        this.activeRealm.entityManager.spawn(player);
      }
      const session = new PlayerSession(clientId, player);
      session.gameplaySession.gemsCollected = this.activeRealm.lastLoadedGems;
      session.cameraX = this.activeRealm.lastLoadedCamera.cameraX;
      session.cameraY = this.activeRealm.lastLoadedCamera.cameraY;
      session.cameraZoom = this.activeRealm.lastLoadedCamera.cameraZoom;
      // Seed a reasonable initial visible range so the first few ticks
      // load chunks near the camera (before the client sends visible-range).
      const camCx = Math.floor(this.activeRealm.lastLoadedCamera.cameraX / CHUNK_SIZE_PX);
      const camCy = Math.floor(this.activeRealm.lastLoadedCamera.cameraY / CHUNK_SIZE_PX);
      session.visibleRange = {
        minCx: camCx - 3,
        minCy: camCy - 3,
        maxCx: camCx + 3,
        maxCy: camCy + 3,
      };
      const num = this.nextPlayerNumber++;
      session.playerNumber = num;
      session.displayName = `Player ${num}`;
      session.cursorColor = CURSOR_COLORS[(num - 1) % CURSOR_COLORS.length] ?? "#ffffff";
      this.activeRealm.sessions.set(clientId, session);

      console.log(
        `[tilefun] client connected: ${clientId} as ${session.displayName} (${this.activeRealm.sessions.size} total)`,
      );

      this.transport.send(clientId, {
        type: "player-assigned",
        entityId: session.player.id,
      });
      this.transport.send(clientId, {
        type: "world-loaded",
        cameraX: this.activeRealm.lastLoadedCamera.cameraX,
        cameraY: this.activeRealm.lastLoadedCamera.cameraY,
        cameraZoom: this.activeRealm.lastLoadedCamera.cameraZoom,
      });
    });

    this.transport.onDisconnect((clientId) => {
      if (clientId === "local") return;

      const session = this.activeRealm.sessions.get(clientId);
      if (!session) return;

      // Zero velocity so the dormant player entity doesn't drift
      if (session.player.velocity) {
        session.player.velocity.vx = 0;
        session.player.velocity.vy = 0;
      }

      console.log(
        `[tilefun] client disconnected: ${clientId} (${session.displayName}), dormant for ${GameServer.DORMANT_TIMEOUT_MS / 1000}s`,
      );

      // Keep session alive for a grace period to allow reconnection (e.g. page refresh)
      const timer = setTimeout(() => {
        this.dormantSessions.delete(clientId);
        const s = this.activeRealm.sessions.get(clientId);
        if (s) {
          this.activeRealm.entityManager.remove(s.player.id);
          this.activeRealm.sessions.delete(clientId);
          this.activeRealm.clearClientRevisions(clientId);
          console.log(`[tilefun] dormant session expired: ${clientId} (${s.displayName})`);
        }
      }, GameServer.DORMANT_TIMEOUT_MS);

      this.dormantSessions.set(clientId, timer);
    });
  }

  getLocalSession(): PlayerSession {
    const session = this.activeRealm.sessions.get("local");
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
    const dormantIds = new Set(this.dormantSessions.keys());
    this.activeRealm.tick(dt, this.transport, this.broadcasting, dormantIds);
  }

  /** Load/unload chunks for the given visible range and compute autotile. */
  updateVisibleChunks(range: { minCx: number; minCy: number; maxCx: number; maxCy: number }): void {
    this.activeRealm.updateVisibleChunks(range);
  }

  /** Mark all chunks for re-render (debug mode changes). */
  invalidateAllChunks(): void {
    this.activeRealm.invalidateAllChunks();
  }

  async loadWorld(
    worldId: string,
  ): Promise<{ cameraX: number; cameraY: number; cameraZoom: number }> {
    const cam = await this.activeRealm.loadWorld(worldId, this.registry, this.createStore);

    // Notify connected clients of the new world/camera position
    if (this.broadcasting) {
      this.transport.broadcast({
        type: "world-loaded",
        cameraX: cam.cameraX,
        cameraY: cam.cameraY,
        cameraZoom: cam.cameraZoom,
      });
    }

    return cam;
  }

  async createWorld(name: string, worldType?: WorldType, seed?: number): Promise<WorldMeta> {
    return this.registry.createWorld(name, worldType, seed);
  }

  async deleteWorld(id: string): Promise<void> {
    // Close the SaveManager connection BEFORE deleting the database,
    // otherwise indexedDB.deleteDatabase() blocks on the open connection.
    this.activeRealm.closePersistenceIfCurrent(id);
    await this.registry.deleteWorld(id);
  }

  async listWorlds(): Promise<WorldMeta[]> {
    return this.registry.listWorlds();
  }

  async renameWorld(id: string, name: string): Promise<void> {
    await this.registry.renameWorld(id, name);
  }

  flush(): void {
    this.activeRealm.flush();
  }

  destroy(): void {
    for (const timer of this.dormantSessions.values()) {
      clearTimeout(timer);
    }
    this.dormantSessions.clear();
    this.activeRealm.destroy();
    this.stopLoop();
    this.transport.close();
  }

  // ---- Private ----

  private handleMessage(clientId: string, msg: ClientMessage): void {
    const session = this.activeRealm.sessions.get(clientId);
    if (!session) return;

    // Global messages handled by GameServer
    switch (msg.type) {
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
        return;

      case "create-world":
        this.createWorld(msg.name, msg.worldType, msg.seed).then((meta) => {
          this.transport.send(clientId, {
            type: "world-created",
            requestId: msg.requestId,
            meta,
          });
        });
        return;

      case "delete-world":
        this.deleteWorld(msg.worldId).then(() => {
          this.transport.send(clientId, {
            type: "world-deleted",
            requestId: msg.requestId,
          });
        });
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
          const lines = this.serverConsole.execServer(msg.command);
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

    // Realm-scoped messages delegated to the active realm
    this.activeRealm.handleMessage(clientId, session, msg);
  }
}
