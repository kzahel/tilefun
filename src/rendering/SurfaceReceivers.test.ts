import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { rotateBodyVector } from "../physics/BodyRotation.js";
import { surfaceProp } from "../scenarios/WorldGeometryRecipe.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { poseOrientation } from "./MeshPresentation.js";
import { shadowFootprint } from "./ProjectedDecals.js";
import {
  planeZ,
  polygonArea,
  rectangle,
  type SurfaceMesh,
  SurfaceReceivers,
} from "./SurfaceReceivers.js";

const world = { getHeightAt: () => 0 };
function patch(id: string, left: number, right: number, z: number, riseX = 0) {
  return surfaceProp(
    { left, right, top: -32, bottom: 32 },
    { id, spaceId: "upper", z, riseX, riseY: 0, thickness: 4, connectsTo: [] },
  );
}
const footprint = (left: number, right: number) => rectangle({ left, right, top: -4, bottom: 4 });
const area = (pieces: ReturnType<SurfaceReceivers["project"]>) =>
  pieces.reduce((a, p) => a + Math.abs(polygonArea(p.vertices)), 0);

it("conforms the whole footprint to a ramp, preserving UVs and a normalized contact normal", () => {
  const r = new SurfaceReceivers(world, [patch("ramp", 0, 64, 0, 32)], []);
  const pieces = r.project(footprint(24, 40), 16);
  expect(area(pieces)).toBeCloseTo(128);
  expect(pieces.every((p) => p.face.id === "ramp")).toBe(true);
  for (const p of pieces)
    for (const v of p.vertices) {
      expect(planeZ(p.face.plane, v.x, v.y)).toBeCloseTo(v.x / 2);
      expect(v.u).toBeCloseTo((v.x - 24) / 16);
    }
  const hit = r.hit(32, 0, 17);
  expect(hit?.point[2]).toBe(16);
  expect(hit?.normal).toEqual([-1 / Math.sqrt(5), -0, 2 / Math.sqrt(5)]);
});
it("splits a crest and a bridge edge without gaps or overlapping shadow pieces", () => {
  const r = new SurfaceReceivers(
    world,
    [patch("ramp", 0, 64, 0, 32), patch("deck", 64, 128, 32)],
    [],
  );
  const crest = r.project(footprint(56, 72), 32);
  expect(new Set(crest.map((p) => p.face.id))).toEqual(new Set(["ramp", "deck"]));
  expect(area(crest)).toBeCloseTo(128);
  const edge = r.project(footprint(120, 136), 32);
  expect(edge.some((p) => p.face.id === "deck")).toBe(true);
  expect(edge.some((p) => p.face.id.startsWith("terrain:"))).toBe(true);
  expect(area(edge)).toBeCloseTo(128);
});
it("keeps under-bridge shadows below the ceiling and selects the highest valid stacked floor", () => {
  const props = [patch("lower", 0, 64, 16), patch("upper", 0, 64, 32), patch("ceiling", 0, 64, 48)];
  const r = new SurfaceReceivers(world, props, []);
  expect(r.project(footprint(20, 40), 0).every((p) => p.face.id.startsWith("terrain:"))).toBe(true);
  expect(r.project(footprint(20, 40), 32).every((p) => p.face.id === "upper")).toBe(true);
  expect(area(r.project(footprint(20, 40), 32))).toBeCloseTo(160);
});
it("partitions intersecting sloped receivers at their height crossing", () => {
  const r = new SurfaceReceivers(
    world,
    [patch("rising", 0, 64, 0, 32), patch("falling", 0, 64, 32, -32)],
    [],
  );
  const p = r.project(footprint(16, 48), 32);
  expect(area(p)).toBeCloseTo(256);
  for (const f of p)
    for (const v of f.vertices)
      expect(planeZ(f.face.plane, v.x, v.y) + 1e-6).toBeGreaterThanOrEqual(
        Math.max(v.x / 2, 32 - v.x / 2),
      );
});
it("removes the unexcavated terrain receiver from a garage and clips at the opening", () => {
  const floor = patch("garage", 0, 64, -32);
  if (!floor.collider?.surface) throw Error("Missing floor");
  floor.collider.surface.excavation = {};
  const r = new SurfaceReceivers(world, [floor], []);
  expect(r.hit(32, 0, -31)?.point[2]).toBe(-32);
  const p = r.project(footprint(56, 72), -32);
  expect(area(p)).toBeCloseTo(64);
  expect(p.every((f) => f.face.id === "garage")).toBe(true);
});
const roofMesh: SurfaceMesh = {
  min: [-20, -10, 0],
  max: [20, 10, 20],
  triangles: [
    [
      [-20, -10, 20],
      [20, -10, 20],
      [20, 10, 20],
    ],
    [
      [-20, -10, 20],
      [20, 10, 20],
      [-20, 10, 20],
    ],
  ],
};
it("uses actual tilted mesh roofs, excludes the caster and moves attachments in body-local coordinates", () => {
  const car = createVehicle("compact-1", 0, 0);
  car.id = 7;
  car.wz = 0;
  car.bodyRotation = poseOrientation(0.7, 0.25, 0.2);
  const before = structuredClone(car),
    r = new SurfaceReceivers(world, [], [car], 1, { mesh: () => roofMesh });
  const p = rotateBodyVector(car.bodyRotation, 0, 0, 20),
    hit = r.hit(p.x, p.y, p.z + 0.01);
  expect(hit?.face.owner?.id).toBe(7);
  expect(hit?.point[2]).toBeCloseTo(p.z);
  expect(r.hit(p.x, p.y, p.z + 0.01, 7)?.point[2]).toBe(0);
  if (!hit) throw Error("Missing roof hit");
  const attachment = r.attach(hit);
  expect(attachment.point[2]).toBeCloseTo(20);
  expect(car).toEqual(before);
  car.position.wx = 50;
  car.wz = 10;
  car.bodyRotation = poseOrientation(1, -0.3, 0.1);
  const next = new SurfaceReceivers(world, [], [car], 1, { mesh: () => roofMesh });
  const local = rotateBodyVector(car.bodyRotation, 0, 0, 20),
    located = next.locate(attachment);
  expect(located?.[0]).toBeCloseTo(50 + local.x);
  expect(located?.[2]).toBeCloseTo(10 + local.z);
  expect(new SurfaceReceivers(world, [], []).locate(attachment)).toBeUndefined();
});
it("keeps custom car footprints oriented and changes their projected dimensions through a rollover", () => {
  const car = createVehicle("compact-1", 0, 0);
  car.bodyRotation = poseOrientation(0);
  const upright = shadowFootprint(car, 0, 0, roofMesh);
  car.bodyRotation = poseOrientation(0, 0, Math.PI / 2);
  const rolled = shadowFootprint(car, 0, 0, roofMesh);
  expect(Math.abs(polygonArea(upright))).toBeCloseTo(800);
  expect(Math.abs(polygonArea(rolled))).toBeCloseTo(800);
  expect(rolled.reduce((sum, p) => sum + p.y, 0) / 4).toBeCloseTo(-10);
  const p = createPlayer(0, 0);
  const r = new SurfaceReceivers(world, [patch("very-long", -100000, 100000, 32)], [p]);
  expect(r.hit(0, 0, 1, p.id)?.point[2]).toBe(0);
});

