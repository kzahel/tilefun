import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { railCrossingRecipe } from "./RailCrossingRecipe.js";
import { type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";
import { undergroundGarageRecipe } from "./UndergroundGarageRecipe.js";

export const VEHICLE_GARAGE_STARTS = {
  entrance: { position: { wx: -272, wy: 48 }, z: 0 },
  garage: { position: { wx: 80, wy: -40 }, z: -48 },
  street: { position: { wx: 80, wy: 0 }, z: 0 },
};
export const VEHICLE_BRIDGE_STARTS = {
  bridge: { position: { wx: 32, wy: 8 }, z: 64 },
  trackside: { position: { wx: 80, wy: 40 }, z: 0 },
};

/** Ordinary controlled cars and authored static surfaces, sharing the game physics. */
export function vehicleGeometryRecipe(
  garage: boolean,
  reverse = false,
  model = "compact-1",
): ScenarioRecipe {
  const base = garage ? undergroundGarageRecipe() : railCrossingRecipe();
  const a = garage ? { x: reverse ? 80 : -272, y: 0 } : { x: 0, y: reverse ? -384 : 384 };
  const z = garage && reverse ? -48 : 0;
  const player = createPlayer(a.x + (garage ? 0 : 32), a.y + (garage ? 32 : 0));
  player.wz = player.groundZ = z;
  return {
    ...base,
    id: `vehicle-${garage ? "garage" : "bridge"}-${reverse ? "return" : "outbound"}`,
    player,
    props: [
      ...base.props.filter((p) => p.collider?.surface),
      ...(garage ? scenarioWalls(-352, -144, 256, 144) : scenarioWalls(-672, -464, 672, 464)),
    ],
    roads: [
      garage
        ? { left: -336, right: 160, top: -32, bottom: 32 }
        : { left: -48, right: 48, top: -448, bottom: 448 },
    ],
    parkedVehicles: [
      {
        name: "car",
        model,
        wx: a.x,
        wy: a.y,
        z,
        facing: garage
          ? reverse
            ? Direction.Left
            : Direction.Right
          : reverse
            ? Direction.Down
            : Direction.Up,
      },
    ],
  };
}
