import { afterEach, describe, expect, it, vi } from "vitest";
import { TILE_SIZE } from "../config/constants.js";
import { devicePacket, type SeatCommand } from "../input/SeatComposer.js";
import { DeviceTransport } from "./DeviceTransport.js";
import type { GameServer } from "./GameServer.js";
import { type PlayerSession, seatSessionId } from "./PlayerSession.js";
import { Realm } from "./Realm.js";
import { MemoryConnections } from "./test/MemoryConnections.js";
import { memoryServer } from "./test/MemoryServer.js";

// Server seats (226 slice 4b-i): several local players on one device connection, end to
// end through the binary codec. Seat 0 is the connection's own player; the others are
// its guests.

const servers: GameServer[] = [];
afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const server of servers.splice(0)) await server.destroy();
});

async function start() {
  const { server, transport } = await memoryServer(new MemoryConnections());
  servers.push(server);
  return { server, transport, host: server.getLocalSession() };
}

type Device = Awaited<ReturnType<typeof start>>;

function sessionOf(server: GameServer, id: string): PlayerSession | undefined {
  return [...server.getSessions()].find((session) => session.clientId === id);
}

/** Join a guest seat and return its session once the arrival settles. */
async function join(
  { server, transport }: Device,
  seat: number,
  connection = "local",
  options: { displayName?: string; playerModel?: string } = {},
) {
  transport.send(connection, { type: "join-seat", requestId: 100 + seat, seat, ...options });
  await server.settle();
  return sessionOf(server, seatSessionId(connection, seat));
}

/** A remote device that joined the test world and plays (editor off). */
async function remote({ server, transport }: Device, id: string) {
  transport.connect(id);
  await server.settle();
  transport.send(id, { type: "join-realm", requestId: 1, worldId: "test" });
  await server.settle();
  transport.send(id, { type: "set-editor-mode", enabled: false });
  const session = sessionOf(server, id);
  if (!session?.realmId) throw Error(`${id} did not join the world`);
  return session;
}

const step = (dx: number, dy: number) => ({ dx, dy, sprinting: false, jump: false });

/** Send one device packet per tick, for sequences `from` through `to`. */
function play(
  { server, transport }: Device,
  connection: string,
  from: number,
  to: number,
  seats: () => SeatCommand[],
) {
  for (let seq = from; seq <= to; seq++) {
    transport.send(connection, devicePacket(seq, seats()).input);
    server.tick(1 / 60);
  }
}

const where = (session: PlayerSession) => ({ ...session.player.position });

