// Original/current car poses on identical live authority and replica geometry.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { transformSync } from "esbuild";
import { Direction } from "../../src/entities/Entity.ts";
import { EntityManager } from "../../src/entities/EntityManager.ts";
import { createPlayer } from "../../src/entities/Player.ts";
import { PropManager } from "../../src/entities/PropManager.ts";
import { FlatStrategy } from "../../src/generation/FlatStrategy.ts";
import { vehicleGeometryRecipe } from "../../src/scenarios/VehicleGeometryRecipe.ts";
import { drivenCarPose } from "../../src/traffic/Driving.ts";
import { createDrivingQueries, registerDrivingProps } from "../../src/traffic/DrivingQueries.ts";
import { TrafficTestHarness } from "../../src/traffic/TrafficTestHarness.ts";
import { createVehicle, VEHICLE_MODELS } from "../../src/traffic/Vehicle.ts";
import { World } from "../../src/world/World.ts";

const option = (k, fallback) =>
  process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? fallback;
const referencePath = option("reference", "");
if (!referencePath) throw Error("Supply --reference=PATH to original Driving.ts");
const output = option("output", path.join(os.tmpdir(), "tilefun-driving-query-parity"));
await mkdir(output, { recursive: true });
const original = await readFile(referencePath, "utf8");
const rewritten = original.replace(
  /from "(\.[^"]+)"/g,
  (_, relative) =>
    `from ${JSON.stringify(new URL(relative.replace(/\.js$/, ".ts"), new URL("../../src/traffic/Driving.ts", import.meta.url)).href)}`,
);
const reference = await import(
  `data:text/javascript;base64,${Buffer.from(transformSync(rewritten, { loader: "ts", format: "esm", target: "es2022" }).code).toString("base64")}`
);
function wall(x, y, offset = 0) {
  return {
    id: 0,
    type: "query-probe-wall",
    position: { wx: x, wy: y },
    sprite: { sheetKey: "probe", frameCol: 0, frameRow: 0, spriteWidth: 1, spriteHeight: 1 },
    collider: { offsetX: offset, offsetY: 8, width: 12, height: 16 },
    walls: null,
    isProp: true,
  };
}
function flat() {
  const world = new World(new FlatStrategy());
  for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) world.getChunk(x, y);
  return world;
}
const city = new TrafficTestHarness();
for (let i = 0; i < 4; i++) city.load({ minCx: 12, minCy: 17, maxCx: 26, maxCy: 37 });
const fixtures = [
  {
    name: "clear-distant-props",
    world: flat(),
    props: Array.from({ length: 1000 }, (_, i) =>
      wall(2048 + (i % 50) * 32, 2048 + Math.floor(i / 50) * 32),
    ),
    x: 0,
    y: 0,
    z: 0,
  },
  {
    name: "compound-near-wall",
    world: flat(),
    props: [{ ...wall(1024, 0), walls: [wall(0, 0, -1024).collider] }],
    x: 0,
    y: 0,
    z: 0,
  },
  {
    name: "roof-headroom",
    world: flat(),
    props: [{ ...wall(400, 0), collider: { ...wall(400, 0).collider, zBase: 24, zHeight: 16 } }],
    x: 0,
    y: 0,
    z: 0,
    rider: true,
  },
  { name: "spanning-body", world: flat(), props: [], x: 0, y: 0, z: 0, body: true },
  {
    name: "garage-ramp",
    world: flat(),
    props: vehicleGeometryRecipe(true).props,
    x: -144,
    y: 0,
    z: -12,
  },
  {
    name: "garage-floor",
    world: flat(),
    props: vehicleGeometryRecipe(true).props,
    x: 80,
    y: 0,
    z: -48,
  },
  {
    name: "bridge-grade",
    world: flat(),
    props: vehicleGeometryRecipe(false).props,
    x: 0,
    y: 224,
    z: 16,
  },
  { name: "deleted-bridge", world: flat(), props: [], x: 0, y: 0, z: 64 },
  {
    name: "generated-city",
    world: city.world,
    props: city.props.props,
    x: city.car.entity.position.wx,
    y: city.car.entity.position.wy,
    z: 0,
  },
];
const inputs = [
  { dx: 1, dy: 0 },
  { dx: -1, dy: 0 },
  { dx: 0, dy: 1 },
  { dx: 0, dy: -1 },
  { dx: 1, dy: 1 },
  { dx: -1, dy: 1 },
  { dx: 0, dy: 0 },
  { dx: 1, dy: -1, sprinting: true },
];
const report = {
  referenceSHA256: createHash("sha256").update(original).digest("hex"),
  sourcesSHA256: {},
  cases: [],
};
for (const file of ["Driving.ts", "DrivingQueries.ts"])
  report.sourcesSHA256[file] = createHash("sha256")
    .update(await readFile(new URL(`../../src/traffic/${file}`, import.meta.url)))
    .digest("hex");
