import { expect, it } from "vitest";
import { rotateBodyVector } from "../physics/BodyRotation.js";
import { required } from "../shared/required.js";
import { manualCarMovement } from "../traffic/CarControls.js";
import { JUMP_LANES, type JumpLane, jumpParkRecipe } from "./JumpParkRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

/** Drives the seated car down a lane at full boost, as the lab's ↑ + Shift does. */
async function boostedRun(model: string, lane: JumpLane) {
  const s = await ScenarioSession.create(jumpParkRecipe(model, lane));
  try {
    const car = () => required(s.realm.vehicleRegistry?.states.get(required(s.handles.car))).entity;
    await s.command({ kind: "enter-vehicle", entityId: car().id });
    const input = manualCarMovement({ dx: 0, dy: -1, jump: false, sprinting: true });
    let peak = 0,
      lowestUp = 1;
    for (let t = 0; t < 900 && car().position.wx < 1600; t++) {
      await s.step(input);
      const c = car();
      peak = Math.max(peak, c.wz ?? 0);
      lowestUp = Math.min(lowestUp, rotateBodyVector(required(c.bodyRotation), 0, 0, 1).z);
    }
    const c = car();
    return { peak, lowestUp, x: c.position.wx, y: c.position.wy, seated: s.player.player.parentId };
  } finally {
    await s.close();
  }
}

it("launches a boosted race car high off the curved kicker and lands it on its lane", async () => {
  const run = await boostedRun("rally-hatchback", "kicker");
  // The lip tops out at 48px; the car keeps rising well above it.
  expect(run.peak).toBeGreaterThan(90);
  expect(run.lowestUp).toBeGreaterThan(0.6);
  expect(run.x).toBeGreaterThanOrEqual(1600);
  expect(Math.abs(run.y - JUMP_LANES.kicker)).toBeLessThan(32);
}, 60_000);

it("lets the slowest race car case the sky jump onto flat ground and keep going", async () => {
  const run = await boostedRun("monster-truck", "sky");
  expect(run.peak).toBeGreaterThan(120);
  expect(run.lowestUp).toBeGreaterThan(0.5);
  expect(run.x).toBeGreaterThanOrEqual(1600);
}, 60_000);
