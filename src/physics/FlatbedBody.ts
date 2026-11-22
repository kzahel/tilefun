import RAPIER from "@dimforge/rapier3d-compat";
import { FLATBED } from "../traffic/Flatbed.js";
import { PHYSICS_PIXELS_PER_METRE as SCALE } from "./PhysicsDefaults.js";

/** Match the deck bearing plane while retaining the truck's full silhouette
 * at the cab and chassis. Shape coordinates are relative to the collider. */
export function flatbedCollider(hx: number, halfY: number, hz: number, clearance: number) {
  const front = FLATBED.front / SCALE;
  const y = (low: number, high: number) => (low + high) / 2 - halfY - clearance / 2;
  const floor = FLATBED.floor / SCALE;
  return new RAPIER.ColliderDesc(
    new RAPIER.Compound(
      [
        new RAPIER.Cuboid((hx + front) / 2, (floor - clearance) / 2, hz),
        new RAPIER.Cuboid((hx - front) / 2, halfY - clearance / 2, hz),
      ],
      [
        { x: (front - hx) / 2, y: y(clearance, floor), z: 0 },
        { x: (front + hx) / 2, y: 0, z: 0 },
      ],
      [
        { x: 0, y: 0, z: 0, w: 1 },
        { x: 0, y: 0, z: 0, w: 1 },
      ],
    ),
  );
}
