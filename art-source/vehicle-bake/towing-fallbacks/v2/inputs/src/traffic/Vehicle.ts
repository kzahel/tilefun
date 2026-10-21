import { required } from "../art/ArtCatalog.js";
import { BOAT_MODEL, BOAT_SIZE, BOAT_TYPE, BOAT_VIEWS } from "../boats/Boat.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";
import { ORIGINAL_VEHICLES } from "./OriginalVehicles.js";
import { validVehiclePaint, vehiclePaintSheet } from "./VehiclePaint.js";
import meshBodies from "./vehicle-body-bounds.json" with { type: "json" };
import bank from "./vehicles-v1.json" with { type: "json" };

export const VEHICLE_BANK = bank;
const roadViews = [...bank.views, ...ORIGINAL_VEHICLES.flatMap((vehicle) => vehicle.views)];
const views = [...roadViews, ...BOAT_VIEWS];
export const VEHICLE_MODELS = [...new Set(roadViews.map((v) => v.vehicleId))];
export const DRIVABLE_MODELS = [...VEHICLE_MODELS, BOAT_MODEL];
export const TRAFFIC_MODELS = VEHICLE_MODELS.filter((id) => id !== "fire-truck-ladder-2");
const directions = ["south", "north", "west", "east"];
const viewsByKey = new Map(views.map((v) => [`vehicle-v1:${v.vehicleId}:${v.direction}`, v]));
// Longer bodies need more room to turn. Use retained vehicle footprints,
// independent of the currently selected cardinal sprite and rendering backend.
const turningRadii = new Map(
  DRIVABLE_MODELS.map((id) => [
    `vehicle-v1:${id}`,
    Math.max(
      40,
      ...views
        .filter((v) => v.vehicleId === id)
        .flatMap((v) => v.metadata.colliders.map((c) => Math.max(c.width, c.height) * 0.7)),
    ),
  ]),
);
const rollingBodies = new Map(
  VEHICLE_MODELS.map((id) => {
    const colliders = views
      .filter((view) => view.vehicleId === id)
      .flatMap((view) => view.metadata.colliders);
    const mesh = meshBodies[id as keyof typeof meshBodies];
    return [
      `vehicle-v1:${id}`,
      {
        length: Math.max(
          mesh?.length ?? 0,
          ...colliders.map((body) => Math.max(body.width, body.height)),
        ),
        breadth: Math.max(
          mesh?.breadth ?? 0,
          ...colliders.map((body) => Math.min(body.width, body.height)),
        ),
      },
    ];
  }),
);
export function vehicleTurningRadius(type: string): number {
  return turningRadii.get(type) ?? 40;
}
export function vehicleCardinalHeading(direction = Direction.Right): number {
  switch (direction) {
    case Direction.Up:
      return -Math.PI / 2;
    case Direction.Down:
      return Math.PI / 2;
    case Direction.Left:
      return Math.PI;
    default:
      return 0;
  }
}
export function vehicleNoseHeading(entity: Pick<Entity, "vehicleHeading" | "sprite">): number {
  return entity.vehicleHeading ?? vehicleCardinalHeading(entity.sprite?.direction);
}
export function vehicleBodySize(
  type: string,
  heading: number,
  towed = false,
): { width: number; height: number } {
  if (type === BOAT_TYPE) return { width: BOAT_SIZE, height: BOAT_SIZE };
  const body = rollingBodies.get(type);
  if (!body) throw Error(`Unknown vehicle body ${type}`);
  const cos = Math.abs(Math.cos(heading)),
    sin = Math.abs(Math.sin(heading));
  // Exact cardinal dimensions avoid microscopic overlap between adjacent lanes.
  const c = cos < 1e-6 ? 0 : cos > 1 - 1e-6 ? 1 : cos;
  const s = sin < 1e-6 ? 0 : sin > 1 - 1e-6 ? 1 : sin;
  const length = body.length + (towed ? 24 : 0);
  return { width: length * c + body.breadth * s, height: length * s + body.breadth * c };
}
const roofSizes = new Map(
  DRIVABLE_MODELS.map((id) => [
    id,
    Math.max(
      0,
      Math.min(
        ...views
          .filter((v) => v.vehicleId === id)
          .flatMap((v) => v.metadata.colliders.map((c) => Math.min(c.width, c.height))),
      ) - 4,
    ),
  ]),
);
const roadWidths = new Map(
  DRIVABLE_MODELS.map((model) => [
    model,
    Math.max(
      ...views
        .filter((v) => v.vehicleId === model)
        .map((v) => {
          const c = required(v.metadata.colliders[0]);
          return v.direction === "east" || v.direction === "west" ? c.height : c.width;
        }),
    ) *
      2 +
      12,
  ]),
);
export function vehicleRoadWidth(type: string): number {
  return roadWidths.get(type.slice(11)) ?? Number.POSITIVE_INFINITY;
}
// The compact, unindexed sedan and police source sets label their side views oppositely to their visible
// headlights. Keep the approved bank untouched; map travel direction to its
// exact opposite-side snapshot (no mirroring). Other families use native labels.
export function vehicleFrameDirection(type: string, direction: Direction) {
  return type.startsWith("vehicle-v1:compact-") ||
    type.startsWith("vehicle-v1:unindexed-sedan-") ||
    type === "vehicle-v1:police-car"
    ? direction === Direction.Left
      ? Direction.Right
      : direction === Direction.Right
        ? Direction.Left
        : direction
    : direction;
}
export function vehicleView(type: string, direction: Direction) {
  if (!type.startsWith("vehicle-v1:")) return undefined;
  return viewsByKey.get(`${type}:${directions[vehicleFrameDirection(type, direction)]}`);
}
export function isVehicle(entity: { type?: string }): boolean {
  return entity.type?.startsWith("vehicle-v1:") === true;
}
/** Entity position is ground-center. The bank pads each native crop to this
 * reference without scaling, rotating, mirroring or changing approved pixels. */
