import { WRECKING_BALL } from "../../entities/ConstructionCargo.js";
import { CONSTRUCTION_RUBBLE } from "../../entities/ConstructionRubble.js";
import type { Entity } from "../../entities/Entity.js";
import { rotateBodyVector, yawRotation } from "../../physics/BodyRotation.js";
import { clampBedTilt, hasDumpBed, insideDumpBed } from "../../traffic/DumpBed.js";
import { craneCargoHook } from "../../traffic/MobileCrane.js";
import { isTransporter, onTransporter } from "../../traffic/Transporter.js";
import { isVehicle } from "../../traffic/Vehicle.js";
import { isCarryable } from "../../wildlife/ForageResources.js";
import { entityHeading } from "../EntityMeshPose.js";
import type { SceneItem, SpriteItem } from "../SceneItem.js";

interface Collected {
  entity: Entity;
  item: SpriteItem;
}

/** Equipment shares one local depth group with what it holds: a towed or carried
 * car draws in the truck's target, and people/cargo in a dump bed or on a
 * transporter depth-test against the actual tub/deck triangles (fallbacks clip
 * against the physical parts). Grouped items leave the ordinary sorted list. */
export function groupVehicleContents(items: SceneItem[], collected: readonly Collected[]) {
  const trucks = collected.filter((c) => hasDumpBed(c.entity) || isTransporter(c.entity));
  const towing = collected.filter(
    (c) => c.entity.towTargetId !== undefined || c.entity.transportLoadId !== undefined,
  );
  const cranes = collected.filter(({ entity }) => entity.vehicleCraneLoadId !== undefined);
  if (!trucks.length && !towing.length && !cranes.length) return;
  const byId = new Map(collected.map((c) => [c.entity.id, c]));
  for (const { entity, item } of cranes) {
    const payload = byId.get(entity.vehicleCraneLoadId ?? -1)?.entity;
    if (!payload || !item.mesh) continue;
    const [x, y, z, w] = entity.bodyRotation ?? yawRotation(entityHeading(entity));
    const eye = craneCargoHook(payload);
    const end = rotateBodyVector(
      [-x, -y, -z, w],
      eye.wx - entity.position.wx,
      eye.wy - entity.position.wy,
      eye.wz - (entity.wz ?? 0),
    );
    item.mesh = {
      ...item.mesh,
      craneCableEnd: { ...end, wrecking: payload.type === WRECKING_BALL },
    };
  }
  const grouped = new Set<SceneItem>();
  for (const { entity, item } of [...towing, ...trucks.filter((t) => isTransporter(t.entity))]) {
    if (item.towGroup) continue;
    const load =
      byId.get(entity.towTargetId ?? entity.transportLoadId ?? -1) ??
      collected.find(
        (c) =>
          isTransporter(entity) &&
          c.entity !== entity &&
          isVehicle(c.entity) &&
          onTransporter(entity, c.entity),
      );
    if (!load || grouped.has(load.item)) continue;
    item.towGroup = load.item;
    grouped.add(load.item);
  }
  for (const { entity: actor, item } of collected) {
    if (
      actor.parentId !== undefined ||
      (actor.type !== "player" && actor.type !== CONSTRUCTION_RUBBLE && !isCarryable(actor))
    )
      continue;
    const owner = trucks.find(({ entity: t }) =>
      hasDumpBed(t) ? insideDumpBed(t, actor, entityHeading(t)) : onTransporter(t, actor),
    );
    if (!owner) continue;
    const truck = owner.entity;
    owner.item.bedGroup ??= {
      heading: entityHeading(truck),
      ...(hasDumpBed(truck)
        ? { tilt: clampBedTilt(truck.vehicleBedTilt) }
        : { vehicle: "transporter" as const, ramp: truck.vehicleRamp === 1 }),
      contents: [],
    };
    item.hasShadow = false;
    delete item.meshRoofSupport;
    owner.item.bedGroup.contents.push(item);
    grouped.add(item);
  }
  if (!grouped.size) return;
  for (let i = items.length - 1; i >= 0; i--)
    if (grouped.has(items[i] as SceneItem)) items.splice(i, 1);
}
