import { expect, it } from "vitest";
import { shoppingRecipe } from "../scenarios/RoadTrafficRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { required } from "../shared/required.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

it("turns a passing compact into the lot, sends its shopper in and back, and rejoins the boulevard", async () => {
  const s = await ScenarioSession.create(shoppingRecipe());
  try {
    const quiet = () => {
      const registry = required(s.realm.vehicleRegistry);
      registry.canSpawn = () => false;
      return registry;
    };
    const identity = required(
      s.realm.entityManager.byId.get(required(s.handles.visitor)),
    ).proceduralId;
    const visitor = () =>
      required([...quiet().states.values()].find((v) => v.entity.proceduralId === identity));
    const shoppers = () =>
      s.realm.entityManager.entities.filter((e) => e.tags?.has("parking-visit"));
    const phases = new Set<string>();
    let shopperSeen = false,
      reloaded = false;
    for (let i = 0; i < 60 * 150 && !phases.has("leaving"); i++) {
      await s.step(idle);
      const phase = visitor().visit?.phase;
      if (phase) phases.add(phase);
      shopperSeen ||= shoppers().length > 0;
      if (phase === "shopping" && !reloaded) {
        reloaded = true;
        await s.reload();
        expect(visitor().visit?.phase).toBe("shopping");
        expect(shoppers()).toHaveLength(0);
      }
    }
    expect(reloaded).toBe(true);
    expect([...phases]).toEqual(
      expect.arrayContaining(["arriving", "parked", "walking", "shopping", "returning", "leaving"]),
    );
    expect(shopperSeen).toBe(true);
    for (let i = 0; i < 60 * 60 && visitor().visit; i++) await s.step(idle);
    expect(visitor().visit).toBeUndefined();
    // Back on the westbound boulevard, driving on as ordinary lane traffic.
    expect(Math.abs(visitor().entity.position.wy - 608)).toBeLessThan(24);
    expect(visitor().route).toBeDefined();
    expect(shoppers()).toHaveLength(0);
  } finally {
    await s.close();
  }
}, 120_000);
