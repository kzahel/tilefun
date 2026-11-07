import { expect, it } from "vitest";
import { controlDumpBed } from "../server/DumpBedControl.js";
import { required } from "../shared/required.js";
import { insideDumpBed } from "../traffic/DumpBed.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { vehicleDynamicsRecipe } from "./VehicleDynamicsRecipe.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

it("keeps resting bed cargo in reach of the player and discharges it when tipped", async () => {
  const s = await ScenarioSession.create(vehicleDynamicsRecipe("compact-1", "bed"));
  try {
    const truck = required(s.realm.entityManager.byId.get(required(s.handles.truck)));
    // Longer than the ordinary resting-ball cleanup: bed cargo is kept.
    for (let i = 0; i < 240; i++) await s.step(idle);
    const balls = s.realm.entityManager.entities.filter((e) => e.type === "ball");
    expect(balls.filter((ball) => insideDumpBed(truck, ball, truck.vehicleHeading))).toHaveLength(
      3,
    );
    controlDumpBed(s.realm.vehicles, s.player, { entityId: truck.id, action: "tip" });
    for (let i = 0; i < 360; i++) await s.step(idle);
    expect(balls.some((ball) => insideDumpBed(truck, ball, truck.vehicleHeading))).toBe(false);
  } finally {
    await s.close();
  }
});
