import { type OutdoorAsset, type OutdoorMetadata, outdoorProp } from "./OutdoorCatalog.js";
import bank from "./outdoor-runtime-v1.json";

const assets = bank.assets as {
  id: string;
  rect: OutdoorAsset["rect"];
  metadata: OutdoorMetadata;
}[];
export const outdoorRuntimeAsset = (type: string) =>
  type.startsWith("outdoor:") ? assets.find((a) => `outdoor:${a.id}` === type) : undefined;
export function outdoorRuntimeProp(type: string, wx: number, wy: number) {
  const asset = outdoorRuntimeAsset(type);
  return asset ? outdoorProp(asset, asset.metadata, wx, wy) : null;
}
