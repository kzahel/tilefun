import { expect, it } from "vitest";
import { createBall } from "../entities/Ball.js";
import { createGhostAngry } from "../entities/Ghost.js";
import { createPlayer } from "../entities/Player.js";
import { FARM_FACTORIES, WOODLOT_TREE } from "../farming/FarmActors.js";
import { AXE, BALL, CORN, handItem, handUses, STICK } from "../inventory/Inventory.js";
import { FLAT_SCENARIO } from "../scenarios/ScenarioRecipe.js";
import { ScenarioSession } from "../scenarios/ScenarioSession.js";
import { required } from "../shared/required.js";
import { holdItem, selectInventory, setInventory } from "./PlayerInventory.js";

const idle = { dx: 0, dy: 0, sprinting: false, jump: false };
const right = { type: "use-item", dirX: 1, dirY: 0, force: 1 } as const;

async function field() {
  const scenario = await ScenarioSession.create({
    version: 1,
    id: "item-use-test",
    generation: FLAT_SCENARIO,
    player: createPlayer(96, 96),
    props: [],
    actors: [],
  });
  for (let i = 0; i < 5; i++) await scenario.step(idle);
  return scenario;
}

it("starts every player with the ball in hand; the use button throws it and counts the use", async () => {
  const scenario = await field();
  try {
    const { realm, player } = scenario;
    expect(handItem(player.player)).toBe(BALL);
    const balls = () => realm.entityManager.entities.filter((e) => e.type === "ball");
    scenario.accept(right);
    expect(balls()).toHaveLength(1);
    expect(handUses(player.player)).toBe(1);
    expect(handItem(player.player)).toBe(BALL);
  } finally {
    await scenario.close();
  }
});

it("swings the stick to bat a loose ball and pop an angry ghost, never throwing a new ball", async () => {
  const scenario = await field();
  try {
    const { realm, player } = scenario;
    const ball = realm.entityManager.spawn(createBall(108, 96));
    const ghost = realm.entityManager.spawn(createGhostAngry(110, 90));
    for (let i = 0; i < 3; i++) await scenario.step(idle);
    holdItem(player, STICK);
    const before = ball.position.wx;
    scenario.accept(right);
    expect(handUses(player.player)).toBe(1);
    expect(ghost.deathTimer).toBeDefined();
    expect(realm.entityManager.entities.some((e) => e.type === "gem")).toBe(true);
    for (let i = 0; i < 10; i++) await scenario.step(idle);
    expect(ball.position.wx - before).toBeGreaterThan(20);
    expect(realm.entityManager.entities.filter((e) => e.type === "ball")).toHaveLength(1);
    // A second swing inside the cooldown does nothing.
    scenario.accept(right);
    expect(handUses(player.player)).toBe(1);
  } finally {
    await scenario.close();
  }
});

it("chops the woodlot tree ahead with the axe, and waves with empty hands", async () => {
  const scenario = await field();
  try {
    const { realm, player } = scenario;
    const tree = realm.entityManager.spawn(required(FARM_FACTORIES[WOODLOT_TREE])(116, 96));
    holdItem(player, AXE);
    scenario.accept(right);
    expect(tree.farm?.chops).toBe(1);
    expect(handUses(player.player)).toBe(1);

    selectInventory(player, { slot: null });
    expect(handItem(player.player)).toBeUndefined();
    await new Promise((resolve) => setTimeout(resolve, 260));
    scenario.accept(right);
    expect(handUses(player.player)).toBe(2);
    expect(player.player.hand).toBe(2 << 5);
    expect(tree.farm?.chops).toBe(1);
  } finally {
    await scenario.close();
  }
});

it("holds still when there are no hens to scatter corn for", async () => {
  const scenario = await field();
  try {
    const { player } = scenario;
    setInventory(player, { slots: [{ item: CORN, count: 2 }], selected: 0 });
    scenario.accept(right);
    expect(handUses(player.player)).toBe(0);
    expect(player.gameplaySession.inventory?.slots[0]?.count).toBe(2);
  } finally {
    await scenario.close();
  }
});
