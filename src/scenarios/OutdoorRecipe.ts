import { required } from "../art/ArtCatalog.js";
import {
  type OutdoorAsset,
  type OutdoorMetadata,
  outdoorProp,
} from "../assets/outdoor/OutdoorCatalog.js";
import { ENTITY_FACTORIES } from "../entities/EntityFactories.js";
import { FLAT_SCENARIO, type ScenarioRecipe, scenarioWalls } from "./ScenarioRecipe.js";
export function outdoorRecipe(asset: OutdoorAsset, metadata: OutdoorMetadata): ScenarioRecipe {
  const width = Math.max(240, asset.rect[2] + 100),
    height = Math.max(180, asset.rect[3] + 120);
  return {
    version: 1,
    id: `outdoor-${asset.id}`,
    generation: FLAT_SCENARIO,
    player: required(ENTITY_FACTORIES.person1)(0, 40),
    physics: { walkSpeed: 60 },
    props: [
      outdoorProp(asset, metadata, 0, 0),
      ...scenarioWalls(-width / 2, -height + 40, width / 2, 70),
    ],
  };
}
