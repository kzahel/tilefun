import { CHUNK_SIZE_PX } from "../config/constants.js";
import { performanceMetrics } from "../diagnostics/PerformanceMetrics.js";
import { createProp } from "../entities/PropFactories.js";
import { baseGameMod } from "../game/base-game.js";
import type { IWorldRegistry, WorldMeta } from "../persistence/IWorldRegistry.js";
import { MemoryRecordStore } from "../persistence/MemoryRecordStore.js";
import { RecordPersistenceStore } from "../persistence/RecordPersistenceStore.js";
import { replaceBodyCollider, teleportBody } from "../physics/PhysicalEdits.js";
import { PHYSICS_DT } from "../physics/PhysicsDefaults.js";
import { validateSurfacePatch } from "../physics/SurfacePatch.js";
import { validateExcavations } from "../physics/TerrainExcavation.js";
import { RoadType } from "../road/RoadType.js";
import { controlDumpBed } from "../server/DumpBedControl.js";
import { PlayerSession } from "../server/PlayerSession.js";
import { Realm } from "../server/Realm.js";
import {
  decodeClientMessage,
  encodeClientMessage,
  encodeServerMessage,
} from "../shared/binaryCodec.js";
import { lcgNext } from "../shared/Determinism.js";
import type { Movement } from "../shared/Movement.js";
import { buildLaneGraph } from "../traffic/LaneGraph.js";
import type { IServerTransport } from "../transport/Transport.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { ScenarioCommand, ScenarioSeatCommand } from "./ScenarioProtocol.js";
import {
  applyScenarioAppearance,
  parkScenarioVehicle,
  type ScenarioRecipe,
  scenarioGravity,
} from "./ScenarioRecipe.js";

