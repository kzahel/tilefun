import { TerrainId } from "../../autotile/TerrainId.js";
import { CHUNK_SIZE, TILE_SIZE } from "../../config/constants.js";
import { RoadType } from "../../road/RoadType.js";
import { Chunk } from "../../world/Chunk.js";
import { deriveTerrain } from "../deriveTerrain.js";
import type { StructurePlacement } from "../StructureGenerator.js";
import {
  type DistrictPlan,
  type DistrictStreet,
  districtForSettlement,
  settledDistrict,
} from "./DistrictPlanner.js";
import { pathDistance } from "./PlanGeometry.js";
import { type Bounds, intersects, REGION_SIZE, settlementForOwner } from "./RegionalPlanner.js";
import { RegionalStrategy } from "./RegionalStrategy.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

export interface FeaturePlacement extends StructurePlacement {
  featureId: string;
}
const within = (b: Bounds, x: number, y: number) =>
  x >= b.minX && x < b.maxX && y >= b.minY && y < b.maxY;
export function streetDistance(street: DistrictStreet, x: number, y: number): number {
  return pathDistance(street.points, x, y);
}

/** A bounded owner cache is disposable working memory, never a generated world atlas. */
export class DistrictSource {
  private owners = new Map<string, DistrictPlan | null>();
  constructor(
    readonly world: RegionalWorld,
    readonly settled = false,
  ) {}
  owner(cx: number, cy: number): DistrictPlan | null {
    const key = `${cx},${cy}`;
    if (this.owners.has(key)) return this.owners.get(key) ?? null;
    const settlement = settlementForOwner(this.world, cx, cy);
    const plan = settlement
      ? this.settled
        ? settledDistrict(settlement, this.world.seed)
        : districtForSettlement(settlement, this.world.seed)
      : null;
    this.owners.set(key, plan);
    if (this.owners.size > 16) this.owners.delete(this.owners.keys().next().value ?? "");
    return plan;
  }
  at(x: number, y: number): DistrictPlan | null {
    const plan = this.owner(Math.floor(x / REGION_SIZE), Math.floor(y / REGION_SIZE));
    return plan && within(plan.bounds, x, y) ? plan : null;
  }
  query(bounds: Bounds): DistrictPlan[] {
    const plans: DistrictPlan[] = [];
    const minCx = Math.floor(bounds.minX / REGION_SIZE),
      maxCx = Math.floor(bounds.maxX / REGION_SIZE);
    const minCy = Math.floor(bounds.minY / REGION_SIZE),
      maxCy = Math.floor(bounds.maxY / REGION_SIZE);
    if ((maxCx - minCx + 1) * (maxCy - minCy + 1) > 16) return plans;
    for (let cy = minCy; cy <= maxCy; cy++)
      for (let cx = minCx; cx <= maxCx; cx++) {
        const plan = this.owner(cx, cy);
        if (plan && intersects(plan.bounds, bounds)) plans.push(plan);
      }
    return plans;
  }
}

function surface(plan: DistrictPlan, x: number, y: number): { terrain: TerrainId; road: RoadType } {
  let best: DistrictStreet | null = null;
  let distance = Infinity;
  let onH = false,
    onV = false;
  for (const street of plan.streets) {
    const d = streetDistance(street, x, y);
    if (d <= street.width / 2) {
      if (street.points[0]?.y === street.points[1]?.y) onH = true;
      else onV = true;
    }
    if (d <= street.width / 2 + street.sidewalk && d < distance) {
      distance = d;
      best = street;
    }
  }
  if (best) {
    const crossing =
      distance <= best.width / 2 &&
      !(onH && onV) &&
      plan.streets.some((street) => {
        if (street === best || street.kind === "alley") return false;
        const perpendicular =
          (street.points[0]?.y === street.points[1]?.y) !==
          (best?.points[0]?.y === best?.points[1]?.y);
        const d = streetDistance(street, x, y);
        return (
          perpendicular &&
          d >= street.width / 2 + 1 &&
          d <= street.width / 2 + 2 &&
          Math.floor((onH ? x : y) * 2) % 2 === 0
        );
      });
    const road = crossing
      ? RoadType.LineWhite
      : distance <= best.width / 2
        ? distance <= 0.5 && !(onH && onV) && best.kind !== "alley"
          ? RoadType.LineYellow
          : RoadType.Asphalt
        : RoadType.Sidewalk;
    return { terrain: TerrainId.Grass, road };
  }
  const park = plan.park;
  if (within(park, x, y)) {
    const px = (park.minX + park.maxX) / 2,
      py = (park.minY + park.maxY) / 2;
    const halfW = Math.min(6, (park.maxX - park.minX) / 4),
      halfH = Math.min(5, (park.maxY - park.minY) / 4);
    if (Math.abs(x - px) < halfW && Math.abs(y - py) < halfH)
      return { terrain: TerrainId.Playground, road: RoadType.None };
    if (
      Math.abs(x - park.minX - 2) < 1 ||
      Math.abs(x - park.maxX + 2) < 1 ||
      Math.abs(y - park.minY - 2) < 1 ||
      Math.abs(y - park.maxY + 2) < 1 ||
      (Math.abs(x - px) < 1 && y >= py + halfH + 1)
    )
      return { terrain: TerrainId.DirtLight, road: RoadType.None };
  }
  for (const block of plan.blocks)
    for (const lot of block.lots) {
      if (Math.abs(x - lot.entrance.x) < 1.5 && y >= lot.entrance.y && y <= lot.bounds.maxY + 2)
        return { terrain: TerrainId.DirtLight, road: RoadType.None };
    }
  return { terrain: TerrainId.Grass, road: RoadType.None };
}

