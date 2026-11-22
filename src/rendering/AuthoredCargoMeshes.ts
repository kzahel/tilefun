import { CONSTRUCTION_CRATE, CONSTRUCTION_PALLET } from "../entities/ConstructionCargo.js";

const models: ReadonlyMap<
  string,
  {
    assetId: string;
    path: string;
    lateralScale: number;
    radius: number;
  }
> = new Map([
  [
    CONSTRUCTION_PALLET,
    {
      assetId: "construction-pallet-authored-v1",
      path: "assets/models/construction/pallet-v1.glb",
      lateralScale: 1,
      radius: 22,
    },
  ],
  [
    CONSTRUCTION_CRATE,
    {
      assetId: "construction-crate-authored-v1",
      path: "assets/models/construction/crate-v1.glb",
      lateralScale: 1,
      radius: 22,
    },
  ],
]);
const byAsset = new Map([...models.values()].map((model) => [model.assetId, model]));

export function authoredCargoForType(type: string) {
  return models.get(type);
}

export function authoredCargoForAsset(assetId: string) {
  return byAsset.get(assetId);
}
