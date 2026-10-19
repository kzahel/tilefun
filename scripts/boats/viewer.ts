import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CarMeshAsset } from "../../src/rendering/CarMeshAsset.js";
import { setCarMeshProjection } from "../../src/rendering/CarMeshProjection.js";
import { CarPixelOutline } from "../../src/rendering/CarPixelOutline.js";

function needed<T>(value: T | null): T {
  if (value === null) throw Error("Boat preview element unavailable");
  return value;
}
const canvas = needed(document.querySelector<HTMLCanvasElement>("canvas"));
const context = needed(canvas.getContext("2d"));
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
renderer.setSize(128, 128);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene(),
  camera = new THREE.Camera();
setCarMeshProjection(camera.projectionMatrix, 64);
camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
const source = new THREE.WebGLRenderTarget(128, 128, { depthBuffer: true });
source.texture.colorSpace = THREE.SRGBColorSpace;
source.texture.magFilter = source.texture.minFilter = THREE.NearestFilter;
source.texture.generateMipmaps = false;
const outline = new CarPixelOutline();
const gltf = await new GLTFLoader().loadAsync(new URL("inputs/model.glb", location.href).href);
const asset = new CarMeshAsset(gltf.scene, 1, { batch: true, preserveParts: ["Boat_Propeller"] });
scene.add(asset.object);
const pixels = new Uint8Array(128 * 128 * 4),
  image = context.createImageData(128, 128);
let yaw = 45,
  travel = 0,
  playing = false;
function pose(angle: number, distance = 0) {
  yaw = angle;
  travel = distance;
  asset.object.rotation.z = (angle * Math.PI) / 180;
  asset.setTravel(distance);
  renderer.setRenderTarget(source);
  renderer.setClearColor(0, 0);
  renderer.clear();
  renderer.render(scene, camera);
  outline.render(renderer, source);
  renderer.readRenderTargetPixels(outline.target, 0, 0, 128, 128, pixels);
  for (let y = 0; y < 128; y++)
    image.data.set(pixels.subarray((127 - y) * 512, (128 - y) * 512), y * 512);
  context.putImageData(image, 0, 0);
  return canvas.toDataURL();
}
Object.assign(window, {
  boatReview: {
    pose,
    stats: { meshes: asset.meshCount, drawMeshes: asset.drawMeshCount },
    ready: true,
  },
});
needed(document.querySelector<HTMLInputElement>("#heading")).oninput = (e) =>
  pose(Number((e.target as HTMLInputElement).value), travel);
needed(document.querySelector<HTMLButtonElement>("button")).onclick = () => {
  playing = !playing;
};
let previous = performance.now();
function tick(now: number) {
  if (playing) pose(yaw, travel + (now - previous) * 0.04);
  previous = now;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
pose(yaw);
