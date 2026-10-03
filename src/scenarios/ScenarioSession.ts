import { Direction } from "../entities/Entity.js";
import { baseGameMod } from "../game/base-game.js";
import type { Movement } from "../input/ActionManager.js";
import type { IWorldRegistry, WorldMeta } from "../persistence/IWorldRegistry.js";
import { MemoryRecordStore } from "../persistence/MemoryRecordStore.js";
import { RecordPersistenceStore } from "../persistence/RecordPersistenceStore.js";
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
  private closed = false;
  private constructor(readonly recipe: ScenarioRecipe) {
    if (recipe.version !== 1) throw new Error("Unsupported scenario recipe");
    recipe.props.forEach((p, i) => {
      p.type = `scenario-prop-${i}`;
    });
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
      definitions: new Map(this.recipe.props.map((p) => [p.type, p])),
      random: () => {
        this.randomState = (Math.imul(this.randomState, 1664525) + 1013904223) >>> 0;
        return this.randomState / 4294967296;
      },
    });
    await this.realm.loadWorld(meta.id, registry, () => this.store);
    this.player = new PlayerSession("scenario-player");
    this.player.editorEnabled = false;
    await this.realm.addPlayer(this.player);
    if (fresh) {
      Object.assign(this.player.player, structuredClone(this.recipe.player), {
        id: this.player.player.id,
        type: "player",
      });
    }
    applyScenarioAppearance(this.player.player, this.recipe.player);
    await this.ready();
    if (fresh) {
      for (const prop of this.recipe.props) this.realm.propManager.add(structuredClone(prop));
      for (const actor of this.recipe.actors ?? [])
        this.realm.entityManager.spawn(structuredClone(actor));
      for (const fixture of this.recipe.traffic ?? []) {
        const traffic = this.realm.traffic;
        const lane = traffic?.strategy
          .trafficNetwork(fixture.x, fixture.y)
          .lanes.get(fixture.laneId);
        if (!traffic || !lane) throw new Error(`Missing scenario lane ${fixture.laneId}`);
        this.handles[fixture.name] = traffic.add(fixture.model, lane, fixture.distance).entity.id;
      }
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
    this.realm.tick(dt, this.transport.serverSide, false, new Set());
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
      Object.assign(settings, command);
      return;
    }
    let position,
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
      z = command.roof ? (car.collider?.physicalHeight ?? 0) : 0;
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
  async reload() {
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
