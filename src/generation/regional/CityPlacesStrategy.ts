import {
  type CityPlacesPlan,
  type CityPlacesRevision,
  CityPlacesSource,
  cityPlacesSurfaceAt,
} from "./CityPlacesPlanner.js";
import type { DenseDistrictPlan } from "./DenseDistrictPlanner.js";
import { DenseDistrictStrategy } from "./DenseDistrictStrategy.js";
import type { RegionalWorld } from "./WorldDescriptor.js";
export class CityPlacesStrategy extends DenseDistrictStrategy {
  override readonly districts: CityPlacesSource;
  constructor(world: RegionalWorld, revision: CityPlacesRevision) {
    super(world);
    this.districts = new CityPlacesSource(world, revision);
  }
  protected override surface(plan: DenseDistrictPlan, x: number, y: number) {
    return cityPlacesSurfaceAt(plan as CityPlacesPlan, x, y);
  }
  protected override furnishings(plan: DenseDistrictPlan) {
    const p = plan as CityPlacesPlan;
    return [
      ...p.commercial.furniture,
      ...super.furnishings(plan).filter((p) => p.featureId.includes(":green:")),
      ...p.places.flatMap((p) => p.furniture),
    ];
  }
}
