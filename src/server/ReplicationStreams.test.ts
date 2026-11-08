import { describe, expect, it, vi } from "vitest";
import { CHUNK_SIZE_PX } from "../config/constants.js";
import { createChicken } from "../entities/Chicken.js";
import { EntityManager } from "../entities/EntityManager.js";
import { createPlayer } from "../entities/Player.js";
import { createProp } from "../entities/PropFactories.js";
import { PropManager } from "../entities/PropManager.js";
import { FlatStrategy } from "../generation/FlatStrategy.js";
import type { FrameMessage, ServerMessage, VehicleHornMessage } from "../shared/protocol.js";
import type { IServerTransport } from "../transport/Transport.js";
import { World } from "../world/World.js";
import { PlayerSession } from "./PlayerSession.js";
import { publishStreams, replicationStreams } from "./RealmPublication.js";
import { RealmReplicator } from "./RealmReplicator.js";

// Replication per (connection, realm) (226 slice 4b-ii), below the server.

function fixture() {
  const entityManager = new EntityManager();
  const at = (chunk: number) => chunk * CHUNK_SIZE_PX + 100;
  const host = new PlayerSession("dev", entityManager.spawn(createPlayer(at(0), 100)));
  const guest = new PlayerSession("dev#1", entityManager.spawn(createPlayer(at(8), 100)));
  const other = new PlayerSession("other", entityManager.spawn(createPlayer(at(0), 140)));
  const nearGuest = entityManager.spawn(createChicken(at(8) + 40, 100));
  const between = entityManager.spawn(createChicken(at(4), 100));
  host.visibleRange = other.visibleRange = { minCx: 0, maxCx: 0, minCy: 0, maxCy: 0 };
  guest.visibleRange = { minCx: 8, maxCx: 8, minCy: 0, maxCy: 0 };
  const propManager = new PropManager();
  const tentNearGuest = propManager.add(createProp("prop-tent-blue", at(8) + 60, 100));
  const tentBetween = propManager.add(createProp("prop-tent-blue", at(4), 100));
  const world = new World(new FlatStrategy());
  for (let x = -3; x <= 11; x++) for (let y = -3; y <= 3; y++) world.getChunk(x, y);
  const physicsSnapshot = vi.fn((anchors: readonly number[]) => ({
    epoch: 1,
    tick: 1,
    omitted: 0,
    bodies: [],
    contacts: [],
    anchors,
  }));
  const source = {
    world,
    entityManager,
    propManager,
    sessions: new Map([host, guest, other].map((s) => [s.clientId, s])),
    tickCounter: 1,
    tickRate: 60,
    physicsSnapshot,
    playerNamesRevision: 0,
    editorCursorsRevision: 0,
  };
  const tents = { nearGuest: tentNearGuest, between: tentBetween };
  return { host, guest, other, nearGuest, between, tents, source, physicsSnapshot };
}

const frameOf = (messages: ServerMessage[]) => messages[0] as FrameMessage;
const ofType = <T extends ServerMessage["type"]>(messages: ServerMessage[], type: T) =>
  messages.filter((m): m is Extract<ServerMessage, { type: T }> => m.type === type);