export class DistrictStrategy extends RegionalStrategy {
  readonly districts: DistrictSource;
  constructor(world: RegionalWorld, settled = false) {
    super(world);
    this.districts = new DistrictSource(world, settled);
  }
  override generate(chunk: Chunk, cx: number, cy: number): void {
    super.generate(chunk, cx, cy);
    const baseX = cx * CHUNK_SIZE,
      baseY = cy * CHUNK_SIZE;
    for (let sy = 0; sy < Chunk.SUBGRID_SIZE; sy++)
      for (let sx = 0; sx < Chunk.SUBGRID_SIZE; sx++) {
        const x = baseX + sx / 2,
          y = baseY + sy / 2,
          plan = this.districts.at(x, y);
        if (plan) chunk.setSubgrid(sx, sy, surface(plan, x, y).terrain);
      }
    deriveTerrain(chunk);
    for (let ly = 0; ly < CHUNK_SIZE; ly++)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = baseX + lx + 0.5,
          y = baseY + ly + 0.5,
          plan = this.districts.at(x, y);
        if (plan) {
          const sampled = surface(plan, x, y);
          if (sampled.road !== RoadType.None) chunk.setRoad(lx, ly, sampled.road);
        }
      }
  }
  placements(cx: number, cy: number): FeaturePlacement[] {
    const bounds = {
      minX: cx * CHUNK_SIZE,
      minY: cy * CHUNK_SIZE,
      maxX: (cx + 1) * CHUNK_SIZE,
      maxY: (cy + 1) * CHUNK_SIZE,
    };
    const search = {
      minX: bounds.minX - 20,
      minY: bounds.minY - 20,
      maxX: bounds.maxX + 20,
      maxY: bounds.maxY + 20,
    };
    const placements: FeaturePlacement[] = [];
    const add = (
      featureId: string,
      propType: string,
      x: number,
      y: number,
      width = 10,
      height = 20,
    ) => {
      if (
        intersects(bounds, {
          minX: x - width / 2,
          minY: y - height,
          maxX: x + width / 2,
          maxY: y + 4,
        })
      )
        placements.push({ featureId, propType, wx: x * TILE_SIZE, wy: y * TILE_SIZE });
    };
    for (const plan of this.districts.query(search)) {
      for (const block of plan.blocks)
        for (const lot of block.lots)
          add(
            lot.id,
            lot.buildingType,
            lot.anchor.x,
            lot.anchor.y,
            lot.buildingType === "prop-country-house" ? 18 : 9,
            20,
          );
      const park = plan.park,
        px = (park.minX + park.maxX) / 2,
        py = (park.minY + park.maxY) / 2;
      add(`${plan.id}:park:swing`, "prop-swing", px - 3, py, 2, 3);
      add(`${plan.id}:park:slide`, "prop-slide", px + 3, py + 1, 4, 3);
      add(`${plan.id}:park:bench`, "prop-bench", park.minX + 4, park.maxY - 4, 3, 2);
      add(`${plan.id}:park:tree`, "prop-oak-tree", park.maxX - 3, park.minY + 4, 4, 4);
      for (let i = 0; i < plan.streets.length; i++) {
        const street = plan.streets[i];
        const point = street?.points[0];
        if (point && street?.kind !== "alley")
          add(`${street?.id}:lamp`, "prop-street-lamp", point.x + 7, point.y + 7, 2, 5);
      }
    }
    return placements;
  }
}
