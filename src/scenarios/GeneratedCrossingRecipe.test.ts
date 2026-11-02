import { expect, it } from "vitest";
import { createProp } from "../entities/PropFactories.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { bridgePlacements, ROAD_RAIL_BRIDGE } from "../railway/RoadRailBridge.js";
import { generatedCrossingRecipe } from "./GeneratedCrossingRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

it("definition-backed bridge parts retain unique connections through durable serialization", () => {
  const { bridge } = generatedCrossingRecipe();
  for (const p of bridgePlacements(bridge)) {
    const prop = createProp(p.propType, p.wx, p.wy);
    expect(decodeActor(encodeActor(prop))).toMatchObject({
      collider: prop.collider,
      position: prop.position,
    });
  }
});

it("walks both generated approaches and restores the observer below the same deck", async () => {
  const f = generatedCrossingRecipe(),
    s = await ScenarioSession.create(f.recipe);
  try {
    let max = 0;
    for (let i = 0; i < 1200 && s.player.player.position.wy >= f.bridge.y * 16 - 448; i++) {
      await s.step({ ...idle, dy: -1 });
      max = Math.max(max, s.player.player.wz ?? 0);
    }
    expect(Math.abs(max - ROAD_RAIL_BRIDGE.height)).toBeLessThan(2);
    expect(Math.abs(s.player.player.wz ?? Infinity)).toBeLessThan(0.5);
    expect(s.player.player.position.wy).toBeLessThan(f.bridge.y * 16 - 448);
    await s.command({
      kind: "teleport",
      position: { wx: f.bridge.x * 16, wy: f.bridge.y * 16 + 40 },
      z: 0,
    });
    await s.reload();
    expect(Math.abs(s.player.player.wz ?? Infinity)).toBeLessThan(0.5);
    expect(s.realm.propManager.props.filter((p) => p.collider?.surface)).toHaveLength(3);
  } finally {
    await s.close();
  }
}, 15000);
