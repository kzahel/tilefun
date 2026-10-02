import { buildingRecipe } from "./BuildingRecipes.js";
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
  protected override building(type: string) {
    const recipe = buildingRecipe(type);
    if (!recipe) throw new Error(`Missing city recipe: ${type}`);
    return recipe;
  }
  protected override surface(plan: DenseDistrictPlan, x: number, y: number) {
    return cityPlacesSurfaceAt(plan as CityPlacesPlan, x, y);
  }
  protected override furnishings(plan: DenseDistrictPlan) {
    const p = plan as CityPlacesPlan;
    return [
      ...p.commercial.furniture,
      ...(p.recipe === "city-places-v7"
        ? super.furnishings(plan).filter((p) => p.featureId.includes(":green:"))
        : []),
      ...p.places.flatMap((p) => p.furniture),
    ];
  }
}
