import { afterEach, describe, expect, it, vi } from "vitest";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import { createChicken } from "../entities/Chicken.js";
import { teleportBody } from "../physics/PhysicalEdits.js";
import type { FrameMessage } from "../shared/protocol.js";
import type { PlayerSession } from "./PlayerSession.js";
import { join, play, remote, start, step, stopDevices } from "./test/DeviceHarness.js";
import { VehicleControl } from "./VehicleControl.js";

// Replication per (connection, realm) (226 slice 4b-ii), end to end through the binary
// codec: a device gets one stream per realm its seats are in, through its lowest seat there.

afterEach(async () => {
  vi.restoreAllMocks();
  await stopDevices();
});

const chunkOf = (s: PlayerSession) => ({
  cx: Math.floor(s.player.position.wx / CHUNK_SIZE_PX),
  cy: Math.floor(s.player.position.wy / CHUNK_SIZE_PX),
});
const around = ({ cx, cy }: { cx: number; cy: number }) => ({
  type: "visible-range" as const,
  minCx: cx - 1,
  minCy: cy - 1,
  maxCx: cx + 1,
  maxCy: cy + 1,
});
const seatList = (...seats: PlayerSession[]) =>
  seats.map((s) => ({ seat: s.seat, entityId: s.player.id }));
const bodyIds = (frame: FrameMessage | undefined) => frame?.physics?.bodies.map((b) => b.id) ?? [];

