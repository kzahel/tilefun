import { required } from "../art/ArtCatalog.js";
import { BlendGraph } from "../autotile/BlendGraph.js";
import { Direction } from "../entities/Entity.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { PropManager } from "../entities/PropManager.js";
import { CURRENT_REGIONAL_VERSION } from "../generation/GenerationDescriptor.js";
import { createGenerator } from "../generation/Generator.js";
import { ProceduralProps } from "../generation/ProceduralProps.js";
import type { Movement } from "../input/ActionManager.js";
import { getMovementPhysicsParams, stepPlayerFromInput } from "../physics/PlayerMovement.js";
import { createMovementContext, createSurfaceSampler } from "../physics/SimulationEnvironment.js";
import type { ChunkRange } from "../world/ChunkManager.js";
import { World } from "../world/World.js";
import type { TrafficStrategy } from "./TrafficNetwork.js";
import { TrafficSystem } from "./TrafficSystem.js";

export const TRAFFIC_DEMO_GENERATION = {
  type: "regional",
  version: CURRENT_REGIONAL_VERSION,
  seed: 2026,
  preset: "temperate-v1",
} as const;
/** Low-level synchronous stress harness for lane/streaming unit tests only.
 * Interactive labs and integration tests use ScenarioSession. */
export class TrafficTestHarness {
  readonly generator = createGenerator(TRAFFIC_DEMO_GENERATION);
  readonly strategy = this.generator.terrain as TrafficStrategy;
  readonly world = new World(this.strategy);
  readonly entities = new EntityManager();
  readonly props = new PropManager();
  readonly generatedProps = new ProceduralProps(this.props, () => {});
  readonly traffic = new TrafficSystem(this.world, this.entities, this.props, this.strategy);
  readonly blend = new BlendGraph();
  readonly player = this.entities.spawn(createPlayer(0, 0));
  readonly car;
  private jumpState = { jumpConsumed: false, lastJumpHeld: false };
  constructor() {
    const graph = this.strategy.trafficNetwork(300 * 16, 519 * 16);
    const lane = required(
      [...graph.lanes.values()]
        .filter(
          (l) =>
            !l.intercity &&
            l.direction === Direction.Right &&
            l.width >= 128 &&
            l.path.length > 300,
        )
        .sort(
          (a, b) => Math.hypot(a.a.x - 4800, a.a.y - 8304) - Math.hypot(b.a.x - 4800, b.a.y - 8304),
        )[0],
    );
    this.car = this.traffic.add("compact-1", lane, 80);
    const reverse = [...graph.lanes.values()].find((l) => l.from === lane.to && l.to === lane.from);
    if (reverse) this.traffic.add("bus-1", reverse, Math.min(120, reverse.path.length / 2));
    this.standAhead();
  }
  standAhead() {
    const c = this.car.entity,
      velocity = c.velocity;
    const direction = c.sprite?.direction ?? Direction.Right;
    const dx = direction === Direction.Right ? 1 : direction === Direction.Left ? -1 : 0;
    const dy = direction === Direction.Down ? 1 : direction === Direction.Up ? -1 : 0;
    this.player.position = { wx: c.position.wx + dx * 90, wy: c.position.wy + dy * 90 + 3 };
    this.player.wz = 0;
    this.player.velocity = { vx: 0, vy: 0 };
    delete this.player.jumpVZ;
    this.player.groundZ = 0;
    this.jumpState = { jumpConsumed: false, lastJumpHeld: false };
    if (velocity) {
      velocity.vx = 0;
      velocity.vy = 0;
    }
  }
  standOnRoof() {
    const c = this.car.entity;
    this.player.position = { wx: c.position.wx, wy: c.position.wy + 3 };
    this.player.wz = required(required(c.collider).physicalHeight);
    this.player.groundZ = this.player.wz;
    this.player.velocity = { vx: 0, vy: 0 };
    delete this.player.jumpVZ;
    this.jumpState = { jumpConsumed: false, lastJumpHeld: false };
  }
  load(range: ChunkRange) {
    this.traffic.visibleRanges = [range];
    this.world.updateLoadedChunks([range, ...this.traffic.supportRanges([this.player])], 64);
    this.world.computeAutotile(this.blend, 64);
    this.generatedProps.reconcile(
      this.generator,
      [...this.world.chunks.entries()].map(([k]) => k),
    );
  }
  step(input: Movement, dt = 1 / 60) {
    const queryEntities = () => this.entities.entities,
      queryProps = () => this.props.props;
    const ctx = createMovementContext({
      getCollision: (x, y) => this.world.getCollisionIfLoaded(x, y),
      getHeight: () => 0,
      queryEntities,
      queryProps,
      movingEntity: this.player,
      excludeIds: new Set([this.player.id]),
      noclip: false,
    });
    this.jumpState = stepPlayerFromInput(
      this.player,
      input,
      dt,
      ctx,
      () => 0,
      createSurfaceSampler({ queryEntities, queryProps }),
      this.jumpState,
      getMovementPhysicsParams(),
    ).jumpState;
    this.traffic.tick(dt, [this.player]);
    this.entities.spatialHash.update(this.player);
  }
}
