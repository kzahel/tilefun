import { expect, it } from "vitest";
import { CONSTRUCTION_RUBBLE } from "../entities/ConstructionRubble.js";
import { runEquipment } from "../server/EquipmentControl.js";
import type { ExcavatorAction } from "../shared/ExcavatorInput.js";
import { required } from "../shared/required.js";
import { insideDumpBed } from "../traffic/DumpBed.js";
import { excavatorAngles, excavatorArm, isExcavator } from "../traffic/Excavator.js";
import { constructionYardRecipe } from "./ConstructionYardRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

it("scoops regional yard rubble and loads the dump truck with the shared equipment controls", async () => {
  const s = await ScenarioSession.create(constructionYardRecipe());
  const rubble = () => s.realm.entityManager.entities.filter((e) => e.type === CONSTRUCTION_RUBBLE);
  try {
    for (let i = 0; i < 45; i++) await s.step(idle);
    const excavator = required(s.realm.entityManager.entities.find(isExcavator));
    const truck = required(
      s.realm.entityManager.entities.find((e) => e.type === "vehicle-v1:dump-truck"),
    );
    const count = rubble().length;
    expect(count).toBe(5);
    s.realm.vehicles.enter(s.player, excavator.id);
    const work = async (action: Parameters<typeof runEquipment>[2]["action"]) => {
      const previous = excavator.vehicleExcavator;
      runEquipment(s.realm.vehicles, s.player, { entityId: excavator.id, action });
      const target = required(excavator.vehicleExcavatorTarget);
      expect(excavator.vehicleExcavator).toBe(previous);
      await s.step(idle);
      expect(excavator.vehicleExcavator).not.toBe(previous);
      expect(excavator.vehicleExcavator).not.toBe(target);
      for (let i = 0; i < 60 && excavator.vehicleExcavatorTarget !== undefined; i++)
        await s.step(idle);
      expect(excavator.vehicleExcavatorTarget).toBeUndefined();
      expect(excavator.vehicleExcavator).not.toBe(previous);
    };
    await work("boom-down");
    await work("boom-down");
    await work("bucket-curl");
    expect(excavatorAngles(excavator.vehicleExcavator).loaded).toBe(true);
    expect(rubble()).toHaveLength(count - 1);

    for (let i = 0; i < 4; i++) await work("boom-up");
    await work("stick-out");
    for (let i = 0; i < 6; i++) await work("swing-right");
    await work("bucket-open");
    expect(excavatorAngles(excavator.vehicleExcavator).loaded).toBe(false);
    for (let i = 0; i < 90; i++) await s.step(idle);
    expect(
      rubble().some((e) => insideDumpBed(truck, e, truck.vehicleHeading)),
      JSON.stringify({
        tip: excavatorArm(excavator, excavator.vehicleExcavator)[3],
        truck: truck.position,
        rubble: rubble().map((e) => ({ p: e.position, z: e.wz })),
      }),
    ).toBe(true);

    const pose = excavator.vehicleExcavator;
    await s.reload();
    expect(s.realm.entityManager.entities.find(isExcavator)?.vehicleExcavator).toBe(pose);
    expect(rubble()).toHaveLength(count);
  } finally {
    await s.close();
  }
});

it("operates the bucket and loads the truck with held device input", async () => {
  const s = await ScenarioSession.create(constructionYardRecipe());
  try {
    for (let i = 0; i < 45; i++) await s.step(idle);
    const excavator = required(s.realm.entityManager.entities.find(isExcavator));
    const truck = required(
      s.realm.entityManager.entities.find((e) => e.type === "vehicle-v1:dump-truck"),
    );
    s.realm.vehicles.enter(s.player, excavator.id);
    const pose = () => excavatorAngles(excavator.vehicleExcavator);
    const hold = async (excavatorAction: ExcavatorAction, done: () => boolean) => {
      for (let i = 0; i < 150 && !done(); i++) await s.step({ ...idle, excavatorAction });
      expect(done(), excavatorAction).toBe(true);
      for (let i = 0; i < 35; i++) await s.step(idle);
      expect(excavator.vehicleExcavatorTarget).toBeUndefined();
    };
    await hold("boom-down", () => pose().boom <= (34.5 * Math.PI) / 180);
    await hold("bucket-curl", () => pose().loaded);
    await hold("boom-up", () => pose().boom >= (80 * Math.PI) / 180);
    await hold("stick-out", () => pose().stick >= (-82 * Math.PI) / 180);
    await hold("swing-right", () => pose().yaw >= (84 * Math.PI) / 180);
    await hold("bucket-open", () => !pose().loaded);
    for (let i = 0; i < 90; i++) await s.step(idle);
    const rubble = s.realm.entityManager.entities.filter((e) => e.type === CONSTRUCTION_RUBBLE);
    expect(rubble).toHaveLength(5);
    expect(rubble.some((e) => insideDumpBed(truck, e, truck.vehicleHeading))).toBe(true);
  } finally {
    await s.close();
  }
});
