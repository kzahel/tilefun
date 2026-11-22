import { CONSTRUCTION_CARGO, WRECKING_BALL } from "../entities/ConstructionCargo.js";

export const WRECKING_BALL_CENTER_Z = CONSTRUCTION_CARGO[WRECKING_BALL].collider.physicalHeight / 2;

// The oblique camera stretches y-z by sqrt(2). Compress that axis about the
// ball's centre while preserving x and the camera's depth axis, y+z.
export const WRECKING_BALL_SHEAR = (1 - Math.SQRT1_2) / 2;
