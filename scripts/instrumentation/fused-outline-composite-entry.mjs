// Diagnostic only: compare shipping outline + composite with a fused composite.
import * as THREE from "three";
import {
  AUTHORED_VEHICLE_MESHES,
  vehicleMeshHeightScale,
} from "../../src/rendering/AuthoredVehicleMeshes.ts";
import { loadCarMesh } from "../../src/rendering/CarMeshAsset.ts";
import { setCarMeshProjection } from "../../src/rendering/CarMeshProjection.ts";
import { CarPixelOutline } from "../../src/rendering/CarPixelOutline.ts";
import { GpuRasterSurface } from "../../src/rendering/GpuRasterSurface.ts";

const canvas = document.querySelector("canvas"),
  surface = new GpuRasterSurface(canvas);
surface.setBatchTextureLimit(1);
const renderer = surface.renderer,
  original = surface.material,
  fusion = original.clone();
const ink = new THREE.Color().setRGB(58 / 255, 58 / 255, 80 / 255, THREE.SRGBColorSpace);
fusion.uniforms.inkColor = { value: ink };
fusion.uniforms.imageSize = { value: new THREE.Vector2() };
fusion.fragmentShader = fusion.fragmentShader
  .replace(
    "void main(){",
    `uniform vec3 inkColor;uniform vec2 imageSize;
bool occupied(ivec2 p){if(any(lessThan(p,ivec2(0)))||any(greaterThanEqual(p,ivec2(imageSize))))return false;return texelFetch(image,p,0).a>=128.0/255.0;}
void main(){`,
  )
  .replace(
    "vec4 c=texture2D(image,uv0)*color0;",
    `vec4 c=texture2D(image,uv0);ivec2 p=ivec2(floor(uv0*imageSize));
if(occupied(p)&&!(occupied(p+ivec2(-1,0))&&occupied(p+ivec2(1,0))&&occupied(p+ivec2(0,-1))&&occupied(p+ivec2(0,1)))){
if(dot(c.rgb,vec3(1.0))>dot(inkColor,vec3(1.0))+0.5/255.0)c.rgb=inkColor;}c*=color0;`,
  );
if (!fusion.fragmentShader.includes("ivec2 p=ivec2(floor")) throw Error("Composite marker changed");
const outline = new CarPixelOutline(),
  source = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: true });
source.texture.colorSpace = THREE.SRGBColorSpace;
source.texture.magFilter = source.texture.minFilter = THREE.NearestFilter;
source.texture.generateMipmaps = false;
const camera = new THREE.Camera(),
  scene = new THREE.Scene();
function material(m) {
  surface.flush();
  surface.material = m;
  surface.mesh.material = m;
}
function read() {
  surface.flush();
  const gl = renderer.getContext();
  const b = new Uint8Array(canvas.width * canvas.height * 4);
  gl.readPixels(0, 0, canvas.width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, b);
  return b;
}
function composite(texture, size, scale, alpha, m) {
  material(original);
  renderer.setRenderTarget(null);
  renderer.setClearColor(0, 0);
  surface.beginFrame();
  surface.globalAlpha = 1;
  surface.fillStyle = "#596d7d";
  surface.fillRect(0, 0, 512, 512);
  // Ordinary painter order: an opaque rear band, the car, then a translucent foreground prop.
  surface.fillStyle = "#c5a467";
  surface.fillRect(120.25, 170.75, 260, 32);
  surface.flush();
  material(m);
  if (m === fusion) fusion.uniforms.imageSize.value.set(size, size);
  surface.globalAlpha = alpha;
  surface.drawTexture(
    texture,
    256.25 - (size * scale) / 2,
    256.75 - (size * scale) / 2,
    size * scale,
    size * scale,
  );
  surface.flush();
  material(original);
  surface.globalAlpha = 0.6;
  surface.fillStyle = "#3c9b7e";
  surface.fillRect(240.5, 240.25, 90, 100);
  surface.globalAlpha = 1;
  return read();
}
window.run = async () => {
  const rows = [],
    failures = [];
  let pairs = 0,
    totalPixels = 0,
    maxChannelError = 0;
  try {
    for (const name of ["compact-1", "fire-truck-ladder-2", "dump-truck"]) {
      const def = AUTHORED_VEHICLE_MESHES.find((m) => m.vehicle === name);
      if (!def) throw Error(name);
      const asset = await loadCarMesh(def.path, def.lateralScale, {
        batch: true,
        heightScale: vehicleMeshHeightScale(name),
        contactShadow: true,
        preserveParts: def.batchPreserveParts ?? [],
      });
      const size = def.radius * 2;
      source.setSize(size, size);
      setCarMeshProjection(camera.projectionMatrix, def.radius);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      let modelPairs = 0,
        modelMismatches = 0;
      try {
        for (const yaw of [0, 0.57, Math.PI / 2, Math.PI + 0.21]) {
          asset.object.rotation.set(0, 0, yaw);
          asset.setTravel(17);
          asset.setEmergency(true, 0.1);
          asset.setDumpBed(name === "dump-truck" ? 0.4 : 0, 0.2);
          renderer.setRenderTarget(source);
          renderer.setClearColor(0, 0);
          renderer.clear();
          scene.add(asset.object);
          renderer.render(scene, camera);
          scene.remove(asset.object);
          const body = new Uint8Array(size * size * 4);
          renderer.readRenderTargetPixels(source, 0, 0, size, size, body);
          if (!body.some((value, index) => index % 4 === 3 && value >= 128))
            throw Error(`Empty body render: ${name}`);
          const painted = outline.render(renderer, source);
          for (const scale of [0.3, 0.75, 3])
            for (const alpha of [1, 0.65]) {
              const baseline = composite(painted, size, scale, alpha, original),
                candidate = composite(source.texture, size, scale, alpha, fusion);
              let pixels = 0,
                max = 0;
              for (let i = 0; i < baseline.length; i += 4) {
                let mismatch = false;
                for (let j = 0; j < 4; j++) {
                  const d = Math.abs(baseline[i + j] - candidate[i + j]);
                  max = Math.max(max, d);
                  mismatch ||= d !== 0;
                }
                pixels += Number(mismatch);
              }
              pairs++;
              modelPairs++;
              totalPixels += pixels;
              maxChannelError = Math.max(maxChannelError, max);
              modelMismatches += Number(pixels > 0);
              if (pixels && failures.length < 12)
                failures.push({ name, yaw, scale, alpha, pixels, max });
            }
        }
      } finally {
        asset.dispose();
      }
      rows.push({
        name,
        path: def.path,
        assetId: def.assetId,
        resolution: size,
        pairs: modelPairs,
        mismatchedPairs: modelMismatches,
      });
    }
    if (renderer.getContext().getError() !== renderer.getContext().NO_ERROR)
      throw Error("WebGL error");
    return {
      schema: "tilefun-fused-outline-composite-probe/v1",
      preview: canvas.toDataURL("image/png"),
      threeRevision: THREE.REVISION,
      pairs,
      totalMismatchingPixels: totalPixels,
      maxChannelError,
      rows,
      failures,
      limits:
        "Scratch GPU experiment using production body loader/projection/outline and raster surface. Three actual models/four yaws/three scales/two alpha values; same painter order with background/rear band/translucent foreground. No cargo/tow pair/paint variants/context-loss/phone performance acceptance.",
    };
  } finally {
    material(original);
    fusion.dispose();
    source.dispose();
    outline.dispose();
    surface.dispose();
  }
};
