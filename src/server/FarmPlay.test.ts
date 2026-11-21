import { expect, it, vi } from "vitest";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { PropManager } from "../entities/PropManager.js";
import {
  CHICKEN_FEEDER,
  FARM_FACTORIES,
  FENCE_STAKES,
  GARDEN_BED,
  GARDEN_FENCE,
  LOG_BUNDLE,
  SCATTERED_CORN,
  WOODLOT_TREE,
} from "../farming/FarmActors.js";
import { type FarmAction, farmAction } from "../farming/FarmInteraction.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { required } from "../shared/required.js";
import { createFauna } from "../wildlife/Fauna.js";
import { World } from "../world/World.js";
import { performFarmAction, updateFarm } from "./FarmPlay.js";
import { PlayerSession } from "./PlayerSession.js";

function fixture() {
  const world = new World(new FlatStrategy());
  world.getChunk(0, 0);
  const realm = {
    world,
    entityManager: new EntityManager(),
    propManager: new PropManager(),
    records: null,
    savePlayerData: vi.fn(),
  };
  const seat = (id: string) => {
    const player = realm.entityManager.spawn(createPlayer(96, 96));
    const session = new PlayerSession(id, player);
    session.editorEnabled = false;
    return session;
  };
  const spawn = (type: string, wx = 116, wy = 96) =>
    realm.entityManager.spawn(required(FARM_FACTORIES[type])(wx, wy));
  const act = (seat: PlayerSession, action: FarmAction, entityId: number, now: number) =>
    performFarmAction(realm, seat, { type: "farm-action", action, entityId }, now);
  return { realm, seat, spawn, act };
}

it("shares planted growth across seats, restores ripeness and grants a harvest only once", () => {
  const { realm, seat, spawn, act } = fixture();
  const first = seat("local"),
    guest = seat("local#1");
  const plot = spawn(GARDEN_BED);
  act(first, "plant", plot.id, 1_000);
  expect(farmAction(plot)).toBe("water");
  act(guest, "water", plot.id, 2_000);
  expect(farmAction(plot)).toBeUndefined();
  expect(() => act(first, "water", plot.id, 3_000)).toThrow("already changed");
  const loaded = decodeActor(encodeActor(plot));
  if ("isProp" in loaded) throw Error("Expected garden actor");
  expect(farmAction(loaded)).toBe("harvest");
  expect(() => act(first, "harvest", plot.id, 16_999)).toThrow("already changed");
  updateFarm(realm, [first, guest], 17_000);
  act(guest, "harvest", plot.id, 17_000);
  expect(guest.gameplaySession.farmBasket).toEqual({ corn: 1, wood: 0 });
  expect(first.gameplaySession.farmBasket).toBeUndefined();
  expect(() => act(first, "harvest", plot.id, 17_000)).toThrow("already changed");
  expect(farmAction(plot)).toBe("plant");

  const feeder = spawn(CHICKEN_FEEDER);
  expect(() => act(guest, "feed", feeder.id, 17_500)).toThrow("Buff hen");
  expect(guest.gameplaySession.farmBasket?.corn).toBe(1);
  realm.entityManager.spawn(createFauna("chicken", 115, 75));
  act(guest, "feed", feeder.id, 18_000);
  expect(guest.gameplaySession.farmBasket?.corn).toBe(0);
  expect(realm.entityManager.entities.filter((e) => e.type === SCATTERED_CORN)).toHaveLength(3);
});

it("gates chopping on reach, awards a log once and replaces the stakes with a fence", () => {
  const { realm, seat, spawn, act } = fixture();
  const first = seat("local"),
    guest = seat("local#1");
  const tree = spawn(WOODLOT_TREE);
  guest.player.position.wx = 0;
  expect(() => act(guest, "chop", tree.id, 1_000)).toThrow("Move closer");
  act(first, "chop", tree.id, 1_000);
  expect(() => act(first, "chop", tree.id, 1_100)).toThrow("settle");
  act(first, "chop", tree.id, 1_400);
  act(first, "chop", tree.id, 1_800);
  expect(realm.entityManager.entities.filter((e) => e.type === LOG_BUNDLE)).toHaveLength(1);
  guest.player.position = { ...first.player.position };
  updateFarm(realm, [first, guest], 2_399);
  expect(first.gameplaySession.farmBasket).toBeUndefined();
  updateFarm(realm, [guest, first], 2_400);
  expect(guest.gameplaySession.farmBasket).toEqual({ corn: 0, wood: 1 });
  expect(first.gameplaySession.farmBasket).toBeUndefined();
  expect(farmAction(tree)).toBe("replant");

  const stakes = spawn(FENCE_STAKES, 118, 112);
  act(guest, "fence", stakes.id, 3_000);
  expect(realm.entityManager.byId.has(stakes.id)).toBe(false);
  expect(realm.propManager.props.map((p) => p.type)).toEqual([GARDEN_FENCE]);
  expect(guest.gameplaySession.farmBasket?.wood).toBe(0);
});
