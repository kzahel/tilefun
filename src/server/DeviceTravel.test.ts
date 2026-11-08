import { afterEach, describe, expect, it, vi } from "vitest";
import { TILE_SIZE } from "../config/constants.js";
import { aabbsOverlap, getEntityAABB } from "../entities/collision.js";
import { DECK_Z, treeHousePoint, treeHouseProp } from "../entities/TreeHouse.js";
import { CURRENT_REGIONAL_VERSION } from "../generation/GenerationDescriptor.js";
import { buildingDoor } from "../interiors/BuildingDoors.js";
import { exteriorEntrance } from "../interiors/GameplayInterior.js";
import { PLAYER_LOCATIONS_STORE, PlayerLocationStore } from "../persistence/PlayerLocationStore.js";
import { teleportBody } from "../physics/PhysicalEdits.js";
import { CollisionFlag } from "../world/TileRegistry.js";
import type { PlayerSession } from "./PlayerSession.js";
import { Realm } from "./Realm.js";
import {
  join,
  play,
  remote,
  sessionOf,
  start,
  step,
  stopDevices,
  where,
} from "./test/DeviceHarness.js";

// Party travel (226 slice 4b-iii): a device's seats go through doors, between worlds and
// out to the lobby together, led by whichever seat asks, end to end through the codec.

afterEach(async () => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  await stopDevices();
});

const box = (s: PlayerSession) => {
  const collider = s.player.collider;
  if (!collider) throw Error("no collider");
  return getEntityAABB(s.player.position, collider);
};
const tilesApart = (a: PlayerSession, b: PlayerSession) =>
  Math.hypot(
    a.player.position.wx - b.player.position.wx,
    a.player.position.wy - b.player.position.wy,
  ) / TILE_SIZE;

/** Every seat arrived in `realmId`, separately and beside the leader. */
function expectParty(realmId: string, leader: PlayerSession, followers: PlayerSession[]) {
  const party = [leader, ...followers];
  expect(party.map((s) => [s.realmId, s.transitioning])).toEqual(party.map(() => [realmId, false]));
  for (const follower of followers) expect(tilesApart(follower, leader)).toBeLessThan(3);
  for (const [i, a] of party.entries())
    for (const b of party.slice(i + 1)) expect(aabbsOverlap(box(a), box(b))).toBe(false);
}