it("queries only nearby mesh triangles and clips accurately far from the world origin", () => {
  const triangles: SurfaceMesh["triangles"][number][] = [];
  for (let i = 0; i < 1024; i++) {
    const x = i * 16 - 8192;
    triangles.push(
      [
        [x, -8, 20],
        [x + 16, -8, 20],
        [x + 16, 8, 20],
      ],
      [
        [x, -8, 20],
        [x + 16, 8, 20],
        [x, 8, 20],
      ],
    );
  }
  const mesh: SurfaceMesh = { min: [-8192, -8, 0], max: [8192, 8, 20], triangles };
  const car = createVehicle("compact-1", 0, 0);
  car.id = 2;
  const r = new SurfaceReceivers(world, [], [car], 1, { mesh: () => mesh });
  expect(r.hit(1, 0, 21)?.point[2]).toBeCloseTo(20);
  expect(r.diagnostics.meshTriangles).toBeLessThan(12);
  const offset = 1e8;
  const p = patch("far", offset, offset + 64, 0, 32);
  p.position.wy += offset;
  const far = new SurfaceReceivers(world, [p], []);
  const pieces = far.project(
    rectangle({ left: offset + 24, right: offset + 40, top: offset - 4, bottom: offset + 4 }),
    16,
  );
  expect(area(pieces)).toBeCloseTo(128);
  expect(pieces.every((p) => p.face.id === "far")).toBe(true);
});

it("keeps a low ledge receiver when the actor's feet overlap its edge", () => {
  const r = new SurfaceReceivers(world, [patch("ledge", 0, 16, 2)], []);
  const pieces = r.project(footprint(-6, 4), 2);
  expect(area(pieces)).toBeCloseTo(80);
  expect(pieces.some((p) => p.face.id === "ledge")).toBe(true);
  expect(pieces.some((p) => p.face.id.startsWith("terrain:"))).toBe(true);
});
