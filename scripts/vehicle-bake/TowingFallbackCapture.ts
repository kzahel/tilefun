import * as THREE from "three";
import { required } from "../../src/art/ArtCatalog.js";
import {
  authoredVehicleForType,
  vehicleMeshHeightScale,
} from "../../src/rendering/AuthoredVehicleMeshes.js";
import { loadCarMesh } from "../../src/rendering/CarMeshAsset.js";
import { setCarMeshProjection } from "../../src/rendering/CarMeshProjection.js";
import { CarPixelOutline } from "../../src/rendering/CarPixelOutline.js";
import { VehiclePaintResources } from "../../src/rendering/VehiclePaintResources.js";
import { towMeshOffset, towPitch } from "../../src/traffic/Towing.js";
import profiles from "../../src/traffic/towing-profiles.json" with { type: "json" };
import { vehiclePaintSchemes } from "../../src/traffic/VehiclePaint.js";

export async function captureTowingFallbacks() {
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const outline = new CarPixelOutline(),
    paints = new VehiclePaintResources();
  const rows = Object.keys(profiles).flatMap((model) => [
    { model, paint: undefined },
    ...vehiclePaintSchemes(model).map((paint) => ({ model, paint })),
  ]);
  const cars = document.createElement("canvas"),
    truck = document.createElement("canvas");
  cars.width = 4 * 160;
  cars.height = rows.length * 160;
  truck.width = 4 * 224;
  truck.height = 2 * 224;
  const carContext = required(cars.getContext("2d")),
    truckContext = required(truck.getContext("2d"));
  const keys: string[] = [];
  async function capture(
    model: string,
    size: number,
    row: number,
    context: CanvasRenderingContext2D,
    active: boolean,
    paint?: ReturnType<typeof vehiclePaintSchemes>[number],
  ) {
    const definition = required(authoredVehicleForType(`vehicle-v1:${model}`));
    const asset = await loadCarMesh(definition.path, definition.lateralScale, {
      batch: true,
      heightScale: vehicleMeshHeightScale(model),
      contactShadow: true,
      preserveParts: definition.batchPreserveParts ?? [],
    });
    const scene = new THREE.Scene(),
      camera = new THREE.Camera(),
      target = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
    target.texture.colorSpace = THREE.SRGBColorSpace;
    target.texture.magFilter = target.texture.minFilter = THREE.NearestFilter;
    setCarMeshProjection(camera.projectionMatrix, size / 2);
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    const entity = {
      type: `vehicle-v1:${model}`,
      ...(model !== "tow-truck" ? { towedBy: 1 } : {}),
    };
    const pitch = towPitch(entity),
      offset = towMeshOffset(entity);
    let restore: (() => void) | undefined, texture: THREE.Texture | undefined;
    try {
      if (paint) {
        texture = await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL + paint.atlas);
        texture.flipY = false;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        restore = paints.bind(asset.object, texture);
      }
      asset.setTowLift(active);
      asset.setTravel(0, pitch > 0);
      asset.setEmergency(false, 0);
      scene.add(asset.object);
      for (const [col, yaw] of [Math.PI / 2, -Math.PI / 2, Math.PI, 0].entries()) {
        asset.object.quaternion
          .setFromAxisAngle(new THREE.Vector3(0, 0, 1), yaw)
          .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -pitch));
        asset.object.position.set(offset.x * Math.cos(yaw), offset.x * Math.sin(yaw), offset.z);
        renderer.setRenderTarget(target);
        renderer.setClearColor(0, 0);
        renderer.clear();
        renderer.render(scene, camera);
        outline.render(renderer, target);
        const pixels = new Uint8Array(size * size * 4);
        renderer.readRenderTargetPixels(outline.target, 0, 0, size, size, pixels);
        const image = context.createImageData(size, size);
        for (let y = 0; y < size; y++)
          image.data.set(
            pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4),
            y * size * 4,
          );
        context.putImageData(image, col * size, row * size);
      }
    } finally {
      restore?.();
      texture?.dispose();
      asset.dispose();
      target.dispose();
    }
  }
  try {
    for (const [row, entry] of rows.entries()) {
      keys.push(`${entry.model}:${entry.paint?.id ?? ""}`);
      await capture(entry.model, 160, row, carContext, false, entry.paint);
    }
    await capture("tow-truck", 224, 0, truckContext, false);
    await capture("tow-truck", 224, 1, truckContext, true);
    return {
      cars: cars.toDataURL("image/png"),
      truck: truck.toDataURL("image/png"),
      frames: { revision: "v2", carSize: 160, truckSize: 224, keys },
    };
  } finally {
    paints.dispose();
    outline.dispose();
    renderer.dispose();
  }
}
