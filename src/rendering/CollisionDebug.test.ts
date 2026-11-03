import { expect, it } from "vitest";
import type { Prop } from "../entities/Prop.js";
import { applyVehicleFacing, createVehicle, vehicleBodySize } from "../traffic/Vehicle.js";
import { Camera } from "./Camera.js";
import {
  COLLISION_LAYERS,
  collisionDebugPose,
  defaultCollisionDebugOptions,
  drawCollisionDebug,
  entityCollisionDebugShapes,
  propCollisionDebugShapes,
} from "./CollisionDebug.js";
import { OverlayFrame } from "./OverlayFrame.js";

it("depicts the shared diagonal vehicle body without a second walking hull", () => {
  const car = createVehicle("compact-1", 0, 0);
  car.vehicleHeading = -Math.PI / 3;
  applyVehicleFacing(car);
  const shapes = entityCollisionDebugShapes(car);
  const driving = shapes.find((s) => s.layer === "driving")?.vertices ?? [];
  const walking = shapes.find((s) => s.layer === "walking")?.vertices ?? [];
  if (!car.collider) throw Error("Missing car body");
  expect(driving).toHaveLength(8);
  const first = driving[0],
    second = driving[1];
  if (!first || !second) throw Error("Missing driving vertices");
  expect(Math.hypot(first.x - second.x, first.y - second.y)).toBeCloseTo(
    vehicleBodySize(car.type, 0).width,
  );
  expect(Math.atan2(second.y - first.y, second.x - first.x)).toBeCloseTo(-Math.PI / 3);
  expect(walking).toHaveLength(0);
  expect(shapes.find((s) => s.layer === "support")?.vertices).toEqual(driving.slice(4));
});

it("uses actual sloped slab heights and does not turn passable support into a blocker", () => {
  const p: Prop = {
    id: 1,
    type: "bridge",
    position: { wx: 0, wy: 0 },
    sprite: {} as Prop["sprite"],
    isProp: true,
    walls: null,
    collider: {
      width: 100,
      height: 40,
      offsetX: 0,
      offsetY: 20,
      passable: true,
      surface: {
        id: "ramp",
        spaceId: "outside",
        z: 20,
        riseX: 40,
        riseY: 0,
        thickness: 4,
        connectsTo: [],
      },
    },
  };
  const shapes = propCollisionDebugShapes(p);
  expect(shapes.some((s) => s.layer === "walking")).toBe(false);
  expect(shapes.find((s) => s.layer === "support")?.vertices.map((v) => v.z)).toEqual([
    20, 60, 60, 20,
  ]);
});

it("does not depict inactive bodies as collision, and isolates layer visibility", () => {
  const car = createVehicle("compact-1", 0, 0);
  if (!car.collider) throw Error("Missing car body");
  const inactive = { ...car, collider: { ...car.collider, solid: false } };
  expect(entityCollisionDebugShapes(inactive)).toEqual([]);
  expect(entityCollisionDebugShapes({ ...car, collider: null })).toEqual([]);
  // Binary replicas reconstruct the type's static collider even inside a car.
  expect(entityCollisionDebugShapes({ ...car, type: "player", parentId: 42 })).toEqual([]);
  const camera = new Camera();
  camera.setViewport(800, 600);
  const frame = new OverlayFrame(),
    options = defaultCollisionDebugOptions();
  for (const layer of Object.keys(options.layers) as (keyof typeof COLLISION_LAYERS)[])
    options.layers[layer] = false;
  drawCollisionDebug(frame, camera, [car], [], inactive, options);
  expect(frame.items).toHaveLength(0);
  options.layers.driving = true;
  drawCollisionDebug(frame, camera, [car], [], inactive, options);
  expect(frame.items).toHaveLength(12);
  expect(frame.items.every((d) => d.stroke === COLLISION_LAYERS.driving.color)).toBe(true);
  frame.begin();
  options.nearbyOnly = true;
  drawCollisionDebug(
    frame,
    camera,
    [{ ...car, position: { wx: 500, wy: 0 } }],
    [],
    inactive,
    options,
  );
  expect(frame.items).toHaveLength(0);
});

it("interpolates debug placement without mutating simulation state", () => {
  const car = createVehicle("dump-truck", 60, 40);
  car.prevPosition = { wx: 20, wy: 0 };
  car.prevWz = 10;
  car.wz = 30;
  const original = structuredClone(car);
  const shown = collisionDebugPose(car, 0.25);
  expect(shown.position).toEqual({ wx: 30, wy: 10 });
  expect(shown.wz).toBe(15);
  expect(car).toEqual(original);
});
