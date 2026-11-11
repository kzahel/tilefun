import type { Entity } from "../entities/Entity.js";
import type { Prop } from "../entities/Prop.js";
import type { GenerationDescriptor } from "../generation/GenerationDescriptor.js";
import { validateSurfacePatch } from "../physics/SurfacePatch.js";
import { validateExcavations } from "../physics/TerrainExcavation.js";
import { quantizeAxis } from "../shared/binaryCodec.js";
import type { Movement } from "../shared/Movement.js";
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
  /** Terrain painted through the ordinary editor brush on a fresh open. Tile units. */
  terrain?: { tx: number; ty: number; terrain: number }[];
  /** Canonical generated-lane input for ordinary road traffic fixtures. Tile units. */
  trafficRoads?: import("../traffic/LaneGraph.js").RoadSegment[];
  /** Fixed diagnostic populations still use ordinary road decisions/motors, but
   * admit only the recipe's vehicles instead of adding generated lane traffic. */
  fixedTrafficPopulation?: boolean;
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
/** Check a session's own copy of a recipe and name its props; throws on
 * fixtures the Realm must not open. */
export function prepareScenarioRecipe(recipe: ScenarioRecipe): void {
  if (
    (recipe.trafficRoads?.length ?? 0) > 64 ||
    recipe.trafficRoads?.some(
      (s) =>
        ![s.a.x, s.a.y, s.b.x, s.b.y, s.width].every(Number.isSafeInteger) ||
        s.width < 2 ||
        s.width > 64 ||
        (s.a.x !== s.b.x && s.a.y !== s.b.y) ||
        [s.a.x, s.a.y, s.b.x, s.b.y].some((n) => Math.abs(n) > 8192),
    )
  )
    throw Error("Invalid traffic road fixture");
  if (recipe.version !== 1) throw Error("Unsupported scenario recipe");
  if ((recipe.actors?.length ?? 0) > 1024 || (recipe.parkedVehicles?.length ?? 0) > 256)
    throw Error("Scenario actor budget exceeded");
  recipe.props.forEach((prop, index) => {
    prop.type = `scenario-prop-${index}`;
    for (const c of prop.walls ?? (prop.collider ? [prop.collider] : []))
      if (c.surface) validateSurfacePatch(c.surface, c.width, c.height);
  });
  if (
    (recipe.nativeProps?.length ?? 0) > 128 ||
    recipe.nativeProps?.some((p) => !Number.isFinite(p.wx) || !Number.isFinite(p.wy))
  )
    throw Error("Invalid native scenario props");
  validateExcavations(recipe.props);
  const patches = recipe.props
    .flatMap((p) => p.walls ?? (p.collider ? [p.collider] : []))
    .flatMap((c) => (c.surface ? [c.surface] : []));
  const ids = new Set(patches.map((p) => p.id));
  if (ids.size !== patches.length || patches.some((p) => p.connectsTo.some((id) => !ids.has(id))))
    throw Error("Invalid surface connections");
  if (recipe.actors?.some((e) => e.type === "player"))
    throw Error("Use recipe.player for the controlled actor");
  if (recipe.guest && recipe.guest.type !== "player") throw Error("Invalid guest player");
}
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
/** Recipe appearances on a lab replica's authoritative entities after each
 * frame (the wire carries animation state, not recipe sprites or colliders). */
export function applyRecipeAppearances(
  replica: { readonly serverPlayerEntity: Entity; readonly serverEntities: readonly Entity[] },
  player: Entity,
  actors: readonly Entity[] = [],
): void {
  applyScenarioAppearance(replica.serverPlayerEntity, player);
  for (const entity of replica.serverEntities) {
    const template = actors.find((actor) => actor.type === entity.type);
    if (template) applyScenarioAppearance(entity, template);
  }
}
/** A lab seat's command as the authority will see it: at most unit length
 * (relative driving keeps its axes) and quantized like the wire. */
export function normalizeLabMovement(input: Movement): Movement {
  const length = input.relativeDriving ? 1 : Math.max(1, Math.hypot(input.dx, input.dy));
  return { ...input, dx: quantizeAxis(input.dx / length), dy: quantizeAxis(input.dy / length) };
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
