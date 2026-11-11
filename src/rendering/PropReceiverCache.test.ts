import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { rotateBodyVector } from "../physics/BodyRotation.js";
import { surfaceProp } from "../scenarios/WorldGeometryRecipe.js";
import { required } from "../shared/required.js";
import { poseOrientation } from "./MeshPresentation.js";
import { PropReceiverCache } from "./PropReceiverCache.js";
import { rotatedBounds } from "./RotatedBounds.js";
import { type Point3, SurfaceReceivers } from "./SurfaceReceivers.js";

const world = { getHeightAt: () => 0 };
const slab = () =>
  surfaceProp(
    { left: 0, right: 64, top: -32, bottom: 32 },
    { id: "ramp", spaceId: "upper", z: 0, riseX: 32, riseY: 0, thickness: 4, connectsTo: [] },
  );

it("reuses unchanged faces across queries/views but replaces edited and reloaded prop identities", () => {
  const prop = slab(),
    propCache = new PropReceiverCache();
  const before = new SurfaceReceivers(world, [prop], [], 1, { propCache });
  const face = before.hit(32, 0, 17)?.face;
  const next = new SurfaceReceivers(world, [prop], [], 1, { propCache });
  expect(next.hit(32, 0, 17)?.face).toBe(face);
  expect(before.hit(32, 0, 17)?.face).toBe(face); // Query stamps cannot collide across instances.
  prop.position.wx += 100;
  required(required(prop.collider).surface).z = 10;
  const edited = new SurfaceReceivers(world, [prop], [], 1, { propCache });
  expect(edited.hit(132, 0, 27)?.point[2]).toBe(26);
  expect(before.hit(32, 0, 17)?.point[2]).toBe(16); // Previous borrow stays a snapshot.
  const replacement = structuredClone(prop);
  const reloaded = new SurfaceReceivers(world, [replacement], [], 1, { propCache });
  expect(reloaded.hit(132, 0, 27)?.face).not.toBe(edited.hit(132, 0, 27)?.face);
  propCache.clear();
  expect(new SurfaceReceivers(world, [prop], [], 1, { propCache }).hit(132, 0, 27)?.face).not.toBe(
    edited.hit(132, 0, 27)?.face,
  );
});

it("rechecks observer visibility and excavation even when cached geometry is unchanged", () => {
  const prop = slab(),
    propCache = new PropReceiverCache(),
    observer = createPlayer(32, 0);
  required(required(prop.collider).surface).z = 32;
  const upper = new SurfaceReceivers(world, [prop], [], 1, {
    propCache,
    observer,
    visibility: "upper",
  });
  expect(upper.hit(32, 0, 49)?.point[2]).toBe(48);
  const lower = new SurfaceReceivers(world, [prop], [], 1, {
    propCache,
    observer,
    visibility: "lower",
  });
  expect(lower.hit(32, 0, 49)?.point[2]).toBe(0);
  required(required(prop.collider).surface).excavation = {};
  const excavated = new SurfaceReceivers(world, [prop], [], 1, {
    propCache,
    observer,
    visibility: "lower",
  });
  expect(excavated.hit(32, 0, 49)?.point[2]).toBe(48);
  expect(excavated.hit(32, 0, 1)).toBeUndefined();
});

it("scalar corner bounds are bit-identical to the old eight-vector construction", () => {
  for (let i = 0; i < 100; i++) {
    const q = poseOrientation(i * 0.37, i * 0.19, i * -0.23);
    const position: Point3 = [i * 1e6, -i * 1e6, i / 3];
    const min = [-i / 7, -30, -4],
      max = [25, i / 4, 40];
    const corners: Point3[] = [];
    for (const x of [min[0], max[0]])
      for (const y of [min[1], max[1]])
        for (const z of [min[2], max[2]]) {
          const v = rotateBodyVector(q, x ?? 0, y ?? 0, z ?? 0);
          corners.push([v.x + position[0], v.y + position[1], v.z + position[2]]);
        }
    expect(rotatedBounds(q, position, min, max)).toEqual({
      bounds: {
        left: Math.min(...corners.map((p) => p[0])),
        right: Math.max(...corners.map((p) => p[0])),
        top: Math.min(...corners.map((p) => p[1])),
        bottom: Math.max(...corners.map((p) => p[1])),
      },
      minZ: Math.min(...corners.map((p) => p[2])),
      maxZ: Math.max(...corners.map((p) => p[2])),
    });
  }
});
