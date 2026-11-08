import { expect, it, vi } from "vitest";
import { createPlayer } from "../entities/Player.js";
import { followSeat, View } from "../session/View.js";
import { decodeServerMessage, encodeClientMessage } from "../shared/binaryCodec.js";
import { COOP_IDLE, coopRecipe } from "./CoopRecipe.js";
import type { ScenarioResponse } from "./ScenarioProtocol.js";
import { ScenarioReplica } from "./ScenarioReplica.js";
import { ScenarioWorkerHost } from "./ScenarioWorkerHost.js";

it("routes two normal session baselines/deltas, input fences and durable replacement through the ordinary Worker host", async () => {
  const recipe = coopRecipe("push");
  if (!recipe.guest) throw Error("Missing guest");
  const replicas = [
    new ScenarioReplica(recipe.player, 1, recipe.actors),
    new ScenarioReplica(recipe.guest, 1, recipe.actors),
  ];
  const apply = (response: ScenarioResponse) => {
    expect(response.error).toBeUndefined();
    for (const [seat, frames] of [response.frames, response.guestFrames ?? []].entries()) {
      const replica = replicas[seat];
      if (!replica) throw Error("Missing replica");
      for (const buffer of frames) {
        const message = decodeServerMessage(buffer);
        if (
          message.type !== "sync-cvars" &&
          (message.type === "frame" || message.type.startsWith("sync-"))
        )
          replica.view.applyMessage(message as Parameters<typeof replica.view.applyMessage>[0]);
      }
      replica.synchronize();
    }
  };
  const host = new ScenarioWorkerHost(apply);
  try {
    await Promise.all(replicas.map((replica) => replica.predictor.ready));
    apply(await host.request({ id: 1, kind: "open", recipe, mode: "realtime" }));
    const ids = replicas.map((replica) => replica.view.serverPlayerEntity.id);
    expect(ids[0]).not.toBe(ids[1]);
    expect(
      replicas[1]?.view.serverEntities.find((entity) => entity.type === recipe.actors?.[0]?.type)
        ?.collider?.width,
    ).toBe(20);
    vi.useFakeTimers();
    apply(await host.request({ id: 2, kind: "clock", running: true }));
    for (let seq = 1; seq <= 30; seq++) {
      host.input(
        encodeClientMessage({ type: "player-input", seq, ...COOP_IDLE, dx: 1 }),
        undefined,
        0,
      );
      host.input(
        encodeClientMessage({ type: "player-input", seq, ...COOP_IDLE, dx: -1 }),
        undefined,
        1,
      );
      await vi.advanceTimersByTimeAsync(1000 / 60);
    }
    apply(await host.request({ id: 3, kind: "clock", running: false }));
    expect(replicas[0]?.view.lastProcessedInputSeq).toBe(30);
    expect(replicas[1]?.view.lastProcessedInputSeq).toBe(30);
    const before = replicas.map((replica) => ({ ...replica.view.serverPlayerEntity.position }));
    expect(before[0]?.wx).toBeGreaterThan(-30);
    expect(before[1]?.wx).toBeLessThan(35);
    const epoch = replicas[0]?.view.physicsState?.epoch;
    replicas.forEach((replica) => {
      replica.clear();
    });
    apply(await host.request({ id: 4, kind: "reload" }));
    for (const [seat, replica] of replicas.entries()) {
      expect(replica.view.serverPlayerEntity.position.wx).toBeCloseTo(
        before[seat]?.wx ?? Infinity,
        1,
      );
      expect(replica.view.physicsState?.epoch).not.toBe(epoch);
    }
    replicas.forEach((replica) => {
      replica.clear();
    });
    apply(await host.request({ id: 5, kind: "reset" }));
    expect(replicas[0]?.view.serverPlayerEntity.position.wx).toBeCloseTo(-40, 1);
    expect(replicas[1]?.view.serverPlayerEntity.position.wx).toBeCloseTo(45, 1);
  } finally {
    await host.request({ id: 6, kind: "close" });
    for (const replica of replicas) replica.dispose();
    vi.useRealTimers();
  }
});

it("is a device session that seats lab resets on the player's parent", () => {
  const template = createPlayer(0, 0);
  const replica = new ScenarioReplica(template, 1);
  expect(replica.session.prediction).toBe(replica.predictor);
  const player = { ...createPlayer(4, 5), id: 3, parentId: 9 };
  vi.spyOn(replica.view, "serverPlayerEntity", "get").mockReturnValue(player);
  const reconcile = vi.spyOn(replica.session, "reconcile").mockReturnValue(true);
  replica.synchronize(); // the first frame after a clear resets
  replica.synchronize();
  replica.synchronize(true);
  // The device seats every reset on the player's parent (DeviceSession.test).
  expect(reconcile.mock.calls).toEqual([[true], [false], [true]]);
  // A reset also clears the device's presentation, its views' slab fades included.
  const view = new View(followSeat());
  replica.session.views.push(view);
  view.fades.set("deck", { opacity: 0.5, time: 1 });
  replica.clear();
  expect(view.fades.size).toBe(0);
  replica.synchronize();
  expect(reconcile).toHaveBeenLastCalledWith(true);
  replica.dispose();
  expect(replica.session.prediction).toBeNull();
});
