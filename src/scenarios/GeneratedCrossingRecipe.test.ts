import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { createProp } from "../entities/PropFactories.js";
import { decodeActor, encodeActor } from "../persistence/ActorRecords.js";
import { RailwayStrategy } from "../railway/RailwayStrategy.js";
import { bridgePlacements } from "../railway/RoadRailBridge.js";
import { generatedCrossingRecipe } from "./GeneratedCrossingRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
for (const index of [0, 1, 2])
  for (const reverse of [false, true]) {
    it(`generated crossing ${index} ${reverse ? "south" : "north"}: car traverses, train clears, ramp reload preserves geometry`, async () => {
      const f = generatedCrossingRecipe(index, reverse),
        s = await ScenarioSession.create(f.recipe);
      try {
        expect(s.realm.traffic?.strategy).toBeInstanceOf(RailwayStrategy);
        const surfaceIds = () =>
          s.realm.propManager.props
            .filter((p) => p.collider?.surface)
            .map((p) => p.collider?.surface?.id)
            .sort();
        expect(surfaceIds()).toHaveLength(3);
        const ids = surfaceIds();
        let maxZ = 0,
          reloaded = false,
          trainPassed = false;
        for (let i = 0; i < 230; i++) {
          await s.step(idle, 0.1);
          const car = required([...required(s.realm.traffic).states.values()][0]);
          maxZ = Math.max(maxZ, car.entity.wz ?? 0);
          const train = required(s.realm.railway?.services.get(f.line.id));
          expect(train.entity.wz ?? 0).toBe(0);
          trainPassed ||= (train.entity.position.wx - f.bridge.x * 16) * (reverse ? -1 : 1) > 320;
          if (!reloaded && maxZ > 20 && maxZ < 48) {
            const before = required(s.realm.traffic).snapshot(car);
            await s.reload();
            expect(
              required(s.realm.traffic).snapshot(
                required([...required(s.realm.traffic).states.values()][0]),
              ),
            ).toEqual(before);
            expect(surfaceIds()).toEqual(ids);
            reloaded = true;
          }
        }
        const car = required([...required(s.realm.traffic).states.values()][0]);
        expect(reloaded).toBe(true);
        expect(maxZ).toBe(64);
        expect(car.entity.wz).toBe(0);
        expect(
          (car.entity.position.wy - f.bridge.y * 16) * (reverse ? 1 : -1),
          car.waiting,
        ).toBeGreaterThan(350);
        expect(trainPassed).toBe(true);
      } finally {
        await s.close();
      }
    }, 30000);
  }
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
    for (let i = 0; i < 65; i++) {
      await s.step({ ...idle, dy: -1 }, 0.1);
      max = Math.max(max, s.player.player.wz ?? 0);
    }
    expect(max).toBe(64);
    expect(s.player.player.wz).toBe(0);
    expect(s.player.player.position.wy).toBeLessThan(f.bridge.y * 16 - 320);
    await s.command({
      kind: "teleport",
      position: { wx: f.bridge.x * 16, wy: f.bridge.y * 16 + 40 },
      z: 0,
    });
    await s.reload();
    expect(s.player.player.wz).toBe(0);
    expect(s.realm.propManager.props.filter((p) => p.collider?.surface)).toHaveLength(3);
  } finally {
    await s.close();
  }
});

for (const obstruction of [
  "bridge pedestrian",
  "underpass pedestrian",
  "missing deck",
  "missing ramp",
] as const) {
  it(`generated traffic respects ${obstruction}`, async () => {
    const f = generatedCrossingRecipe(),
      s = await ScenarioSession.create(f.recipe);
    try {
      const car = required([...required(s.realm.traffic).states.values()][0]);
      if (obstruction === "missing deck" || obstruction === "missing ramp") {
        const deck = required(
          s.realm.propManager.props.find(
            (p) =>
              p.type ===
              (obstruction === "missing deck" ? "prop-road-rail-deck" : "prop-road-rail-south"),
          ),
        );
        s.realm.propManager.remove(deck.id);
      } else
        await s.command({
          kind: "teleport",
          position: { wx: car.entity.position.wx, wy: f.bridge.y * 16 + 20 },
          z: obstruction === "bridge pedestrian" ? 64 : 0,
        });
      for (let i = 0; i < 200; i++) await s.step(idle, 0.1);
      if (obstruction === "underpass pedestrian")
        expect(car.entity.position.wy).toBeLessThan(f.bridge.y * 16 - 350);
      else {
        expect(car.speed).toBe(0);
        expect(car.entity.position.wy).toBeGreaterThan(f.bridge.y * 16 + 20);
      }
    } finally {
      await s.close();
    }
  });
}
