import { CONSTRUCTION_RUBBLE, createConstructionRubble } from "../entities/ConstructionRubble.js";
import { aabbOverlapsPropWalls } from "../entities/collision.js";
import type { Entity } from "../entities/Entity.js";
import { launchBody } from "../physics/PhysicalEdits.js";
import { getSurfaceZ } from "../physics/surfaceHeight.js";
import type { ExcavatorAction } from "../shared/ExcavatorInput.js";
import { required } from "../shared/required.js";
import {
  excavatorAngles,
  excavatorArm,
  excavatorLoad,
  fineExcavatorPose,
  nextExcavatorPose,
} from "../traffic/Excavator.js";
import type { Realm } from "./Realm.js";

type WorkRealm = Pick<Realm, "entityManager" | "propManager" | "world">;
const pending = new WeakMap<Entity, { action: ExcavatorAction; target: number; start: number }>();

export function workExcavator(realm: WorkRealm, machine: Entity, action: ExcavatorAction): void {
  if (machine.vehicleExcavatorTarget !== undefined) throw Error("The arm is still moving.");
  const start = fineExcavatorPose(machine.vehicleExcavator);
  const target = nextExcavatorPose(start, action);
  if (target === start) return;
  const getHeight = (x: number, y: number) => realm.world.getHeightAt(x, y);
  checkArmClearance(realm, excavatorArm(machine, target), getHeight);
  machine.vehicleExcavatorTarget = target;
  if (action === "bucket-curl" || action === "bucket-open")
    pending.set(machine, { action, target, start });
}

/** Cargo changes hands when the physical bucket completes its powered stroke. */
export function finishExcavatorStroke(
  realm: Pick<Realm, "entityManager" | "world">,
  machine: Entity,
  previous: number | undefined,
) {
  const target = machine.vehicleExcavator;
  if (target === undefined) return;
  const stroke = pending.get(machine);
  if (stroke) {
    if (machine.vehicleExcavatorTarget !== undefined) return;
    pending.delete(machine);
    if (target === stroke.target)
      transferRubble(realm, machine, stroke.start, target, stroke.action);
    return;
  }
  if (previous === undefined || previous === target) return;
  const before = excavatorAngles(previous);
  const after = excavatorAngles(target);
  // Open past the release angle, or sweep a low bucket through loose rubble.
  if (!before.loaded && after.bucket > before.bucket && after.bucket >= (-28 * Math.PI) / 180)
    transferRubble(realm, machine, previous, target, "bucket-curl");
  else if (before.loaded && after.bucket < before.bucket && after.bucket <= (-32 * Math.PI) / 180)
    transferRubble(realm, machine, previous, target, "bucket-open");
}

function transferRubble(
  realm: Pick<Realm, "entityManager" | "world">,
  machine: Entity,
  start: number,
  target: number,
  action: ExcavatorAction,
) {
  const tip = required(excavatorArm(machine, target)[3]);
  const ground = getSurfaceZ(tip.wx, tip.wy, (x, y) => realm.world.getHeightAt(x, y));
  const { loaded } = excavatorAngles(start);

  if (action === "bucket-curl" && !loaded && tip.wz - ground <= 14) {
    const entry = required(excavatorArm(machine, start)[3]);
    const scoopDistance = (e: Entity) =>
      Math.min(
        Math.hypot(e.position.wx - tip.wx, e.position.wy - tip.wy),
        Math.hypot(e.position.wx - entry.wx, e.position.wy - entry.wy),
      );
    const rubble = realm.entityManager.entities
      .filter((e) => e.type === CONSTRUCTION_RUBBLE && Math.abs((e.wz ?? 0) - ground) < 9)
      .filter((e) => scoopDistance(e) <= 12)
      .sort((a, b) => scoopDistance(a) - scoopDistance(b) || a.id - b.id)[0];
    if (rubble) {
      realm.entityManager.remove(rubble.id);
      setBucketLoad(machine, target, true);
    }
  } else if (action === "bucket-open" && loaded) {
    const rubble = createConstructionRubble(tip.wx, tip.wy);
    rubble.wz = Math.max(ground, tip.wz);
    launchBody(rubble, { vx: 0, vy: 0, vz: 0 });
    realm.entityManager.spawn(rubble);
    setBucketLoad(machine, target, false);
  }
}

function setBucketLoad(machine: Entity, pose: number, loaded: boolean) {
  machine.vehicleExcavator = excavatorLoad(pose, loaded);
  if (machine.vehicleExcavatorTarget !== undefined)
    machine.vehicleExcavatorTarget = excavatorLoad(machine.vehicleExcavatorTarget, loaded);
}

/** Check the working links along their length before committing a jog. */
function checkArmClearance(
  realm: Pick<Realm, "propManager">,
  arm: ReturnType<typeof excavatorArm>,
  getHeight: (x: number, y: number) => number,
) {
  for (let link = 0; link < arm.length - 1; link++) {
    const from = required(arm[link]);
    const to = required(arm[link + 1]);
    for (const t of [0.25, 0.5, 0.75, 1]) {
      const x = from.wx + (to.wx - from.wx) * t;
      const y = from.wy + (to.wy - from.wy) * t;
      const z = from.wz + (to.wz - from.wz) * t;
      if (z < getSurfaceZ(x, y, getHeight) - 0.75)
        throw Error("The arm is at ground level. Raise the boom first.");
      const probe = { left: x - 2, top: y - 2, right: x + 2, bottom: y + 2 };
      if (
        realm.propManager.queryProps.some((p) =>
          aabbOverlapsPropWalls(
            probe,
            p.position,
            { collider: p.collider, walls: p.walls ?? null },
            z - 2,
            4,
            getHeight,
          ),
        )
      )
        throw Error("The arm needs more room.");
    }
  }
}
