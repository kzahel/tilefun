import { expect, it } from "vitest";
import { carProxyPatches, projectSource } from "../projection/CarProxy.js";
import { CAR_SPRITE_ORIGIN, carVertexToLocal } from "./CarMeshDefinition.js";

it("registers the canonical source view to the existing sprite ground anchor", () => {
  for (const patch of carProxyPatches())
    for (const point of patch.vertices) {
      const [x, y, z] = carVertexToLocal(point),
        [u, v] = projectSource(point);
      // Source-facing yaw is pi after the +X-forward asset normalization.
      expect(-x).toBeCloseTo(u - CAR_SPRITE_ORIGIN[0]);
      expect(-y - z).toBeCloseTo(v - CAR_SPRITE_ORIGIN[1]);
      expect(z).toBe(point[2]);
    }
});
