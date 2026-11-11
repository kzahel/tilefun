import { OwnerPlanCache } from "./OwnerPlanCache.js";
import { regionalHash as hash, naturalElevation, REGION_SIZE } from "./RegionalGeography.js";
import type { Settlement } from "./RegionalPlanner.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

const NAME_START = ["Maple", "Willow", "Ash", "Oak", "Fern", "Cedar", "Brook", "Birch"];
const NAME_END = ["ford", "haven", "field", "wick", "grove", "bridge", "stead", "vale"];

/** One independently addressable owner. No neighbor search or child construction. */
function buildSettlement(world: RegionalWorld, cx: number, cy: number): Settlement | null {
  const x = cx * REGION_SIZE + 288 + Math.floor(hash(cx, cy, world.seed, 101) * 448);
  const y = cy * REGION_SIZE + 288 + Math.floor(hash(cx, cy, world.seed, 211) * 448);
  if (hash(cx, cy, world.seed, 307) > 0.76 || naturalElevation(world, x, y) < 0.02) return null;
  const kind = hash(cx, cy, world.seed, 401) < 0.32 ? "city" : "village";
  const width = kind === "city" ? 320 + Math.floor(hash(cx, cy, world.seed, 503) * 64) : 128;
  const height = kind === "city" ? 256 + Math.floor(hash(cx, cy, world.seed, 601) * 64) : 112;
  const bounds = {
    minX: x - width / 2,
    minY: y - height / 2,
    maxX: x + width / 2,
    maxY: y + height / 2,
  };
  const { minX, minY, maxX, maxY } = bounds;
  const cut = kind === "city" ? 32 : 16;
  return {
    id: `settlement:${cx}:${cy}`,
    parentId: `region:${cx}:${cy}`,
    owner: { cx, cy },
    bounds,
    kind,
    name: `${NAME_START[Math.floor(hash(cx, cy, world.seed, 701) * NAME_START.length)]}${NAME_END[Math.floor(hash(cx, cy, world.seed, 809) * NAME_END.length)]}`,
    center: { x, y },
    outline: [
      { x: minX + cut, y: minY },
      { x: maxX - cut, y: minY },
      { x: maxX, y: minY + cut },
      { x: maxX, y: maxY - cut },
      { x: maxX - cut, y: maxY },
      { x: minX + cut, y: maxY },
      { x: minX, y: maxY - cut },
      { x: minX, y: minY + cut },
    ],
  };
}

const owners = new OwnerPlanCache(buildSettlement);
/** Internal immutable plan. Public query functions return independent copies. */
export const readSettlement = (world: RegionalWorld, cx: number, cy: number) =>
  owners.get(world, cx, cy);
export function settlementForOwner(
  world: RegionalWorld,
  cx: number,
  cy: number,
): Settlement | null {
  const s = readSettlement(world, cx, cy);
  return (
    s && {
      ...s,
      owner: { ...s.owner },
      bounds: { ...s.bounds },
      center: { ...s.center },
      outline: s.outline.map((p) => ({ ...p })),
    }
  );
}
