import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { ScenarioSession } from "./ScenarioSession.js";
import { vehicleGeometryRecipe } from "./VehicleGeometryRecipe.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
for (const garage of [false, true]) {
  it(`controls a car over the ${garage ? "garage ramp" : "bridge"} and reloads while on its slope`, async () => {
    const s = await ScenarioSession.create(vehicleGeometryRecipe(garage));
    const car = () => required(s.realm.vehicleRegistry?.states.get(required(s.handles.car))).entity;
    try {
      await s.command({ kind: "enter-vehicle", entityId: car().id });
      let reloaded = false,
        extreme = 0;
      for (let i = 0; i < (garage ? 360 : 800); i++) {
        await s.step({ ...idle, dx: garage ? 1 : 0, dy: garage ? 0 : -1 });
        const z = car().wz ?? 0;
        extreme = garage ? Math.min(extreme, z) : Math.max(extreme, z);
        if (!reloaded && (garage ? z < -12 && z > -36 : z > 12 && z < 48)) {
          const before = { ...car().position },
            height = z,
            identity = car().proceduralId;
          await s.reload();
          expect(car().proceduralId).toBe(identity);
          expect(car().position).toEqual(before);
          expect(car().wz).toBeCloseTo(height, 3);
          expect(s.player.player.parentId).toBe(car().id);
          reloaded = true;
        }
        if (garage ? car().position.wx > 90 : car().position.wy < -350) break;
      }
      expect(reloaded).toBe(true);
      expect(garage ? extreme < -47 : extreme > 63).toBe(true);
      expect(garage ? car().position.wx > 90 : car().position.wy < -350).toBe(true);
      for (let i = 0; i < 30; i++) await s.step(idle);
      const stop = { ...car().position };
      for (let i = 0; i < 30; i++) await s.step(idle);
      expect(Math.hypot(car().position.wx - stop.wx, car().position.wy - stop.wy)).toBeLessThan(
        0.5,
      );
    } finally {
      await s.close();
    }
  }, 20000);
}
