import { createFauna, type FaunaSpecies, faunaType } from "../../wildlife/Fauna.js";
import type { ActorPlacement } from "../Generator.js";
import { edgeHash } from "../RoadGenerator.js";
import type { Bounds } from "./RegionalPlanner.js";

/** Ordinary durable fauna, with a planner-owned safe yard expressed in world pixels. */
export function residentFauna(
  species: FaunaSpecies,
  featureId: string,
  x: number,
  y: number,
  bounds: Bounds,
  seed: number,
  groupId?: string,
): ActorPlacement {
  const wx = x * 16,
    wy = y * 16;
  const fauna = createFauna(species, wx, wy).fauna;
  if (!fauna) throw Error("Missing resident fauna definition");
  fauna.habitatBounds = {
    minX: bounds.minX * 16,
    minY: bounds.minY * 16,
    maxX: bounds.maxX * 16,
    maxY: bounds.maxY * 16,
  };
  fauna.randomState =
    Math.floor(edgeHash(Math.floor(wx), Math.floor(wy), seed + 31231) * 2 ** 32) >>> 0;
  fauna.timer = 1.5 + edgeHash(Math.floor(wy), Math.floor(wx), seed + 31237);
  if (groupId) fauna.groupId = groupId;
  return { featureId, type: faunaType(species), wx, wy, route: [], fauna };
}
