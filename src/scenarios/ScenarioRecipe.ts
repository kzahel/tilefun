import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import { getMovementPhysicsParams, type MovementPhysicsParams } from "../physics/PlayerMovement.js";
import type { RailRoute } from "../railway/RailwaySystem.js";

/** Data only: the Realm owns all updates, collisions, AI and persistence. */
export interface ScenarioRecipe {
  version: 1;
  id: string;
  generation: GenerationDescriptor;
  player: Entity;
  props: Prop[];
  actors?: Entity[];
  /** Authored straight tracks, served by the production RailwaySystem. */
  railways?: RailRoute[];
  physics?: Partial<MovementPhysicsParams>;
  traffic?: {
    model: string;
    laneId: string;
    x: number;
    y: number;
    distance: number;
    name: string;
  }[];
}
export const FLAT_SCENARIO = {
  type: "flat",
  version: "flat-v1",
  seed: 1,
  preset: "grass",
} as const;
export function scenarioPhysics(
  settings: Partial<MovementPhysicsParams> = {},
): MovementPhysicsParams {
  const result = { ...getMovementPhysicsParams(), ...settings };
  for (const [key, value] of Object.entries(result)) {
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0 || value > 10000))
      throw new Error(`Invalid scenario physics: ${key}`);
  }
  return result;
}
/** Apply candidate static geometry without touching replicated animation state. */
export function applyScenarioAppearance(entity: Entity, template: Entity): void {
  entity.collider = structuredClone(template.collider);
  if (template.sortOffsetY === undefined) delete entity.sortOffsetY;
  else entity.sortOffsetY = template.sortOffsetY;
  if (template.sprite && entity.sprite) {
    const { direction, frameRow, frameCol, moving, animTimer } = entity.sprite;
    entity.sprite = {
      ...structuredClone(template.sprite),
      direction,
      frameRow,
      frameCol,
      moving,
      animTimer,
    };
  } else entity.sprite = structuredClone(template.sprite);
}
/** Invisible ordinary wall props, shared by every bounded fixture. */
export function scenarioWalls(left: number, top: number, right: number, bottom: number): Prop[] {
  return [
    [left - 16, top - 16, right - left + 32, 16],
    [left - 16, bottom, right - left + 32, 16],
    [left - 16, top, 16, bottom - top],
    [right, top, 16, bottom - top],
  ].map(([x = 0, y = 0, width = 0, height = 0], id) => ({
    id,
    type: "scenario-wall",
    isProp: true,
    position: { wx: x + width / 2, wy: y + height },
    sprite: {
      sheetKey: "scenario-wall",
      frameCol: 0,
      frameRow: 0,
      spriteWidth: 0,
      spriteHeight: 0,
    },
    collider: { offsetX: 0, offsetY: 0, width, height },
    walls: null,
  }));
}
