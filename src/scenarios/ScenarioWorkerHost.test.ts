import { expect, it } from "vitest";
import { RemoteStateView } from "../client/ClientStateView.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { decodeServerMessage } from "../shared/binaryCodec.js";
import type { BufferedMessage } from "../shared/protocol.js";
import { type Lane, path } from "../traffic/LaneGraph.js";
import { World } from "../world/World.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { ScenarioWorkerHost } from "./ScenarioWorkerHost.js";

const recipe: ScenarioRecipe = {
  version: 1,
  id: "worker-parity",
  generation: FLAT_SCENARIO,
  player: createPlayer(0, 0),
  props: scenarioWalls(-80, -80, 80, 80),
  physics: { gravityScale: 0.5 },
};
it("reports actual durable racer handles without including an ordinary car of the same model", async () => {
  const lane = (id: string, y: number, race: boolean): Lane => ({
    id,
    from: `${id}:a`,
    to: `${id}:b`,
    a: { x: 0, y },
    b: { x: 256, y },
    direction: Direction.Right,
    width: 16,
    intercity: false,
    path: path([
      { x: 0, y },
      { x: 256, y },
    ]),
    ...(race ? { race: { model: "car-21", speed: 150 } } : {}),
  });
  const r: ScenarioRecipe = {
    version: 1,
    id: "racer-handle-ownership",
    generation: FLAT_SCENARIO,
    player: createPlayer(0, 100),
    props: [],
    roads: [
      { left: -32, right: 320, top: 16, bottom: 48 },
      { left: -32, right: 320, top: 176, bottom: 208 },
    ],
    trafficLanes: [lane("racetrack-fixture", 32, true), lane("street-fixture", 192, false)],
    traffic: [
      { name: "racer", model: "car-21", laneId: "racetrack-fixture", x: 64, y: 32, distance: 64 },
      { name: "ordinary", model: "car-21", laneId: "street-fixture", x: 64, y: 192, distance: 64 },
    ],
  };
  const host = new ScenarioWorkerHost();
  let id = 0;
  try {
    const opened = await host.request({ id: ++id, kind: "open", recipe: r });
    expect(opened.error).toBeUndefined();
    const racers = Object.entries(opened.handles).filter(([name]) => name.startsWith("racer:"));
    expect(racers).toHaveLength(1);
    expect(racers[0]?.[1]).toBe(opened.handles.racer);
    expect(racers[0]?.[1]).not.toBe(opened.handles.ordinary);
    const reloaded = await host.request({ id: ++id, kind: "reload" });
    expect(reloaded.error).toBeUndefined();
    const restored = Object.entries(reloaded.handles).filter(([name]) => name.startsWith("racer:"));
    expect(restored.map(([name]) => name)).toEqual(racers.map(([name]) => name));
    expect(restored[0]?.[1]).toBe(reloaded.handles.racer);
    expect(restored[0]?.[1]).not.toBe(reloaded.handles.ordinary);
  } finally {
    await host.request({ id: ++id, kind: "close" });
  }
});
it("the Worker request host matches explicit headless steps and distinguishes reload from reset", async () => {
  const host = new ScenarioWorkerHost(),
    direct = await ScenarioSession.create(recipe);
  const replica = new RemoteStateView(new World());
  let id = 0;
  const apply = (frames: ArrayBuffer[]) => {
    for (const packet of frames) {
      const m = decodeServerMessage(packet);
      if (m.type !== "sync-cvars" && (m.type === "frame" || m.type.startsWith("sync-")))
        replica.applyMessage(m as BufferedMessage);
    }
  };
  try {
    apply((await host.request({ id: ++id, kind: "open", recipe })).frames);
    for (let i = 0; i < 75; i++) {
      const input = {
        dx: i < 30 ? 1 : 0,
        dy: i > 40 ? -1 : 0,
        jump: i > 5 && i < 20,
        sprinting: false,
      };
      const [response] = await Promise.all([
        host.request({ id: ++id, kind: "step", input, dt: 1 / 60 }),
        direct.step(input),
      ]);
      expect(response.error).toBeUndefined();
      apply(response.frames);
      expect(replica.serverPlayerEntity.position.wx).toBeCloseTo(
        direct.player.player.position.wx,
        4,
      );
      expect(replica.serverPlayerEntity.position.wy).toBeCloseTo(
        direct.player.player.position.wy,
        4,
      );
      expect(replica.serverPlayerEntity.wz ?? 0).toBeCloseTo(direct.player.player.wz ?? 0, 4);
    }
    const before = { ...replica.serverPlayerEntity.position };
    apply((await host.request({ id: ++id, kind: "reload" })).frames);
    expect(replica.serverPlayerEntity.position).toEqual(before);
    apply((await host.request({ id: ++id, kind: "reset" })).frames);
    expect(replica.serverPlayerEntity.position).toEqual({ wx: 0, wy: 0 });
    expect(replica.props).toHaveLength(4);
    expect(
      (
        await host.request({
          id: ++id,
          kind: "command",
          command: { kind: "teleport", position: { wx: NaN, wy: 0 } },
        })
      ).error,
    ).toContain("Invalid teleport");
  } finally {
    await direct.close();
    await host.request({ id: ++id, kind: "close" });
  }
  expect((await host.request({ id: ++id, kind: "reload" })).error).toContain("not open");
  // A closed host can be mounted again with entirely fresh memory.
  expect((await host.request({ id: ++id, kind: "open", recipe })).error).toBeUndefined();
  await host.request({ id: ++id, kind: "close" });
});
