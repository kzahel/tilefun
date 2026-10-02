import {
  type CommercialDistrictPlan,
  CommercialDistrictSource,
  commercialDistrictSurfaceAt,
} from "./CommercialDistrictPlanner.js";
import type { DenseDistrictPlan } from "./DenseDistrictPlanner.js";
import { DenseDistrictStrategy } from "./DenseDistrictStrategy.js";
import type { FeaturePlacement } from "./DistrictStrategy.js";
import type { RegionalWorld } from "./WorldDescriptor.js";

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
