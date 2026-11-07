import { expect, it } from "vitest";
import { createProp } from "../entities/PropFactories.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { bridgePlacements, isRoadRailBridge, ROAD_RAIL_BRIDGE } from "../railway/RoadRailBridge.js";
import { GENERATED_CROSSINGS, generatedCrossingRecipe } from "./GeneratedCrossingRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };

it("definition-backed bridge parts retain unique connections through durable serialization", () => {
  for (const [index] of GENERATED_CROSSINGS.entries()) {
    const { bridge } = generatedCrossingRecipe(index);
    const parts = bridgePlacements(bridge).map((p) => createProp(p.propType, p.wx, p.wy));
    // Ramps meet the deck at its height; the shared space links all three parts.
    const ids = new Set(parts.map((p) => p.collider?.surface?.spaceId));
    expect(ids.size).toBe(1);
    for (const p of parts)
      for (const n of p.collider?.surface?.connectsTo ?? [])
        expect(parts.some((q) => q.collider?.surface?.id === n)).toBe(true);
  }
  for (const p of bridgePlacements(generatedCrossingRecipe(1).bridge)) {
    const prop = createProp(p.propType, p.wx, p.wy);
    expect(decodeActor(encodeActor(prop))).toMatchObject({
      collider: prop.collider,
      position: prop.position,
    });
  }
});

it.each(GENERATED_CROSSINGS.map((c, i) => [c.label, i] as const))(
  "walks both approaches of %s and restores the observer below the same deck",
  async (_label, index) => {
    const f = generatedCrossingRecipe(index),
      s = await ScenarioSession.create(f.recipe);
    const east = f.bridge.axis === "east";
    // Distance travelled along the carried road past the rail centerline. East
    // travel measures the body center, so continue one tile beyond the ramp end.
    const along = () =>
      east
        ? s.player.player.position.wx - f.bridge.x * 16
        : f.bridge.y * 16 - s.player.player.position.wy;
    try {
      let max = 0;
      for (let i = 0; i < 1200 && along() <= 464; i++) {
        await s.step({ ...idle, ...(east ? { dx: 1 } : { dy: -1 }) });
        max = Math.max(max, s.player.player.wz ?? 0);
      }
      expect(Math.abs(max - ROAD_RAIL_BRIDGE.height)).toBeLessThan(2);
      expect(Math.abs(s.player.player.wz ?? Infinity)).toBeLessThan(0.5);
      expect(along()).toBeGreaterThan(448);
      await s.command({ kind: "teleport", position: f.starts.trackside.position, z: 0 });
      await s.reload();
      expect(Math.abs(s.player.player.wz ?? Infinity)).toBeLessThan(0.5);
      expect(
        s.realm.propManager.props.filter((p) => isRoadRailBridge(p.type) && p.collider?.surface),
      ).toHaveLength(3);
    } finally {
      await s.close();
    }
  },
  20000,
);

it("stages the drivable car beside every generated crossing in both directions", async () => {
  for (let index = 0; index < GENERATED_CROSSINGS.length; index++)
    for (const reverse of [false, true]) {
      const s = await ScenarioSession.create(generatedCrossingRecipe(index, reverse).recipe);
      await s.close();
    }
}, 15000);
