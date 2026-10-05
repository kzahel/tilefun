import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import { railAlignment } from "../railway/RailPath.js";
import { RoadType } from "../road/RoadType.js";
import { roofSupport } from "../traffic/RoofSupport.js";
import { cityTrainRecipe } from "./CityTrainRecipe.js";
import { ScenarioSession } from "./ScenarioSession.js";

const idle = { dx: 0, dy: 0, jump: false, sprinting: false };
it("jumps from a generated station, rides through bends/chunk boundaries/reload and alights at the other city", async () => {
  const s = await ScenarioSession.create(cityTrainRecipe());
  try {
    let service = required([...required(s.realm.railway).services.values()][0]);
    const path = required(service.line.path),
      a = railAlignment(path);
    expect(path.stops.map((p) => p.name)).toEqual(["Willowhaven", "Willowbridge"]);
    expect(s.realm.propManager.props.some((p) => p.type === "prop-rail-platform-edge")).toBe(true);
    for (let i = 0; i < 72; i++) await s.step({ ...idle, dy: i < 55 ? 1 : 0, jump: i < 55 });
    expect(s.player.player.wz).toBe(44);
    const support = required(roofSupport(s.player.player, s.realm.entityManager.entities));
    const identity = s.realm.entityManager.byId.get(support.id)?.proceduralId;
    let reloaded = false,
      turned = false,
      arrived = false;
    for (let i = 0; i < 1900; i++) {
      await s.step(idle, 0.1);
      expect(s.player.player.wz).toBe(44);
      const car = required(service.carriages[1]);
      expect(roofSupport(s.player.player, s.realm.entityManager.entities)?.id).toBe(car.id);
      if ((car.sprite?.frameRow ?? 0) % 64 > 16 && (car.sprite?.frameRow ?? 0) % 64 < 48) {
        turned = true;
        if (!reloaded) {
          const before = { ...s.player.player.position };
          await s.reload();
          service = required([...required(s.realm.railway).services.values()][0]);
          expect(s.player.player.position).toEqual(before);
          expect(s.realm.playerData(s.player).roofRide?.identity).toBe(identity);
          reloaded = true;
        }
      }
      if (service.record.target === 0 && service.record.dwell > 0) {
        arrived = true;
        break;
      }
    }
    expect(turned && reloaded && arrived).toBe(true);
    const dest = a.sample(required(path.stops[1]).distance);
    expect(s.player.player.position.wx).toBeCloseTo(dest.x, 4);
    for (let i = 0; i < 85; i++) await s.step({ ...idle, dy: i < 60 ? -1 : 0, jump: i < 60 });
    expect(s.player.player.wz).toBe(0);
    expect(roofSupport(s.player.player, s.realm.entityManager.entities)).toBeUndefined();
    const p = s.player.player.position;
    expect(s.realm.world.getRoadAt(Math.floor(p.wx / 16), Math.floor(p.wy / 16))).toBe(
      RoadType.CityPavement,
    );
    expect(s.realm.railway?.error).toBeUndefined();
  } finally {
    await s.close();
  }
}, 30000);
