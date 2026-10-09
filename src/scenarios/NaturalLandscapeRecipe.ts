import { TerrainId } from "../autotile/TerrainId.js";
import { createPlayer } from "../entities/Player.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { DenseDistrictSource } from "../generation/regional/DenseDistrictPlanner.js";
import { FarmsteadSource } from "../generation/regional/FarmsteadPlanner.js";
import {
  type LandscapeProfile,
  NaturalLandscape,
} from "../generation/regional/NaturalLandscape.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { FAUNA_PROFILES } from "../wildlife/Fauna.js";
import { cityTrainRecipe } from "./CityTrainRecipe.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

/** Fixed, inspected coordinates; IDs pin compositions, never search order. All positions are tiles. */
export const NATURAL_CASES = [
  ...FAUNA_PROFILES.map((p) => ({
    id: p.species,
    name: `${p.label} · ${p.habitat} refuge`,
    seed: 2026,
    x: p.inspection[0],
    y: p.inspection[1],
  })),
  { id: "farmstead", name: "Countryside · connected farmstead", seed: 2026, x: 380, y: 897 },
  { id: "village-pets", name: "Village · cats & dogs", seed: 2026, x: 672, y: -592 },
  { id: "city-pets", name: "City · cats & dogs", seed: 2026, x: 306, y: 540 },
  { id: "meadow", name: "Meadow · lone trees", seed: 2026, x: 480, y: -512 },
  { id: "grove", name: "Open woodland", seed: 2026, x: -160, y: -512 },
  { id: "forest", name: "Woodland · individual trees", seed: 2026, x: -416, y: -512 },
  { id: "edge", name: "Forest edge & clearing", seed: 7, x: -384, y: -512 },
  { id: "pond", name: "Pond & dry bank", seed: 2026, x: 227, y: -183 },
  { id: "frogs", name: "Pond · frogs & shallows", seed: 2026, x: 236, y: -181 },
  { id: "deer", name: "Woodland glade · deer group", seed: 2026, x: -164, y: -460 },
  { id: "robins", name: "Grove · robins & tree perches", seed: 2026, x: -163, y: -519 },
  { id: "rabbits", name: "Meadow · rabbits & woodland edge", seed: 2026, x: -151, y: -529 },
  { id: "train", name: "Between towns · train ride", seed: 2026, x: 2543, y: -2713 },
  { id: "thicket-1", name: "Forest pattern 1 · tall thicket", seed: 2026, x: -73, y: -425 },
  { id: "thicket-2", name: "Forest pattern 2 · stump thicket", seed: 2026, x: -193, y: -548 },
  { id: "thicket-3", name: "Forest pattern 3 · mixed thicket", seed: 2026, x: 180, y: -554 },
] as const;
export type NaturalCase = (typeof NATURAL_CASES)[number];
export function naturalCase(id: string): NaturalCase {
  const found = NATURAL_CASES.find((c) => c.id === id);
  if (!found) throw new Error("Unknown landscape case");
  return found;
}
export function naturalLandscapeRecipe(
  id: string,
  profile: LandscapeProfile,
  at?: { seed: number; x: number; y: number },
): ScenarioRecipe {
  if (id === "train")
    return { ...cityTrainRecipe(), id: `nature-train-${profile}-v1`, landscape: profile };
  const point = at ?? naturalCase(id);
  if (!at && ["farmstead", "village-pets", "city-pets"].includes(id)) {
    const world = regionalWorld(point.seed);
    let player: ReturnType<typeof createPlayer>;
    if (id === "farmstead") {
      const farm = new FarmsteadSource(world).owner(0, 0, "south");
      if (!farm) throw Error("Missing connected farmstead inspection");
      player = createPlayer(farm.center.x * 16, (farm.center.y + 3) * 16);
    } else {
      const plan = new DenseDistrictSource(world, true).owner(0, id === "village-pets" ? -1 : 0);
      if (!plan) throw Error("Missing settlement inspection");
      player = createPlayer(
        (plan.park.minX - 1) * 16,
        ((plan.park.minY + plan.park.maxY) / 2) * 16,
      );
    }
    return {
      version: 1,
      id: `nature-${id}-${profile}-v1`,
      generation: createDescriptor("regional", point.seed),
      landscape: profile,
      player,
      props: [],
      traffic: [],
    };
  }
  if (![point.x, point.y].every((n) => Number.isFinite(n) && Math.abs(n) <= 2 ** 23))
    throw new Error("Invalid landscape location");
  const n = new NaturalLandscape(regionalWorld(point.seed), profile);
  let arrival: { x: number; y: number } | undefined;
  for (let r = 0; r <= 32 && !arrival; r++)
    for (let dy = -r; dy <= r && !arrival; dy++)
      for (let dx = -r; dx <= r && !arrival; dx++) {
        if (r && Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const x = Math.floor(point.x) + dx,
          y = Math.floor(point.y) + dy;
        if (
          n.reserved(x, y, 1) ||
          n.inThicket(x, y, 2) ||
          [-1, 0, 1].some((ox) =>
            [-1, 0, 1].some(
              (oy) =>
                ![TerrainId.Grass, TerrainId.Sand, TerrainId.SandLight].includes(
                  n.terrain(x + ox, y + oy),
                ),
            ),
          )
        )
          continue;
        const trees = n.placements(Math.floor(x / 16), Math.floor(y / 16));
        if (trees.some((p) => Math.abs(p.wx / 16 - x) < 1.5 && Math.abs(p.wy / 16 - y) < 1.5))
          continue;
        arrival = { x, y };
      }
  if (!arrival) throw new Error("No open dry arrival within 32 tiles; choose nearby countryside");
  return {
    version: 1,
    id: `nature-${id}-${profile}-v1`,
    generation: createDescriptor("regional", point.seed),
    landscape: profile,
    player: createPlayer(arrival.x * 16, arrival.y * 16),
    props: [],
    traffic: [],
  };
}
export function naturalExplorerUrl(
  c: { seed: number; x: number; y: number },
  profile: LandscapeProfile,
  zoom = 0.8,
) {
  return `/tilefun/world-explorer.html?${new URLSearchParams({ seed: String(c.seed), x: String(c.x), y: String(c.y), landscape: profile, zoom: String(zoom) })}`;
}
