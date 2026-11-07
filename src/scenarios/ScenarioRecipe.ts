import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import type { VehicleRegistry } from "../traffic/VehicleRegistry.js";

/** Data only: the Realm owns all updates, collisions, AI and persistence. */
export interface ScenarioRecipe {
  version: 1;
  id: string;
  generation: GenerationDescriptor;
  landscape?: import("../generation/regional/NaturalLandscape.js").LandscapeProfile;
  player: Entity;
  /** Optional second ordinary session for co-op inspection. */
  guest?: Entity;
  props: Prop[];
  /** Known ordinary prop identities retain production AI semantics and persistence. */
  nativeProps?: { type: string; wx: number; wy: number }[];
  actors?: Entity[];
  /** Native parked bodies use durable VehicleRecords, just like editor placement. */
  parkedVehicles?: ParkedScenarioVehicle[];
  gravity?: number;
  /** Bounded Worker timings, sampled on explicit diagnostics requests. */
  measurePhysics?: boolean;
  roads?: { left: number; right: number; top: number; bottom: number }[];
  /** Canonical generated-lane input for ordinary road traffic fixtures. Tile units. */
  trafficRoads?: import("../traffic/LaneGraph.js").RoadSegment[];
  /** Speedway ovals (tile-unit centers) whose two closed rings carry racers. */
  racetracks?: { id: string; center: { x: number; y: number } }[];
  /** Shopping centers (world pixels) that passing road compacts may visit. */
  shoppingCenters?: import("../traffic/ShoppingCenter.js").ShoppingCenter[];
}
export interface ParkedScenarioVehicle {
  model: string;
  name?: string;
  z?: number;
  rotation?: import("../physics/BodyRotation.js").BodyRotation;
  paintSchemeId?: string;
  wx: number;
  wy: number;
  facing: import("../entities/Entity.js").Direction;
  /** Pixels the car may back up, opposite its facing, in 16px steps when a
   * generated world's own vehicle occupies the staged pose. */
  backUp?: number;
  /** Starts as ordinary road traffic instead of parked. */
  autonomous?: true;
}
/** Places a parked fixture, backing it up along its lane when allowed. */
export function parkScenarioVehicle(
  registry: VehicleRegistry | null,
  fixture: ParkedScenarioVehicle,
) {
  // Direction order: Down, Up, Left, Right; backing up reverses the facing.
  const [bx, by] = (
    [
      [0, -1],
      [0, 1],
      [1, 0],
      [-1, 0],
    ] as const
  )[fixture.facing];
  for (let back = 0; back <= (fixture.backUp ?? 0); back += 16) {
    const state = registry?.place(
      fixture.model,
      fixture.wx + bx * back,
      fixture.wy + by * back,
      fixture.facing,
      fixture.paintSchemeId,
      undefined,
      fixture.z,
    );
    if (state) {
      if (fixture.autonomous) state.autonomous = true;
      return state;
    }
  }
  return undefined;
}
export const FLAT_SCENARIO = {
  type: "flat",
  version: "flat-v1",
  seed: 1,
  preset: "grass",
} as const;
export function scenarioGravity(recipe: ScenarioRecipe): number {
  const gravity = recipe.gravity ?? 1;
  if (!Number.isFinite(gravity) || gravity < 0 || gravity > 10000)
    throw new Error("Invalid scenario gravity");
  return gravity;
}
/** Apply candidate static geometry without touching replicated animation state. */
export function applyScenarioAppearance(entity: Entity, template: Entity): void {
  entity.collider = structuredClone(template.collider);
  if (template.sortOffsetY === undefined) delete entity.sortOffsetY;
  else entity.sortOffsetY = template.sortOffsetY;
  if (template.sprite && entity.sprite) {
    const { direction, frameRow, frameCol, moving, animTimer, clip, clipElapsedMs } = entity.sprite;
    entity.sprite = {
      ...structuredClone(template.sprite),
      direction,
      frameRow,
      frameCol,
      moving,
      animTimer,
    };
    if (clip === undefined) delete entity.sprite.clip;
    else entity.sprite.clip = clip;
    if (clipElapsedMs === undefined) delete entity.sprite.clipElapsedMs;
    else entity.sprite.clipElapsedMs = clipElapsedMs;
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