/** A temporary ordinary Realm with memory persistence. No alternate physics or clock. */
export class ScenarioSession {
  readonly records = new MemoryRecordStore();
  private store = new RecordPersistenceStore(this.records);
  private outgoing = new Map<string, ArrayBuffer[]>();
  private transport: IServerTransport = {
    send: (id, message) => {
      const packets = this.outgoing.get(id) ?? [];
      packets.push(encodeServerMessage(message));
      this.outgoing.set(id, packets);
    },
    broadcast: (message) => {
      for (const id of this.realm.sessions.keys()) this.transport.send(id, message);
    },
    onMessage() {},
    onConnect() {},
    onDisconnect() {},
    close() {},
  };
  private randomState: number;
  readonly gravity: number;
  realm!: Realm;
  player!: PlayerSession;
  guest: PlayerSession | undefined;
  readonly handles: Record<string, number> = {};
  private identities: Record<string, string> = {};
  private seq = 0;
  private closed = false;
  private constructor(readonly recipe: ScenarioRecipe) {
    if (
      (recipe.trafficRoads?.length ?? 0) > 64 ||
      recipe.trafficRoads?.some(
        (s) =>
          ![s.a.x, s.a.y, s.b.x, s.b.y, s.width].every(Number.isSafeInteger) ||
          s.width < 2 ||
          s.width > 64 ||
          (s.a.x !== s.b.x && s.a.y !== s.b.y) ||
          [s.a.x, s.a.y, s.b.x, s.b.y].some((n) => Math.abs(n) > 8192),
      )
    )
      throw Error("Invalid traffic road fixture");
    if (recipe.version !== 1) throw Error("Unsupported scenario recipe");
    if ((recipe.actors?.length ?? 0) > 1024 || (recipe.parkedVehicles?.length ?? 0) > 256)
      throw Error("Scenario actor budget exceeded");
    recipe.props.forEach((prop, index) => {
      prop.type = `scenario-prop-${index}`;
      for (const c of prop.walls ?? (prop.collider ? [prop.collider] : []))
        if (c.surface) validateSurfacePatch(c.surface, c.width, c.height);
    });
    if (
      (recipe.nativeProps?.length ?? 0) > 128 ||
      recipe.nativeProps?.some((p) => !Number.isFinite(p.wx) || !Number.isFinite(p.wy))
    )
      throw Error("Invalid native scenario props");
    validateExcavations(recipe.props);
    const patches = recipe.props
      .flatMap((p) => p.walls ?? (p.collider ? [p.collider] : []))
      .flatMap((c) => (c.surface ? [c.surface] : []));
    const ids = new Set(patches.map((p) => p.id));
    if (ids.size !== patches.length || patches.some((p) => p.connectsTo.some((id) => !ids.has(id))))
      throw Error("Invalid surface connections");
    if (recipe.actors?.some((e) => e.type === "player"))
      throw Error("Use recipe.player for the controlled actor");
    if (recipe.guest && recipe.guest.type !== "player") throw Error("Invalid guest player");
    this.gravity = scenarioGravity(recipe);
    this.randomState = recipe.generation.seed;
  }
  static async create(recipe: ScenarioRecipe): Promise<ScenarioSession> {
    if (recipe.measurePhysics) {
      performanceMetrics.enabled = true;
      performanceMetrics.reset();
    }
    const session = new ScenarioSession(structuredClone(recipe));
    try {
      await session.open(true);
      return session;
    } catch (error) {
      await session.close();
      throw error;
    }
  }
  private requireGuest() {
    if (!this.guest) throw Error("No guest in this scenario");
    return this.guest;
  }
  private async open(fresh: boolean) {
    const meta: WorldMeta = {
      id: "scenario",
      name: this.recipe.id,
      generation: this.recipe.generation,
      createdAt: 0,
      lastPlayedAt: 0,
    };
    const registry: IWorldRegistry = {
      async open() {},
      close() {},
      async listWorlds() {
        return [structuredClone(meta)];
      },
      async getWorld(id) {
        return id === meta.id ? structuredClone(meta) : undefined;
      },
      async createWorld() {
        throw Error("Scenario registry is fixed");
      },
      async updateLastPlayed() {},
      async renameWorld() {},
      async deleteWorld() {},
    };
    const graph = this.recipe.trafficRoads ? buildLaneGraph(this.recipe.trafficRoads) : undefined;
    this.realm = new Realm([baseGameMod], {
      ...(graph ? { vehicleSource: { trafficNetwork: () => graph } } : {}),
      gravity: () => this.gravity,
      ambientSpawns: false,
      ...(this.recipe.landscape ? { landscape: this.recipe.landscape } : {}),
      definitions: new Map(this.recipe.props.map((p) => [p.type, p])),
      random: () => {
        this.randomState = lcgNext(this.randomState);
        return this.randomState / 4294967296;
      },
    });
    await this.realm.loadWorld(meta.id, registry, () => this.store);
    this.player = new PlayerSession("scenario-player");
    this.player.editorEnabled = false;
    await this.realm.addPlayer(this.player);
    if (fresh)
      Object.assign(this.player.player, structuredClone(this.recipe.player), {
        id: this.player.player.id,
        type: "player",
      });
    this.player.player.wanderAI = null;
    delete this.player.player.routeAI;
    applyScenarioAppearance(this.player.player, this.recipe.player);
    if (this.realm.vehicles.get(this.player)) replaceBodyCollider(this.player.player, null);
    await this.ready();
    if (fresh) {
      for (const area of this.recipe.roads ?? []) {
        if (
          !Object.values(area).every((v) => Number.isSafeInteger(v) && v % 16 === 0) ||
          area.right <= area.left ||
          area.bottom <= area.top ||
          (area.right - area.left) * (area.bottom - area.top) > 1048576
        )
          throw Error("Invalid scenario road bounds");
        await this.ready({
          minCx: Math.floor(area.left / CHUNK_SIZE_PX),
          maxCx: Math.floor((area.right - 1) / CHUNK_SIZE_PX),
          minCy: Math.floor(area.top / CHUNK_SIZE_PX),
          maxCy: Math.floor((area.bottom - 1) / CHUNK_SIZE_PX),
        });
        for (let y = area.top / 16; y < area.bottom / 16; y++)
          for (let x = area.left / 16; x < area.right / 16; x++) {
            const cx = Math.floor(x / 16),
              cy = Math.floor(y / 16),
              c = this.realm.world.getChunkIfLoaded(cx, cy);
            if (!c) throw Error("Scenario road is not ready");
            const lx = ((x % 16) + 16) % 16,
              ly = ((y % 16) + 16) % 16;
            if (!c.getRoad(lx, ly)) c.setRoad(lx, ly, RoadType.Asphalt);
            this.realm.saveManager?.markChunkDirty(`${cx},${cy}`);
          }
      }
      for (const prop of this.recipe.props) this.realm.propManager.add(structuredClone(prop));
      for (const prop of this.recipe.nativeProps ?? [])
        this.realm.propManager.add(createProp(prop.type, prop.wx, prop.wy));
      for (const actor of this.recipe.actors ?? [])
        this.realm.entityManager.spawn(structuredClone(actor));
      for (const fixture of this.recipe.parkedVehicles ?? []) {
        await this.ready({
          minCx: Math.floor(fixture.wx / CHUNK_SIZE_PX) - 1,
          maxCx: Math.floor(fixture.wx / CHUNK_SIZE_PX) + 1,
          minCy: Math.floor(fixture.wy / CHUNK_SIZE_PX) - 1,
          maxCy: Math.floor(fixture.wy / CHUNK_SIZE_PX) + 1,
        });
        const state = parkScenarioVehicle(this.realm.vehicleRegistry, fixture);
        if (!state) throw Error("Blocked parked scenario vehicle");
        if (fixture.rotation) {
          state.entity.bodyRotation = [...fixture.rotation];
          this.realm.vehicleRegistry?.onChange?.(state, false);
        }
        if (fixture.name) {
          this.handles[fixture.name] = state.entity.id;
          if (state.entity.proceduralId) this.identities[fixture.name] = state.entity.proceduralId;
        }
      }
    } else
      for (const [name, identity] of Object.entries(this.identities)) {
        const entity = this.realm.entityManager.entities.find((e) => e.proceduralId === identity);
        if (entity) this.handles[name] = entity.id;
      }
    for (const entity of this.realm.entityManager.entities) {
      const template = this.recipe.actors?.find((actor) => actor.type === entity.type);
      if (template) applyScenarioAppearance(entity, template);
    }
    this.realm.entityManager.spatialHash.update(this.player.player);
    this.guest = undefined;
    if (this.recipe.guest) {
      const guest = new PlayerSession("scenario-guest");
      guest.editorEnabled = false;
      await this.realm.addPlayer(guest);
      if (fresh)
        Object.assign(guest.player, structuredClone(this.recipe.guest), {
          id: guest.player.id,
          type: "player",
        });
      guest.player.wanderAI = null;
      delete guest.player.routeAI;
      guest.visibleRange = { ...this.player.visibleRange };
      this.guest = guest;
      this.handles.host = this.player.player.id;
      this.handles.guest = guest.player.id;
      this.realm.entityManager.spatialHash.update(guest.player);
      // Opening/restoring a paused two-player lab publishes through frames();
      // it must not advance vehicles or other bodies by a hidden warm-up tick.
    }
  }
  private setViewRange(range?: ChunkRange) {
    if (
      range &&
      (!Object.values(range).every(Number.isSafeInteger) ||
        range.maxCx < range.minCx ||
        range.maxCy < range.minCy ||
        (range.maxCx - range.minCx + 1) * (range.maxCy - range.minCy + 1) > 4096)
    )
      throw Error("Invalid scenario view range");
    const p = this.player.player.position,
      cx = Math.floor(p.wx / CHUNK_SIZE_PX),
      cy = Math.floor(p.wy / CHUNK_SIZE_PX);
    const view = range ?? { minCx: cx - 2, maxCx: cx + 2, minCy: cy - 2, maxCy: cy + 2 };
    this.player.visibleRange = {
      minCx: Math.min(view.minCx, cx - 2),
      maxCx: Math.max(view.maxCx, cx + 2),
      minCy: Math.min(view.minCy, cy - 2),
      maxCy: Math.max(view.maxCy, cy + 2),
    };
  }
  async ready(range?: ChunkRange) {
    this.setViewRange(range);
    this.realm.updateVisibleChunks(this.player.visibleRange);
    await this.realm.ensureReady(this.player.visibleRange);
  }
  input(buffer: ArrayBuffer, range?: ChunkRange, seat: 0 | 1 = 0) {
    if (this.closed) throw Error("Scenario is closed");
    const message = decodeClientMessage(buffer);
    if (message.type !== "player-input") throw Error("Expected scenario player input");
    const player = seat === 0 ? this.player : this.guest;
    if (!player) throw Error("No guest in this scenario");
    if (seat === 0) {
      this.setViewRange(range);
      this.seq = Math.max(this.seq, message.seq);
    }
    this.realm.handleMessage(player.clientId, player, message);
  }
  /** Exactly one fixed shared tick, whether invoked by ServerLoop or manual stepping. */
  tick(publish = false): ArrayBuffer[] {
    if (this.closed) throw Error("Scenario is closed");
    const started = performanceMetrics.start();
    this.realm.tick(PHYSICS_DT, this.transport, publish, new Set());
    performanceMetrics.end("realm.tick", started);
    return this.takeFrames(this.player);
  }
  private takeFrames(player: PlayerSession): ArrayBuffer[] {
    const frames = this.outgoing.get(player.clientId) ?? [];
    this.outgoing.delete(player.clientId);
    return frames;
  }
  takeGuestFrames(): ArrayBuffer[] {
    return this.guest ? this.takeFrames(this.guest) : [];
  }
  discardInputs() {
    for (const player of this.realm.sessions.values()) {
      player.lastProcessedInputSeq = player.inputQueue.at(-1)?.seq ?? player.lastProcessedInputSeq;
      player.inputQueue.length = 0;
      player.controls.reset(player.lastProcessedInputSeq);
    }
  }
  async step(input: Movement, range?: ChunkRange) {
    if (this.closed) throw Error("Scenario is closed");
    if (![input.dx, input.dy].every(Number.isFinite)) throw Error("Invalid scenario input");
    await this.ready(range);
    this.input(encodeClientMessage({ type: "player-input", ...input, seq: ++this.seq }), range);
    this.tick();
  }
  async command(command: ScenarioCommand) {
    if (this.closed) throw Error("Scenario is closed");
    switch (command.kind) {
      case "place-entity":
        if (![command.position.wx, command.position.wy].every(Number.isFinite))
          throw Error("Invalid scenario placement");
        this.realm.handleMessage(this.player.clientId, this.player, {
          type: "edit-spawn",
          entityType: command.entityType,
          ...command.position,
        });
        return;
      case "throw-ball":
        if (
          ![command.dirX, command.dirY, command.force].every(Number.isFinite) ||
          command.force < 0 ||
          command.force > 1 ||
          Math.hypot(command.dirX, command.dirY) < 0.001 ||
          Math.hypot(command.dirX, command.dirY) > 1.001
        )
          throw Error("Invalid scenario throw");
        this.realm.handleMessage(this.player.clientId, this.player, {
          type: "throw-ball",
          ...command,
        });
        return;
      case "vehicle-horn":
        this.realm.vehicles.honk(this.player, command.active);
        return;
      case "vehicle-emergency":
        this.realm.vehicles.emergency(this.player, command.action);
        return;
      case "call-train":
      case "enter-vehicle":
      case "recover-vehicle":
      case "vehicle-bed":
      case "exit-vehicle":
        return this.seatCommand(command);
      case "view-range":
        await this.ready(command.range);
        return;
      case "teleport": {
        if (![command.position.wx, command.position.wy, command.z ?? 0].every(Number.isFinite))
          throw Error("Invalid teleport");
        if (this.realm.vehicles.get(this.player)) this.realm.vehicles.exit(this.player, true);
        const p = this.player.player;
        teleportBody(p, { ...command.position, wz: command.z ?? 0 });
        this.player.controls.reset(this.player.lastProcessedInputSeq);
        this.realm.entityManager.spatialHash.update(p);
        await this.ready();
        return;
      }
    }
  }
  /** Seat-addressed vehicle and train requests, shared by the host and guest panes. */
  private async seatCommand(command: ScenarioSeatCommand) {
    const session = command.seat === 1 ? this.requireGuest() : this.player,
      vehicles = this.realm.vehicles;
    if (command.kind === "call-train") {
      if (!Number.isSafeInteger(command.benchId) || !this.realm.railways)
        throw Error("No train service.");
      await this.realm.railways.call(session, command.benchId);
    } else if (command.kind === "enter-vehicle") vehicles.enter(session, command.entityId);
    else if (command.kind === "recover-vehicle") vehicles.recover(session, command.entityId);
    else if (command.kind === "vehicle-bed") controlDumpBed(vehicles, session, command);
    else vehicles.exit(session);
  }
  frames(): ArrayBuffer[] {
    if (this.guest) {
      const packets = this.outgoing.get(this.guest.clientId) ?? [];
      packets.push(...this.realm.replicate(this.guest.clientId).map(encodeServerMessage));
      this.outgoing.set(this.guest.clientId, packets);
    }
    return [
      ...this.takeFrames(this.player),
      ...this.realm.replicate(this.player.clientId).map(encodeServerMessage),
    ];
  }
  async reset() {
    if (this.closed) throw Error("Scenario is closed");
    await this.realm.destroy();
    this.records.records.clear();
    this.store = new RecordPersistenceStore(this.records);
    this.seq = 0;
    this.randomState = this.recipe.generation.seed;
    this.outgoing.clear();
    for (const key of Object.keys(this.handles)) delete this.handles[key];
    this.identities = {};
    await this.open(true);
  }
  async reload() {
    if (this.closed) throw Error("Scenario is closed");
    const range = this.player.visibleRange;
    await this.realm.flushAsync();
    await this.realm.destroy();
    this.seq = 0;
    this.outgoing.clear();
    await this.open(false);
    await this.ready(range);
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.realm?.destroy();
    this.outgoing.clear();
  }
}
