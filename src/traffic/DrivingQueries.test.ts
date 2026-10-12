import { describe, expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { Direction } from "../entities/Entity.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import type { Prop } from "../entities/Prop.js";
import { PropManager } from "../entities/PropManager.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { surfaceProp } from "../scenarios/WorldGeometryRecipe.js";
import { World } from "../world/World.js";
import { drivenCarPose } from "./Driving.js";
import {
  createDrivingQueries,
  drivingQueries,
  registerDrivingProps,
  retainDrivingQueries,
} from "./DrivingQueries.js";
import { createVehicle } from "./Vehicle.js";

function fixture() {
  const world = new World(new FlatStrategy());
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) world.getChunk(x, y);
  const entities = new EntityManager(),
    props = new PropManager();
  const car = entities.spawn(createVehicle("compact-1", 0, 0, Direction.Right));
  const queries = createDrivingQueries(props, entities);
  const pose = (local: boolean) =>
    drivenCarPose(
      car,
      { dx: 1, dy: 0 },
      1 / 60,
      world,
      props.props,
      entities.entities,
      local ? queries : undefined,
    );
  return { world, entities, props, car, queries, pose };
}
function wall(wx: number, offsetX = 0): Prop {
  return {
    id: 0,
    type: "test-wall",
    position: { wx, wy: 0 },
    sprite: { sheetKey: "test", frameCol: 0, frameRow: 0, spriteWidth: 1, spriteHeight: 1 },
    collider: { offsetX, offsetY: 10, width: 8, height: 20 },
    walls: null,
    isProp: true,
  };
}
describe("driven car neighborhoods", () => {
  it("keeps compound walls whose origin is distant and observes moving/deleted props", () => {
    const f = fixture(),
      p = wall(1024);
    p.walls = [{ ...required(p.collider), offsetX: -1024 }];
    f.props.add(p);
    expect(f.pose(true)).toEqual(f.pose(false));
    expect(f.pose(true)).toBeUndefined();
    f.props.move(p.id, 2048, 0);
    expect(f.pose(true)).toEqual(f.pose(false));
    expect(f.pose(true)).toBeDefined();
    f.props.remove(p.id);
    expect(f.pose(true)).toBeDefined();
  });
  it("includes oversized live bodies across distant origin cells", () => {
    const f = fixture(),
      body = createPlayer(1024, 0);
    body.collider = { offsetX: -1024, offsetY: 10, width: 8, height: 20, physicalHeight: 16 };
    f.entities.spawn(body);
    expect(f.pose(true)).toEqual(f.pose(false));
    expect(f.pose(true)).toBeUndefined();
    body.position.wx += 2048;
    f.entities.spatialHash.update(body);
    expect(f.pose(true)).toEqual(f.pose(false));
    expect(f.pose(true)).toBeDefined();
  });
  it("checks rider clearance beyond the car footprint", () => {
    const f = fixture(),
      rider = createPlayer(0, 0);
    rider.collider = { offsetX: 0, offsetY: 10, width: 900, height: 20, physicalHeight: 16 };
    rider.wz = f.car.collider?.physicalHeight ?? 24;
    f.entities.spawn(rider);
    const p = wall(400);
    required(p.collider).zBase = rider.wz;
    required(p.collider).zHeight = 16;
    f.props.add(p);
    expect(f.pose(true)).toEqual(f.pose(false));
    expect(f.pose(true)).toBeUndefined();
    f.entities.remove(rider.id, false);
    expect(f.pose(true)).toBeDefined();
  });
  it("retains distant excavation presence while excluding ordinary distant props", () => {
    const f = fixture(),
      p = surfaceProp(
        { left: 1024, top: 0, right: 1040, bottom: 16 },
        {
          id: "cut",
          spaceId: "below",
          z: -48,
          riseX: 0,
          riseY: 0,
          thickness: 8,
          connectsTo: [],
          excavation: {},
        },
      );
    f.props.add(p);
    f.props.add(wall(1536));
    expect(f.queries.props({ left: -32, top: -32, right: 32, bottom: 32 })).toEqual([p]);
    expect(f.pose(true)).toEqual(f.pose(false));
    f.props.remove(p.id);
    expect(f.queries.props({ left: -32, top: -32, right: 32, bottom: 32 })).toEqual([]);
  });
  it("retains the exact replica snapshot index for a replay copy after a new edit snapshot", () => {
    const old = [{ ...wall(1024), id: 1 }];
    registerDrivingProps(old);
    const copy = old.slice();
    retainDrivingQueries(old, copy);
    const edited = [{ ...wall(0), id: 1 }];
    registerDrivingProps(edited);
    expect(drivingQueries(copy)).toBe(drivingQueries(old));
    expect(drivingQueries(copy)?.props({ left: -32, top: -32, right: 32, bottom: 32 })).toEqual([]);
    expect(drivingQueries(edited)?.props({ left: -32, top: -32, right: 32, bottom: 32 })).toEqual(
      edited,
    );
    expect(drivingQueries([{ ...required(old[0]) }])).toBeUndefined();
  });
});
