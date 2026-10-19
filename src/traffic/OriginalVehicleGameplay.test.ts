import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

it("places, drives and reloads the coupe through the shared Realm and saved traffic codec", async () => {
  const session = await ScenarioSession.create({
    version: 1,
    id: "original-coupe",
    generation: FLAT_SCENARIO,
    player: createPlayer(0, 0),
    props: [],
  });
  try {
    session.player.editorEnabled = true;
    session.realm.handleMessage(session.player.clientId, session.player, {
      type: "edit-spawn",
      entityType: "vehicle-v1:rosso-coupe",
      wx: 160,
      wy: 0,
    });
    const car = required([...required(session.realm.traffic).states.values()][0]);
    expect(car.entity.type).toBe("vehicle-v1:rosso-coupe");
    expect(car.placed).toBe(true);
    const identity = car.entity.proceduralId;
    session.player.editorEnabled = false;
    session.player.player.position = { wx: 160, wy: -16 };
    session.realm.vehicles.enter(session.player, car.entity.id);
    for (let i = 0; i < 100; i++) await session.step({ ...idle, dx: 1 });
    expect(car.entity.position.wx).toBeGreaterThan(300);
    const position = { ...car.entity.position };
    await session.reload();
    const restored = required(
      [...required(session.realm.traffic).states.values()].find(
        (state) => state.entity.proceduralId === identity,
      ),
    );
    expect(restored.entity.type).toBe("vehicle-v1:rosso-coupe");
    expect(restored.entity.position).toEqual(position);
    expect(session.player.player.parentId).toBe(restored.entity.id);
    session.realm.vehicles.exit(session.player);
    for (let i = 0; i < 60; i++) await session.step(idle);
    expect(restored.parked).toBe(true);
    expect(restored.entity.position).toEqual(position);
  } finally {
    await session.close();
  }
});

// Generated-road admission for every original is covered by the independent
// fixture-driven production selector cases in OriginalVehicles.test.ts.
