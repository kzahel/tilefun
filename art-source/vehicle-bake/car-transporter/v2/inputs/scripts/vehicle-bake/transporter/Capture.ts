import * as THREE from "three";
import { required } from "../../../src/art/ArtCatalog.js";
import { loadCarMesh } from "../../../src/rendering/CarMeshAsset.js";
import { setCarMeshProjection } from "../../../src/rendering/CarMeshProjection.js";
import { CarPixelOutline } from "../../../src/rendering/CarPixelOutline.js";

export async function captureTransporter() {
  const size = 384,
    renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
    });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const outline = new CarPixelOutline(),
    target = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  target.texture.magFilter = target.texture.minFilter = THREE.NearestFilter;
  const asset = await loadCarMesh("assets/models/vehicles/car-transporter-v2.glb", 1, {
    batch: true,
    contactShadow: true,
  });
  const scene = new THREE.Scene(),
    camera = new THREE.Camera();
  setCarMeshProjection(camera.projectionMatrix, size / 2);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  scene.add(asset.object);
  const sheet = document.createElement("canvas");
  sheet.width = size * 4;
  sheet.height = size * 2;
  const context = required(sheet.getContext("2d"));
  const normal = document.createElement("canvas");
  normal.width = 192;
  normal.height = 896;
  const normalContext = required(normal.getContext("2d"));
  const views: string[] = [];
  try {
    for (const deployed of [false, true]) {
      asset.setTransportRamp(deployed);
      asset.setTravel(0);
      for (let i = 0; i < 16; i++) {
        const yaw = (i * Math.PI) / 8;
        asset.object.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), yaw);
        renderer.setRenderTarget(target);
        renderer.setClearColor(0, 0);
        renderer.clear();
        renderer.render(scene, camera);
        outline.render(renderer, target);
        const data = new Uint8Array(size * size * 4);
        renderer.readRenderTargetPixels(outline.target, 0, 0, size, size, data);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const c = required(canvas.getContext("2d")),
          im = c.createImageData(size, size);
        for (let y = 0; y < size; y++)
          im.data.set(
            data.subarray((size - 1 - y) * size * 4, (size - y) * size * 4),
            y * size * 4,
          );
        c.putImageData(im, 0, 0);
        views.push(canvas.toDataURL());
        const col = ({ 4: 0, 12: 1, 8: 2, 0: 3 } as Record<number, number>)[i];
        if (col !== undefined) {
          context.drawImage(canvas, col * size, Number(deployed) * size);
          if (!deployed) normalContext.drawImage(canvas, 96 - size / 2, col * 224 + 144 - size / 2);
        }
      }
    }
    asset.setTransportRamp(false);
    asset.object.quaternion.identity();
    asset.object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(asset.object);
    return {
      sheet: sheet.toDataURL(),
      normal: normal.toDataURL(),
      views,
      bounds: { min: box.min.toArray(), max: box.max.toArray() },
      meshes: asset.meshCount,
      draws: asset.drawMeshCount,
    };
  } finally {
    asset.dispose();
    outline.dispose();
    target.dispose();
    renderer.dispose();
  }
}
