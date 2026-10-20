import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createPlayer } from "../entities/Player.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { VEHICLE_PAINTS } from "../traffic/VehiclePaint.js";

it("places every reviewed paint through normal authority and retains it through durable reload", async () => {
  const session = await ScenarioSession.create({
    version: 1,
    id: "vehicle-paint",
    generation: FLAT_SCENARIO,
    player: createPlayer(0, 0),
    props: [],
  });
  try {
    for (const [model, family] of Object.entries(VEHICLE_PAINTS.families)) {
      for (const paint of family.schemes) {
        session.player.editorEnabled = true;
        session.realm.handleMessage(session.player.clientId, session.player, {
          type: "edit-spawn",
          entityType: `vehicle-v1:${model}`,
          wx: 160,
          wy: 0,
          paintSchemeId: paint.id,
        });
        const state = required([...required(session.realm.traffic).states.values()].at(-1));
        const identity = state.entity.proceduralId;
        expect(state.entity.paintSchemeId).toBe(paint.id);
        expect(state.entity.sprite?.sheetKey).toBe(`${state.entity.type}:paint:${paint.id}`);
        await session.reload();
        const restored = required(
          [...required(session.realm.traffic).states.values()].find(
            (s) => s.entity.proceduralId === identity,
          ),
        );
        expect(restored.entity.paintSchemeId).toBe(paint.id);
        expect(restored.entity.sprite?.sheetKey).toBe(`${restored.entity.type}:paint:${paint.id}`);
        const record = required(session.realm.traffic).snapshot(restored);
        expect(record.paintSchemeId).toBe(paint.id);
        session.realm.entityManager.remove(restored.entity.id);
      }
    }
  } finally {
    await session.close();
  }
});

it("rejects wrong-family network requests and saved paint atomically; legacy records keep original", async () => {
  const session = await ScenarioSession.create({
    version: 1,
    id: "vehicle-paint-invalid",
    generation: FLAT_SCENARIO,
    player: createPlayer(0, 0),
    props: [],
  });
  try {
    session.player.editorEnabled = true;
    const message = {
      type: "edit-spawn",
      entityType: "vehicle-v1:beetle",
      wx: 160,
      wy: 0,
      paintSchemeId: "navy-stripes",
    } as const;
    session.realm.handleMessage(session.player.clientId, session.player, message);
    const traffic = required(session.realm.traffic);
    expect(traffic.states.size).toBe(0);
    const car = required(traffic.place("beetle", 160, 0, undefined, "teal"));
    const record = traffic.snapshot(car);
    session.realm.entityManager.remove(car.entity.id, false);
    expect(() => traffic.prepareRestore([{ ...record, paintSchemeId: "navy-stripes" }])).toThrow(
      "paint",
    );
    expect(traffic.states.size).toBe(0);
    delete record.paintSchemeId;
    expect(() => traffic.prepareRestore([record])).not.toThrow();
  } finally {
    await session.close();
  }
});
