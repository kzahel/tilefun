import { CONSTRUCTION_CARGO, CONSTRUCTION_CRATE } from "../../entities/ConstructionCargo.js";
import {
  MARBLE_CHUTE,
  MARBLE_TRACK,
  SEESAW,
  SEESAW_PIVOT,
} from "../../entities/PhysicsPlayground.js";

export const MARBLE_CRANE_START = { wx: -156, wy: 6 };
export const MARBLE_CHUTE_X = 113;
export const SEESAW_CAR_START = { wx: -136, wy: 0 };

/** Offsets in world pixels. The same layout is used in the yard and Workshop. */
export function marbleRunActors() {
  const height = CONSTRUCTION_CARGO[CONSTRUCTION_CRATE].collider.physicalHeight;
  return [
    { name: "track", type: MARBLE_TRACK, wx: 0, wy: 0 },
    { name: "chute", type: MARBLE_CHUTE, wx: MARBLE_CHUTE_X, wy: 0 },
    { name: "crate:front", type: CONSTRUCTION_CRATE, wx: 151, wy: 3.5 },
    { name: "crate:top", type: CONSTRUCTION_CRATE, wx: 147, wy: 0, wz: height + 0.05 },
    { name: "crate:cap", type: CONSTRUCTION_CRATE, wx: 144, wy: -2.5, wz: 2 * height + 0.1 },
    { name: "crate:left", type: CONSTRUCTION_CRATE, wx: 165, wy: -14 },
    { name: "crate:right", type: CONSTRUCTION_CRATE, wx: 165, wy: 14 },
  ] as const;
}

export function seesawActors() {
  return [
    { name: "pivot", type: SEESAW_PIVOT, wx: 0, wy: 0 },
    { name: "deck", type: SEESAW, wx: 0, wy: 0 },
  ] as const;
}
