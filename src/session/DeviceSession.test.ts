import { describe, expect, it, vi } from "vitest";
import type { RemoteStateView } from "../client/ClientStateView.js";
import type { PlayerPredictor } from "../client/PlayerPredictor.js";
import type { Entity } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { Chunk } from "../world/Chunk.js";
import { DeviceSession } from "./DeviceSession.js";
import { followSeat, View } from "./View.js";

function replica(player: Entity) {
  return {
    serverPlayerEntity: player,
    serverEntities: [] as Entity[],
    mountEntityId: undefined as number | undefined,
    lastProcessedInputSeq: 7,
    serverTick: 40,
    physicsState: undefined,
    world: { name: "world" },
    props: [],
    entities: [player],
    seats: { entities: new Map([[0, player.id]]) },
    setPredictor: vi.fn(),
  };
}

function predictor(player?: Entity) {
  return {
    player,
    reset: vi.fn(),
    reconcile: vi.fn(),
    storeInput: vi.fn(),
    update: vi.fn(),
  };
}

const walk = { dx: 1, dy: 0, sprinting: false, jump: false };

describe("DeviceSession prediction", () => {
  it("attaches, resumes and stops the predictor on the replica", () => {
    const player = { ...createPlayer(10, 20), id: 3 };
    const view = replica(player);
    const session = new DeviceSession(view as unknown as RemoteStateView);
    const first = predictor();
    expect(session.startPrediction(first as unknown as PlayerPredictor)).toBe(first);
    expect(view.setPredictor).toHaveBeenLastCalledWith(first);
    expect(first.reset).toHaveBeenCalledWith(player); // from the current server pose
    view.setPredictor.mockClear(); // another scene detached it
    session.resumePrediction();
    expect(view.setPredictor).toHaveBeenCalledWith(first);
    // Starting again replaces the old predictor.
    const second = predictor();
    session.startPrediction(second as unknown as PlayerPredictor);
    expect(view.setPredictor.mock.calls.slice(-2)).toEqual([[null], [second]]);
    session.stopPrediction();
    expect(view.setPredictor).toHaveBeenLastCalledWith(null);
    expect(session.prediction).toBeNull();
    const calls = view.setPredictor.mock.calls.length;
    session.resumePrediction();
    session.stopPrediction();
    expect(view.setPredictor.mock.calls.length).toBe(calls);
  });

  it("does not reset from a placeholder server player", () => {
    const view = replica({ ...createPlayer(0, 0), id: -1 });
    const session = new DeviceSession(view as unknown as RemoteStateView);
    const p = predictor();
    session.startPrediction(p as unknown as PlayerPredictor);
    expect(p.reset).not.toHaveBeenCalled();
    expect(session.reconcile(true)).toBe(false);
    expect(p.reconcile).not.toHaveBeenCalled();
  });

  it("resets only when asked, unpredicted or the server player changed, then reconciles", () => {
    const player = { ...createPlayer(10, 20), id: 3, parentId: 9 };
    const horse = { ...createPlayer(10, 20), id: 5 };
    const car = { ...createPlayer(10, 20), id: 9 };
    const view = replica(player);
    view.serverEntities = [horse, car];
    view.mountEntityId = 5;
    const session = new DeviceSession(view as unknown as RemoteStateView);
    expect(session.reconcile(false)).toBe(false); // no predictor yet
    const p = predictor(player);
    session.startPrediction(p as unknown as PlayerPredictor);
    p.reset.mockClear();
    expect(session.reconcile(false)).toBe(true);
    expect(p.reset).not.toHaveBeenCalled();
    expect(p.reconcile).toHaveBeenLastCalledWith(player, 7, view.world, [], [horse, car], 5, {
      serverTick: 40,
      seats: view.seats.entities,
    });
    // Asked (a door transition): a reset seats the player on its parent as the frame
    // shows it, for the game and labs alike, even while session sync names another mount.
    session.reconcile(true);
    expect(p.reset).toHaveBeenLastCalledWith(player, car);
    // No parent: no mount.
    const { parentId: _parentId, ...walking } = player;
    view.serverPlayerEntity = walking;
    session.reconcile(true);
    expect(p.reset).toHaveBeenLastCalledWith(walking, undefined);
    view.serverPlayerEntity = player;
    // Another server player, or none predicted yet.
    p.reset.mockClear();
    p.player = { ...player, id: 4 };
    session.reconcile(false);
    p.player = undefined;
    session.reconcile(false);
    expect(p.reset).toHaveBeenCalledTimes(2);
  });

  it("stores and predicts seat 0's command with the device's other seats", () => {
    const player = { ...createPlayer(10, 20), id: 3 };
    const view = replica(player);
    const session = new DeviceSession(view as unknown as RemoteStateView);
    session.predict(1, walk, 1 / 60); // no predictor: nothing to do
    const p = predictor(player);
    session.startPrediction(p as unknown as PlayerPredictor);
    const coSeats = new Map([[1, walk]]); // keyed by seat
    session.predict(2, walk, 1 / 60, coSeats);
    expect(p.storeInput).toHaveBeenCalledWith(2, walk, 1 / 60, coSeats);
    expect(p.update).toHaveBeenCalledWith(1 / 60, walk, view.world, [], [player]);
    expect(p.storeInput.mock.invocationCallOrder[0]).toBeLessThan(
      p.update.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("clears shared presentation and every view's fades on a realm change and on dispose", () => {
    const view = replica({ ...createPlayer(0, 0), id: 3 });
    const session = new DeviceSession(view as unknown as RemoteStateView);
    const views = [new View(followSeat()), new View(followSeat())];
    session.views.push(...views);
    for (const v of views) v.fades.set("deck", { opacity: 0.6, time: 1 });
    const clear = vi.spyOn(session.frame, "clear");
    session.clearPresentation();
    expect(clear).toHaveBeenCalledTimes(1);
    expect(views.map((v) => v.fades.size)).toEqual([0, 0]);
    session.startPrediction(predictor() as unknown as PlayerPredictor);
    views[0]?.fades.set("deck", { opacity: 0.6, time: 1 });
    const seats = vi.spyOn(session.seats, "dispose");
    session.dispose();
    expect(seats).toHaveBeenCalledOnce(); // guests' input sets released
    expect(view.setPredictor).toHaveBeenLastCalledWith(null);
    expect(clear).toHaveBeenCalledTimes(2);
    expect(views[0]?.fades.size).toBe(0);
    expect(session.views).toEqual([]);
  });
});

describe("DeviceSession readiness", () => {
  it("is ready once seat 0 exists and its room or terrain chunk is presentable", () => {
    const player = { ...createPlayer(300, 20), id: 3 };
    const chunk = new Chunk();
    const view = Object.assign(replica(player), {
      interior: null as object | null,
      roomState: null as object | null,
      world: {
        chunks: { get: (cx: number, cy: number) => (cx === 1 && cy === 0 ? chunk : undefined) },
      },
    });
    const session = new DeviceSession(view as unknown as RemoteStateView);
    const ready = new Set<unknown>();
    const terrain = { isTerrainReady: (c: unknown) => ready.has(c) };
    expect(session.seatWorldReady(terrain)).toBe(false);
    ready.add(chunk);
    expect(session.seatWorldReady(terrain)).toBe(true);
    view.interior = {};
    expect(session.seatWorldReady(terrain)).toBe(false);
    view.roomState = {};
    expect(session.seatWorldReady(terrain)).toBe(true);
    player.id = -1;
    expect(session.seatWorldReady(terrain)).toBe(false);
  });
});
