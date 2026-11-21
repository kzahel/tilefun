import { expect, it, vi } from "vitest";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { PropManager } from "../entities/PropManager.js";
import {
  FARM_FACTORIES,
  FENCE_STAKES,
  GARDEN_BED,
  GARDEN_FENCE,
  LOG_BUNDLE,
  SCATTERED_CORN,
  WOODLOT_TREE,
} from "../farming/FarmActors.js";
import { FARM_GATE, OPEN_FARM_GATE } from "../farming/FarmGate.js";
import { type FarmAction, farmAction } from "../farming/FarmInteraction.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import {
  CORN,
  EMPTY_INVENTORY,
  inventoryFromSave,
  itemCount,
  selectHotbar,
  WOOD,
} from "../inventory/Inventory.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { required } from "../shared/required.js";
import { reuseEntitySnapshot, serializeEntity } from "../shared/serialization.js";
import { createFauna } from "../wildlife/Fauna.js";
import { World } from "../world/World.js";
import { performFarmAction, updateFarm } from "./FarmPlay.js";
import { selectInventory, setInventory } from "./PlayerInventory.js";
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
  expect(guest.gameplaySession.inventory?.slots[0]).toEqual({ item: CORN, count: 1 });
  expect(first.gameplaySession.inventory).toBeUndefined();
  expect(() => act(first, "harvest", plot.id, 17_000)).toThrow("already changed");
  expect(farmAction(plot)).toBe("plant");

  const hen = realm.entityManager.spawn(createFauna("chicken", 115, 75));
  expect(() => act(guest, "feed", hen.id, 17_500)).toThrow("Hold corn");
  expect(guest.gameplaySession.inventory?.slots[0]).toEqual({ item: CORN, count: 1 });
  expect(selectInventory(guest, { step: 1 })).toBe(true);
  expect(guest.player.heldItem).toBe(CORN);
  act(guest, "feed", hen.id, 18_000);
  expect(guest.gameplaySession.inventory).toEqual(EMPTY_INVENTORY);
  expect(guest.player.heldItem).toBeUndefined();
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
  expect(first.gameplaySession.inventory).toBeUndefined();
  updateFarm(realm, [guest, first], 2_400);
  expect(guest.gameplaySession.inventory?.slots[0]).toEqual({ item: WOOD, count: 1 });
  expect(first.gameplaySession.inventory).toBeUndefined();
  expect(farmAction(tree)).toBe("replant");

  const stakes = spawn(FENCE_STAKES, 118, 112);
  act(guest, "fence", stakes.id, 3_000);
  expect(realm.entityManager.byId.has(stakes.id)).toBe(false);
  expect(realm.propManager.props.map((p) => p.type)).toEqual([GARDEN_FENCE]);
  expect(itemCount(required(guest.gameplaySession.inventory), WOOD)).toBe(0);
});

it("migrates stored corn and wood into private slots and cycles through occupied slots and empty hands", () => {
  const { seat } = fixture();
  const player = seat("local");
  const previous = inventoryFromSave(undefined, { corn: 4, wood: 2 });
  expect(previous.slots).toEqual([{ item: CORN, count: 4 }, { item: WOOD, count: 2 }, null, null]);
  setInventory(player, previous);
  expect(player.player.heldItem).toBeUndefined();
  const before = serializeEntity(player.player);
  expect(selectInventory(player, { step: -1 })).toBe(true);
  expect(player.player.heldItem).toBe(WOOD);
  expect(reuseEntitySnapshot(player.player, before).heldItem).toBe(WOOD);
  expect(selectHotbar(required(player.gameplaySession.inventory), { slot: 3 }).selected).toBe(1);
  expect(selectInventory(player, { step: 1 })).toBe(true);
  expect(player.player.heldItem).toBeUndefined();
});

it("changes a gate's saved identity in place and refuses to close over a body", () => {
  const { realm, seat } = fixture();
  const host = seat("local");
  const gate = realm.propManager.add(createProp(FARM_GATE, 96, 122));
  gate.proceduralId = "farm:gate";
  gate.persistentId = "world-gate";
  const open = { type: "farm-action", action: "open-gate", propId: gate.id } as const;
  const close = { ...open, action: "close-gate" } as const;
  performFarmAction(realm, host, open);
  expect(gate).toMatchObject({ type: OPEN_FARM_GATE, proceduralId: "farm:gate", collider: null });
  expect(decodeActor(encodeActor(gate)).type).toBe(OPEN_FARM_GATE);
  expect(() => performFarmAction(realm, host, open)).toThrow("already changed");
  host.player.position.wy = 122;
  expect(() => performFarmAction(realm, host, close)).toThrow("Clear the gateway");
  host.player.position.wy = 96;
  performFarmAction(realm, host, close);
  expect(gate.type).toBe(FARM_GATE);
  expect(gate.collider).not.toBeNull();
});