export function applyVehicleFacing(
  entity: Entity,
  direction = entity.sprite?.direction ?? Direction.Down,
) {
  const view = vehicleView(entity.type, direction);
  if (!view) return;
  const c = view.metadata.colliders[0];
  if (!c) throw new Error("Missing approved vehicle collider");
  // The envelope includes the registered mesh and native sprite footprints.
  // Its continuous heading prevents the body escaping a cardinal collision box.
  const { width, height } = vehicleBodySize(
    entity.type,
    entity.vehicleHeading ?? vehicleCardinalHeading(direction),
    entity.towedBy !== undefined,
  );
  entity.collider = {
    offsetX: 0,
    offsetY: height / 2,
    width,
    height,
    physicalHeight: c.zHeight + (entity.towedBy !== undefined ? 12 : 0),
    clientSolid: true,
  };
  entity.sortOffsetY = view.metadata.depthOffset - (c.offsetY - c.height / 2);
  entity.noShadow = true; // Native art contains the approved shadow.
  if (entity.sprite) {
    entity.sprite.sheetKey = vehiclePaintSheet(entity.type, entity.paintSchemeId);
    entity.sprite.direction = direction;
    entity.sprite.frameRow = vehicleFrameDirection(entity.type, direction);
  }
}
export const VEHICLE_DEFS: Record<string, EntityDef> = Object.fromEntries(
  DRIVABLE_MODELS.map((id) => [
    `vehicle-v1:${id}`,
    {
      sprite: {
        sheetKey: `vehicle-v1:${id}`,
        spriteWidth: 192,
        spriteHeight: 224,
        frameCount: 1,
        frameDuration: 1000,
        drawOffsetY: 80,
      },
      collider: null,
      wanderAI: null,
      hasVelocity: true,
      noShadow: true,
    },
  ]),
);
export function createVehicle(
  model: string,
  wx: number,
  wy: number,
  direction = Direction.Right,
  paintSchemeId?: string,
): Entity {
  const type = `vehicle-v1:${model}`,
    def = VEHICLE_DEFS[type];
  if (!def?.sprite) throw new Error(`Unknown vehicle ${model}`);
  if (!validVehiclePaint(type, paintSchemeId)) throw new Error(`Invalid paint for ${model}`);
  const entity: Entity = {
    id: 0,
    type,
    ...(model === "dump-truck" ? { vehicleBed: true as const } : {}),
    ...(paintSchemeId === undefined ? {} : { paintSchemeId }),
    position: { wx, wy },
    velocity: { vx: 0, vy: 0 },
    sprite: {
      ...def.sprite,
      frameCol: 0,
      frameRow: direction,
      direction,
      moving: false,
      animTimer: 0,
    },
    collider: null,
    wanderAI: null,
    wz: 0,
    tags: new Set(["traffic"]),
    noShadow: true,
  };
  applyVehicleFacing(entity, direction);
  return entity;
}
/** Shared, direction-independent safe standing area inside all approved footprints. */
export function vehicleRoofSize(type: string): number {
  return roofSizes.get(type.slice(11)) ?? 0;
}
