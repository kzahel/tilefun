import { expect, it } from "vitest";
import { RemoteStateView } from "../client/ClientStateView.js";
import { createPlayer } from "../entities/Player.js";
import { decodeServerMessage } from "../shared/binaryCodec.js";
import { World } from "../world/World.js";
import { naturalLandscapeRecipe } from "./NaturalLandscapeRecipe.js";
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

it("backfills missing track spectators in seeded chunks without duplicating moved or deleted people", async () => {
  const s = await ScenarioSession.create(naturalLandscapeRecipe("racetrack", "thicket"));
  try {
    await s.ready({ minCx: 24, maxCx: 33, minCy: 24, maxCy: 31 });
    const crowd = () =>
      s.realm.entityManager.entities.filter((e) => e.proceduralId?.includes(":racetrack:"));
    expect(crowd()).toHaveLength(48);
    const [missing, moved, deleted] = crowd();
    if (!missing || !moved || !deleted) throw Error("Missing spectators");
    const ids = [missing.proceduralId, moved.proceduralId, deleted.proceduralId];
    moved.position.wx += 256;
    const movedAt = { ...moved.position };
    s.realm.entityManager.remove(deleted.id);
    await s.realm.flushAsync();
    // Model a world that visited this chunk before the spectator feature existed:
    // terrain and the seeded-origin marker survive, but this person has no record.
    for (const [key, record] of s.records.records)
      if (
        (record.collection === "features" && record.key === ids[0]) ||
        (record.collection === "entities" && record.key === missing.persistentId)
      )
        s.records.records.delete(key);
    await s.reload();
    await s.ready({ minCx: 24, maxCx: 33, minCy: 24, maxCy: 31 });
    expect(crowd()).toHaveLength(47);
    expect(crowd().filter((e) => e.proceduralId === ids[0])).toHaveLength(1);
    expect(crowd().find((e) => e.proceduralId === ids[1])?.position).toEqual(movedAt);
    expect(crowd().some((e) => e.proceduralId === ids[2])).toBe(false);
  } finally {
    await s.close();
  }
});