describe("server seats on one device connection", () => {
  it("seats a guest of seat 0 beside it, in its realm, without a profile", async () => {
    const device = await start();
    const { server, transport, host } = device;
    transport.send("local", { type: "identify", displayName: "Host", profileId: "host-profile" });
    const guest = await join(device, 1, "local", { displayName: "Guest", playerModel: "person3" });

    expect(transport.messages("local", "seat-joined")).toEqual([
      { type: "seat-joined", requestId: 101, seat: 1, entityId: guest?.player.id },
    ]);
    expect(guest).toMatchObject({
      clientId: "local#1",
      connectionId: "local",
      seat: 1,
      profileId: null,
      displayName: "Guest",
      playerModel: "person3",
      realmId: host.realmId,
      editorEnabled: host.editorEnabled,
    });
    expect(host).toMatchObject({ clientId: "local", connectionId: "local", seat: 0 });
    expect(host.profileId).toBe("host-profile");
    const realmPlayers = server.entityManager.entities.filter((e) => e.type === "player");
    expect(realmPlayers.map((e) => e.id).sort()).toEqual([host.player.id, guest?.player.id].sort());
    const apart = Math.hypot(
      (guest?.player.position.wx ?? 0) - host.player.position.wx,
      (guest?.player.position.wy ?? 0) - host.player.position.wy,
    );
    expect(apart).toBeGreaterThan(8);
    expect(apart).toBeLessThan(40);

    // Connection-wide notices reach the device once, never once per seat.
    server.broadcastChat("Host", "hello");
    expect(transport.messages("local", "chat")).toHaveLength(1);
    expect(transport.messages("local", "realm-player-count").at(-1)).toMatchObject({ count: 2 });
    expect(transport.messages("local", "seat")).toEqual([]);

    for (const [requestId, seat] of [
      [7, 1],
      [8, 0],
      [9, 4],
      [10, 1.5],
    ] as const)
      transport.send("local", { type: "join-seat", requestId, seat });
    await server.settle();
    const errors = transport.messages("local", "request-error");
    expect(errors.map((e) => [e.requestId, e.message])).toEqual([
      [7, "Player 2 is already playing."],
      [8, "Invalid player seat."],
      [9, "Invalid player seat."],
      [10, "Invalid player seat."],
    ]);
    expect([...server.getSessions()]).toHaveLength(2);

    // A seat whose arrival fails is not left behind.
    const home = where(host);
    host.player.position.wx = TILE_SIZE * 2 ** 24;
    transport.send("local", { type: "join-seat", requestId: 11, seat: 2 });
    await server.settle();
    host.player.position = home;
    expect(transport.messages("local", "request-error").at(-1)).toMatchObject({
      requestId: 11,
      message: "Arrival is outside supported coordinates.",
    });
    expect(sessionOf(server, "local#2")).toBeUndefined();
    expect(await join(device, 2)).toMatchObject({ seat: 2, realmId: host.realmId });
  });

  it("moves every seat by its own movement on one sequence; a seat missing from a packet stands still", async () => {
    const device = await start();
    const { transport, host } = device;
    transport.send("local", { type: "set-editor-mode", enabled: false });
    const guest = await join(device, 1);
    if (!guest) throw Error("no guest");
    const hostStart = where(host);
    const guestStart = where(guest);

    play(device, "local", 1, 10, () => [
      { seat: 0, body: host.player.id, movement: step(1, 0) },
      { seat: 1, body: guest.player.id, movement: step(0, 1) },
    ]);
    // A repeated seat keeps its first movement; a seat nobody plays is ignored.
    for (let seq = 11; seq <= 20; seq++) {
      const seats = [
        { seat: 1, ...step(0, 1) },
        { seat: 1, ...step(0, -1) },
        { seat: 3, ...step(-1, 0) },
      ];
      transport.send("local", { type: "player-input", seq, ...step(1, 0), seats });
      device.server.tick(1 / 60);
    }
    expect(sessionOf(device.server, "local#3")).toBeUndefined();
    expect(host.player.position.wx - hostStart.wx).toBeGreaterThan(10);
    expect(Math.abs(host.player.position.wy - hostStart.wy)).toBeLessThan(0.5);
    expect(guest.player.position.wy - guestStart.wy).toBeGreaterThan(10);
    expect(Math.abs(guest.player.position.wx - guestStart.wx)).toBeLessThan(0.5);
    expect([host.lastProcessedInputSeq, guest.lastProcessedInputSeq]).toEqual([20, 20]);

    // Seat 1 drops out of the packets: it stops at once and still acknowledges each tick.
    play(device, "local", 21, 22, () => [{ seat: 0, body: host.player.id, movement: step(1, 0) }]);
    const stopped = where(guest);
    play(device, "local", 23, 40, () => [{ seat: 0, body: host.player.id, movement: step(1, 0) }]);
    expect(guest.player.position.wy).toBeCloseTo(stopped.wy, 3);
    expect(guest.player.position.wx).toBeCloseTo(stopped.wx, 3);
    expect([host.lastProcessedInputSeq, guest.lastProcessedInputSeq]).toEqual([40, 40]);
  });

  it("reads only a seat entry's controls, whatever else untrusted JSON puts in it", async () => {
    const device = await start();
    const { server, transport, host } = device;
    transport.send("local", { type: "identify", displayName: "Host", profileId: "host-profile" });
    transport.send("local", { type: "set-editor-mode", enabled: false });
    const first = await join(device, 1);
    const second = await join(device, 2);
    if (!first || !second) throw Error("no guests");
    const start1 = where(first);
    for (let seq = 1; seq <= 5; seq++) {
      transport.sendJson("local", {
        type: "player-input",
        seq,
        ...step(0, 0),
        seats: [
          { seat: 1, type: "identify", profileId: "host-profile", seq: 99_999, dx: 5, dy: 0 },
          { seat: 2, type: "set-debug", paused: true, dx: "far", jump: "yes" },
        ],
      });
      server.tick(1 / 60);
    }
    expect(host).toMatchObject({ profileId: "host-profile", retired: false });
    expect(transport.messages("local", "kicked")).toEqual([]);
    expect([first.profileId, second.debugPaused]).toEqual([null, false]);
    expect([first, second, host].map((s) => s.lastProcessedInputSeq)).toEqual([5, 5, 5]);
    expect(first.player.position.wx - start1.wx).toBeGreaterThan(3);
    expect(first.inputQueue).toEqual([]);

    // A malformed envelope or seat list is ignored, not thrown.
    transport.sendJson("local", { type: "seat", seat: 1 });
    transport.sendJson("local", { type: "seat", seat: 1, message: null });
    transport.sendJson("local", { type: "player-input", seq: 6, ...step(0, 0), seats: "all" });
    transport.sendJson("local", { type: "player-input", seq: 7, ...step(0, 0), seats: [null] });
    server.tick(1 / 60);
    expect([first, second, host].map((s) => s.lastProcessedInputSeq)).toEqual([7, 7, 7]);

    // Axes are clamped like the binary codec's, and only `true` is a pressed flag.
    transport.sendJson("local", {
      type: "player-input",
      seq: 8,
      ...step(0, 0),
      seats: [
        { seat: 1, dx: 5, dy: -Infinity, relativeDriving: true },
        { seat: 2, dx: -0.5, jump: "yes", sprinting: 1 },
      ],
    });
    expect(first.inputQueue).toEqual([
      { seq: 8, dx: 1, dy: 0, sprinting: false, jump: false, relativeDriving: true },
    ]);
    expect(second.inputQueue).toEqual([{ seq: 8, dx: -0.5, dy: 0, sprinting: false, jump: false }]);
  });

  it("routes a seat's messages and replies in its envelope, and never device messages", async () => {
    const device = await start();
    const { server, transport, host } = device;
    transport.send("local", { type: "identify", displayName: "Host", profileId: "host-profile" });
    const guest = await join(device, 1);
    const hostModel = host.playerModel;

    transport.send("local", {
      type: "seat",
      seat: 1,
      message: { type: "set-player-model", requestId: 5, model: "person3" },
    });
    expect(transport.seatMessages("local", 1, "player-model-set")).toEqual([
      { type: "player-model-set", requestId: 5, model: "person3" },
    ]);
    expect(transport.messages("local", "player-model-set")).toEqual([]);
    expect([guest?.playerModel, host.playerModel]).toEqual(["person3", hostModel]);

    const hostRange = { ...host.visibleRange };
    const range = { minCx: 40, minCy: 41, maxCx: 42, maxCy: 43 };
    transport.send("local", {
      type: "seat",
      seat: 1,
      message: { type: "visible-range", ...range },
    });
    expect([guest?.visibleRange, host.visibleRange]).toEqual([range, hostRange]);

    // A guest's identify names it but never claims (or takes over) a profile.
    transport.send("local", {
      type: "seat",
      seat: 1,
      message: {
        type: "identify",
        displayName: "Kid",
        profileId: "host-profile",
        playerModel: "person5",
      },
    });
    await server.settle();
    expect(guest).toMatchObject({
      displayName: "Kid",
      profileId: null,
      playerModel: "person5",
      retired: false,
    });
    expect(host).toMatchObject({ profileId: "host-profile", retired: false });
    expect(transport.messages("local", "kicked")).toEqual([]);

    // Device messages inside an envelope, and envelopes for seats nobody plays.
    const before = guest?.lastProcessedInputSeq;
    for (const message of [
      { type: "join-seat", requestId: 6, seat: 2 },
      { type: "player-input", seq: 99, ...step(1, 0) },
      { type: "set-debug", paused: true },
      { type: "seat", seat: 1, message: { type: "set-debug", paused: true } },
    ] as const)
      transport.send("local", { type: "seat", seat: 1, message });
    transport.send("local", {
      type: "seat",
      seat: 3,
      message: { type: "set-player-model", requestId: 7, model: "person4" },
    });
    await server.settle();
    // Refusals answer in the seat's envelope, like every other reply to that seat.
    expect(transport.messages("local", "request-error")).toEqual([]);
    expect(transport.seatMessages("local", 1, "request-error")).toEqual([
      { type: "request-error", requestId: 6, message: "Send seat changes for the whole device." },
    ]);
    expect(transport.seatMessages("local", 3, "request-error")).toEqual([
      { type: "request-error", requestId: 7, message: "That player is not playing." },
    ]);
    expect(sessionOf(server, "local#2")).toBeUndefined();
    expect(guest).toMatchObject({ debugPaused: false, lastProcessedInputSeq: before });
    expect(guest?.inputQueue).toEqual([]);
  });

  it("lets a guest leave; the device's own seat cannot, and later packets ignore the seat", async () => {
    const device = await start();
    const { server, transport, host } = device;
    transport.send("local", { type: "set-editor-mode", enabled: false });
    const guest = await join(device, 1);
    if (!guest) throw Error("no guest");
    const guestBody = guest.player.id;

    transport.send("local", { type: "leave-seat", requestId: 3, seat: 1 });
    transport.send("local", { type: "leave-seat", requestId: 4, seat: 0 });
    transport.send("local", { type: "leave-seat", requestId: 5, seat: 2 });
    expect(transport.messages("local", "seat-left")).toEqual([
      { type: "seat-left", requestId: 3, seat: 1 },
    ]);
    expect(transport.messages("local", "request-error").map((e) => e.requestId)).toEqual([4, 5]);
    expect(transport.messages("local", "realm-player-count").at(-1)).toMatchObject({ count: 1 });
    expect(sessionOf(server, "local#1")).toBeUndefined();
    expect(guest.realmId).toBeNull();
    expect(server.entityManager.entities.some((e) => e.id === guestBody)).toBe(false);

    const hostStart = where(host);
    play(device, "local", 1, 10, () => [
      { seat: 0, body: host.player.id, movement: step(1, 0) },
      { seat: 1, body: guestBody, movement: step(0, 1) },
    ]);
    expect(host.player.position.wx - hostStart.wx).toBeGreaterThan(5);
    expect(host.lastProcessedInputSeq).toBe(10);
  });

  it("pauses every seat of a device and never another device", async () => {
    const device = await start();
    const { transport, host } = device;
    transport.send("local", { type: "set-editor-mode", enabled: false });
    const guest = await join(device, 1);
    if (!guest) throw Error("no guest");
    const other = await remote(device, "dev-b");

    // Seat 2 is still arriving when the device pauses; seat 3 joins a paused device.
    transport.send("local", { type: "join-seat", requestId: 2, seat: 2 });
    expect(sessionOf(device.server, "local#2")?.transitioning).toBe(true);
    transport.send("local", { type: "set-debug", paused: true });
    expect([host.debugPaused, guest.debugPaused, other.debugPaused]).toEqual([true, true, false]);
    await device.server.settle();
    expect(sessionOf(device.server, "local#2")?.debugPaused).toBe(true);
    const late = await join(device, 3);
    expect(late?.debugPaused).toBe(true);

    const starts = [where(host), where(guest), where(other)];
    for (let seq = 1; seq <= 15; seq++) {
      transport.send(
        "local",
        devicePacket(seq, [
          { seat: 0, body: host.player.id, movement: step(1, 0) },
          { seat: 1, body: guest.player.id, movement: step(1, 0) },
        ]).input,
      );
      transport.send(
        "dev-b",
        devicePacket(seq, [{ seat: 0, body: other.player.id, movement: step(1, 0) }]).input,
      );
      device.server.tick(1 / 60);
    }
    expect(host.player.position.wx).toBeCloseTo(starts[0]?.wx ?? 0, 3);
    expect(guest.player.position.wx).toBeCloseTo(starts[1]?.wx ?? 0, 3);
    expect(other.player.position.wx - (starts[2]?.wx ?? 0)).toBeGreaterThan(5);
  });

  it("makes every seat dormant when a device disconnects; a returning device rejoins its seats", async () => {
    const device = await start();
    const { server, transport } = device;
    const seat0 = await remote(device, "dev-b");
    const guest = await join(device, 1, "dev-b");
    const unclaimed = await join(device, 2, "dev-b");
    if (!guest || !unclaimed) throw Error("no guests");
    play(device, "dev-b", 1, 5, () => [
      { seat: 0, body: seat0.player.id, movement: step(1, 0) },
      { seat: 1, body: guest.player.id, movement: step(1, 0) },
    ]);
    expect(guest.lastProcessedInputSeq).toBe(5);
    const local = await join(device, 1);

    transport.disconnect("local"); // The local Worker connection never goes dormant.
    expect([server.isDormant("local"), server.isDormant("local#1")]).toEqual([false, false]);

    transport.disconnect("dev-b");
    expect(["dev-b", "dev-b#1", "dev-b#2"].map((id) => server.isDormant(id))).toEqual([
      true,
      true,
      true,
    ]);

    transport.connect("dev-b");
    await server.settle();
    expect(transport.messages("dev-b", "world-loaded")).toHaveLength(1);
    expect([server.isDormant("dev-b"), server.isDormant("dev-b#1")]).toEqual([false, true]);
    // A dormant seat takes no input until its device seats it again.
    transport.send("dev-b", {
      type: "seat",
      seat: 1,
      message: { type: "set-editor-mode", enabled: true },
    });
    expect(guest.editorEnabled).toBe(false);

    // A seat the returning device does not want back can leave while still dormant.
    transport.send("dev-b", { type: "leave-seat", requestId: 8, seat: 2 });
    expect(transport.messages("dev-b", "seat-left").at(-1)).toMatchObject({ requestId: 8 });
    expect(sessionOf(server, "dev-b#2")).toBeUndefined();
    expect(server.entityManager.entities.some((e) => e.id === unclaimed.player.id)).toBe(false);

    const resumed = await join(device, 1, "dev-b");
    expect(resumed).toBe(guest);
    expect(server.isDormant("dev-b#1")).toBe(false);
    expect(guest.lastProcessedInputSeq).toBe(0); // The returning client restarts its sequence.
    expect(transport.messages("dev-b", "seat-joined").at(-1)).toMatchObject({
      seat: 1,
      entityId: guest.player.id,
    });

    // Unclaimed seats expire with their device.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    transport.disconnect("dev-b");
    vi.advanceTimersByTime(60_000);
    expect([sessionOf(server, "dev-b"), sessionOf(server, "dev-b#1")]).toEqual([
      undefined,
      undefined,
    ]);
    const bodies = new Set(server.entityManager.entities.map((e) => e.id));
    expect([bodies.has(seat0.player.id), bodies.has(guest.player.id)]).toEqual([false, false]);
    expect(local && bodies.has(local.player.id)).toBe(true);
  });

  it("keeps a dormant guest's first deadline when its device drops again before claiming it", async () => {
    const device = await start();
    const { server, transport } = device;
    await remote(device, "dev-b");
    await join(device, 1, "dev-b");
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    transport.disconnect("dev-b"); // t = 0: both seats dormant until t = 60 s.
    vi.advanceTimersByTime(50_000);
    transport.connect("dev-b"); // Seat 0 returns; seat 1 stays dormant.
    vi.advanceTimersByTime(5_000);
    transport.disconnect("dev-b"); // t = 55 s: seat 1 is already dormant.
    vi.advanceTimersByTime(1_000);
    transport.connect("dev-b");
    vi.advanceTimersByTime(4_000); // t = 60 s: the old seat 1 expires on its first deadline.
    expect(sessionOf(server, "dev-b#1")).toBeUndefined();

    vi.advanceTimersByTime(10_000);
    const fresh = await join(device, 1, "dev-b");
    expect(fresh).toMatchObject({ seat: 1, realmId: "test" });
    vi.advanceTimersByTime(60_000); // No stale timer from t = 55 s may drop the new seat.
    expect(sessionOf(server, "dev-b#1")).toBe(fresh);
    expect(server.isDormant("dev-b#1")).toBe(false);
  });

  it("removes the old device's guests when another connection takes over its profile", async () => {
    const device = await start();
    const { server, transport } = device;
    transport.connect("dev-a", { profileId: "shared", displayName: "A" });
    await server.settle();
    transport.send("dev-a", { type: "join-realm", requestId: 1, worldId: "test" });
    await server.settle();
    const guest = await join(device, 1, "dev-a");
    if (!guest) throw Error("no guest");
    // Seat 2 is still arriving when the takeover starts; it leaves once it has arrived.
    transport.send("dev-a", { type: "join-seat", requestId: 2, seat: 2 });
    const travelling = sessionOf(server, "dev-a#2");
    expect(travelling?.transitioning).toBe(true);

    transport.connect("dev-c", { profileId: "shared", displayName: "C" });
    // While the takeover saves, the replaced device's seats already take nothing.
    transport.send("dev-a", {
      type: "seat",
      seat: 1,
      message: { type: "set-player-model", requestId: 9, model: "person3" },
    });
    await server.settle();
    expect(transport.messages("dev-a", "seat")).toEqual([]);
    expect(guest.playerModel).toBe("player");
    expect(transport.messages("dev-a", "kicked")).toHaveLength(1);
    expect([sessionOf(server, "dev-a"), sessionOf(server, "dev-a#1")]).toEqual([
      undefined,
      undefined,
    ]);
    expect(server.entityManager.entities.some((e) => e.id === guest.player.id)).toBe(false);
    expect(sessionOf(server, "dev-a#2")).toBeUndefined();
    const players = server.entityManager.entities.filter((e) => e.type === "player");
    expect(players.map((e) => e.id)).toEqual([server.getLocalSession().player.id]);

    // The replaced connection's packets and seat messages reach nobody.
    transport.send("dev-a", {
      type: "seat",
      seat: 1,
      message: { type: "set-debug", paused: true },
    });
    transport.send(
      "dev-a",
      devicePacket(1, [
        { seat: 0, body: 1, movement: step(1, 0) },
        { seat: 1, body: 2, movement: step(1, 0) },
      ]).input,
    );
    expect(guest.inputQueue).toEqual([]);
  });

  it("keeps the old device and its guests playing when a takeover cannot save it", async () => {
    const device = await start();
    const { server, transport } = device;
    transport.connect("dev-a", { profileId: "shared", displayName: "A" });
    await server.settle();
    transport.send("dev-a", { type: "join-realm", requestId: 1, worldId: "test" });
    await server.settle();
    const guest = await join(device, 1, "dev-a");
    if (!guest) throw Error("no guest");

    const flush = vi.spyOn(Realm.prototype, "flushAsync");
    flush.mockRejectedValueOnce(Error("disk full"));
    transport.connect("dev-c", { profileId: "shared", displayName: "C" });
    await server.settle();
    expect(transport.messages("dev-c", "kicked")).toHaveLength(1);
    expect(transport.messages("dev-a", "kicked")).toEqual([]);
    expect([sessionOf(server, "dev-a")?.retired, guest.retired]).toEqual([false, false]);

    transport.send("dev-a", {
      type: "seat",
      seat: 1,
      message: { type: "set-player-model", requestId: 9, model: "person3" },
    });
    expect(transport.seatMessages("dev-a", 1, "player-model-set")).toHaveLength(1);
    expect(guest.playerModel).toBe("person3");
  });

  it("refuses connection ids that could pose as another device's seat", async () => {
    const device = await start();
    const { server, transport } = device;
    transport.connect("local#1");
    expect(transport.messages("local#1", "kicked")).toEqual([
      { type: "kicked", reason: "Invalid connection id." },
    ]);
    transport.send("local#1", { type: "join-seat", requestId: 1, seat: 1 });
    await server.settle();
    expect([...server.getSessions()].map((session) => session.clientId)).toEqual(["local"]);
    expect(await join(device, 1)).toMatchObject({ connectionId: "local", seat: 1 });
  });

  it("keeps one frame stream per connection; guests ride in seat 0's", async () => {
    const device = await start();
    const { server, transport, host } = device;
    const guest = await join(device, 1);
    server.broadcasting = true;
    server.tick(1 / 60);
    server.tick(1 / 60);

    const frames = transport.messages("local", "frame");
    expect(frames.length).toBeGreaterThan(0);
    expect(frames.every((frame) => frame.playerEntityId === host.player.id)).toBe(true);
    expect(frames.some((f) => f.entityBaselines?.some((e) => e.id === guest?.player.id))).toBe(
      true,
    );
    expect(transport.messages("local", "seat")).toEqual([]);
  });

  it("asks the device's connection whether a seat can be sent to", () => {
    const canSend = vi.fn((id?: string) => id !== "busy");
    const raw = { ...new MemoryConnections().serverSide, canSend };
    const transport = new DeviceTransport(raw, () => ({ seats: () => [], isDormant: () => false }));
    expect([transport.canSend("busy#2"), transport.canSend("idle#1"), transport.canSend()]).toEqual(
      [false, true, true],
    );
    expect(canSend.mock.calls).toEqual([["busy"], ["idle"], [undefined]]);
  });
});
