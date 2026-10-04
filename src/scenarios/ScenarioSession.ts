import { Direction } from "../entities/Entity.js";
import { baseGameMod } from "../game/base-game.js";
import type { Movement } from "../input/ActionManager.js";
import type { IWorldRegistry, WorldMeta } from "../persistence/IWorldRegistry.js";
import { MemoryRecordStore } from "../persistence/MemoryRecordStore.js";
import { RecordPersistenceStore } from "../persistence/RecordPersistenceStore.js";
import { validateSurfacePatch } from "../physics/SurfacePatch.js";
import { validateExcavations } from "../physics/TerrainExcavation.js";
import { RoadType } from "../road/RoadType.js";
import { PlayerSession } from "../server/PlayerSession.js";
import { Realm } from "../server/Realm.js";
import {
  decodeClientMessage,
  encodeClientMessage,
  encodeServerMessage,
} from "../shared/binaryCodec.js";
import { LocalTransport } from "../transport/LocalTransport.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import type { ScenarioCommand } from "./ScenarioProtocol.js";
import { applyScenarioAppearance, type ScenarioRecipe, scenarioPhysics } from "./ScenarioRecipe.js";

/** Temporary host of the production Realm. No timers, DOM, IndexedDB or simulation callbacks. */
export class ScenarioSession {
  readonly records = new MemoryRecordStore();
  private store = new RecordPersistenceStore(this.records);
  private transport = new LocalTransport();
  private randomState: number;
  readonly physics;
  realm!: Realm;
  player!: PlayerSession;
  readonly handles: Record<string, number> = {};
  private seq = 0;
  private identities: Record<string, string> = {};
  private closed = false;
  private constructor(readonly recipe: ScenarioRecipe) {
    if (recipe.version !== 1) throw new Error("Unsupported scenario recipe");
    recipe.props.forEach((p, i) => {
      p.type = `scenario-prop-${i}`;
      for (const c of p.walls ?? (p.collider ? [p.collider] : []))
        if (c.surface) validateSurfacePatch(c.surface, c.width, c.height);
    });
    validateExcavations(recipe.props);
    const patches = recipe.props
      .flatMap((p) => p.walls ?? (p.collider ? [p.collider] : []))
      .flatMap((c) => (c.surface ? [c.surface] : []));
    const ids = new Set(patches.map((p) => p.id));
    if (ids.size !== patches.length || patches.some((p) => p.connectsTo.some((id) => !ids.has(id))))
      throw new Error("Invalid surface connections");
    if (recipe.actors?.some((e) => e.type === "player"))
      throw new Error("Use recipe.player for the controlled actor");
    for (const line of recipe.railways ?? [])
      if (
        !line.id ||
        ![line.start, line.end, line.y].every(Number.isSafeInteger) ||
        line.end <= line.start ||
        line.end - line.start > 256
      )
        throw new Error("Invalid scenario railway");
    this.physics = scenarioPhysics(recipe.physics);
    this.randomState = recipe.generation.seed;
  }
  static async create(recipe: ScenarioRecipe): Promise<ScenarioSession> {
    const session = new ScenarioSession(structuredClone(recipe));
    try {
      await session.open(true);
      return session;
    } catch (error) {
      await session.close();
      throw error;
    }
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
        throw new Error("Scenario registry is fixed");
      },
      async updateLastPlayed() {},
      async renameWorld() {},
      async deleteWorld() {},
    };
    this.realm = new Realm([baseGameMod], {
      physics: () => this.physics,
      ambientSpawns: false,
      ...(this.recipe.trafficLanes
        ? {
            traffic: {
              trafficNetwork: () => ({
                lanes: new Map(this.recipe.trafficLanes?.map((l) => [l.id, l])),
                outgoing: new Map(
                  this.recipe.trafficLanes?.map((l) => [
                    l.from,
                    this.recipe.trafficLanes?.filter((n) => n.from === l.from) ?? [],
                  ]),
                ),
              }),
            },
          }
        : {}),
      ...(this.recipe.railways
        ? {
            railways: {
              query: (b) =>
                this.recipe.railways?.filter(
                  (line) =>
                    line.start <= b.maxX &&
                    line.end >= b.minX &&
                    line.y >= b.minY &&
                    line.y <= b.maxY,
                ) ?? [],
            },
          }
        : {}),
      definitions: new Map(this.recipe.props.map((p) => [p.type, p])),
      random: () => {
        this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
        return this.randomState / 4294967296;
      },
    });
    await this.realm.loadWorld(meta.id, registry, () => this.store);
    if (this.recipe.trafficLanes && this.realm.traffic) {
      this.realm.traffic.canSpawn = () => false;
      this.realm.traffic.settings.speed = this.recipe.trafficSpeed ?? 36;
    }
    this.player = new PlayerSession("scenario-player");
    this.player.editorEnabled = false;
    await this.realm.addPlayer(this.player);
    if (fresh) {
      Object.assign(this.player.player, structuredClone(this.recipe.player), {
        id: this.player.player.id,
        type: "player",
      });
    }
    this.player.player.wanderAI = null;
    delete this.player.player.routeAI;
    applyScenarioAppearance(this.player.player, this.recipe.player);
    await this.ready();
    if (fresh) {
      // Seed the entire bounded track once; saved chunk edits own it thereafter.
      for (const line of this.recipe.railways ?? []) {
        const minX = line.start - 16,
          maxX = line.end + 16;
        const range = {
          minCx: Math.floor(minX / 16),
          maxCx: Math.floor(maxX / 16),
          minCy: Math.floor((line.y - 1) / 16),
          maxCy: Math.floor(line.y / 16),
        };
        await this.ready(range);
        for (let tx = minX; tx <= maxX; tx++)
          for (const ty of [line.y - 1, line.y]) {
            const cx = Math.floor(tx / 16),
              cy = Math.floor(ty / 16);
            const chunk = this.realm.world.getChunkIfLoaded(cx, cy);
            if (!chunk) throw new Error("Scenario track is not ready");
            chunk.setRoad(
              ((tx % 16) + 16) % 16,
              ((ty % 16) + 16) % 16,
              ty < line.y ? RoadType.RailHorizontalTop : RoadType.RailHorizontalBottom,
            );
            this.realm.saveManager?.markChunkDirty(`${cx},${cy}`);
          }
      }
      for (const area of this.recipe.roads ?? []) {
        if (
          !Object.values(area).every((v) => Number.isSafeInteger(v) && v % 16 === 0) ||
          area.right <= area.left ||
          area.bottom <= area.top ||
          (area.right - area.left) * (area.bottom - area.top) > 1048576
        )
          throw new Error("Invalid scenario road bounds");
        await this.ready({
          minCx: Math.floor(area.left / 256),
          maxCx: Math.floor((area.right - 1) / 256),
          minCy: Math.floor(area.top / 256),
          maxCy: Math.floor((area.bottom - 1) / 256),
        });
        for (let y = area.top / 16; y < area.bottom / 16; y++)
          for (let x = area.left / 16; x < area.right / 16; x++) {
            const cx = Math.floor(x / 16),
              cy = Math.floor(y / 16);
            const c = this.realm.world.getChunkIfLoaded(cx, cy);
            if (!c) throw new Error("Scenario road is not ready");
            const lx = ((x % 16) + 16) % 16,
              ly = ((y % 16) + 16) % 16;
            if (!c.getRoad(lx, ly)) c.setRoad(lx, ly, RoadType.Asphalt);
            this.realm.saveManager?.markChunkDirty(`${cx},${cy}`);
          }
      }
      for (const prop of this.recipe.props) this.realm.propManager.add(structuredClone(prop));
      for (const actor of this.recipe.actors ?? [])
        this.realm.entityManager.spawn(structuredClone(actor));
      for (const fixture of this.recipe.traffic ?? []) {
        const traffic = this.realm.traffic;
        const lane = traffic?.strategy
          .trafficNetwork(fixture.x, fixture.y)
          .lanes.get(fixture.laneId);
        if (!traffic || !lane) throw new Error(`Missing scenario lane ${fixture.laneId}`);
        const car = traffic.add(
          fixture.model,
          lane,
          fixture.distance,
          true,
          undefined,
          fixture.z ?? 0,
        ).entity;
        this.handles[fixture.name] = car.id;
        if (car.proceduralId) this.identities[fixture.name] = car.proceduralId;
      }
    }
    if (!fresh)
      for (const [name, identity] of Object.entries(this.identities)) {
        const entity = this.realm.entityManager.entities.find((e) => e.proceduralId === identity);
        if (entity) this.handles[name] = entity.id;
      }
    this.realm.entityManager.spatialHash.update(this.player.player);
  }
  async ready(range?: ChunkRange) {
    const p = this.player.player.position,
      cx = Math.floor(p.wx / 256),
      cy = Math.floor(p.wy / 256);
    this.player.visibleRange = range ?? {
      minCx: cx - 2,
      maxCx: cx + 2,
      minCy: cy - 2,
      maxCy: cy + 2,
    };
    this.realm.updateVisibleChunks(this.player.visibleRange);
    await this.realm.ensureReady(this.player.visibleRange);
  }
  async step(input: Movement, dt = 1 / 60, range?: ChunkRange) {
    if (this.closed) throw new Error("Scenario is closed");
    if (
      !Number.isFinite(dt) ||
      dt <= 0 ||
      dt > 0.1 ||
      !Number.isFinite(input.dx) ||
      !Number.isFinite(input.dy)
    )
      throw new Error("Invalid scenario input");
    await this.ready(range);
    const message = decodeClientMessage(
      encodeClientMessage({ type: "player-input", ...input, seq: ++this.seq, dtMs: dt * 1000 }),
    );
    if (message.type !== "player-input") throw new Error("Invalid input codec");
    this.player.inputQueue.push(message);
    this.realm.tick(
      (message.dtMs ?? dt * 1000) / 1000,
      this.transport.serverSide,
      false,
      new Set(),
    );
  }
  async command(command: ScenarioCommand) {
    if (this.closed) throw new Error("Scenario is closed");
    const player = this.player.player;
    if (command.kind === "traffic-settings") {
      const settings = this.realm.traffic?.settings;
      if (!settings) throw new Error("No traffic in this scenario");
      for (const key of ["speed", "gap"] as const) {
        const value = command[key];
        if (value !== undefined && (!Number.isFinite(value) || value < 1 || value > 100))
          throw new Error("Invalid traffic setting");
      }
      if (command.speed !== undefined) settings.speed = command.speed;
      if (command.gap !== undefined) settings.gap = command.gap;
      return;
    }
    let position: { wx: number; wy: number },
      z = 0;
    if (command.kind === "traffic-position") {
      const car = this.realm.entityManager.entities.find((e) => e.id === this.handles.car);
      if (!car) throw new Error("Missing car fixture");
      const direction = car.sprite?.direction ?? Direction.Right;
      const dx = direction === Direction.Right ? 1 : direction === Direction.Left ? -1 : 0;
      const dy = direction === Direction.Down ? 1 : direction === Direction.Up ? -1 : 0;
      position = {
        wx: car.position.wx + (command.roof ? 0 : dx * 90),
        wy: car.position.wy + 3 + (command.roof ? 0 : dy * 90),
      };
      z = (car.wz ?? 0) + (command.roof ? (car.collider?.physicalHeight ?? 0) : 0);
    } else {
      position = command.position;
      z = command.z ?? 0;
    }
    if (![position.wx, position.wy, z].every(Number.isFinite)) throw new Error("Invalid teleport");
    player.position = { ...position };
    player.wz = player.groundZ = z;
    player.velocity = { vx: 0, vy: 0 };
    delete player.jumpVZ;
    delete player.jumpZ;
    this.player.jumpConsumed = this.player.lastJumpHeld = false;
    this.realm.entityManager.spatialHash.update(player);
    await this.ready();
  }
  frames(): ArrayBuffer[] {
    return this.realm.replicate(this.player.clientId).map(encodeServerMessage);
  }
  async reset() {
    if (this.closed) throw new Error("Scenario is closed");
    await this.realm.destroy();
    this.records.records.clear();
    this.store = new RecordPersistenceStore(this.records);
    this.seq = 0;
    this.randomState = this.recipe.generation.seed;
    for (const name of Object.keys(this.handles)) delete this.handles[name];
    this.identities = {};
    await this.open(true);
  }
  async reload() {
    if (this.closed) throw new Error("Scenario is closed");
    await this.realm.flushAsync();
    await this.realm.destroy();
    this.seq = 0;
    await this.open(false);
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.realm?.destroy();
    this.transport.serverSide.close();
  }
}
