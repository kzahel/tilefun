import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { createFrog, FROG_TYPE } from "./Frog.js";
import { roadkillType } from "./Roadkill.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

it("a driven car runs over a small animal in the shared physics scene", async () => {
  // Ahead of the car's nose; the low frog passes under the moving chassis.
  const frog = createFrog(150, 102);
  const s = await ScenarioSession.create({
    version: 1,
    id: "roadkill",
    generation: FLAT_SCENARIO,
    player: createPlayer(100, 140),
    props: [],
    actors: [frog],
    parkedVehicles: [{ name: "car", model: "compact-1", wx: 100, wy: 100, facing: 3 }],
  });
  try {
    for (let tick = 0; tick < 30; tick++) s.tick();
    await s.command({ kind: "enter-vehicle", entityId: s.handles.car ?? -1 });
    const types = () => s.realm.entityManager.entities.map((e) => e.type);
    for (let tick = 0; tick < 120 && types().includes(FROG_TYPE); tick++)
      await s.step({ ...idle, dx: 1 });
    expect(types()).not.toContain(FROG_TYPE);
    expect(types()).toContain(roadkillType(FROG_TYPE));
  } finally {
    await s.close();
  }
});
