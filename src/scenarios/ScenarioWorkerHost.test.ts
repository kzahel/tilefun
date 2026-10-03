import { expect, it } from "vitest";
import { RemoteStateView } from "../client/ClientStateView.js";
import { createPlayer } from "../entities/Player.js";
import { decodeServerMessage } from "../shared/binaryCodec.js";
import type { BufferedMessage } from "../shared/protocol.js";
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
