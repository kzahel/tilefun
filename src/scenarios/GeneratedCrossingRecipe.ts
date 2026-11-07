import { Direction } from "../entities/Entity.js";
import { createPlayer } from "../entities/Player.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { RailwayStrategy } from "../railway/RailwayStrategy.js";
import { ROAD_RAIL_BRIDGE } from "../railway/RoadRailBridge.js";
import { required } from "../shared/required.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

/** Production bridges of both orientations; `key` names the Workshop fixture. */
export const GENERATED_CROSSINGS = [
  { key: "2026-ns", seed: 2026, cx: -1, cy: -1, bridge: 0, label: "Seed 2026 · north/south road" },
  { key: "2026-ew", seed: 2026, cx: -1, cy: 0, bridge: 0, label: "Seed 2026 · east/west road" },
  { key: "100", seed: 100, cx: -1, cy: 0, bridge: 1, label: "Seed 100 · north/south road" },
] as const;
/** A real regional world, not painted fixture roads or substitute routes/props.
 * Only the initial observer/car poses are staged to avoid minutes of waiting.
 * Offsets are along the carried road (`along`, positive = far side) and across it. */
export function generatedCrossingRecipe(index = 0, reverse = false) {
  const choice = required(GENERATED_CROSSINGS[index]);
  const strategy = new RailwayStrategy(regionalWorld(choice.seed));
  const line = required(strategy.railways.owner(choice.cx, choice.cy));
  const bridge = required(line.bridges[choice.bridge]);
  const east = bridge.axis === "east";
  const x = bridge.x * 16,
    y = bridge.y * 16;
  // South bridges are approached from the south (travelling north); east bridges
  // from the west (travelling east). `across` follows that lane's right-hand side.
  const at = (along: number, across: number) =>
    east ? { wx: x + along, wy: y + across } : { wx: x + across, wy: y - along };
  const starts = {
    "near approach": { position: at(-480, 76), z: 0 },
    bridge: { position: at(-8, 76), z: ROAD_RAIL_BRIDGE.height },
    trackside: { position: east ? { wx: x + 40, wy: y + 128 } : { wx: x + 128, wy: y + 40 }, z: 0 },
    "far approach": { position: at(480, 76), z: 0 },
  };
  const start = starts["near approach"];
  const car = at(reverse ? 548 : -548, 0);
  const recipe: ScenarioRecipe = {
    version: 1,
    id: `generated-crossing-${choice.key}`,
    generation: createDescriptor("regional", choice.seed),
    player: createPlayer(start.position.wx, start.position.wy),
    props: [],
    parkedVehicles: [
      {
        name: "car",
        model: "compact-1",
        ...car,
        facing: east
          ? reverse
            ? Direction.Left
            : Direction.Right
          : reverse
            ? Direction.Down
            : Direction.Up,
        // The world's own parked/traffic cars may occupy the staged lane spot.
        backUp: 160,
      },
    ],
  };
  return { recipe, starts, bridge, line, at };
}
