import { createPlayer } from "../entities/Player.js";
import { createDescriptor } from "../generation/GenerationDescriptor.js";
import { MotocrossSource } from "../generation/regional/MotocrossPlanner.js";
import type { LandscapeProfile } from "../generation/regional/NaturalLandscape.js";
import { RacetrackSource } from "../generation/regional/RacetrackPlanner.js";
import { regionalWorld } from "../generation/regional/WorldDescriptor.js";
import { required } from "../shared/required.js";
import type { ScenarioRecipe } from "./ScenarioRecipe.js";

export const OUTING_CASES = [
  { id: "outing-camp", name: "Ferngrove · Woodland camp", seed: 2026, x: 184, y: 427 },
  { id: "outing-garden", name: "Oakwick · Garden park", seed: 2026, x: -1471, y: -2812 },
  { id: "outing-play", name: "Ferngrove · Basketball green", seed: 42, x: -462, y: -609 },
  { id: "outing-beach", name: "Lake · Beach kiosk", seed: 2026, x: 1234, y: -259 },
] as const;

export function venueRecipe(
  id: string,
  profile: LandscapeProfile,
  point: { seed: number; x: number; y: number },
): ScenarioRecipe | undefined {
  let arrival = point as { x: number; y: number };
  if (id === "motocross") {
    arrival = required(
      new MotocrossSource(regionalWorld(point.seed)).owner(0, 0),
      "Missing generated motocross inspection",
    ).start;
  } else if (id === "racetrack") {
    const { center } = required(
      new RacetrackSource(regionalWorld(point.seed)).owner(0, 0),
      "Missing generated racetrack inspection",
    );
    arrival = { x: center.x, y: center.y + 37 };
  } else if (!id.startsWith("outing-")) return;
  return {
    version: 1,
    id: `nature-${id}-${profile}-v1`,
    generation: createDescriptor("regional", point.seed),
    landscape: profile,
    player: createPlayer(arrival.x * 16, arrival.y * 16),
    props: [],
  };
}