describe("party travel", () => {
  it("moves a device's seats together, with one reply and each seat's own new body", async () => {
    const device = await start({ worlds: ["other"] });
    const { server, transport, host } = device;
    const guests = [await join(device, 1), await join(device, 2), await join(device, 3)];
    const [g1, g2, g3] = guests;
    if (!g1 || !g2 || !g3) throw Error("no guests");
    const other = await remote(device, "dev-b");

    transport.send("local", { type: "join-realm", requestId: 7, worldId: "other" });
    await server.settle();
    expectParty("other", host, [g1, g2, g3]);
    // On open ground each follower takes its own side of the leader, in seat order.
    const { wx, wy } = where(host);
    expect([g1, g2, g3].map(where)).toEqual([
      { wx: wx + TILE_SIZE, wy },
      { wx: wx - TILE_SIZE, wy },
      { wx, wy: wy + TILE_SIZE },
    ]);
    expect(other.realmId).toBe("test"); // Another device stays.
    // One reply for the device; each guest hears only its own body, in its envelope.
    expect(transport.messages("local", "realm-joined")).toEqual([
      expect.objectContaining({ requestId: 7, worldId: "other" }),
    ]);
    expect(transport.messages("local", "player-assigned").at(-1)?.entityId).toBe(host.player.id);
    for (const guest of [g1, g2, g3]) {
      expect(transport.seatMessages("local", guest.seat, "realm-joined")).toEqual([]);
      expect(transport.seatMessages("local", guest.seat, "player-assigned")).toEqual([
        { type: "player-assigned", entityId: guest.player.id },
      ]);
    }
    // One player count per world, never one per seat.
    const counts = transport.messages("dev-b", "realm-player-count").slice(-2);
    expect(counts).toEqual([
      expect.objectContaining({ worldId: "test", count: 1 }),
      expect.objectContaining({ worldId: "other", count: 4 }),
    ]);
    server.broadcasting = true;
    server.tick(1 / 60);
    expect(
      transport
        .messages("local", "frame")
        .at(-1)
        ?.seats?.map((s) => s.seat),
    ).toEqual([0, 1, 2, 3]);
    const locations = device.stores.get(PLAYER_LOCATIONS_STORE);
    const savedRealm = async (id: string) =>
      ((await locations?.get("players", id)) as { realmId?: string } | undefined)?.realmId;
    expect(await savedRealm("local")).toBe("other");

    // A guest's request leads the device back; the reply goes to that guest's envelope.
    transport.send("local", {
      type: "seat",
      seat: 2,
      message: { type: "join-realm", requestId: 8, worldId: "test" },
    });
    await server.settle();
    expectParty("test", g2, [host, g1, g3]);
    expect(transport.seatMessages("local", 2, "realm-joined")).toEqual([
      expect.objectContaining({ requestId: 8, worldId: "test" }),
    ]);
    expect(transport.messages("local", "realm-joined")).toHaveLength(1);
    expect(transport.messages("local", "player-assigned").at(-1)?.entityId).toBe(host.player.id);
    // Seat 0 followed, so the device's saved place moved with it.
    expect(await savedRealm("local")).toBe("test");
  });

  it("puts every seat back with its own body when one seat's arrival or commit fails", async () => {
    const device = await start({ worlds: ["other"] });
    const { server, transport, host } = device;
    transport.send("local", { type: "identify", displayName: "Host", profileId: "host-profile" });
    const g1 = await join(device, 1);
    const g2 = await join(device, 2);
    if (!g1 || !g2) throw Error("no guests");
    const party = [host, g1, g2];
    const before = party.map((s) => ({ id: s.player.id, at: where(s) }));
    const expectHome = () => {
      expect(party.map((s) => [s.realmId, s.transitioning, s.player.id, where(s)])).toEqual(
        before.map(({ id, at }) => ["test", false, id, at]),
      );
      const bodies = server.entityManager.entities.filter((e) => e.type === "player");
      expect(bodies.map((e) => e.id).sort()).toEqual(before.map((b) => b.id).sort());
    };

    // The second seat cannot arrive after the leader already has.
    const addPlayer = Realm.prototype.addPlayer;
    let adds = 0;
    vi.spyOn(Realm.prototype, "addPlayer").mockImplementation(function (this: Realm, ...args) {
      return ++adds === 2 ? Promise.reject(Error("no room")) : addPlayer.apply(this, args);
    });
    transport.send("local", { type: "join-realm", requestId: 7, worldId: "other" });
    await server.settle();
    expect(transport.messages("local", "request-error").at(-1)).toMatchObject({
      requestId: 7,
      message: "no room",
    });
    expect(adds).toBe(2);
    expectHome();
    vi.restoreAllMocks();

    // Every seat arrived, but the device's location could not be committed.
    const save = vi.spyOn(PlayerLocationStore.prototype, "save");
    save.mockRejectedValueOnce(Error("disk full"));
    transport.send("local", { type: "join-realm", requestId: 8, worldId: "other" });
    await server.settle();
    expect(transport.messages("local", "request-error").at(-1)).toMatchObject({
      requestId: 8,
      message: "disk full",
    });
    expectHome();
    vi.restoreAllMocks();

    transport.send("local", { type: "join-realm", requestId: 9, worldId: "other" });
    await server.settle();
    expectParty("other", host, [g1, g2]);
  });

  it("takes the device to the lobby and brings every seat into the next realm it joins", async () => {
    const device = await start();
    const { server, transport } = device;
    const seat0 = await remote(device, "dev-b");
    const guest = await join(device, 1, "dev-b");
    if (!guest) throw Error("no guest");
    // A seat still arriving holds its device's travel.
    transport.send("dev-b", { type: "join-seat", requestId: 8, seat: 2 });
    transport.send("dev-b", { type: "leave-realm", requestId: 9 });
    transport.send("dev-b", { type: "join-realm", requestId: 10, worldId: "test" });
    await server.settle();
    expect(
      transport.messages("dev-b", "request-error").map((e) => [e.requestId, e.message]),
    ).toEqual([
      [9, "A realm transition is already running."],
      [10, "A realm transition is already running."],
    ]);
    transport.send("dev-b", { type: "leave-seat", requestId: 11, seat: 2 });
    guest.gameplaySession.gemsCollected = 2;

    // Any seat may lead the device out.
    transport.send("dev-b", {
      type: "seat",
      seat: 1,
      message: { type: "leave-realm", requestId: 3 },
    });
    await server.settle();
    expect([seat0.realmId, guest.realmId]).toEqual([null, null]);
    expect(transport.seatMessages("dev-b", 1, "realm-left")).toHaveLength(1);
    expect(transport.messages("dev-b", "realm-left")).toEqual([]);
    expect(transport.messages("local", "realm-player-count").at(-1)).toMatchObject({ count: 1 });
    expect(server.entityManager.entities.filter((e) => e.type === "player")).toHaveLength(1);

    // Seat 0 resumes its saved place; the guest follows with its own progress, not seat 0's.
    transport.send("dev-b", { type: "join-realm", requestId: 4, worldId: "test", resume: true });
    await server.settle();
    expectParty("test", seat0, [guest]);
    expect(guest.gameplaySession.gemsCollected).toBe(2);
    expect(transport.messages("dev-b", "realm-joined").map((m) => m.requestId)).toEqual([1, 4]);
    expect(transport.seatMessages("dev-b", 1, "realm-joined")).toEqual([]);
    expect(transport.seatMessages("dev-b", 1, "player-assigned").at(-1)?.entityId).toBe(
      guest.player.id,
    );

    // A guest's resume is the device's: seat 0 leads back to its saved place, and each seat
    // hears its new body once.
    const saved = where(seat0);
    teleportBody(seat0.player, { wx: saved.wx + 20 * TILE_SIZE, wy: saved.wy, wz: 0 });
    transport.send("dev-b", { type: "leave-realm", requestId: 5 });
    await server.settle();
    const assigned = [
      transport.messages("dev-b", "player-assigned").length,
      transport.seatMessages("dev-b", 1, "player-assigned").length,
    ];
    transport.send("dev-b", {
      type: "seat",
      seat: 1,
      message: { type: "join-realm", requestId: 6, worldId: "test", resume: true },
    });
    await server.settle();
    expectParty("test", seat0, [guest]);
    expect(where(seat0)).toEqual(saved);
    expect(transport.seatMessages("dev-b", 1, "realm-joined").map((m) => m.requestId)).toEqual([6]);
    expect([
      transport.messages("dev-b", "player-assigned").length,
      transport.seatMessages("dev-b", 1, "player-assigned").length,
    ]).toEqual(assigned.map((n) => n + 1));
  });

  it("brings a dormant guest back beside seat 0 when seat 0 travelled while it was away", async () => {
    const device = await start({ worlds: ["other"] });
    const { server, transport } = device;
    const seat0 = await remote(device, "dev-b");
    const guest = await join(device, 1, "dev-b");
    if (!guest) throw Error("no guest");
    transport.disconnect("dev-b");
    transport.connect("dev-b");
    await server.settle();
    // Seat 0 travels alone: a dormant seat is no part of its device's party.
    transport.send("dev-b", { type: "join-realm", requestId: 2, worldId: "other" });
    await server.settle();
    expect([seat0.realmId, guest.realmId]).toEqual(["other", "test"]);
    transport.send("dev-b", {
      type: "player-input",
      seq: 4,
      dx: 0,
      dy: 0,
      sprinting: false,
      jump: false,
    });
    server.tick(1 / 60);

    expect(await join(device, 1, "dev-b")).toBe(guest);
    expectParty("other", seat0, [guest]);
    expect(guest.lastProcessedInputSeq).toBe(4);
    expect(server.isDormant("dev-b#1")).toBe(false);
  });

  it("moves each device out of a deleted world as one party, and dormant seats alone", async () => {
    const device = await start({ worlds: ["other"] });
    const { server, transport, host } = device;
    const guest = await join(device, 1);
    const b = await remote(device, "dev-b");
    const asleep = await remote(device, "dev-c");
    const asleepGuest = await join(device, 1, "dev-c");
    const back = await remote(device, "dev-d");
    const notBack = await join(device, 1, "dev-d");
    if (!guest || !asleepGuest || !notBack) throw Error("no guests");
    for (const id of ["local", "dev-b", "dev-c", "dev-d"])
      transport.send(id, { type: "join-realm", requestId: 2, worldId: "other" });
    await server.settle();
    // dev-c is away; dev-d is back, but has not seated its guest again.
    transport.disconnect("dev-c");
    transport.disconnect("dev-d");
    transport.connect("dev-d");
    await server.settle();
    const everyone = [host, guest, b, asleep, asleepGuest, back, notBack];
    expect(everyone.map((s) => s.realmId)).toEqual(Array(7).fill("other"));

    const loaded = transport.messages("local", "world-loaded").length;
    await server.deleteWorld("other");
    expectParty("test", host, [guest]);
    expect(everyone.map((s) => s.realmId)).toEqual(Array(7).fill("test"));
    expect(server.isDormant("dev-d#1")).toBe(true);
    expect(transport.messages("local", "world-loaded").slice(loaded)).toEqual([
      expect.objectContaining({ worldId: "test", cameraX: host.cameraX }),
    ]);
    expect(transport.seatMessages("local", 1, "world-loaded")).toEqual([]);
    expect(transport.seatMessages("local", 1, "player-assigned").at(-1)?.entityId).toBe(
      guest.player.id,
    );
    expect(transport.messages("dev-b", "world-loaded")).toHaveLength(1);
    expect(transport.messages("dev-b", "player-assigned").at(-1)?.entityId).toBe(b.player.id);
    // A returned device hears nothing for the guest it has not seated again (5-i review).
    expect(transport.messages("dev-d", "seat")).toEqual([]);
  });

  it("sends a device to the lobby once when a deleted world has no fallback", async () => {
    const device = await start();
    const { server, transport, host } = device;
    const guest = await join(device, 1);
    if (!guest) throw Error("no guest");
    await server.deleteWorld("test");
    expect([host.realmId, guest.realmId]).toEqual([null, null]);
    expect(transport.messages("local", "realm-left")).toEqual([
      { type: "realm-left", requestId: 0 },
    ]);
    expect(transport.seatMessages("local", 1, "realm-left")).toEqual([]);
  });

  it("brings followers and a joining guest onto the deck their leader stands on, and not under it (5-ii-c)", async () => {
    const device = await start();
    const { server, transport } = device;
    // dev-b's device plays by a tree house; the local device keeps the world loaded.
    const seat0 = await remote(device, "dev-b");
    const { wx, wy } = seat0.player.position;
    const feet = { wx: wx + 10 * TILE_SIZE + 8, wy: wy + 40 };
    server.propManager.add(treeHouseProp(feet.wx, feet.wy));
    const deck = (x: number, y: number) => treeHousePoint(feet.wx, feet.wy, x, y);
    const height = (s: PlayerSession) => [s.player.wz, s.player.groundZ];
    const cabin = deck(64, 136);
    teleportBody(seat0.player, { ...cabin, wz: DECK_Z });

    // A guest joining beside seat 0 stands on the deck one tile over, not on the ground.
    const guest = await join(device, 1, "dev-b");
    if (!guest) throw Error("no guest");
    expect(where(guest)).toEqual({ wx: cabin.wx + TILE_SIZE, wy: cabin.wy });
    expect(height(guest)).toEqual([DECK_Z, DECK_Z]);
    expect(guest.gameplaySession.lastSafePosition).toEqual({ ...where(guest), wz: DECK_Z });

    // The device resumes seat 0's saved place in the cabin: the follower joins it there.
    const resumeAt = async (place: { wx: number; wy: number }) => {
      teleportBody(seat0.player, { ...place, wz: DECK_Z });
      teleportBody(guest.player, { wx: wx - 4 * TILE_SIZE, wy, wz: 0 });
      await server.flushAsync();
      transport.send("dev-b", { type: "leave-realm", requestId: 2 });
      await server.settle();
      transport.send("dev-b", { type: "join-realm", requestId: 3, worldId: "test", resume: true });
      await server.settle();
      expectParty("test", seat0, [guest]);
      expect([where(seat0), height(seat0)]).toEqual([place, [DECK_Z, DECK_Z]]);
    };
    await resumeAt(cabin);
    expect(where(guest)).toEqual({ wx: cabin.wx + TILE_SIZE, wy: cabin.wy });
    expect(height(guest)).toEqual([DECK_Z, DECK_Z]);

    // Over water (a pond under the tree house), the deck still carries them.
    const pond = vi.spyOn(server.world, "getCollision").mockReturnValue(CollisionFlag.Water);
    await resumeAt(cabin);
    expect([where(guest), height(guest)]).toEqual([
      { wx: cabin.wx + TILE_SIZE, wy: cabin.wy },
      [DECK_Z, DECK_Z],
    ]);
    pond.mockRestore();

    // Where the deck ends beside the porch, the follower stands on the ground past its edge.
    const porch = deck(104, 136);
    await resumeAt(porch);
    expect(where(guest)).toEqual({ wx: porch.wx + TILE_SIZE, wy: porch.wy });
    expect(height(guest)).toEqual([0, 0]);
    expect(guest.gameplaySession.lastSafePosition).toEqual(where(guest));

    // Seat 0 jumping on the ground by the deck's west edge is not raised: a guest joining
    // there stays on the ground.
    transport.send("dev-b", { type: "leave-seat", requestId: 4, seat: 1 });
    await server.settle();
    teleportBody(seat0.player, { ...deck(16, 136), wz: 0 });
    seat0.player.wz = DECK_Z - 2;
    const jumper = await join(device, 1, "dev-b");
    expect(jumper && height(jumper)).toEqual([0, 0]);
  });

  it("lets transfers in progress settle before a deleted world's devices leave (5-ii-c)", async () => {
    const device = await start({ worlds: ["other"] });
    const { server, transport, host } = device;
    const guest = await join(device, 1);
    const leaver = await remote(device, "dev-b");
    const leaverGuest = await join(device, 1, "dev-b");
    const arriver = await remote(device, "dev-c");
    if (!guest || !leaverGuest) throw Error("no guests");
    for (const id of ["local", "dev-b"])
      transport.send(id, { type: "join-realm", requestId: 2, worldId: "other" });
    await server.settle();

    // dev-b's device is on its way out of "other" and dev-c's on its way in, both held
    // reading their saved progress, when "other" is deleted.
    const gates = new Map<string, () => void>();
    const held = new Map(
      ["dev-b", "dev-c"].map((id) => [id, new Promise<void>((done) => gates.set(id, done))]),
    );
    const prepare = Realm.prototype.preparePlayer;
    vi.spyOn(Realm.prototype, "preparePlayer").mockImplementation(async function (
      this: Realm,
      session,
    ) {
      await held.get(session.connectionId);
      return prepare.call(this, session);
    });
    transport.send("dev-b", { type: "join-realm", requestId: 3, worldId: "test" });
    transport.send("dev-c", { type: "join-realm", requestId: 3, worldId: "other" });
    await vi.waitFor(() =>
      expect([leaver, arriver].map((s) => s.transitioning)).toEqual([true, true]),
    );
    const deleting = server.deleteWorld("other");
    const pause = () => new Promise((done) => setTimeout(done, 20));
    await pause();
    // Nobody moves while a transfer is in progress, even one not yet in the deleted world.
    const realmsOf = () => [host, guest, leaver, arriver].map((s) => s.realmId);
    expect(realmsOf()).toEqual(["other", "other", "other", "test"]);
    gates.get("dev-b")?.();
    await pause();
    expect(realmsOf()).toEqual(["other", "other", "test", "test"]);
    gates.get("dev-c")?.();
    // Before, a travelling seat refused its device's move and stopped the deletion.
    await expect(deleting).resolves.toBeUndefined();
    await server.settle();
    expect([host, guest, leaver, leaverGuest, arriver].map((s) => s.realmId)).toEqual(
      Array(5).fill("test"),
    );
    expectParty("test", host, [guest]);
    expect(transport.messages("local", "world-loaded").at(-1)).toMatchObject({ worldId: "test" });
    // dev-b finished its own trip, and the deletion did not move it again.
    expectParty("test", leaver, [leaverGuest]);
    expect(transport.messages("dev-b", "realm-joined").at(-1)).toMatchObject({ requestId: 3 });
    expect(transport.messages("dev-b", "world-loaded")).toEqual([]);
    // dev-c arrived in "other", then moved on with the others.
    expect(transport.messages("dev-c", "world-loaded").at(-1)).toMatchObject({ worldId: "test" });
  });

  it("seats a guest clear of the car its host drives", async () => {
    const device = await start();
    const { server, transport, host } = device;
    const { wx, wy } = host.player.position;
    transport.send("local", {
      type: "edit-spawn",
      entityType: "vehicle-v1:compact-1",
      wx: wx + 40,
      wy,
    });
    await server.settle();
    const car = server.entityManager.entities.find((e) => e.type === "vehicle-v1:compact-1");
    if (!car?.collider) throw Error("no car");
    transport.send("local", { type: "set-editor-mode", enabled: false });
    transport.send("local", { type: "enter-vehicle", requestId: 3, entityId: car.id });
    await server.settle();
    expect(host.gameplaySession.mountId).toBe(car.id);
    const carBox = getEntityAABB(car.position, car.collider);
    const beside = { wx: host.player.position.wx + TILE_SIZE, wy: host.player.position.wy };
    const guest = await join(device, 1);
    if (!guest?.player.collider) throw Error("no guest");
    // The tile beside the host, where a guest arrives, is under the car.
    expect(aabbsOverlap(getEntityAABB(beside, guest.player.collider), carBox)).toBe(true);
    expect(aabbsOverlap(box(guest), carBox)).toBe(false);
    expect(tilesApart(guest, host)).toBeLessThan(5);

    // The device travels back to where seat 0 boarded: the car stays parked, and the guest
    // following seat 0 keeps off it too.
    const generation = server.worldGeneration;
    const counted = transport.messages("local", "realm-player-count").length;
    transport.send("local", {
      type: "load-world",
      requestId: 4,
      worldId: "test",
      arrival: { x: wx / TILE_SIZE, y: wy / TILE_SIZE, generation },
    });
    await server.settle();
    expect(where(host)).toEqual({ wx, wy });
    // A trip within one world reports its count once.
    expect(transport.messages("local", "realm-player-count").slice(counted)).toEqual([
      { type: "realm-player-count", worldId: "test", count: 2 },
    ]);
    const parked = getEntityAABB(car.position, car.collider);
    expect(aabbsOverlap(getEntityAABB(beside, guest.player.collider), parked)).toBe(true);
    expect(aabbsOverlap(box(guest), parked)).toBe(false);
    expect(tilesApart(guest, host)).toBeLessThan(5);
  });

  it("keys guests' saved data under seat 0's profile and saves no location for them", async () => {
    const device = await start({ worlds: ["other"] });
    const { server, transport, stores } = device;
    transport.send("local", { type: "identify", displayName: "Host", profileId: "host-profile" });
    const guest = await join(device, 1);
    await remote(device, "dev-b");
    const anonymous = await join(device, 1, "dev-b");
    if (!guest || !anonymous) throw Error("no guests");
    const second = await join(device, 2);
    if (!second) throw Error("no second guest");
    expect([guest.persistId, anonymous.persistId]).toEqual(["host-profile#1", "dev-b#1"]);
    guest.gameplaySession.gemsCollected = 3;
    second.gameplaySession.gemsCollected = 5;
    transport.send("local", { type: "join-realm", requestId: 2, worldId: "other" });
    await server.settle();
    await server.flushAsync();

    const world = stores.get("test");
    const players = async (ids: string[]) =>
      Promise.all(ids.map(async (id) => (await world?.get("players", id)) !== undefined));
    expect(await players(["host-profile", "host-profile#1", "dev-b#1", "local#1"])).toEqual([
      true,
      true,
      true,
      false,
    ]);
    const locations = stores.get(PLAYER_LOCATIONS_STORE);
    const located = async (ids: string[]) =>
      Promise.all(ids.map(async (id) => (await locations?.get("players", id)) !== undefined));
    expect(
      await located(["host-profile", "dev-b", "host-profile#1", "local#1", "dev-b#1"]),
    ).toEqual([true, true, false, false, false]);
    expect(sessionOf(server, "local#1")?.realmId).toBe("other");

    // Back in the first world, each guest's progress there returns from its own record.
    transport.send("local", { type: "join-realm", requestId: 3, worldId: "test" });
    await server.settle();
    expect([guest, second].map((s) => s.gameplaySession.gemsCollected)).toEqual([3, 5]);

    // The key is pinned when a guest is seated: a later profile does not orphan its records.
    transport.send("dev-b", { type: "identify", displayName: "B", profileId: "late-profile" });
    expect([sessionOf(server, "dev-b")?.persistId, anonymous.persistId]).toEqual([
      "late-profile",
      "dev-b#1",
    ]);
    // A profile id that could pose as another profile's guest is ignored.
    transport.connect("dev-c", { profileId: "host-profile#1", displayName: "C" });
    await server.settle();
    transport.send("dev-c", { type: "identify", displayName: "C", profileId: "host-profile#2" });
    expect(sessionOf(server, "dev-c")).toMatchObject({ profileId: null, persistId: "dev-c" });
  });
});

