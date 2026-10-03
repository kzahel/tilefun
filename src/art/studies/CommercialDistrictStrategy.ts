/** Authoring study only. Playable worlds use the current regional generator. */
import {
  type CommercialDistrictPlan,
  CommercialDistrictSource,
  commercialDistrictSurfaceAt,
} from "../../generation/regional/CommercialDistrictPlanner.js";
import type { DenseDistrictPlan } from "../../generation/regional/DenseDistrictPlanner.js";
import { DenseDistrictStrategy } from "../../generation/regional/DenseDistrictStrategy.js";
import type { FeaturePlacement } from "../../generation/regional/DistrictStrategy.js";
import type { RegionalWorld } from "../../generation/regional/WorldDescriptor.js";

export class CommercialDistrictStrategy extends DenseDistrictStrategy {
  override readonly districts: CommercialDistrictSource;
  constructor(world: RegionalWorld) {
    super(world);
    this.districts = new CommercialDistrictSource(world);
  }
  protected override surface(plan: DenseDistrictPlan, x: number, y: number) {
    return commercialDistrictSurfaceAt(plan as CommercialDistrictPlan, x, y);
  }
  protected override furnishings(plan: DenseDistrictPlan): FeaturePlacement[] {
    return [
      ...(plan as CommercialDistrictPlan).commercial.furniture,
      ...super.furnishings(plan).filter((p) => p.featureId.includes(":green:")),
    ];
  }
}
