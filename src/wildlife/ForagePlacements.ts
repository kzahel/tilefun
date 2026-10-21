import { TerrainId } from "../autotile/TerrainId.js";
import type { ActorPlacement } from "../generation/Generator.js";
import type { NaturalLandscape } from "../generation/regional/NaturalLandscape.js";
import { createFauna, faunaType } from "./Fauna.js";
import { forageType, sourceType } from "./ForageResources.js";
import { gardenSupplies } from "./GardenHabitat.js";
import { pastureSite } from "./PastureHabitat.js";
import { RABBIT_TYPE } from "./Rabbit.js";
import { rangeSupplies } from "./RangeHabitat.js";
import { ROBIN_TYPE } from "./Robin.js";

/** Natural crow homes are clearings: give each crow an ordinary supported tree. */
export function crowNestTrees(nature: NaturalLandscape, cx: number, cy: number) {
  const rows = [];
  for (let y = cy - 1; y <= cy + 1; y++)
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (
        !["crow", "red-squirrel", "capuchin-monkey", "raccoon"].includes(
          nature.faunaHome(Math.floor(x / 4), Math.floor(y / 4), true)?.species ?? "",
        )
      )
        continue;
      for (const actor of nature.wildlife(x, y)) {
        if (
          ![
            faunaType("crow"),
            faunaType("red-squirrel"),
            faunaType("capuchin-monkey"),
            faunaType("raccoon"),
          ].includes(actor.type)
        )
          continue;
        const wx = actor.wx,
          wy = actor.wy - 52;
        // Include overlapping canopies on both sides of chunk boundaries.
        if (
          wx + 48 < cx * 256 ||
          wx - 48 >= (cx + 1) * 256 ||
          wy + 16 < cy * 256 ||
          wy - 96 >= (cy + 1) * 256
        )
          continue;
        rows.push({ featureId: `${actor.featureId}:nest-tree`, propType: "prop-oak-tree", wx, wy });
      }
    }
  return rows;
}

/** Finite native food/litter, with stable identities owned by the original cell. */
export function foragePlacements(
  actors: readonly ActorPlacement[],
  nature: NaturalLandscape,
  cx: number,
  cy: number,
): ActorPlacement[] {
  const result: ActorPlacement[] = [
    ...gardenSupplies(actors, nature, cx, cy),
    ...rangeSupplies(actors, nature, cx, cy),
  ];
  let robinFood = false;
  for (const actor of actors) {
    const rabbit = actor.type === RABBIT_TYPE,
      robin = actor.type === ROBIN_TYPE,
      meerkat = actor.type === faunaType("meerkat"),
      crow = actor.type === faunaType("crow"),
      squirrel = actor.type === faunaType("red-squirrel");
    const capuchin = actor.type === faunaType("capuchin-monkey");
    const pasture =
      actor.type === faunaType("goat")
        ? "browse-shrub"
        : actor.type === faunaType("piglet")
          ? "root-patch"
          : actor.type === faunaType("elephant")
            ? "fruit-tree"
            : undefined;
    if (pasture)
      result.push({
        featureId: `${actor.featureId}:pasture-food`,
        type: sourceType(pasture),
        ...pastureSite(actor),
        route: [],
      });
    if (capuchin || squirrel)
      result.push({
        featureId: `${actor.featureId}:growing-food`,
        type: sourceType(capuchin ? "fruit-tree" : "nut-tree"),
        // Birth stays in the owning cell; ready support later binds to the actual tree.
        wx: Math.max(cx * 256 + 4, Math.min(cx * 256 + 252, actor.wx)),
        wy: Math.max(cy * 256 + 6, Math.min(cy * 256 + 250, actor.wy - 52)),
        route: [],
      });
    if (!crow && !squirrel && !rabbit && !robin && !meerkat) continue;
    // Robin groves have one bird per tree. Share a finite seed patch within
    // each occupied chunk instead of doubling the whole forest's actor count.
    if (robin && robinFood) continue;
    for (const [index, offset] of [
      [-24, 24],
      [24, 24],
      [-40, 48],
      [40, 48],
      [0, 56],
      [0, -40],
    ].entries()) {
      const wx = Math.max(cx * 256 + 12, Math.min(cx * 256 + 244, actor.wx + (offset[0] ?? 0)));
      const wy = Math.max(cy * 256 + 12, Math.min(cy * 256 + 244, actor.wy + (offset[1] ?? 0)));
      if (
        ![-4, 4].every((x) =>
          [-4, 4].every((y) =>
            [TerrainId.Grass, TerrainId.Sand, TerrainId.SandLight].includes(
              nature.terrain((wx + x) / 16, (wy + y) / 16),
            ),
          ),
        ) ||
        nature.inThicket(wx / 16, wy / 16, 1)
      )
        continue;
      result.push({
        featureId: `${actor.featureId}:forage:${index}`,
        type: rabbit
          ? sourceType("growing-plant")
          : robin
            ? sourceType("seed-plant")
            : forageType(
                rabbit
                  ? "greens"
                  : robin
                    ? "seed"
                    : meerkat
                      ? "fruit"
                      : crow
                        ? "twig"
                        : index % 2
                          ? "fruit"
                          : "nut",
              ),
        wx,
        wy,
        route: [],
      });
      if (robin) robinFood = true;
      // Rabbits/meerkats retain one patch per animal; robin groves share one.
      // Nest builders and caching squirrels keep their original six supplies.
      if (rabbit || robin || meerkat) break;
    }
  }
  return result;
}

/** One real cache-building neighbour per natural raccoon group; original owners/RNG stay intact. */
export function raccoonForagers(
  nature: NaturalLandscape,
  cx: number,
  cy: number,
): ActorPlacement[] {
  const result: ActorPlacement[] = [];
  for (let y = cy - 1; y <= cy + 1; y++)
    for (let x = cx - 1; x <= cx + 1; x++) {
      if (nature.faunaHome(Math.floor(x / 4), Math.floor(y / 4), true)?.species !== "raccoon")
        continue;
      for (const actor of nature.wildlife(x, y)) {
        if (actor.type !== faunaType("raccoon") || !actor.featureId.endsWith(":0")) continue;
        const wx = actor.wx + 40,
          wy = actor.wy + 20;
        if (Math.floor(wx / 256) !== cx || Math.floor(wy / 256) !== cy) continue;
        const fauna = createFauna("red-squirrel", wx, wy).fauna;
        if (fauna)
          result.push({
            featureId: `${actor.featureId}:cache-forager`,
            type: faunaType("red-squirrel"),
            wx,
            wy,
            route: [],
            fauna,
          });
      }
    }
  return result;
}
