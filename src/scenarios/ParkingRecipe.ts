import { required } from "../art/ArtCatalog.js";
import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { parkingStudy } from "../traffic/ParkingLayout.js";
import type { ParkingVisit } from "../traffic/ParkingSystem.js";
import { shoppingScenery } from "../traffic/ShoppingScenery.js";
import { FLAT_SCENARIO, type ScenarioRecipe } from "./ScenarioRecipe.js";

/** Live revision: four paired pull-through bays. Static v1 studies stay immutable. */
export function parkingRecipe(): ScenarioRecipe {
  const plan = parkingStudy("shopping");
  const slots = [2, 5, 9, 12];
  const visits: ParkingVisit[] = slots.map((slot, i) => {
    const bay = required(plan.bays.find((b) => b.id === `shopping:0:${slot}`));
    const x = bay.x + 24,
      y = 360,
      west = i < 2;
    const entrance = west ? 32 : 1248,
      edge = west ? 104 : 1176;
    const door = required([288, 512, 736, 960][i]);
    return {
      id: `shopper-${i + 1}`,
      bayId: `pull-through-${slot}`,
      aisle: west ? "west" : "east",
      model: `compact-${i + 1}`,
      delay: (i % 2) * 4,
      shopSeconds: 8 + i * 3,
      arrival: [
        { wx: entrance, wy: 264 },
        { wx: x, wy: 264 },
        { wx: x, wy: y },
      ],
      // The paired bay immediately behind remains clear, allowing a forward exit.
      departure: [
        { wx: x, wy: y },
        { wx: x, wy: 536 },
        { wx: edge, wy: 536 },
        { wx: edge, wy: 888 },
        { wx: entrance, wy: 888 },
      ],
      walk: [
        { wx: x + 24, wy: y },
        { wx: x + 24, wy: 192 },
        { wx: door, wy: 192 },
        { wx: door, wy: 184 },
      ],
    };
  });
  const props = shoppingScenery.map((p) => structuredClone(p));
  // Route pavement is ordinary saved road data; painted spaces remain native props.
  return {
    version: 1,
    id: "parking-visits-v1",
    generation: FLAT_SCENARIO,
    player: createPlayer(608, 192),
    props,
    parkedVehicles: plan.bays
      .filter((b) => {
        const [, row, slot] = b.id.split(":").map(Number);
        return (
          b.occupied &&
          !((row === 0 || row === 1) && slots.some((s) => Math.abs(s - required(slot)) <= 1))
        );
      })
      .map((b) => ({
        model: `compact-${1 + b.color}`,
        wx: b.x + 24,
        wy: b.y + 40,
        facing: b.facing === "north" ? Direction.Up : Direction.Down,
      })),
    roads: [{ left: 16, top: 208, right: 1264, bottom: 944 }],
    parking: {
      id: "shopping-visits-v1",
      bounds: { left: 0, top: 0, right: 1280, bottom: 960 },
      visits,
    },
  };
}