describe("replication streams", () => {
  it("builds one stream per connection over its seats' rectangles, with one ack and a seat list", () => {
    const { host, guest, nearGuest, between, tents, source, physicsSnapshot } = fixture();
    // Seats share the device's timeline; the stream acknowledges through its first seat.
    host.lastProcessedInputSeq = 5;
    guest.lastProcessedInputSeq = 3;
    host.gameplaySession.gemsCollected = 2;
    guest.gameplaySession.gemsCollected = 7;
    const replicator = new RealmReplicator();
    const first = replicator.build("dev", source, [guest]);
    const frame = frameOf(first);
    expect(frame).toMatchObject({
      lastProcessedInputSeq: 5,
      playerEntityId: host.player.id,
      seats: [
        { seat: 0, entityId: host.player.id },
        { seat: 1, entityId: guest.player.id },
      ],
    });
    const sent = frame.entityBaselines?.map((e) => e.id);
    expect(sent).toContain(nearGuest.id);
    expect(sent).not.toContain(between.id);
    // One anchor per seat; the snapshot only ever sees the stream's actors.
    expect(physicsSnapshot.mock.calls[0]?.[0]).toEqual([host.player.id, guest.player.id]);
    const keys = ofType(first, "sync-chunks")[0]?.loadedChunkKeys ?? [];
    expect(keys).toContain("0,0");
    expect(keys).toContain("8,0");
    expect(keys).toContain("10,0"); // the guest's collision buffer
    expect(keys).not.toContain("4,0"); // never the bounding box between seats
    const props = ofType(first, "sync-props")[0]?.props.map((p) => p.id);
    expect(props).toContain(tents.nearGuest.id);
    expect(props).not.toContain(tents.between.id);
    // The stream carries its first seat's own sync; another seat's comes on its own.
    expect(ofType(first, "sync-session")).toEqual([
      { type: "sync-session", gemsCollected: 2, editorEnabled: true, mountEntityId: null },
    ]);
    expect(replicator.seatSync(guest, 1, 60)).toEqual([
      { type: "sync-session", gemsCollected: 7, editorEnabled: true, mountEntityId: null },
    ]);

    const second = replicator.build("dev", source, [guest]);
    expect(frameOf(second).entityBaselines).toBeUndefined();
    expect(ofType(second, "sync-props")).toEqual([]);
    expect(ofType(second, "sync-chunks")).toEqual([]);
    expect(ofType(second, "sync-session")).toEqual([]);
    expect(replicator.seatSync(guest, 1, 60)).toEqual([]);
    guest.gameplaySession.invincibilityTimer = 2;
    expect(replicator.seatSync(guest, 9, 60)).toEqual([
      { type: "sync-invincibility", startTick: 9, durationTicks: 120 },
    ]);
    expect(ofType(replicator.build("dev", source, [guest]), "sync-invincibility")).toEqual([]);
    // Only the guest's view moves: its props and terrain follow it.
    guest.visibleRange = { minCx: 9, maxCx: 9, minCy: 0, maxCy: 0 };
    const moved = replicator.build("dev", source, [guest]);
    expect(ofType(moved, "sync-props")).toHaveLength(1);
    expect(ofType(moved, "sync-chunks")[0]?.loadedChunkKeys).toContain("11,0");

    // A guest's own reset leaves the stream alone; the first seat's restarts it.
    replicator.clearClient("dev#1");
    expect(frameOf(replicator.build("dev", source, [guest])).entityBaselines).toBeUndefined();
    expect(ofType(replicator.seatSync(guest, 1, 60), "sync-session")).toHaveLength(1);
    replicator.clearClient("dev");
    expect(frameOf(replicator.build("dev", source, [guest])).entityBaselines).toBeDefined();
    expect(ofType(replicator.seatSync(guest, 1, 60), "sync-session")).toHaveLength(1);

    // A new first seat is a new replica on the device: everything again, through it.
    const alone = replicator.build("dev#1", source);
    expect(frameOf(alone)).toMatchObject({
      playerEntityId: guest.player.id,
      seats: [{ seat: 1, entityId: guest.player.id }],
    });
    expect(frameOf(alone).entityBaselines?.map((e) => e.id)).toContain(nearGuest.id);
    expect(frameOf(alone).entityBaselines?.map((e) => e.id)).not.toContain(between.id);
    expect(ofType(alone, "sync-session")).toHaveLength(1);
    expect(ofType(alone, "sync-chunks")[0]?.loadedChunkKeys).not.toContain("0,0");
    expect(frameOf(replicator.build("dev", source, [guest])).entityBaselines).toBeDefined();
  });

  it("includes each seat's mount even outside every rectangle", () => {
    const { host, guest, source } = fixture();
    const mount = source.entityManager.spawn(createChicken(20 * CHUNK_SIZE_PX, 100));
    const replicator = new RealmReplicator();
    const sent = () =>
      frameOf(replicator.build("dev", source, [guest])).entityBaselines?.map((e) => e.id) ?? [];
    expect(sent()).not.toContain(mount.id);
    guest.gameplaySession.mountId = mount.id;
    expect(sent()).toContain(mount.id);
    guest.gameplaySession.mountId = null;
    expect(frameOf(replicator.build("dev", source, [guest])).entityExits).toContain(mount.id);
    host.gameplaySession.mountId = mount.id;
    expect(sent()).toContain(mount.id);
  });

  it("keeps a single seat's frame without a seat list", () => {
    const { other, source } = fixture();
    const frame = frameOf(new RealmReplicator().build("other", source));
    expect(frame.seats).toBeUndefined();
    expect(frame.playerEntityId).toBe(other.player.id);
  });

  it("asks for a seat's own sync only after its stream exists", () => {
    const { guest } = fixture();
    expect(() => new RealmReplicator().seatSync(guest, 1, 60)).toThrow(/No stream/);
  });

  it("shows other devices' editor cursors, never the device's own seats'", () => {
    const { host, guest, other, source } = fixture();
    for (const [session, tileX] of [
      [guest, 1],
      [other, 2],
      [host, 3],
    ] as const) {
      session.editorEnabled = true;
      session.editorCursor = { tileX, tileY: 0, editorTab: "terrain", brushMode: "tile" };
    }
    const replicator = new RealmReplicator();
    const cursors = (id: string, others: PlayerSession[] = []) =>
      ofType(replicator.build(id, source, others), "sync-editor-cursors")[0]?.editorCursors.map(
        (c) => c.tileX,
      );
    expect(cursors("dev", [guest])).toEqual([2]);
    expect(cursors("other")).toEqual([3, 1]);
  });

  it("groups a realm's live seats into one stream per connection, lowest seat first", () => {
    const player = createPlayer(0, 0);
    const seats = ["dev#2", "other", "dev", "dev#1", "lone#3"].map(
      (id) => new PlayerSession(id, player),
    );
    const streams = replicationStreams(seats, (s) => s.clientId !== "dev#1");
    expect(streams.map((stream) => stream.map((s) => s.clientId))).toEqual([
      ["dev", "dev#2"],
      ["other"],
      ["lone#3"],
    ]);
    expect(replicationStreams(seats, () => false)).toEqual([]);
  });

  it("sends horns once per stream in range, and each stream through its first seat", () => {
    const at = (wx: number) => createPlayer(wx, 0);
    const [host, guest, near, far, farGuest] = [
      new PlayerSession("dev", at(0)),
      new PlayerSession("dev#1", at(100)),
      new PlayerSession("near", at(700)),
      new PlayerSession("far", at(5000)),
      new PlayerSession("far#2", at(60)),
    ];
    if (!host || !guest || !near || !far || !farGuest) throw Error("missing seats");
    const sent: [string, string][] = [];
    const transport = {
      send: (id: string, msg: ServerMessage) => sent.push([id, msg.type]),
      canSend: (id?: string) => id !== "far",
    } as unknown as IServerTransport;
    const horn: VehicleHornMessage = {
      type: "vehicle-horn",
      vehicleId: 9,
      active: true,
      wx: 50,
      wy: 0,
      kind: "car",
    };
    const streams = replicationStreams([guest, host, near, far, farGuest], () => true);
    const realm = {
      replicate: vi.fn((id: string, _others: readonly PlayerSession[]) => [
        { type: `frame:${id}` } as unknown as ServerMessage,
      ]),
      syncSeat: vi.fn((s: PlayerSession) => [{ type: `sync:${s.clientId}` } as never]),
    };
    publishStreams(transport, streams, [horn], realm);
    // "far" hears it through its seat 0 although only its guest is near; it cannot take
    // frames now, so its replication waits.
    expect(sent).toEqual([
      ["dev", "vehicle-horn"],
      ["near", "vehicle-horn"],
      ["far", "vehicle-horn"],
      ["dev", "frame:dev"],
      ["dev#1", "sync:dev#1"],
      ["near", "frame:near"],
    ]);
    expect(realm.replicate.mock.calls.map(([id, others]) => [id, others.length])).toEqual([
      ["dev", 1],
      ["near", 0],
    ]);
    sent.length = 0;
    publishStreams(transport, streams, [horn]);
    expect(sent).toEqual([
      ["dev", "vehicle-horn"],
      ["near", "vehicle-horn"],
      ["far", "vehicle-horn"],
    ]);
  });
});