/** The device at an apartment's street door in a regional city. */
async function atApartmentDoor() {
  const generation = {
    type: "regional",
    version: CURRENT_REGIONAL_VERSION,
    seed: 2026,
    preset: "temperate-v1",
  } as const;
  const device = await start({ worlds: [{ id: "city", generation }] });
  const { server } = device;
  await server.loadWorld("city", { x: 300, y: 519, generation });
  const prop = server.propManager.props.find(
    (p) => p.type.startsWith("prop-city-dense-v1-condo") && p.proceduralId,
  );
  const door = prop && exteriorEntrance(prop);
  if (!prop?.proceduralId || !door) throw Error("no apartment door");
  await server.loadWorld("city", { x: door.wx / TILE_SIZE, y: door.wy / TILE_SIZE, generation });
  return { device, featureId: prop.proceduralId, door };
}

describe("party travel through building doors", () => {
  it("walks the leader alone through a door while its follower waits, then holds both until the walk ends (5-ii-c)", async () => {
    const { device, featureId, door } = await atApartmentDoor();
    const { server, transport, host } = device;
    transport.send("local", { type: "set-editor-mode", enabled: false });
    const guest = await join(device, 1);
    if (!guest) throw Error("no guest");
    teleportBody(host.player, { ...door, wz: 0 });
    teleportBody(guest.player, { wx: door.wx + 6 * TILE_SIZE, wy: door.wy + 3 * TILE_SIZE, wz: 0 });
    const toDoor = () => [
      { seat: 0, movement: step(0, -1) },
      { seat: 1, movement: step(1, 0) },
    ];
    // Seat 0 walks into the doorway (its approach) and asks to walk through.
    play(device, "local", 1, 1, toDoor);
    teleportBody(host.player, { ...door, wz: 0 });
    const away = where(guest);
    transport.send("local", { type: "enter-building", requestId: 5, featureId, walkThrough: true });

    // Seat 0 departs alone; the guest's envelope carries a copy, as another player's walk.
    await vi.waitFor(() => expect(transport.messages("local", "door-motion")).toHaveLength(1));
    expect(transport.messages("local", "door-motion")[0]).toMatchObject({
      phase: "depart",
      self: true,
      actorClientId: "local",
    });
    expect(transport.seatMessages("local", 1, "door-motion")).toEqual([
      expect.objectContaining({ phase: "depart", self: false, actorClientId: "local" }),
    ]);
    // During the walk both seats are travelling, still outside, and the guest's walking
    // moves nobody.
    expect([host.transitioning, guest.transitioning, guest.realmId]).toEqual([true, true, "city"]);
    play(device, "local", 2, 8, toDoor);
    expect(where(guest)).toEqual(away);
    await server.settle();

    // Both arrive: the reply and the leader's walk in for seat 0, the guest's new body and
    // a copy of that walk in its envelope.
    const inside = transport.messages("local", "realm-joined").at(-1);
    expect(inside?.requestId).toBe(5);
    const roomId = inside?.worldId ?? "";
    expectParty(roomId, host, [guest]);
    expect(transport.seatMessages("local", 1, "player-assigned").at(-1)?.entityId).toBe(
      guest.player.id,
    );
    expect(transport.messages("local", "door-motion").at(-1)).toMatchObject({
      phase: "arrive",
      self: true,
    });
    expect(transport.seatMessages("local", 1, "door-motion").at(-1)).toMatchObject({
      phase: "arrive",
      self: false,
      actorClientId: "local",
    });
    // Until the walk in ends, the guest neither moves nor leads the device back out. The
    // clock stops here, so a slow machine cannot outlast the walk.
    vi.useFakeTimers({ toFake: ["Date"], now: Date.now() });
    expect(guest.doorArrivalUntil).toBeGreaterThan(Date.now());
    const arrived = where(guest);
    play(device, "local", 9, 12, toDoor);
    expect(where(guest)).toEqual(arrived);
    const interior = server.worldInterior;
    if (!interior) throw Error("no interior");
    teleportBody(guest.player, { ...buildingDoor(interior, "street").inside, wz: 0 });
    play(device, "local", 13, 13, () => [
      { seat: 0, movement: step(0, 0) },
      { seat: 1, movement: step(0, 1) },
    ]);
    transport.send("local", {
      type: "seat",
      seat: 1,
      message: { type: "exit-building", requestId: 6, walkThrough: true },
    });
    await server.settle();
    expect(transport.seatMessages("local", 1, "request-error").at(-1)).toMatchObject({
      requestId: 6,
      message: "Walk toward the doorway to enter.",
    });
    expect([host.realmId, guest.realmId]).toEqual([roomId, roomId]);
  });

  it("lets either seat lead the device through a door, without the leader's door checks for the others", async () => {
    const { device, featureId, door } = await atApartmentDoor();
    const { server, transport, host } = device;
    const guest = await join(device, 1);
    if (!guest) throw Error("no guest");
    // The guest stands well away from the door; only the leader is checked.
    teleportBody(guest.player, { wx: door.wx + 6 * TILE_SIZE, wy: door.wy + 3 * TILE_SIZE, wz: 0 });

    transport.send("local", { type: "enter-building", requestId: 5, featureId });
    await server.settle();
    const inside = transport.messages("local", "realm-joined").at(-1);
    expect(inside?.interior?.featureId).toBe(featureId);
    const roomId = inside?.worldId ?? "";
    expectParty(roomId, host, [guest]);
    expect(guest.returnLocation).toEqual(host.returnLocation);
    expect(transport.seatMessages("local", 1, "realm-joined")).toEqual([]);

    // Seat 0, across the room from the doorway, cannot lead the way out; nobody moves.
    const interior = server.worldInterior;
    if (!interior) throw Error("no interior");
    const doorway = buildingDoor(interior, "street").inside;
    teleportBody(guest.player, { ...doorway, wz: 0 });
    teleportBody(host.player, { wx: doorway.wx, wy: doorway.wy - 4 * TILE_SIZE, wz: 0 });
    transport.send("local", { type: "exit-building", requestId: 6 });
    await server.settle();
    expect(transport.messages("local", "request-error").at(-1)).toMatchObject({
      requestId: 6,
      message: "Return to the interior doorway to leave.",
    });
    expect([host.realmId, guest.realmId, host.transitioning]).toEqual([roomId, roomId, false]);

    // The guest at the doorway leads the way out, and seat 0 follows from across the room.
    transport.send("local", {
      type: "seat",
      seat: 1,
      message: { type: "exit-building", requestId: 7 },
    });
    await server.settle();
    expect(transport.seatMessages("local", 1, "realm-joined").at(-1)?.worldId).toBe("city");
    expectParty("city", guest, [host]);
    const fromDoor = Math.hypot(
      guest.player.position.wx - door.wx,
      guest.player.position.wy - door.wy,
    );
    expect(fromDoor).toBeLessThan(3 * TILE_SIZE);
    expect(transport.messages("local", "realm-joined")).toHaveLength(1);
  });
});
