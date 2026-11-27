import { required } from "../../shared/required.js";
import { edgeHash } from "../RoadGenerator.js";
import type { FeaturePlacement } from "../StructureGenerator.js";
import { civicBuilding } from "./CivicBuildings.js";
import { type CivicKind, type CivicSite, furnishSite } from "./CivicSites.js";
import type { DenseDistrictPlan } from "./DenseDistrictPlanner.js";
import type { DistrictBlock, DistrictLot } from "./DistrictPlan.js";
import type { Settlement } from "./RegionalPlanner.js";

function lot(block: DistrictBlock, slot: number, key: string, x: number, y: number): DistrictLot {
  const recipe = required(civicBuilding(`prop-city-civic-${key}`));
  return {
    id: `${block.id}:lot:${slot}`,
    buildingType: recipe.type,
    anchor: { x, y },
    entrance: { x: x + recipe.entrance.dx / 16, y: y + recipe.entrance.dy / 16 },
    facing: "south",
    bounds: {
      minX: x - recipe.width / 32,
      maxX: x + recipe.width / 32,
      minY: y - recipe.height / 16,
      maxY: y + 1,
    },
  };
}
const citySites: readonly CivicKind[] = [
  "salvage",
  "cemetery",
  "nursery",
  "fire",
  "school",
  "hospital",
  "postal-depot",
];
const villageServices: readonly CivicKind[] = [
  "post",
  "clinic",
  "school",
  "fire",
  "post",
  "clinic",
];
const villageEdges: readonly CivicKind[] = ["cemetery", "salvage", "nursery"];
// Select large institutions on distinct blocks. City addresses follow roads instead
// of overwriting parks, inter-town corridors or dedicated shopping centers.
function addresses(plan: DenseDistrictPlan, town: Settlement, seed: number) {
  const homes = plan.blocks.filter((b) => b.kind === "homes");
  const sorted = (blocks: DistrictBlock[], salt: number) =>
    [...blocks].sort(
      (a, b) =>
        edgeHash(a.bounds.minX, a.bounds.minY, seed + salt) -
        edgeHash(b.bounds.minX, b.bounds.minY, seed + salt),
    );
  const address = new Map<DistrictBlock, CivicKind>();
  const random = (salt: number) => edgeHash(town.owner.cx, town.owner.cy, seed + salt);
  if (town.kind === "village") {
    const main = required(plan.blocks.find((b) => b.kind === "shops"));
    address.set(main, required(villageServices[Math.floor(random(321) * villageServices.length)]));
    address.set(
      required(sorted(homes, 13)[0]),
      required(villageEdges[Math.floor(random(843) * villageEdges.length)]),
    );
  } else {
    const nearEdge = (b: DistrictBlock) =>
      b.bounds.minX < plan.bounds.minX + 20 ||
      b.bounds.maxX > plan.bounds.maxX - 20 ||
      b.bounds.minY < plan.bounds.minY + 20;
    const edges = sorted(homes.filter(nearEdge), 512);
    const central = sorted(
      plan.blocks.filter((b) => b.kind !== "park" && !edges.includes(b)),
      752,
    );
    for (const [i, kind] of citySites.entries()) {
      const next = i < 3 ? edges.shift() : (central.shift() ?? edges.shift());
      if (next) address.set(next, kind);
    }
  }
  return address;
}
const buildings: Record<CivicKind, [string, number, number]> = {
  salvage: ["salvage", -8, -2],
  cemetery: ["victorian", -6, -1],
  nursery: ["nursery", -7, -2],
  hospital: ["hospital", 0, 2],
  clinic: ["clinic", -4, -2],
  fire: ["fire", 0, 0],
  post: ["post", -5, 0],
  "postal-depot": ["postal-depot", -5, 0],
  school: ["school", 0, -1],
};
export function civicDistrict(
  plan: DenseDistrictPlan,
  town: Settlement,
  seed: number,
): DenseDistrictPlan {
  const address = addresses(plan, town, seed),
    sites: CivicSite[] = [],
    props: FeaturePlacement[] = [];
  const blocks = plan.blocks.map((block) => {
    const b = block.bounds,
      x = (b.minX + b.maxX) / 2,
      y = (b.minY + b.maxY) / 2;
    const kind = address.get(block);
    const variation = edgeHash(Math.floor(x / 80), Math.floor(y / 80), seed + 713);
    if (kind) {
      const [key, dx, dy] = buildings[kind];
      sites.push(furnishSite(kind, `${block.id}:${kind}`, town.name, b, variation));
      return { ...block, lots: [lot(block, 0, key, x + dx, y + dy)] };
    }
    if (
      block.kind !== "homes" ||
      (town.kind !== "village" &&
        (block.lots[0]?.buildingType.includes("hotel") ||
          block.lots[0]?.buildingType.includes("bay-5")))
    )
      return block;
    const anchor = b.maxY - 4;
    props.push({
      featureId: `${block.id}:letterbox`,
      propType: "prop-civic-mailbox",
      wx: (x + 1) * 16,
      wy: (b.maxY - 1) * 16,
    });
    if (variation < 0.48) {
      const lots = [lot(block, 0, "porch-house", x - 5, anchor)];
      props.push(
        {
          featureId: `${block.id}:driveway`,
          propType: "prop-civic-sale",
          wx: (x + 7) * 16,
          wy: (anchor - 1) * 16,
        },
        {
          featureId: `${block.id}:shade`,
          propType: "prop-oak-tree",
          wx: (x + 9) * 16,
          wy: (anchor - 8) * 16,
        },
      );
      return { ...block, lots };
    }
    return {
      ...block,
      lots: [
        lot(block, 0, variation > 0.8 ? "victorian" : "terrace-ochre", x - 7, anchor),
        lot(block, 1, "terrace-blue", x + 7, anchor),
      ],
    };
  });
  return { ...plan, blocks, civicSites: sites, neighborhoodProps: props };
}
