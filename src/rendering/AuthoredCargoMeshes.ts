import {
  CONSTRUCTION_CRATE,
  CONSTRUCTION_PALLET,
  WRECKING_BALL,
} from "../entities/ConstructionCargo.js";
import { MARBLE_CHUTE, MARBLE_TRACK, SEESAW, SEESAW_PIVOT } from "../entities/PhysicsPlayground.js";

const playgroundModel = (type: string, radius: number) => ({
  assetId: `${type}-authored-v1`,
  path: `assets/models/construction/${type.replace(/^construction-/, "")}.glb`,
  lateralScale: 1,
  radius,
});

const models: ReadonlyMap<
  string,
  {
    assetId: string;
    path: string;
    lateralScale: number;
    radius: number;
  }
> = new Map([
  [MARBLE_TRACK, playgroundModel(MARBLE_TRACK, 110)],
  [MARBLE_CHUTE, playgroundModel(MARBLE_CHUTE, 30)],
  [SEESAW, playgroundModel(SEESAW, 91)],
  [SEESAW_PIVOT, playgroundModel(SEESAW_PIVOT, 28)],
  [WRECKING_BALL, playgroundModel(WRECKING_BALL, 11)],
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
