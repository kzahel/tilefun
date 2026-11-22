import type { BodyRotation } from "../physics/BodyRotation.js";
import geometry from "./PhysicsPlaygroundGeometry.json" with { type: "json" };

export const MARBLE_TRACK = "construction-marble-track";
export const MARBLE_CHUTE = "construction-marble-chute";
export const SEESAW = "construction-seesaw";
export const SEESAW_PIVOT = "construction-seesaw-pivot";

export const PLAYGROUND_GEOMETRY = geometry;
export type PlaygroundBody = keyof typeof geometry;

export function isPlaygroundBody(type: string): type is PlaygroundBody {
  return Object.hasOwn(geometry, type);
}

export const SEESAW_HEIGHT = 12;
const tilt = -Math.asin(SEESAW_HEIGHT / ((geometry[SEESAW].size[0] ?? 172) / 2));
export const SEESAW_REST: BodyRotation = [0, Math.sin(tilt / 2), 0, Math.cos(tilt / 2)];
