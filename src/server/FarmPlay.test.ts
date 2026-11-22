import { expect, it, vi } from "vitest";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { PropManager } from "../entities/PropManager.js";
import {
  CHICKEN_FEEDER,
  EGG_POSE,
  FARM_EGG,
  FARM_FACTORIES,
  FENCE_STAKES,
  GARDEN_BED,
  GARDEN_FENCE,
  LOG_BUNDLE,
  SCATTERED_CORN,
  WOODLOT_TREE,
} from "../farming/FarmActors.js";
import { CHICK, DOMESTIC_HEN } from "../farming/FarmFowl.js";
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
import { FIRST_EGG_MS, GROW_CHICK_MS, HATCH_MS, LAY_AGAIN_MS, PEN_BIRDS } from "./FarmPoultry.js";
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

it("lays eggs without a rooster and hatches fertile eggs only with a rooster presently inside the pen", () => {
  const { realm, seat, spawn } = fixture();
  const first = seat("local");
  const { entityManager: manager } = realm;
  spawn(CHICKEN_FEEDER, 96, 140);
  manager.spawn(createFauna("chicken", 116, 96));
  const rooster = manager.spawn(createFauna("rooster", 116, 158));
  const actors = (type: string) => manager.entities.filter((entity) => entity.type === type);
  const update = (now: number) => updateFarm(realm, [first], now);
  update(0);
  update(FIRST_EGG_MS);
  const plain = required(actors(FARM_EGG)[0]);
  expect(plain.sprite?.clip).toBe(EGG_POSE.plain);
  expect(plain.farm?.hatchAt).toBeUndefined();

  const moveRooster = (wy: number) => {
    rooster.position.wy = wy;
    manager.spatialHash.update(rooster);
  };
  moveRooster(135);
  const secondLay = FIRST_EGG_MS + LAY_AGAIN_MS;
  update(secondLay);
  const fertile = required(actors(FARM_EGG).find((egg) => egg !== plain));
  expect(fertile.farm?.hatchAt).toBe(secondLay + HATCH_MS);
  const restored = decodeActor(encodeActor(fertile));
  if ("isProp" in restored) throw Error("Expected an egg actor");
  expect(restored.farm).toEqual(fertile.farm);
  expect(restored.sprite?.clip).toBe(EGG_POSE.incubating);

  moveRooster(158);
  const hatchAt = secondLay + HATCH_MS;
  update(hatchAt);
  expect(fertile.sprite?.clip).toBe(EGG_POSE.missingRooster);
  expect(actors(CHICK)).toHaveLength(0);

  moveRooster(135);
  update(hatchAt + 2);
  expect(actors(FARM_EGG)).toEqual([plain]);
  const chick = required(actors(CHICK)[0]);
  expect(chick.farm?.growAt).toBe(hatchAt + 2 + GROW_CHICK_MS);
  update(required(chick.farm?.growAt));
  expect(actors(CHICK)).toHaveLength(0);
  expect(actors(DOMESTIC_HEN)).toHaveLength(2);
});

it("fills only the available place and lets either seat break a waiting egg once", () => {
  const { realm, seat, spawn, act } = fixture();
  const first = seat("local");
  const guest = seat("local#1");
  const { entityManager: manager } = realm;
  spawn(CHICKEN_FEEDER, 96, 140);
  const rooster = manager.spawn(createFauna("rooster", 106, 130));
  for (let i = 0; i < PEN_BIRDS - 2; i++) manager.spawn(createFauna("chicken", 68 + 18 * i, 75));
  const firstEgg = spawn(FARM_EGG, 128, 103);
  const secondEgg = spawn(FARM_EGG, 114, 104);
  firstEgg.farm = secondEgg.farm = { hatchAt: 2_000 };
  updateFarm(realm, [first, guest], 2_000);
  expect(manager.byId.has(firstEgg.id)).toBe(false);
  expect(manager.entities.filter((entity) => entity.type === CHICK)).toHaveLength(1);
  expect(secondEgg.sprite?.clip).toBe(EGG_POSE.crowded);

  act(guest, "break-egg", secondEgg.id, 2_000);
  expect(secondEgg.sprite?.clip).toBe(EGG_POSE.broken);
  expect(() => act(first, "break-egg", secondEgg.id, 2_000)).toThrow("already changed");
  const restored = decodeActor(encodeActor(secondEgg));
  if ("isProp" in restored) throw Error("Expected an egg actor");
  expect(farmAction(restored)).toBeUndefined();
  manager.remove(rooster.id);
  manager.spawn(createFauna("rooster", 106, 130));
  updateFarm(realm, [first, guest], 6_000);
  expect(manager.byId.has(secondEgg.id)).toBe(false);
  expect(manager.entities.filter((entity) => entity.type === CHICK)).toHaveLength(1);
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