for (const fixture of fixtures) {
  const props = new PropManager();
  for (const p of structuredClone(fixture.props)) props.add(p);
  const replica = structuredClone(props.props);
  registerDrivingProps(replica);
  const entities = new EntityManager();
  let queries = 0,
    candidates = 0,
    bodyCandidates = 0,
    checks = 0,
    blocked = 0;
  const local = createDrivingQueries(props, entities);
  const query = local.props.bind(local),
    bodies = local.bodies.bind(local);
  local.props = (box) => {
    const list = query(box);
    queries++;
    candidates += list.length;
    return list;
  };
  local.bodies = (box) => {
    const list = bodies(box);
    bodyCandidates += list.length;
    return list;
  };
  const hash = createHash("sha256");
  for (const model of VEHICLE_MODELS)
    for (const direction of [Direction.Down, Direction.Up, Direction.Left, Direction.Right])
      for (const input of inputs)
        for (const dt of [1 / 60, 1 / 30, 0.1]) {
          const car = entities.spawn(createVehicle(model, fixture.x, fixture.y, direction));
          car.wz = car.groundZ = fixture.z;
          let extra;
          if (fixture.rider) {
            extra = createPlayer(fixture.x, fixture.y);
            extra.collider = {
              offsetX: 0,
              offsetY: 10,
              width: 900,
              height: 20,
              physicalHeight: 16,
            };
            extra.wz = fixture.z + (car.collider.physicalHeight ?? 24);
          }
          if (fixture.body) {
            extra = createPlayer(fixture.x + 1024, fixture.y);
            extra.collider = {
              offsetX: -1024,
              offsetY: 10,
              width: 12,
              height: 20,
              physicalHeight: 16,
            };
          }
          if (extra) entities.spawn(extra);
          const full = reference.drivenCarPose(
            car,
            input,
            dt,
            fixture.world,
            props.props,
            entities.entities,
          );
          const authority = drivenCarPose(
            car,
            input,
            dt,
            fixture.world,
            props.props,
            entities.entities,
            local,
          );
          const prediction = drivenCarPose(
            car,
            input,
            dt,
            fixture.world,
            replica,
            entities.entities,
          );
          assert.deepEqual(authority, full, `${fixture.name}/${model}/${direction}/authority`);
          assert.deepEqual(prediction, full, `${fixture.name}/${model}/${direction}/replica`);
          hash.update(JSON.stringify(full ?? null));
          checks++;
          if (!full) blocked++;
          entities.remove(car.id, false);
          if (extra) entities.remove(extra.id, false);
        }
  report.cases.push({
    name: fixture.name,
    models: VEHICLE_MODELS.length,
    checks,
    blocked,
    props: props.props.length,
    queries,
    propCandidates: candidates,
    bodyCandidates,
    poseHash: hash.digest("hex"),
  });
  console.log(
    `${fixture.name}: ${checks} exact authority/replica poses; ${props.props.length} resident props`,
  );
}
await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
