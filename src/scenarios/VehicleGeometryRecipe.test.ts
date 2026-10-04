import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { vehicleGeometryRecipe } from "./VehicleGeometryRecipe.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
for (const garage of [false, true])
  for (const reverse of [false, true]) {
    it(`drives the full ${garage ? "garage" : "bridge"} route ${reverse ? "back" : "out"} and reloads on its slope`, async () => {
      const s = await ScenarioSession.create(vehicleGeometryRecipe(garage, reverse));
      try {
        let reloaded = false,
          min = 0,
          max = 0,
          previous = garage && reverse ? -48 : 0;
        for (let i = 0; i < 250; i++) {
          await s.step(idle, 0.1);
          const car = required([...required(s.realm.traffic).states.values()][0]);
          const z = car.entity.wz ?? 0;
          expect(Math.abs(z - previous)).toBeLessThanOrEqual(3.601);
          previous = z;
          min = Math.min(min, z);
          max = Math.max(max, z);
          if (!reloaded && (garage ? z < -12 && z > -36 : z > 12 && z < 48)) {
            const before = required(s.realm.traffic).snapshot(car);
            await s.reload();
            expect(
              required(s.realm.traffic).snapshot(
                required([...required(s.realm.traffic).states.values()][0]),
              ),
            ).toEqual(before);
            reloaded = true;
          }
        }
        const car = required([...required(s.realm.traffic).states.values()][0]);
        expect(reloaded).toBe(true);
        expect(garage ? min : max).toBe(garage ? -48 : 64);
        expect(car.entity.wz).toBe(garage && !reverse ? -48 : 0);
        expect(car.distance, car.waiting).toBeGreaterThan(car.lane.path.length - 65);
        expect(car.speed).toBe(0);
      } finally {
        await s.close();
      }
    });
  }

for (const obstruction of [
  "low ceiling",
  "pedestrian",
  "street pedestrian",
  "missing road",
] as const) {
  it(`garage respects ${obstruction}`, async () => {
    const recipe = vehicleGeometryRecipe(true);
    if (obstruction === "low ceiling")
      required(
        recipe.props.find((p) => p.collider?.surface?.id === "garage-roof")?.collider?.surface,
      ).thickness = 32;
    const s = await ScenarioSession.create(recipe);
    try {
      if (obstruction.includes("pedestrian"))
        await s.command({
          kind: "teleport",
          position: { wx: 80, wy: 0 },
          z: obstruction === "street pedestrian" ? 0 : -48,
        });
      if (obstruction === "missing road") {
        const chunk = required(s.realm.world.getChunkIfLoaded(-1, 0));
        chunk.setRoad(10, 0, 0);
      }
      for (let i = 0; i < 220; i++) await s.step(idle, 0.1);
      const car = required([...required(s.realm.traffic).states.values()][0]);
      expect(car.speed).toBe(0);
      if (obstruction === "street pedestrian") expect(car.entity.position.wx).toBeGreaterThan(90);
      else expect(car.entity.position.wx).toBeLessThan(obstruction === "pedestrian" ? 50 : 0);
    } finally {
      await s.close();
    }
  });
}

it("carries a roof rider continuously up the bridge and restores both heights", async () => {
  const s = await ScenarioSession.create(vehicleGeometryRecipe(false));
  try {
    await s.command({ kind: "traffic-position", roof: true });
    let max = 0;
    for (let i = 0; i < 135; i++) {
      await s.step(idle, 0.1);
      const car = required([...required(s.realm.traffic).states.values()][0]).entity;
      max = Math.max(max, car.wz ?? 0);
      expect(s.player.player.wz).toBeCloseTo(
        (car.wz ?? 0) + required(car.collider?.physicalHeight),
        2,
      );
    }
    expect(max).toBe(64);
    await s.reload();
    const car = required([...required(s.realm.traffic).states.values()][0]).entity;
    expect(s.player.player.wz).toBeCloseTo(
      (car.wz ?? 0) + required(car.collider?.physicalHeight),
      2,
    );
  } finally {
    await s.close();
  }
});
