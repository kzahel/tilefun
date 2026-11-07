import { expect, it } from "vitest";
import { MotocrossSource } from "../generation/regional/MotocrossPlanner.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { rotateBodyVector } from "../physics/BodyRotation.js";
import { required } from "../shared/required.js";
import { manualCarMovement } from "../traffic/CarControls.js";
import { naturalLandscapeRecipe } from "./NaturalLandscapeRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

it("drives the generated start-line car over the sky lip and double in the real world", async () => {
  const park = required(new MotocrossSource(regionalWorld(2026)).owner(0, 0));
  const s = await ScenarioSession.create(naturalLandscapeRecipe("motocross", "thicket"));
  // This boosted run is chaotic: a 0.05px start offset already rolls the car on
  // landing (measured 2026-11-07). Distant rail services (~600 tiles away) only
  // change shared-solver floating-point order, so keep them out of this jump check.
  s.realm.railways?.dispose();
  try {
    const north = park.center.y - 20;
    await s.ready({
      minCx: Math.floor((park.center.x - park.straight - 4) / 16),
      maxCx: Math.floor((park.center.x + park.straight) / 16),
      minCy: Math.floor((north - 8) / 16),
      maxCy: Math.floor((north + 8) / 16),
    });
    expect(
      s.realm.propManager.props.filter((p) => p.type.startsWith("prop-mx-sky-")).length,
    ).toBeGreaterThan(10);
    const car = required(
      s.realm.entityManager.entities.find(
        (e) => e.type === "vehicle-v1:rally-hatchback" && e.proceduralId?.includes(":start:"),
      ),
    );
    await s.command({ kind: "enter-vehicle", entityId: car.id });
    expect(s.player.player.parentId).toBe(car.id);
    const input = manualCarMovement({ dx: 0, dy: -1, jump: false, sprinting: true });
    const finish = (park.center.x + park.straight - 8) * 16;
    let peak = 0,
      lowestUp = 1;
    for (let t = 0; t < 900 && car.position.wx < finish; t++) {
      await s.step(input);
      peak = Math.max(peak, car.wz ?? 0);
      lowestUp = Math.min(lowestUp, rotateBodyVector(required(car.bodyRotation), 0, 0, 1).z);
    }
    // The sky lip tops out at 80px; a boosted rally hatchback flies well above it.
    expect(peak).toBeGreaterThan(140);
    expect(lowestUp).toBeGreaterThan(0.5);
    expect(car.position.wx).toBeGreaterThanOrEqual(finish);
    expect(Math.abs(car.position.wy / 16 - north)).toBeLessThan(4);
  } finally {
    await s.close();
  }
}, 120_000);
