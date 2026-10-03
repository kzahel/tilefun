import { required } from "../art/ArtCatalog.js";
import { Direction, type Entity } from "../entities/Entity.js";
import type { EntityDef } from "../entities/EntityDefs.js";
import bank from "./vehicles-v1.json" with { type: "json" };

export const VEHICLE_BANK = bank;
export const VEHICLE_MODELS = [...new Set(bank.views.map((v) => v.vehicleId))];
export const TRAFFIC_MODELS = VEHICLE_MODELS.filter((id) => id !== "fire-truck-ladder-2");
const directions = ["south", "north", "west", "east"];
const viewsByKey = new Map(bank.views.map((v) => [`vehicle-v1:${v.vehicleId}:${v.direction}`, v]));
const roofSizes = new Map(
  VEHICLE_MODELS.map((id) => [
    id,
    Math.max(
      0,
      Math.min(
        ...bank.views
          .filter((v) => v.vehicleId === id)
          .flatMap((v) => v.metadata.colliders.map((c) => Math.min(c.width, c.height))),
      ) - 4,
    ),
  ]),
);
const roadWidths = new Map(
  VEHICLE_MODELS.map((model) => [
    model,
    Math.max(
      ...bank.views
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
  entity.collider = {
    offsetX: 0,
    offsetY: c.height / 2,
    width: c.width,
    height: c.height,
    physicalHeight: c.zHeight,
    clientSolid: true,
  };
  entity.sortOffsetY = view.metadata.depthOffset - (c.offsetY - c.height / 2);
  entity.noShadow = true; // Native art contains the approved shadow.
  if (entity.sprite) {
    entity.sprite.direction = direction;
    entity.sprite.frameRow = vehicleFrameDirection(entity.type, direction);
  }
}
export const VEHICLE_DEFS: Record<string, EntityDef> = Object.fromEntries(
  VEHICLE_MODELS.map((id) => [
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
): Entity {
  const type = `vehicle-v1:${model}`,
    def = VEHICLE_DEFS[type];
  if (!def?.sprite) throw new Error(`Unknown vehicle ${model}`);
  const entity: Entity = {
    id: 0,
    type,
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
