import { expect, it } from "vitest";
import {
  CONSTRUCTION_BLOCK,
  CONSTRUCTION_PALLET,
  WRECKING_BALL,
} from "../entities/ConstructionCargo.js";
import { runEquipment } from "../server/EquipmentControl.js";
import type { ExcavatorAction } from "../shared/ExcavatorInput.js";
import {
  physicsStateBytes,
  readPhysicsState,
  writePhysicsState,
} from "../shared/physicsStateCodec.js";
import { required } from "../shared/required.js";
import { isFlatbed, onFlatbed } from "../traffic/Flatbed.js";
import { craneRig, isMobileCrane } from "../traffic/MobileCrane.js";
import { constructionCraneRecipe } from "./ConstructionYardRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

it("loads a real pallet onto the flatbed and swings the ball through the practice stack", async () => {
  const session = await ScenarioSession.create(constructionCraneRecipe());
  try {
    const wait = async (ticks: number) => {
      for (let i = 0; i < ticks; i++) await session.step(idle);
    };
    await wait(55);
    const { entityManager } = session.realm;
    const crane = required(entityManager.entities.find(isMobileCrane));
    const flatbed = required(entityManager.entities.find(isFlatbed));
    session.realm.vehicles.enter(session.player, crane.id);
    const rig = () => craneRig(crane.vehicleExcavator);
    const hold = async (
      excavatorAction: ExcavatorAction,
      until: () => boolean,
      observe?: () => void,
    ) => {
      for (let tick = 0; tick < 210 && !until(); tick++) {
        await session.step({ ...idle, excavatorAction });
        observe?.();
      }
      expect(
        until(),
        JSON.stringify({
          excavatorAction,
          rig: rig(),
          target: crane.vehicleExcavatorTarget,
          speed: crane.velocity,
          position: crane.position,
          rotation: crane.bodyRotation,
        }),
      ).toBe(true);
      await wait(25);
    };
    const command = (action: "crane-hook" | "crane-tool") =>
      runEquipment(session.realm.vehicles, session.player, { entityId: crane.id, action });
    await hold("stick-out", () => rig().extension >= 20);
    await hold("bucket-curl", () => rig().cable >= 22);
    command("crane-hook");
    const pallet = required(entityManager.byId.get(required(crane.vehicleCraneLoadId)));
    expect(pallet.type).toBe(CONSTRUCTION_PALLET);
    await hold("bucket-open", () => rig().cable <= 8.5);
    await hold("boom-up", () => rig().pitch >= 0.3);
    expect(pallet.wz).toBeGreaterThan(25);
    await hold("stick-out", () => rig().extension >= 34);
    // A lurch in the slewing cable actually tilts the loose body. Preserve
    // that pose and its spin across the prediction snapshot boundary too.
    let steepest = 0;
    await hold(
      "swing-right",
      () => rig().yaw >= 1.14,
      () => {
        const rotation = required(pallet.bodyRotation);
        steepest = Math.max(steepest, Math.hypot(rotation[0], rotation[1]));
      },
    );
    expect(steepest).toBeGreaterThan(0.15);
    const snapshot = required(session.realm.physicsScene).snapshot();
    const body = required(snapshot.bodies.find((b) => b.id === pallet.id));
    expect(body.kind).toBe("loose");
    const rotatingLoad = { ...snapshot, bodies: [body], contacts: [] };
    const wire = new DataView(new ArrayBuffer(physicsStateBytes(rotatingLoad)));
    expect(writePhysicsState(wire, 0, rotatingLoad)).toBe(wire.byteLength);
    const [restoredLoad, end] = readPhysicsState(wire, 0);
    expect(end).toBe(wire.byteLength);
    expect(restoredLoad?.bodies[0]?.rotation).toEqual(pallet.bodyRotation);
    expect(restoredLoad?.bodies[0]?.angularVelocity).toEqual(pallet.bodyAngularVelocity);
    await wait(85);
    command("crane-hook");
    await wait(100);
    expect(
      onFlatbed(flatbed, pallet),
      JSON.stringify({
        pallet: pallet.position,
        z: pallet.wz,
        flatbed: flatbed.position,
        rig: rig(),
      }),
    ).toBe(true);
    expect(crane.vehicleCraneLoadId).toBeUndefined();

    await hold("swing-left", () => rig().yaw <= 0.02 || rig().yaw > 6);
    command("crane-tool");
    const ball = required(entityManager.byId.get(required(crane.vehicleCraneLoadId)));
    expect(ball.type).toBe(WRECKING_BALL);
    await hold("bucket-curl", () => rig().cable >= 55);
    const blocks = entityManager.entities.filter((e) => e.type === CONSTRUCTION_BLOCK);
    const start = blocks.map((e) => ({ x: e.position.wx, y: e.position.wy, z: e.wz ?? 0 }));
    expect(start.some((p) => p.z > 12)).toBe(true);
    await hold("swing-right", () => rig().yaw > 0.7 && rig().yaw < Math.PI);
    await wait(85);
    expect(
      blocks.some((e, i) => {
        const p = required(start[i]);
        return Math.hypot(e.position.wx - p.x, e.position.wy - p.y) > 6 || (e.wz ?? 0) < p.z - 8;
      }),
    ).toBe(true);

    expect(blocks.filter((e) => (e.wz ?? 0) > 12)).toHaveLength(1);

    const oldPose = crane.vehicleExcavator;
    const oldBall = ball.persistentId;
    await session.reload();
    await wait(10);
    const restored = required(session.realm.entityManager.entities.find(isMobileCrane));
    expect(restored.vehicleExcavator).toBe(oldPose);
    const restoredBall = required(
      session.realm.entityManager.byId.get(required(restored.vehicleCraneLoadId)),
    );
    expect(restoredBall.persistentId).toBe(oldBall);
  } finally {
    await session.close();
  }
});
