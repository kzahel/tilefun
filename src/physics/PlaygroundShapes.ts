import RAPIER from "@dimforge/rapier3d-compat";
import { PLAYGROUND_GEOMETRY, type PlaygroundBody } from "../entities/PhysicsPlayground.js";
import { PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";

export function playgroundShape(type: PlaygroundBody) {
  const { size, pieces } = PLAYGROUND_GEOMETRY[type];
  const height = (size[2] ?? 0) / 2;
  const hulls = pieces.map(({ x, y, bottom, top }) => {
    const points = x.flatMap((wx, i) =>
      y.flatMap((wy) =>
        [bottom[i] ?? 0, top[i] ?? 0].flatMap((z) => [
          wx / SCALE,
          (z - height) / SCALE,
          wy / SCALE,
        ]),
      ),
    );
    return new RAPIER.ConvexPolyhedron(new Float32Array(points));
  });
  return new RAPIER.Compound(
    hulls,
    hulls.map(() => ({ x: 0, y: 0, z: 0 })),
    hulls.map(() => ({ x: 0, y: 0, z: 0, w: 1 })),
  );
}
