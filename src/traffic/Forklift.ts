import type { Entity } from "../entities/Entity.js";
import type { ExcavatorAction } from "../shared/ExcavatorInput.js";
import { EXCAVATOR_REST, excavatorAngles, excavatorHoldTarget } from "./Excavator.js";

export const FORKLIFT_TYPE = "vehicle-v1:forklift";
export const isForklift = (entity: Pick<Entity, "type">) => entity.type === FORKLIFT_TYPE;
export const FORKLIFT_REST = excavatorHoldTarget(EXCAVATOR_REST, "stick-in");
export const FORKLIFT_SCALE = 400 / 23;

export function isForkliftControl(action: ExcavatorAction) {
  return (
    action === "stick-in" ||
    action === "stick-out" ||
    action === "boom-down" ||
    action === "boom-up"
  );
}

// Match the pivots and adjusted tines in the working Blender revision.
export const FORKLIFT = {
  mastX: 1.01 * FORKLIFT_SCALE,
  mastZ: 0.15 * FORKLIFT_SCALE,
  deck: { back: 1.1 * FORKLIFT_SCALE, tip: 2.3 * FORKLIFT_SCALE, bottom: 0.35, top: 1.17 },
  tines: { y: 3.15, halfWidth: (0.12 * FORKLIFT_SCALE * 0.76) / 2 },
};

export function forkliftRig(pose = FORKLIFT_REST) {
  const { boom, stick } = excavatorAngles(pose);
  const lift = Math.max(0, ((stick * 180) / Math.PI + 136) * 0.74);
  return {
    lift,
    tilt: (boom - (58 * Math.PI) / 180) / 3,
    extension: Math.max(0, lift - 20),
  };
}