describe("replication per connection and realm", () => {
  it("sends a device one stream through seat 0, with one ack, a seat list and each seat's own sync", async () => {
    const device = await start();
    const { server, transport, host } = device;
    transport.send("local", { type: "set-editor-mode", enabled: false });
    const guest = await join(device, 1);
    if (!guest) throw Error("no guest");
    const other = await remote(device, "dev-b");
    server.broadcasting = true;
    const acks: number[][] = [];
    for (let seq = 1; seq <= 6; seq++) {
      play(device, "local", seq, seq, () => [
        { seat: 0, body: host.player.id, movement: step(1, 0) },
        { seat: 1, body: guest.player.id, movement: step(0, 1) },
      ]);
      acks.push([host.lastProcessedInputSeq, guest.lastProcessedInputSeq]);
    }
    expect(acks).toEqual([1, 2, 3, 4, 5, 6].map((seq) => [seq, seq]));

    const frames = transport.messages("local", "frame");
    expect(frames).toHaveLength(6);
    expect(frames.map((f) => f.lastProcessedInputSeq)).toEqual([1, 2, 3, 4, 5, 6]);
    for (const frame of frames) {
      expect(frame.playerEntityId).toBe(host.player.id);
      expect(frame.seats).toEqual(seatList(host, guest));
    }
    expect(bodyIds(frames.at(-1))).toEqual(
      expect.arrayContaining([host.player.id, guest.player.id]),
    );
    expect(transport.seatMessages("local", 1, "frame")).toEqual([]);
    // Each seat hears its own session: seat 0 bare, the guest in its envelope.
    expect(transport.messages("local", "sync-session").at(-1)).toMatchObject({
      editorEnabled: false,
    });
    expect(transport.seatMessages("local", 1, "sync-session")).toHaveLength(1);
    guest.gameplaySession.gemsCollected = 3;
    const bare = transport.messages("local", "sync-session").length;
    server.tick(1 / 60);
    expect(transport.seatMessages("local", 1, "sync-session").at(-1)).toMatchObject({
      gemsCollected: 3,
    });
    expect(transport.messages("local", "sync-session")).toHaveLength(bare);
    // The device's other seats ride as entities in other devices' streams.
    const remoteFrames = transport.messages("dev-b", "frame");
    expect(remoteFrames.every((f) => f.playerEntityId === other.player.id && !f.seats)).toBe(true);
    expect(remoteFrames.some((f) => f.entityBaselines?.some((e) => e.id === guest.player.id))).toBe(
      true,
    );
    expect(transport.messages("dev-b", "seat")).toEqual([]);
  });

  it("keeps a distant guest's terrain, actors and body in the stream, and nothing between the seats", async () => {
    const device = await start();
    const { server, transport, host } = device;
    transport.send("local", { type: "set-editor-mode", enabled: false });
    const guest = await join(device, 1);
    if (!guest) throw Error("no guest");
    const home = chunkOf(host);
    const far = { cx: home.cx + 12, cy: home.cy };
    const at = (c: { cx: number; cy: number }) => ({
      wx: c.cx * CHUNK_SIZE_PX + 128,
      wy: c.cy * CHUNK_SIZE_PX + 128,
    });
    // Another device plays between the seats, so terrain and actors exist there too.
    const middle = { cx: home.cx + 6, cy: home.cy };
    const other = await remote(device, "dev-b");
    teleportBody(guest.player, { ...at(far), wz: 0 });
    teleportBody(other.player, { ...at(middle), wz: 0 });
    transport.send("local", around(home));
    transport.send("local", { type: "seat", seat: 1, message: around(far) });
    transport.send("dev-b", around(middle));
    // Each seat's own range streams its neighbourhood in, as any player's does.
    const ready = (c: { cx: number; cy: number }) =>
      server.entityManager.canPlace?.(at(c).wx, at(c).wy) !== false;
    for (let i = 0; i < 200 && !(ready(far) && ready(middle)); i++) {
      server.tick(1 / 60);
      await server.settle();
    }
    const nearGuest = server.entityManager.spawn(createChicken(at(far).wx + 40, at(far).wy));
    const between = server.entityManager.spawn(createChicken(at(middle).wx + 40, at(middle).wy));
    server.broadcasting = true;
    play(device, "local", 1, 3, () => [
      { seat: 0, body: host.player.id, movement: step(0, 0) },
      { seat: 1, body: guest.player.id, movement: step(0, 0) },
    ]);

    const frames = transport.messages("local", "frame");
    const sent = new Set(frames.flatMap((f) => f.entityBaselines?.map((e) => e.id) ?? []));
    expect(sent.has(nearGuest.id)).toBe(true);
    expect(sent.has(between.id)).toBe(false);
    // The latest key list (later sync messages carry only changed terrain).
    const listed = transport.messages("local", "sync-chunks").filter((m) => m.loadedChunkKeys);
    const keys = listed.at(-1)?.loadedChunkKeys ?? [];
    expect(keys).toContain(`${home.cx},${home.cy}`);
    expect(keys).toContain(`${far.cx},${far.cy}`);
    expect(keys).not.toContain(`${middle.cx},${middle.cy}`);
    // One snapshot anchored on each seat carries both bodies, 12 chunks apart.
    expect(Math.abs(guest.player.position.wx - host.player.position.wx)).toBeGreaterThan(3000);
    expect(bodyIds(frames.at(-1))).toEqual(
      expect.arrayContaining([host.player.id, guest.player.id]),
    );
  });

  it("gives a guest in another realm a stream in its envelope until seat 0 joins it", async () => {
    const device = await start({ worlds: ["other"] });
    const { server, transport, host } = device;
    transport.send("local", { type: "set-editor-mode", enabled: false });
    const guest = await join(device, 1);
    if (!guest) throw Error("no guest");
    transport.send("local", {
      type: "seat",
      seat: 1,
      message: { type: "join-realm", requestId: 5, worldId: "other" },
    });
    await server.settle();
    expect([host.realmId, guest.realmId]).toEqual(["test", "other"]);
    server.broadcasting = true;
    // Entity ids are per realm, so seats in two realms may share one; send raw packets.
    const tick = (from: number, to: number) => {
      for (let seq = from; seq <= to; seq++) {
        transport.send("local", {
          type: "player-input",
          seq,
          ...step(0, 0),
          seats: [{ seat: 1, ...step(0, 0) }],
        });
        server.tick(1 / 60);
      }
    };
    tick(1, 3);

    const bare = transport.messages("local", "frame");
    expect(bare).toHaveLength(3);
    expect(bare.every((f) => f.playerEntityId === host.player.id && !f.seats)).toBe(true);
    const own = transport.seatMessages("local", 1, "frame");
    expect(own.map((f) => f.lastProcessedInputSeq)).toEqual([1, 2, 3]);
    for (const frame of own) {
      expect(frame.playerEntityId).toBe(guest.player.id);
      expect(frame.seats).toEqual(seatList(guest));
    }
    expect(own[0]?.entityBaselines?.map((e) => e.id)).toContain(guest.player.id);
    expect(transport.seatMessages("local", 1, "sync-chunks").length).toBeGreaterThan(0);
    expect(transport.seatMessages("local", 1, "sync-session")).toHaveLength(1);

    // Seat 0 arrives: the realm's stream moves to it and starts over, carrying both seats.
    // Nothing streams to a travelling seat: its client has entered neither realm for it,
    // and its arrival restarts the stream anyway. The guest's own stream carries on.
    transport.send("local", { type: "join-realm", requestId: 6, worldId: "other" });
    const departed = transport.messages("local", "frame").length;
    let travellingTicks = 0;
    for (let i = 0; i < 200 && host.transitioning; i++, travellingTicks++) {
      server.tick(1 / 60);
      await Promise.resolve();
    }
    expect(travellingTicks).toBeGreaterThan(1);
    expect(transport.messages("local", "frame")).toHaveLength(departed);
    await server.settle();
    expect(host.realmId).toBe("other");
    const before = {
      bare: transport.messages("local", "frame").length,
      own: transport.seatMessages("local", 1, "frame").length,
    };
    tick(4, 5);
    const after = transport.messages("local", "frame").slice(before.bare);
    expect(after).toHaveLength(2);
    expect(after.map((f) => f.seats)).toEqual([seatList(host, guest), seatList(host, guest)]);
    expect(after[0]?.entityBaselines?.map((e) => e.id)).toEqual(
      expect.arrayContaining([host.player.id, guest.player.id]),
    );
    expect(transport.seatMessages("local", 1, "frame")).toHaveLength(before.own);
  });

  it("restarts a resumed guest's own stream in its realm, on the device's sequence", async () => {
    const device = await start({ worlds: ["other"] });
    const { server, transport } = device;
    const seat0 = await remote(device, "dev-b");
    const guest = await join(device, 1, "dev-b");
    if (!guest) throw Error("no guest");
    transport.send("dev-b", {
      type: "seat",
      seat: 1,
      message: { type: "join-realm", requestId: 5, worldId: "other" },
    });
    await server.settle();
    expect([seat0.realmId, guest.realmId]).toEqual(["test", "other"]);
    server.broadcasting = true;
    server.tick(1 / 60);
    expect(transport.seatMessages("dev-b", 1, "frame").length).toBeGreaterThan(0);

    transport.disconnect("dev-b");
    transport.connect("dev-b");
    await server.settle();
    for (let seq = 1; seq <= 3; seq++) {
      transport.send("dev-b", { type: "player-input", seq, ...step(0, 0) });
      server.tick(1 / 60);
    }
    expect(transport.seatMessages("dev-b", 1, "frame")).toEqual([]);
    expect(await join(device, 1, "dev-b")).toBe(guest);
    expect(guest.lastProcessedInputSeq).toBe(3);
    server.tick(1 / 60);
    // The returning client's first frame for that realm is a full one, with the guest's sync.
    const [first] = transport.seatMessages("dev-b", 1, "frame");
    expect(first?.lastProcessedInputSeq).toBe(3);
    expect(first?.entityBaselines?.map((e) => e.id)).toContain(guest.player.id);
    expect(first?.entityDeltas).toBeUndefined();
    expect(transport.seatMessages("dev-b", 1, "sync-session")).toHaveLength(1);
    expect(
      transport.seatMessages("dev-b", 1, "sync-chunks")[0]?.loadedChunkKeys?.length,
    ).toBeGreaterThan(0);
  });

  it("leaves a dormant guest out of its returning device's stream until it is seated again", async () => {
    const device = await start();
    const { server, transport } = device;
    const seat0 = await remote(device, "dev-b");
    const guest = await join(device, 1, "dev-b");
    if (!guest) throw Error("no guest");
    transport.disconnect("dev-b");
    transport.connect("dev-b");
    await server.settle();
    expect([server.isDormant("dev-b"), server.isDormant("dev-b#1")]).toEqual([false, true]);
    server.broadcasting = true;
    server.tick(1 / 60);
    const dormant = transport.messages("dev-b", "frame");
    expect(dormant.every((f) => f.seats === undefined)).toBe(true);
    // Its body still shows, as any other player in the realm does.
    expect(dormant[0]?.entityBaselines?.map((e) => e.id)).toContain(guest.player.id);
    expect(transport.messages("dev-b", "seat")).toEqual([]);

    await join(device, 1, "dev-b");
    server.tick(1 / 60);
    expect(transport.messages("dev-b", "frame").at(-1)?.seats).toEqual(seatList(seat0, guest));
    expect(transport.seatMessages("dev-b", 1, "sync-session")).toHaveLength(1);
  });

  it("sounds a horn once per stream in range, never once per seat", async () => {
    const device = await start();
    const { server, transport, host } = device;
    await join(device, 1);
    await join(device, 2);
    const other = await remote(device, "dev-b");
    const { wx, wy } = host.player.position;
    other.player.position.wx = wx + 5000;
    vi.spyOn(VehicleControl.prototype, "takeHorns").mockReturnValueOnce([
      { type: "vehicle-horn", vehicleId: 1, active: true, wx, wy, kind: "car" },
    ]);
    server.tick(1 / 60);
    expect(transport.messages("local", "vehicle-horn")).toHaveLength(1);
    expect(transport.messages("local", "seat")).toEqual([]);
    expect(transport.messages("dev-b", "vehicle-horn")).toEqual([]);
  });
});
