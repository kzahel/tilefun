import { aabbOverlapsPropWalls, getEntityAABB } from "../../entities/collision.js";
import { createProp } from "../../entities/PropFactories.js";
import { createFauna, petCoat } from "../../wildlife/Fauna.js";
import type { ActorPlacement } from "../Generator.js";
import { edgeHash } from "../RoadGenerator.js";
import type { DenseDistrictPlan } from "./DenseDistrictPlanner.js";
import type { FeaturePlacement } from "./DistrictStrategy.js";
import { residentFauna } from "./ResidentFauna.js";

/** Existing green furniture, shared by town realization and safe initial pet placement. */
export function settlementGreenProps(plan: DenseDistrictPlan): FeaturePlacement[] {
  return plan.blocks
    .filter((b) => b.kind === "park")
    .flatMap((block, i) => {
      const p = block.bounds,
        px = (p.minX + p.maxX) / 2,
        py = (p.minY + p.maxY) / 2;
      const prefix = i === 0 ? `${plan.id}:green` : `${block.id}:green`;
      return [
        {
          featureId: `${prefix}:tree`,
          propType: "prop-oak-tree",
          wx: (p.minX + 5) * 16,
          wy: (p.minY + 8) * 16,
        },
        {
          featureId: `${prefix}:bench`,
          propType: "prop-bench",
          wx: (px + 5) * 16,
          wy: (p.maxY - 5) * 16,
        },
        {
          featureId: `${prefix}:fountain`,
          propType: "prop-garden-fountain",
          wx: (px - 5) * 16,
          wy: (py + 5) * 16,
        },
      ];
    });
}

/** Sparse saved individuals around settlement greens, never random traffic-lane spawns. */
export function settlementPets(plan: DenseDistrictPlan, seed: number): ActorPlacement[] {
  const result: ActorPlacement[] = [];
  const props = settlementGreenProps(plan).map((p) => createProp(p.propType, p.wx, p.wy));
  for (const block of plan.blocks.filter((b) => b.kind === "park")) {
    const b = block.bounds;
    const safe = { minX: b.minX + 3, minY: b.minY + 3, maxX: b.maxX - 3, maxY: b.maxY - 3 };
    const candidates: { x: number; y: number }[] = [];
    for (let y = safe.minY + 2; y <= safe.maxY - 2; y += 5)
      for (let x = safe.minX + 2; x <= safe.maxX - 2; x += 5) candidates.push({ x, y });
    candidates.sort((a, b) => edgeHash(a.x, a.y, seed + 31301) - edgeHash(b.x, b.y, seed + 31301));
    for (const species of ["cat", "dog"] as const) {
      const coat = petCoat(
        species,
        edgeHash(b.minX, b.minY, seed + (species === "cat" ? 31401 : 31403)),
      );
      const point = candidates.find((p) => {
        const e = createFauna(coat, p.x * 16, p.y * 16);
        if (!e.collider) throw Error("Missing pet collider");
        const aabb = getEntityAABB(e.position, e.collider);
        return (
          !props.some((prop) => aabbOverlapsPropWalls(aabb, prop.position, prop, 0)) &&
          !result.some((a) => Math.hypot(a.wx - e.position.wx, a.wy - e.position.wy) < 48)
        );
      });
      if (!point) throw Error(`No clear ${species} home in ${block.id}`);
      result.push(
        residentFauna(coat, `settlement-pet:${block.id}:${species}`, point.x, point.y, safe, seed),
      );
    }
  }
  return result;
}
