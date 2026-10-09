import { TerrainId } from "../../autotile/TerrainId.js";
import { CHUNK_SIZE, TILE_SIZE } from "../../config/constants.js";
import { createProp } from "../../entities/PropFactories.js";
import { Chunk } from "../../world/Chunk.js";
import { deriveTerrain } from "../deriveTerrain.js";
import type { ActorPlacement } from "../Generator.js";
import { buildingVisualBounds } from "./BuildingRecipes.js";
import { denseBuilding } from "./DenseCityAssets.js";
import {
  type DenseDistrictPlan,
  DenseDistrictSource,
  denseSurfaceAt,
} from "./DenseDistrictPlanner.js";
import { DistrictStrategy, type FeaturePlacement } from "./DistrictStrategy.js";
import { intersects } from "./RegionalPlanner.js";
import { RegionalStrategy } from "./RegionalStrategy.js";
import { settlementGreenProps } from "./SettlementPets.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

/** Shared dense realization using promoted facades, streets and walking routes.
 * Current gameplay enables threshold connections; authoring studies can omit them.
 */
export class DenseDistrictStrategy extends DistrictStrategy {
  override readonly districts: DenseDistrictSource;
  private readonly geography: RegionalStrategy;
  constructor(world: RegionalWorld, connectEntrances = false) {
    super(world);
    this.districts = new DenseDistrictSource(world, connectEntrances);
    this.geography = new RegionalStrategy(world);
  }
  override generate(chunk: Chunk, cx: number, cy: number): void {
    this.geography.generate(chunk, cx, cy);
    const baseX = cx * CHUNK_SIZE,
      baseY = cy * CHUNK_SIZE;
    for (let sy = 0; sy < Chunk.SUBGRID_SIZE; sy++)
      for (let sx = 0; sx < Chunk.SUBGRID_SIZE; sx++)
        if (this.districts.at(baseX + sx / 2, baseY + sy / 2))
          chunk.setSubgrid(sx, sy, TerrainId.Grass);
    deriveTerrain(chunk);
    for (let ly = 0; ly < CHUNK_SIZE; ly++)
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const x = baseX + lx,
          y = baseY + ly,
          plan = this.districts.at(x, y);
        if (plan) {
          chunk.setRoad(lx, ly, this.surface(plan, x, y));
          chunk.setHeight(lx, ly, 0);
        }
      }
  }
  override placements(cx: number, cy: number): FeaturePlacement[] {
    const bounds = { minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 },
      search = {
        minX: bounds.minX - 32,
        minY: bounds.minY - 40,
        maxX: bounds.maxX + 32,
        maxY: bounds.maxY + 40,
      };
    const props: FeaturePlacement[] = [];
    const add = (featureId: string, propType: string, x: number, y: number) => {
      const prop = createProp(propType, x * TILE_SIZE, y * TILE_SIZE);
      const w = prop.sprite.spriteWidth / TILE_SIZE,
        h = prop.sprite.spriteHeight / TILE_SIZE;
      if (intersects(bounds, { minX: x - w / 2, minY: y - h, maxX: x + w / 2, maxY: y + 1 }))
        props.push({ featureId, propType, wx: x * TILE_SIZE, wy: y * TILE_SIZE });
    };
    for (const plan of this.districts.query(search)) {
      for (const block of plan.blocks)
        for (const lot of block.lots) {
          const art = buildingVisualBounds(this.building(lot.buildingType));
          if (
            intersects(bounds, {
              minX: lot.anchor.x + art.minX / 16,
              minY: lot.anchor.y + art.minY / 16,
              maxX: lot.anchor.x + art.maxX / 16,
              maxY: lot.anchor.y + Math.max(2, art.maxY / 16),
            })
          )
            props.push({
              featureId: lot.id,
              propType: lot.buildingType,
              wx: lot.anchor.x * 16,
              wy: lot.anchor.y * 16,
            });
        }
      for (const p of this.furnishings(plan)) add(p.featureId, p.propType, p.wx / 16, p.wy / 16);
    }
    return props;
  }
  protected building(type: string) {
    return denseBuilding(type);
  }
  protected surface(plan: DenseDistrictPlan, x: number, y: number): number {
    return denseSurfaceAt(plan, x, y);
  }
  protected furnishings(plan: DenseDistrictPlan): FeaturePlacement[] {
    const props: FeaturePlacement[] = [],
      { x, y } = plan.center;
    const add = (featureId: string, propType: string, x: number, y: number) =>
      props.push({ featureId, propType, wx: x * 16, wy: y * 16 });
    for (const dx of [-14, 14])
      for (const dy of [-4.5, 4.5])
        add(`${plan.id}:lamp:${dx}:${dy}`, "prop-street-lamp", x + dx, y + dy);
    props.push(...settlementGreenProps(plan));
    return props;
  }
  actors(cx: number, cy: number): ActorPlacement[] {
    const bounds = { minX: cx * 16, minY: cy * 16, maxX: (cx + 1) * 16, maxY: (cy + 1) * 16 };
    return this.districts
      .query(bounds)
      .flatMap((p) => p.actors)
      .filter((a) =>
        intersects(bounds, {
          minX: Math.min(...a.route.map((p) => p.wx / 16)) - 1,
          minY: Math.min(...a.route.map((p) => p.wy / 16)) - 1,
          maxX: Math.max(...a.route.map((p) => p.wx / 16)) + 1,
          maxY: Math.max(...a.route.map((p) => p.wy / 16)) + 1,
        }),
      );
  }
}
