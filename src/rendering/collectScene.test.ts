import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PNG } from "pngjs";
import { expect, it } from "vitest";
import { TerrainId } from "../autotile/TerrainId.js";
import { BOAT_MODEL } from "../boats/Boat.js";
import { createCow } from "../entities/Cow.js";
import { Direction, type Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { DECK_Z, treeHouseProp } from "../entities/TreeHouse.js";
import { createCurveTrain } from "../railway/CurveTrain.js";
import { RailAlignment } from "../railway/RailPath.js";
import { curvedTrackPath } from "../scenarios/CurvedTrainRecipe.js";
import { undergroundGarageRecipe } from "../scenarios/UndergroundGarageRecipe.js";
import { worldGeometryRecipe } from "../scenarios/WorldGeometryRecipe.js";
import { createVehicle, VEHICLE_MODELS } from "../traffic/Vehicle.js";
import { createFauna } from "../wildlife/Fauna.js";
import { createForageItem } from "../wildlife/ForageResources.js";
import { createRoadkill } from "../wildlife/Roadkill.js";
import { Chunk } from "../world/Chunk.js";
import { authoredVehicleForType } from "./AuthoredVehicleMeshes.js";
import { Camera } from "./Camera.js";
import { collectScene, collectWorldSprites } from "./collectScene.js";
import { SceneFrame } from "./SceneFrame.js";
import type { ElevationItem, ParticleItem, SceneItem, SpriteItem } from "./SceneItem.js";
import { shadowMode } from "./ShadowMode.js";
import type { TerrainResourceId } from "./TerrainPresentation.js";

const world = { getHeightAt: () => 0, getChunkIfLoaded: () => undefined, getRoadAt: () => 0 };
const terrain = { collectElevationItems: () => [] };

it("keeps physical roof riders at their world height while legacy fitted meshes retain their offset", () => {
  const car = createVehicle("compact-1", 200, 150, Direction.Right);
  car.id = 1;
  car.wz = 0;
  const rider = createPlayer(200, 150);
  rider.wz = car.collider?.physicalHeight ?? 24;
  const camera = new Camera();
  camera.setViewport(600, 400);
  camera.snapTo(200, 150);
  const sample = () =>
    collectScene(
      [car, rider],
      [],
      world,
      camera,
      camera.getVisibleChunkRange(),
      1,
      terrain,
      [],
      false,
    ).find((item) => item.kind === "sprite" && item.sheetKey === "player");
  const legacy = sample();
  if (legacy?.kind !== "sprite") throw Error("Missing rider");
  expect(legacy.meshRoofSupport?.heightDelta).toBeGreaterThan(0);
  car.bodyRotation = [0, 0, 0, 1];
  const physical = sample();
  if (physical?.kind !== "sprite") throw Error("Missing rider");
  expect(physical.meshRoofSupport?.heightDelta).toBe(0);
  expect(physical.zOffset).toBe(rider.wz);
});

function collect(entity: Entity, alpha = 1, zoom = 1 / 3, frame?: SceneFrame, height = 0) {
  const camera = new Camera();
  camera.zoom = zoom;
  camera.setViewport(400 * 3 * zoom, 300 * 3 * zoom);
  camera.snapTo(200, 150);
  return collectScene(
    [entity],
    [],
    { ...world, getHeightAt: () => height },
    camera,
    camera.getVisibleChunkRange(),
    alpha,
    terrain,
    [],
    false,
    undefined,
    frame,
  );
}

it("keeps a native train comparison disabled and uses physical heading in frameless collection", () => {
  const path = curvedTrackPath();
  if (!path) throw Error("Missing train path");
  const train = createCurveTrain(new RailAlignment(path), 900)[2];
  if (!train?.sprite) throw Error("Missing front carriage");
  train.position = { wx: 200, wy: 150 };
  train.prevPosition = { ...train.position };
  train.sprite.frameRow = 32;
  train.velocity = { vx: -10, vy: -10 };
  const original = structuredClone(train);
  const native = collect(train, 1, 1 / 3, new SceneFrame({ authoredTrains: false }))[0];
  if (native?.kind !== "sprite") throw Error("Missing native train");
  expect(native.mesh).toBeUndefined();
  for (const frame of [undefined, new SceneFrame()]) {
    const item = collect(train, 1, 1 / 3, frame)[0];
    if (item?.kind !== "sprite") throw Error("Missing train body");
    expect(item.mesh?.assetId).toBe("train-blue-front-authored-v3");
    expect(item.mesh?.orientation[2]).toBeCloseTo(Math.sin(Math.PI / 8));
    expect(item.mesh?.orientation[3]).toBeCloseTo(Math.cos(Math.PI / 8));
  }
  expect(train).toEqual(original);
});

it("collects an incoming bus while its center is above the screen and its front is visible", () => {
  const bus = createVehicle("bus-2", 200, -40, Direction.Down);
  // Actual committed artwork has an opaque front pixel five world pixels inside
  // the viewport at this position, well before the old center-based cutoff.
  const sheet: { width: number; data: Uint8Array } = PNG.sync.read(
    readFileSync("public/assets/vehicles/bus-2-v1.png"),
  );
  const frontRow = 189;
  expect(
    Array.from(
      { length: sheet.width },
      (_, x) => sheet.data[(frontRow * sheet.width + x) * 4 + 3],
    ).some((alpha) => alpha !== undefined && alpha > 0),
  ).toBe(true);
  expect(collect(bus)).toHaveLength(1);
});

it.each(VEHICLE_MODELS)("keeps %s sprite and mesh bounds at all four screen edges", (model) => {
  for (const direction of [Direction.Down, Direction.Up, Direction.Left, Direction.Right]) {
    const car = createVehicle(model, 200, 150, direction);
    for (const zoom of [0.2, 1 / 3, 1]) {
      for (const [wx, wy] of [
        [-95, 150],
        [495, 150],
        [200, -79],
        [200, 443],
      ] as const) {
        car.position = { wx, wy };
        expect(collect(car, 1, zoom)).toHaveLength(1);
      }
      // The fallback spans [-96,96] x [-144,80] around its ground origin.
      // A registered mesh sphere projects to +/- radius horizontally and
      // +/- sqrt(2)*radius vertically under the shared y-z camera. Test just
      // beyond their union plus the 16px effects margin, for every family.
      const radius = authoredVehicleForType(car.type)?.radius ?? 0;
      const halfWidth = Math.max(96, radius);
      const topReach = Math.max(144, radius * Math.SQRT2);
      const bottomReach = Math.max(80, radius * Math.SQRT2);
      for (const [wx, wy] of [
        [-halfWidth - 17, 150],
        [400 + halfWidth + 17, 150],
        [200, -bottomReach - 17],
        [200, 300 + topReach + 17],
      ] as const) {
        car.position = { wx, wy };
        expect(collect(car, 1, zoom)).toHaveLength(0);
      }
    }
  }
});

it("culls at the interpolated position while a vehicle crosses the top edge", () => {
  const bus = createVehicle("bus-2", 200, -200);
  bus.prevPosition = { wx: 200, wy: -40 };
  const before = structuredClone(bus);
  expect(collect(bus, 0)).toHaveLength(1);
  expect(collect(bus, 0.25)).toHaveLength(1);
  expect(collect(bus, 1)).toHaveLength(0);
  expect(bus).toEqual(before);
});

it("culls at the interpolated horizontal position", () => {
  const bus = createVehicle("bus-2", -200, 150);
  bus.prevPosition = { wx: -95, wy: 150 };
  expect(collect(bus, 0)).toHaveLength(1);
  expect(collect(bus, 1)).toHaveLength(0);
});

it("uses displayed height while a vehicle crosses the top edge", () => {
  const bus = createVehicle("bus-2", 200, -40);
  bus.prevWz = 0;
  bus.wz = 200;
  expect(collect(bus, 0)).toHaveLength(1);
  expect(collect(bus, 1)).toHaveLength(0);
});

it("handles negative sprite offsets near the bottom edge", () => {
  const player = createPlayer(200, 400);
  if (!player.sprite) throw new Error("Missing player sprite");
  player.sprite.drawOffsetY = -100;
  expect(collect(player)).toHaveLength(1);
  player.position.wy = 449;
  expect(collect(player)).toHaveLength(0);
});

it("uses terrain and interpolated jump height for legacy entities", () => {
  const player = createPlayer(200, -40);
  delete player.wz;
  player.prevJumpZ = 0;
  player.jumpZ = 200;
  if (!player.sprite) throw new Error("Missing player sprite");
  player.sprite.drawOffsetY = 80;
  expect(collect(player, 0)).toHaveLength(1);
  expect(collect(player, 1)).toHaveLength(0);
  player.position.wy = 350;
  player.jumpZ = 0;
  player.sprite.drawOffsetY = 0;
  expect(collect(player)).toHaveLength(0);
  expect(collect(player, 1, 1 / 3, undefined, 10)).toHaveLength(1);
});

it("retains conservative mesh bounds even when the fallback sprite is outside the view", () => {
  const car = createVehicle("compact-1", 200, -100);
  expect(collect(car, 1, 1 / 3, new SceneFrame())).toHaveLength(1);
  car.position.wy = -120;
  expect(collect(car, 1, 1 / 3, new SceneFrame())).toHaveLength(0);
});

it.each(["police-car", "garbage-truck-green", "garbage-truck-orange", "fire-truck-ladder-2"])(
  "preserves %s colored flashing sprite fallback and off reset",
  (model) => {
    const car = createVehicle(model, 200, 150);
    const frame = new SceneFrame();
    car.emergencyState = 1;
    frame.presentationTime = 0.05;
    const items = collect(car, 1, 1 / 3, frame);
    const item = items[0];
    expect(item?.kind).toBe("sprite");
    if (item?.kind !== "sprite") throw Error("Missing vehicle");
    expect(item.emergencyFlash).toBe(1);
    expect(item.emergencyColors?.[0]).toBe(
      model.startsWith("garbage-") ? "#ffd37a" : model === "police-car" ? "#ff7979" : "#79dfff",
    );
    car.emergencyState = 0;
    expect(collect(car, 1, 1 / 3, frame)[0]).not.toHaveProperty("emergencyFlash");
  },
);

/** Characterization fixture: one scene that reaches every collection stage (roof
 * riders, hidden drivers, boat passengers, carried items, roadkill, warning lights,
 * legacy jumps, trains, culling, planar/excavated props, prop parts, grass,
 * receivers, elevation and particles). Duplicate entity ids pin `find` semantics. */
function characterizationScene(garage: boolean) {
  const entities: Entity[] = [];
  const add = (e: Entity, id: number) => {
    e.id = id;
    entities.push(e);
    return e;
  };
  const car = add(createVehicle("compact-1", 200, 150, Direction.Right), 1);
  car.wz = 0;
  const rider = add(createPlayer(200, 150), 2);
  rider.wz = car.collider?.physicalHeight ?? 24;
  add(createPlayer(205, 150), 3).parentId = 1;
  add(createPlayer(60, 60), 4); // Same id as the boat, but not a boat.
  const boat = add(createVehicle(BOAT_MODEL, 90, 260, Direction.Left), 4);
  boat.prevPosition = { wx: 80, wy: 255 };
  add(createPlayer(92, 258), 5).parentId = 4;
  const fox = add(createFauna("fox", 320, 120), 6);
  fox.prevPosition = { wx: 316, wy: 118 };
  fox.wz = 6; // Carried items follow the parent's interpolated depth and height.
  fox.prevWz = 2;
  add(createForageItem("twig", 322, 118), 7).parentId = 6;
  const cat = add(createFauna("cat", 140, 60), 8);
  if (cat.sprite) cat.sprite.direction = Direction.Up;
  add(createForageItem("fruit", 140, 58), 9).parentId = 8;
  const remains = add(createRoadkill(createFauna("dog", 260, 210)), 10);
  remains.deathTimer = 2;
  for (const [i, model] of ["police-car", "fire-truck-ladder-2", "garbage-truck-green"].entries()) {
    add(createVehicle(model, 40 + i * 140, 330, Direction.Down), 11 + i).emergencyState = 1;
  }
  const jumper = add(createPlayer(300, 40), 14);
  delete jumper.wz;
  jumper.prevJumpZ = 2;
  jumper.jumpZ = 10;
  add(createPlayer(5000, 5000), 15);
  const tilted = add(createVehicle("bus-2", 360, 260, Direction.Up), 16);
  tilted.bodyRotation = [0, 0, 0.2, Math.sqrt(1 - 0.04)];
  const path = curvedTrackPath();
  const train = path ? createCurveTrain(new RailAlignment(path), 900)[2] : undefined;
  if (train) {
    train.position = { wx: 100, wy: 180 };
    train.prevPosition = { ...train.position };
    add(train, 17);
  }
  for (const [i, feet] of [0, 48, -48].entries())
    add(createPlayer(-20 + i * 60, 8), 20 + i).wz = feet;
  // The view culls x < 50.67, x > 349.33, y < 34 and y > 266 (16px margin included).
  // One sprite just beyond each remaining edge; mesh spheres that alone reach inside.
  for (const [i, [wx, wy]] of (
    [
      [358, 150],
      [200, 30],
      [200, 283],
    ] as const
  ).entries())
    add(createPlayer(wx, wy), 30 + i).wz = 0;
  add(createVehicle("compact-1", 200, -50), 33).wz = 0; // r*sqrt2 below the top edge
  const ambulance = add(createVehicle("ambulance", 200, 420, Direction.Down), 34);
  ambulance.wz = 0; // r*sqrt2 above the bottom edge, default light height
  ambulance.emergencyState = 1;
  const native = path ? createCurveTrain(new RailAlignment(path), 900)[0] : undefined;
  if (native) {
    // With native trains only the 96px fallback sphere (not 95) keeps this carriage.
    native.position = { wx: 200, wy: 401 };
    native.prevPosition = { ...native.position };
    add(native, 35);
  }
  // Roof rider on the yawed bus: an upright rotated support with no fitted offset,
  // and a vehicle depth surface in front of the rider's own Y+Z depth.
  add(createPlayer(345, 210), 36).wz = 40;
  // A duplicate boat id: passengers resolve to the first boat. The fruit-carrying
  // cat stands on this deck behind the hull's depth.
  const dock = add(createVehicle(BOAT_MODEL, 300, 200, Direction.Up), 4);
  dock.wz = 0;
  cat.position = { wx: 300, wy: 175 };
  cat.prevPosition = { ...cat.position };
  cat.wz = 16;
  cat.prevWz = 16;
  add(createPlayer(325, 125), 37).parentId = 6; // Not carryable: ordinary depth.
  // Non-raster planar shadow: a car parked on the raised deck.
  add(createVehicle("compact-1", 120, 50, Direction.Right), 38).wz = 48;
  const recipe = garage ? undergroundGarageRecipe() : worldGeometryRecipe();
  const parked = createProp("prop-city-street-v1-car-east", 250, 60);
  parked.id = 100;
  parked.sortOffsetY = 6;
  const parted = createProp("prop-city-commercial-v1-car-west", 120, 120);
  parted.id = 101;
  parted.sprite.parts = [
    { frameCol: 1, frameRow: 2, spriteWidth: 16, spriteHeight: 16, dx: -8, dy: 0 },
    { frameCol: 3, frameRow: 4, spriteWidth: 16, spriteHeight: 16, dx: 8, dy: -4 },
  ];
  const hidden = createProp("prop-city-street-v1-car-east", 210, 90);
  hidden.id = 102;
  const props = [...recipe.props.map((p, i) => ({ ...p, id: 200 + i })), parked, parted, hidden];
  return { entities, props, drawProps: new Set(props.map((p) => p.id).filter((id) => id !== 102)) };
}

const grassChunk = new Chunk();
grassChunk.blendBase.fill(TerrainId.Grass);
grassChunk.autotileComputed = true;

function sceneDigest(variant: {
  frame: boolean;
  raster: boolean;
  grass: boolean;
  garage: boolean;
  time: number;
  /** Partial grass opacity below zoom 1/2; the world view stays the same. */
  zoom?: number;
  nativeTrains?: boolean;
}) {
  const { entities, props, drawProps } = characterizationScene(variant.garage);
  const camera = new Camera();
  const zoom = variant.zoom ?? 1 / 2;
  camera.zoom = zoom;
  camera.setViewport(800 * zoom, 600 * zoom);
  camera.snapTo(200, 150);
  camera.worldRaster = variant.raster;
  const frame = variant.frame
    ? new SceneFrame({ authoredTrains: !variant.nativeTrains })
    : undefined;
  if (frame) frame.presentationTime = variant.time;
  const elevation: ElevationItem = {
    kind: "elevation",
    sortKey: 150,
    phase: "cliff",
    wx: 192,
    wy: 144,
    terrainResource: 7 as TerrainResourceId,
    srcX: 0,
    srcY: 16,
    height: 1,
  };
  const particle: ParticleItem = {
    kind: "particle",
    sortKey: 150,
    wx: 200,
    wy: 150,
    z: 4,
    size: 2,
    color: "#fff",
    alpha: 0.5,
  };
  const items = collectScene(
    entities,
    props,
    {
      getHeightAt: (tx: number, ty: number) => ((tx + ty) & 1) * (variant.garage ? 0 : 1),
      getChunkIfLoaded: () => (variant.grass ? grassChunk : undefined),
      getRoadAt: () => 0,
    },
    camera,
    { minCx: -1, maxCx: 1, minCy: -1, maxCy: 1 },
    0.5,
    { collectElevationItems: () => [elevation] },
    variant.raster ? { collectItems: () => [particle] } : [particle],
    variant.grass,
    drawProps,
    frame,
  );
  // Ten significant digits: trig results (grass sway) differ in the last bit
  // between arm64 and x64 V8 builds; any real regression moves far more digits.
  const json = JSON.stringify({ items, stats: frame?.receiverStats }, (_key, value) =>
    typeof value !== "number"
      ? value
      : Object.is(value, -0) || !Number.isFinite(value)
        ? `number:${Object.is(value, -0) ? "-0" : value}`
        : Number(value.toPrecision(10)),
  );
  const kinds: Record<string, number> = {};
  for (const item of items) kinds[item.kind] = (kinds[item.kind] ?? 0) + 1;
  return { kinds, digest: createHash("sha256").update(json).digest("hex").slice(0, 16) };
}

// Digests were recorded against the single-function collector before it was
// split into stages; any change to item fields, values, key order or draw order fails.
// 229 re-recorded them for the added `facing` field only: with that key omitted, the
// shared collectWorldSprites stage reproduced every earlier digest exactly.
// 2026-11-09 re-recorded them for key order only: actor items now assign optional
// fields after a fixed literal; key-sorted digests of all five scenes were unchanged.
// 236 made GPU depth shadows the default: raster scenes carry `gpuShadow` on ovals
// and mesh vehicles instead of projected decals. Their earlier digests still pin the
// projected path (`shadowMode.gpu = false`), unchanged.
it.each([
  [
    { frame: false, raster: false, grass: false, garage: false, time: 0 },
    "8cb06b493c72350e",
    undefined,
  ],
  [
    { frame: true, raster: false, grass: true, garage: false, time: 0.05, zoom: 3 / 8 },
    "6c28c08dccb1c409",
    undefined,
  ],
  [
    { frame: true, raster: true, grass: true, garage: false, time: 0.55 },
    "1a2e80ea19044af2",
    "9232b9304475daed",
  ],
  [
    { frame: true, raster: true, grass: false, garage: true, time: 0.25, nativeTrains: true },
    "76b558ad7a421bb9",
    "7e677f939a0e7d3d",
  ],
  [
    { frame: false, raster: true, grass: false, garage: true, time: 0 },
    "0454afa6d0e33319",
    "a95ffb71a76f339f",
  ],
] as const)(
  "collects a byte-identical characterization scene %o",
  (variant, digest, projected?: string) => {
    const result = sceneDigest(variant);
    expect(result.digest).toBe(digest);
    if (projected) {
      shadowMode.gpu = false;
      try {
        const decals = sceneDigest(variant);
        expect(decals.digest).toBe(projected);
        expect(decals.kinds.decal).toBeGreaterThan(0);
      } finally {
        shadowMode.gpu = true;
      }
    }
    expect(result.kinds.sprite).toBeGreaterThan(20);
    if (variant.grass) expect(result.kinds.grass).toBeGreaterThan(0);
    if (variant.raster) expect(result.kinds.decal).toBeUndefined();
  },
);

it("swaps a tree house's outside and inside parts by observer room and keeps floor depth", () => {
  const house = treeHouseProp(200, 200);
  house.id = 7;
  const camera = new Camera();
  camera.setViewport(600, 400);
  camera.snapTo(200, 150);
  const parts = (observer: Entity) =>
    collectScene(
      [observer],
      [house],
      world,
      camera,
      camera.getVisibleChunkRange(),
      1,
      terrain,
      [],
      false,
      undefined,
      undefined,
      { observer },
    ).filter((item) => item.kind === "sprite" && item.sheetKey === "me-complete");
  const outside = parts(createPlayer(160, 260));
  const inside = { ...createPlayer(200, 160), wz: DECK_Z };
  const room = parts(inside);
  // Canopy, deck band, ground band; inside: bare deck, three furnishings, ground band.
  expect(outside).toHaveLength(3);
  expect(room).toHaveLength(5);
  for (const items of [outside, room]) {
    const floor = items.find((item) => item.kind === "sprite" && item.depthFloorZ !== undefined);
    expect(floor?.kind === "sprite" && floor.depthFloorZ).toBe(DECK_Z);
  }
  // A player standing on the porch, outside the cabin volume, keeps the roof.
  expect(parts({ ...createPlayer(170, 185), wz: DECK_Z })).toHaveLength(3);
});

it("marks only four-direction facing rows for views that reselect them (229)", () => {
  const player = { ...createPlayer(100, 100), id: 1 };
  if (player.sprite)
    player.sprite = { ...player.sprite, direction: Direction.Left, frameRow: Direction.Left };
  const clipPlayer = { ...createPlayer(120, 100), id: 2 };
  if (clipPlayer.sprite) clipPlayer.sprite = { ...clipPlayer.sprite, clip: 1 };
  // Single- or two-row sheets match `frameRow === direction` (both 0) by coincidence.
  const cow = { ...createCow(140, 100), id: 3 };
  const turningCow = { ...createCow(160, 100), id: 4 };
  if (turningCow.wanderAI) turningCow.wanderAI = { ...turningCow.wanderAI, directional: true };
  const items: SceneItem[] = [];
  collectWorldSprites({
    entities: [player, clipPlayer, cow, turningCow],
    props: [],
    world: { getHeightAt: () => 0 },
    alpha: 1,
    cull: { left: 0, right: 400, top: 0, bottom: 400 },
    items,
  });
  const facing = (items as SpriteItem[]).map((item) => item.facing);
  expect(facing).toEqual([Direction.Left, undefined, undefined, cow.sprite?.direction]);
});
