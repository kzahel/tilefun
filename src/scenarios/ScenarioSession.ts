import { Direction } from "../entities/Entity.js";
import { baseGameMod } from "../game/base-game.js";
import type { Movement } from "../input/ActionManager.js";
import type { IWorldRegistry, WorldMeta } from "../persistence/IWorldRegistry.js";
import { MemoryRecordStore } from "../persistence/MemoryRecordStore.js";
import { RecordPersistenceStore } from "../persistence/RecordPersistenceStore.js";
import { validateSurfacePatch } from "../physics/SurfacePatch.js";
import { validateExcavations } from "../physics/TerrainExcavation.js";
import { railAlignment } from "../railway/RailPath.js";
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
        line.end - line.start > 256 ||
        (line.surfaceFollowing &&
          (![line.surfaceFollowing.startZ, line.surfaceFollowing.endZ].every(
            (z) => Number.isFinite(z) && Math.abs(z) <= 4096,
          ) ||
            (line.surfaceFollowing.startAtEnd !== undefined &&
              typeof line.surfaceFollowing.startAtEnd !== "boolean")))
      )
        throw new Error("Invalid scenario railway");
    for (const line of recipe.railways ?? []) if (line.path) railAlignment(line.path);
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
    if (fresh && this.recipe.railwayStarts) {
      if (this.recipe.railwayStarts.length > 4) throw new Error("Too many scenario train starts");
      await this.records.commit(
        this.recipe.railwayStarts.map((r) => {
          if (!r.id || !Number.isFinite(r.x) || ![0, 1].includes(r.target))
            throw new Error("Invalid train start");
          return {
            put: {
              collection: "railServices",
              revision: 1,
              key: r.id,
              value: { version: 1, x: r.x, target: r.target, dwell: 0, speed: 0, deleted: false },
            },
          };
        }),
      );
    }
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
      ...(this.recipe.landscape ? { landscape: this.recipe.landscape } : {}),
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
                this.recipe.railways?.filter((line) => {
                  const bounds = line.path
                    ? railAlignment(line.path).bounds
                    : {
                        minX: line.start * 16,
                        maxX: line.end * 16,
                        minY: line.y * 16,
                        maxY: line.y * 16,
                      };
                  return (
                    bounds.minX <= b.maxX * 16 &&
                    bounds.maxX >= b.minX * 16 &&
                    bounds.minY <= b.maxY * 16 &&
                    bounds.maxY >= b.minY * 16
                  );
                }) ?? [],
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
    if ((this.recipe.trafficLanes || this.recipe.traffic) && this.realm.traffic) {
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
        if (line.path) {
          const alignment = railAlignment(line.path),
            b = alignment.bounds;
          await this.ready({
            minCx: Math.floor(b.minX / 256),
            maxCx: Math.floor(b.maxX / 256),
            minCy: Math.floor(b.minY / 256),
            maxCy: Math.floor(b.maxY / 256),
          });
          for (const p of alignment.samples(8))
            for (let tx = Math.floor((p.x - 24) / 16); tx <= Math.floor((p.x + 24) / 16); tx++)
              for (let ty = Math.floor((p.y - 24) / 16); ty <= Math.floor((p.y + 24) / 16); ty++) {
                const cx = Math.floor(tx / 16),
                  cy = Math.floor(ty / 16);
                const chunk = this.realm.world.getChunkIfLoaded(cx, cy);
                if (!chunk) throw Error("Curved track is not ready");
                chunk.setRoad(
                  ((tx % 16) + 16) % 16,
                  ((ty % 16) + 16) % 16,
                  RoadType.RailCurveProof,
                );
                this.realm.saveManager?.markChunkDirty(`${cx},${cy}`);
              }
          continue;
        }
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
  private setViewRange(range?: ChunkRange) {
    if (
      range &&
      (!Object.values(range).every(Number.isSafeInteger) ||
        range.maxCx < range.minCx ||
        range.maxCy < range.minCy ||
        (range.maxCx - range.minCx + 1) * (range.maxCy - range.minCy + 1) > 4096)
    )
      throw new Error("Invalid scenario view range");
    const p = this.player.player.position,
      cx = Math.floor(p.wx / 256),
      cy = Math.floor(p.wy / 256);
    this.player.visibleRange = range ?? {
      minCx: cx - 2,
      maxCx: cx + 2,
      minCy: cy - 2,
      maxCy: cy + 2,
    };
    // A diagnostic camera may inspect a remote actor. Keep the controlled
    // player's prediction/support neighborhood in the replicated view as well.
    const view = this.player.visibleRange;
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
    this.applyAuthoredRailPaths();
    await this.realm.railway?.settle();
    if (this.realm.railway?.error) throw this.realm.railway.error;
  }
  private applyAuthoredRailPaths() {
    if (!this.recipe.railways?.some((line) => line.path)) return;
    for (const [key, chunk] of this.realm.world.chunks.entries()) {
      const [cx, cy] = key.split(",").map(Number);
      const paths = (this.recipe.railways ?? [])
        .flatMap((l) => (l.path ? [l.path] : []))
        .filter((path) => {
          const b = railAlignment(path).bounds;
          return (
            b.minX < ((cx ?? 0) + 1) * 256 &&
            b.maxX > (cx ?? 0) * 256 &&
            b.minY < ((cy ?? 0) + 1) * 256 &&
            b.maxY > (cy ?? 0) * 256
          );
        });
      if (paths.length) chunk.railPaths = paths;
    }
  }
  /** Normal live input admission; streaming readiness is owned by Realm.tick. */
  input(buffer: ArrayBuffer, range?: ChunkRange) {
    if (this.closed) throw new Error("Scenario is closed");
    const message = decodeClientMessage(buffer);
    if (message.type !== "player-input") throw new Error("Expected scenario player input");
    this.setViewRange(range);
    this.seq = Math.max(this.seq, message.seq);
    this.realm.handleMessage(this.player.clientId, this.player, message);
  }
  /** Synchronous production authority tick, independent of client/render cadence. */
  tick(dt: number, publish = false): ArrayBuffer[] {
    if (this.closed) throw new Error("Scenario is closed");
    const frames: ArrayBuffer[] = [];
    this.transport.clientSide.onMessage((message) => frames.push(encodeServerMessage(message)));
    this.applyAuthoredRailPaths();
    this.realm.tick(dt, this.transport.serverSide, publish, new Set());
    return frames;
  }
  discardInputs() {
    this.player.lastProcessedInputSeq =
      this.player.inputQueue.at(-1)?.seq ?? this.player.lastProcessedInputSeq;
    this.player.inputQueue.length = 0;
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
    this.realm.handleMessage(this.player.clientId, this.player, message);
    this.tick((message.dtMs ?? dt * 1000) / 1000);
  }
  async command(command: ScenarioCommand) {
    if (this.closed) throw new Error("Scenario is closed");
    const player = this.player.player;
    if (command.kind === "view-range") {
      const r = command.range;
      if (
        !Object.values(r).every(Number.isSafeInteger) ||
        r.maxCx < r.minCx ||
        r.maxCy < r.minCy ||
        (r.maxCx - r.minCx + 1) * (r.maxCy - r.minCy + 1) > 4096
      )
        throw new Error("Invalid scenario view range");
      await this.ready(r);
      return;
    }
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
    if (command.kind === "train-position") {
      const service = [...(this.realm.railway?.services.values() ?? [])][0];
      const car = service?.carriages[command.carriage ?? (service.carriages.length > 1 ? 1 : 0)];
      if (!car?.collider) throw new Error("Missing train fixture");
      position = { wx: car.position.wx, wy: car.position.wy + (command.roof ? 0 : 48) };
      z = (car.wz ?? 0) + (command.roof ? (car.collider.physicalHeight ?? 44) : 0);
    } else if (command.kind === "traffic-position") {
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
    delete player.airMomentumX;
    delete player.airMomentumY;
    delete player.jumpVZ;
    delete player.jumpZ;
    this.player.jumpConsumed = this.player.lastJumpHeld = false;
    this.realm.entityManager.spatialHash.update(player);
    await this.ready(this.player.visibleRange);
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
    const range = this.player.visibleRange;
    if (this.closed) throw new Error("Scenario is closed");
    await this.realm.flushAsync();
    await this.realm.destroy();
    this.seq = 0;
    await this.open(false);
    await this.ready(range);
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    await this.realm?.destroy();
    this.transport.serverSide.close();
  }
}
