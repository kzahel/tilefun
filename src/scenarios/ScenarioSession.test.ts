import { expect, it } from "vitest";
import { RemoteStateView } from "../client/ClientStateView.js";
import { createPlayer } from "../entities/Player.js";
import { decodeServerMessage } from "../shared/binaryCodec.js";
import { World } from "../world/World.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const recipe: ScenarioRecipe = {
  version: 1,
  id: "walking-room",
  generation: FLAT_SCENARIO,
  player: createPlayer(0, 0),
  props: scenarioWalls(-64, -64, 64, 64),
};
it("runs real Realm collision through binary frames, isolates sessions and reloads memory records", async () => {
  const a = await ScenarioSession.create(recipe),
    b = await ScenarioSession.create(recipe);
  try {
    const replica = new RemoteStateView(new World());
    for (let i = 0; i < 100; i++) await a.step({ dx: 1, dy: 0, jump: false, sprinting: false });
    expect(a.player.player.position.wx).toBeGreaterThan(30);
    expect(a.player.player.position.wx).toBeLessThan(64);
    expect(b.player.player.position.wx).toBe(0);
    for (const packet of a.frames()) {
      const m = decodeServerMessage(packet);
      if (m.type === "frame" || m.type.startsWith("sync-"))
        replica.applyMessage(m as Parameters<RemoteStateView["applyMessage"]>[0]);
    }
    expect(replica.playerEntity.position.wx).toBeCloseTo(a.player.player.position.wx, 4);
    expect(replica.playerEntity).not.toBe(a.player.player);
    const saved = { ...a.player.player.position };
    await a.reload();
    expect(a.player.player.position).toEqual(saved);
    expect(a.realm.propManager.props).toHaveLength(4);
    expect(a.records.commits).toBeGreaterThan(0);
  } finally {
    await a.close();
    await b.close();
  }
  await expect(a.step({ dx: 0, dy: 0, jump: false, sprinting: false })).rejects.toThrow("closed");
});
it("rejects invalid scoped settings", async () => {
  await expect(
    ScenarioSession.create({ ...recipe, physics: { gravityScale: NaN } }),
  ).rejects.toThrow("Invalid scenario physics");
});
it("keeps candidate geometry and gravity local across simultaneous sessions and reload", async () => {
  const narrow = structuredClone(recipe),
    wide = structuredClone(recipe);
  if (!narrow.player.collider || !wide.player.collider) throw new Error("Missing player collider");
  narrow.player.collider.width = 4;
  wide.player.collider.width = 20;
  narrow.physics = { gravityScale: 0.25 };
  wide.physics = { gravityScale: 1 };
  const a = await ScenarioSession.create(narrow),
    b = await ScenarioSession.create(wide);
  try {
    for (let i = 0; i < 35; i++) {
      const input = { dx: 0, dy: 0, jump: true, sprinting: false };
      await a.step(input);
      await b.step(input);
    }
    expect(a.player.player.wz ?? 0).toBeGreaterThan((b.player.player.wz ?? 0) + 20);
    expect(a.player.player.collider?.width).toBe(4);
    expect(b.player.player.collider?.width).toBe(20);
    await a.reload();
    expect(a.player.player.collider?.width).toBe(4);
    expect(b.player.player.collider?.width).toBe(20);
    expect(recipe.player.collider?.width).not.toBe(4);
    expect(recipe.player.collider?.width).not.toBe(20);
  } finally {
    await a.close();
    await b.close();
  }
});
