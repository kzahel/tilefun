import {
  CONSTRUCTION_PALLET,
  createConstructionCargo,
  WRECKING_BALL,
} from "../entities/ConstructionCargo.js";
import type { Entity } from "../entities/Entity.js";
import { durableId } from "../persistence/ActorRecords.js";
import { launchBody } from "../physics/PhysicalEdits.js";
import { getSurfaceZ } from "../physics/surfaceHeight.js";
import { type ExcavatorAction, isExcavatorAction } from "../shared/ExcavatorInput.js";
import { nextExcavatorPose } from "../traffic/Excavator.js";
import { CRANE_REST, craneCargoHook, craneRig, craneTip } from "../traffic/MobileCrane.js";
import type { CraneToolAction } from "../traffic/VehicleEquipment.js";
import type { Realm } from "./Realm.js";

export function runCraneTool(
  realm: Pick<Realm, "entityManager" | "world">,
  crane: Entity,
  action: CraneToolAction | ExcavatorAction,
) {
  if (isExcavatorAction(action)) {
    if (crane.vehicleExcavatorTarget !== undefined) throw Error("The boom is still moving.");
    const current = crane.vehicleExcavator ?? CRANE_REST;
    const target = nextExcavatorPose(current, action);
    if (target !== current) crane.vehicleExcavatorTarget = target;
    return;
  }
  const manager = realm.entityManager;
  const load = manager.byId.get(crane.vehicleCraneLoadId ?? -1);
  if (load?.type === WRECKING_BALL) {
    if (action === "crane-hook") throw Error("Switch back to the hook to lift a pallet.");
    manager.remove(load.id);
    releaseCraneLoad(crane);
    return;
  }
  if (load) {
    if (action === "crane-tool") throw Error("Set down the pallet before switching tools.");
    releaseCraneLoad(crane);
    return;
  }

  const tip = craneTip(crane);
  const cable = craneRig(crane.vehicleExcavator).cable;
  const ground = getSurfaceZ(tip.wx, tip.wy, (x, y) => realm.world.getHeightAt(x, y));
  if (action === "crane-tool") {
    const ball = createConstructionCargo(WRECKING_BALL, tip.wx, tip.wy);
    ball.wz = Math.max(ground, tip.wz - cable - 16);
    launchBody(ball, { vx: 0, vy: 0, vz: 0 });
    hookCraneLoad(crane, manager.spawn(ball));
    return;
  }

  const attached = new Set(manager.entities.map((e) => e.vehicleCraneLoadId));
  const candidates = manager.entities
    .filter((e) => e.type === CONSTRUCTION_PALLET && !attached.has(e.id))
    .map((e) => {
      const eye = craneCargoHook(e);
      const flat = Math.hypot(eye.wx - tip.wx, eye.wy - tip.wy);
      const hookZ = Math.max(ground, tip.wz - cable);
      return { e, flat, distance: Math.hypot(flat, hookZ - eye.wz) };
    })
    .filter(({ flat, distance }) => flat <= 13 && distance <= 15)
    .sort((a, b) => a.distance - b.distance || a.e.id - b.e.id);
  const target = candidates[0]?.e;
  if (!target) throw Error("Lower the hook to a nearby pallet.");
  hookCraneLoad(crane, target);
}

function hookCraneLoad(crane: Entity, cargo: Entity) {
  crane.vehicleCraneLoadKey = durableId(cargo);
  crane.vehicleCraneLoadId = cargo.id;
}

function releaseCraneLoad(crane: Entity) {
  delete crane.vehicleCraneLoadKey;
  delete crane.vehicleCraneLoadId;
}

/** Saved actor identities resolve to this residency's replicated body IDs. */
export function resolveCraneLoads(participants: readonly Entity[], residents: readonly Entity[]) {
  const cranes = participants.filter((e) => e.vehicleCraneLoadKey !== undefined);
  if (!cranes.length) return;
  const payloads = new Map(
    residents
      .filter((e) => (e.type === CONSTRUCTION_PALLET || e.type === WRECKING_BALL) && e.persistentId)
      .map((e) => [e.persistentId, e.id]),
  );
  for (const crane of cranes) {
    const id = payloads.get(crane.vehicleCraneLoadKey);
    if (id === undefined) delete crane.vehicleCraneLoadId;
    else {
      crane.vehicleCraneLoadId = id;
      payloads.delete(crane.vehicleCraneLoadKey);
    }
  }
}
