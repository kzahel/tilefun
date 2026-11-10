import { readFile } from "node:fs/promises";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  authoredVehicleForType,
  vehicleMeshHeightScale,
} from "../../src/rendering/AuthoredVehicleMeshes.js";
import { CarMeshAsset } from "../../src/rendering/CarMeshAsset.js";
import type { ScenarioRecipe } from "../../src/scenarios/ScenarioRecipe.js";
import { sha256 } from "./report.js";

/** The production GLB decoder and receiver compiler; only image decoding is replaced. */
export async function loadReceivers(recipe: ScenarioRecipe) {
  const loader = new GLTFLoader();
  loader.register(() => ({ name: "node-texture", loadTexture: async () => new THREE.Texture() }));
  const assets = new Map<string, CarMeshAsset>();
  const inputs: { assetId: string; sha256: string; triangles: number }[] = [];
  try {
    for (const model of new Set(recipe.parkedVehicles?.map((v) => v.model))) {
      const definition = authoredVehicleForType(`vehicle-v1:${model}`);
      if (!definition) throw Error(`No mesh registration for ${model}`);
      const data = await readFile(`public/${definition.path}`);
      const gltf = await loader.parseAsync(
        data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
        "",
      );
      const asset = new CarMeshAsset(gltf.scene, definition.lateralScale, {
        batch: true,
        heightScale: vehicleMeshHeightScale(model),
        contactShadow: true,
        preserveParts: definition.batchPreserveParts ?? [],
      });
      assets.set(definition.assetId, asset);
      inputs.push({
        assetId: definition.assetId,
        sha256: sha256(data),
        triangles: asset.surfaceGeometry.triangles.length,
      });
    }
    return {
      assets,
      inputs,
      dispose: () => {
        for (const asset of assets.values()) asset.dispose();
      },
    };
  } catch (error) {
    for (const asset of assets.values()) asset.dispose();
    throw error;
  }
}
