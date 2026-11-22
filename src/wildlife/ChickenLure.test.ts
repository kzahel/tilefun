import { expect, it } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { FARM_GATE, OPEN_FARM_GATE } from "../farming/FarmGate.js";
import { CORN, handItem, inventoryFromSave } from "../inventory/Inventory.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { performFarmAction } from "../server/FarmPlay.js";
import { setInventory } from "../server/PlayerInventory.js";
import { required } from "../shared/required.js";
import { createFauna } from "./Fauna.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };

it("uses solid gate geometry while leading a hen and saves the moved hen and selected corn", async () => {
  const hen = createFauna("chicken", 96, 74);
  required(hen.fauna).habitatBounds = { minX: 65, maxX: 126, minY: 50, maxY: 116 };
  hen.persistentId = "test-hen";
  const scenario = await ScenarioSession.create({
    version: 1,
    id: "chicken-lure-test",
    generation: FLAT_SCENARIO,
    player: createPlayer(96, 146),
    props: [],
    nativeProps: [{ type: FARM_GATE, wx: 96, wy: 120 }],
    actors: [hen],
  });
  try {
    const { realm, player } = scenario;
    const testHen = required(
      realm.entityManager.entities.find((e) => e.persistentId === "test-hen"),
    );
    const testGate = required(realm.propManager.props.find((p) => p.type === FARM_GATE));
    const inventory = inventoryFromSave(undefined, { corn: 2, wood: 0 });
    setInventory(player, { ...inventory, selected: 0 });
    for (let i = 0; i < 100; i++) await scenario.step(idle);
    expect(testHen.position.wy).toBeGreaterThan(95);
    expect(testHen.position.wy).toBeLessThan(120);
    performFarmAction(realm, player, {
      type: "farm-action",
      action: "open-gate",
      propId: testGate.id,
    });
    for (let i = 0; i < 55; i++) await scenario.step({ ...idle, dy: 0.7 });
    for (let i = 0; i < 100; i++) await scenario.step(idle);
    expect(testHen.position.wy).toBeGreaterThan(140);
    await scenario.reload();
    expect(handItem(scenario.player.player)).toBe(CORN);
    expect(scenario.player.gameplaySession.inventory?.slots[0]?.count).toBe(2);
    expect(
      scenario.realm.propManager.props.find((p) => p.type === OPEN_FARM_GATE)?.collider,
    ).toBeNull();
    const reloaded = required(
      scenario.realm.entityManager.entities.find((e) => e.persistentId === "test-hen"),
    );
    setInventory(scenario.player, { ...inventory, selected: null });
    for (let i = 0; i < 20; i++) await scenario.step(idle);
    expect(reloaded.fauna?.home.wy).toBeGreaterThan(140);
    expect(reloaded.fauna?.habitatBounds).toBeUndefined();
  } finally {
    await scenario.close();
  }
}, 60_000);
