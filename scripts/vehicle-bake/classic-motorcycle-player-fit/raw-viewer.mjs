/** Actual two-wheel GLTF source diagnostic. No CarMeshAsset or fake car rig. */
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { setCarMeshProjection } from "../../../src/rendering/CarMeshProjection.ts";
import { CarPixelOutline } from "../../../src/rendering/CarPixelOutline.ts";

const config = window.cycleOffline?.config ?? (await fetch("recipe.json").then((r) => r.json()));
document.querySelector("h1").textContent = config.draftPurpose
  ? `Unchanged classic controls · ${config.rider.label} fit failure`
  : `Classic motorcycle · ${config.rider.label} controls`;
if (config.draftPurpose) {
  document.querySelector(".note").textContent = config.draftPurpose;
  document.querySelectorAll(".limits")[1].textContent =
    "Retained failed comparison: immutable original classic bike and unchanged rider at one saddle-contact mount. Hand/foot anchors miss original controls and actual tank intersections remain. This is failure evidence, not a qualified fit.";
}
const asset = (id, path) => window.cycleOffline?.assets[id] ?? path;
const loader = new GLTFLoader();
const [bike, independentBike, rider] = await Promise.all([
  loader.loadAsync(asset("bike", "model.glb")).then((g) => g.scene),
  loader.loadAsync(asset("bike", "model.glb")).then((g) => g.scene),
  loader.loadAsync(asset("rider", "rider-reference.glb")).then((g) => g.scene),
]);
const scale = config.exportWorldScale;
const mount = config.riderMountSource;
rider.position.set(mount[0] * scale, mount[2] * scale, -mount[1] * scale);
const outer = new THREE.Group();
const basis = new THREE.Group();
outer.add(basis);
basis.add(bike, independentBike, rider);
const scene = new THREE.Scene();
scene.add(outer);
const originals = new Map();
for (const root of [bike, independentBike, rider])
  root.traverse((o) => {
    if (!o.isMesh) return;
    originals.set(o, o.material);
    o.material.toneMapped = false;
    for (const value of Object.values(o.material))
      if (value instanceof THREE.Texture) {
        value.magFilter = value.minFilter = THREE.NearestFilter;
        value.generateMipmaps = false;
        value.needsUpdate = true;
      }
  });
const rigs = [bike, independentBike].map((root) =>
  ["F", "R"].map((id) => {
    const roll = root.getObjectByName(`Wheel_${id}_Roll`);
    const steer = root.getObjectByName(`Wheel_${id}_Steer`);
    if (!roll || roll.parent !== steer || !(roll.userData.wheel_radius > 0))
      throw Error(`Bad true ${id} rig`);
    return {
      id,
      roll,
      steer,
      steerRest: steer.quaternion.clone(),
      radius: roll.userData.wheel_radius,
      rest: roll.quaternion.clone(),
      axis: new THREE.Vector3(...roll.userData.roll_axis_gltf),
    };
  }),
);
const marker = bike.getObjectByName("Motorcycle_Root");
if (
  marker?.userData.tilefun_motorcycle !== 1 ||
  JSON.stringify(marker.userData.wheel_ids) !== '["F","R"]'
)
  throw Error("Missing true motorcycle marker");
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const target = new THREE.WebGLRenderTarget(224, 224, { depthBuffer: true });
target.texture.colorSpace = THREE.SRGBColorSpace;
target.texture.magFilter = target.texture.minFilter = THREE.NearestFilter;
target.texture.generateMipmaps = false;
const outline = new CarPixelOutline();
const study = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
const game = new THREE.Camera();
const canvas = document.querySelector("#native");
const context = canvas.getContext("2d");
let size = 224;
let pixels, raw, image;
function setNativeSize(n = 224) {
  if (!Number.isInteger(n) || n < 128 || n % 2) throw Error("Invalid padding size");
  size = n;
  renderer.setSize(size, size);
  target.setSize(size, size);
  canvas.width = canvas.height = size;
  pixels = new Uint8Array(size * size * 4);
  raw = new Uint8Array(pixels.length);
  image = context.createImageData(size, size);
}
setNativeSize();
const state = {
  yaw: 45,
  mode: "study",
  view: "combined",
  wire: false,
  distance: 0,
  wheelDistances: null,
  steerRadians: 0,
};
const red = new THREE.MeshBasicMaterial({ color: 0xff0000, toneMapped: false });
const blue = new THREE.MeshBasicMaterial({ color: 0x0000ff, toneMapped: false });
const wireMaterial = new THREE.MeshBasicMaterial({
  color: 0xd6e2f0,
  wireframe: true,
  toneMapped: false,
});
function render(options = {}) {
  Object.assign(state, options);
  const { yaw, mode, view, wire, distance, wheelDistances, steerRadians } = state;
  if (mode === "study") {
    basis.rotation.set(0, 0, 0);
    outer.rotation.set(0, THREE.MathUtils.degToRad(yaw), 0);
    study.left = study.bottom = -3.6 * scale * (size / 128);
    study.right = study.top = 3.6 * scale * (size / 128);
    study.position.set(
      0,
      12 * Math.sin((50 * Math.PI) / 180) * scale,
      12 * Math.cos((50 * Math.PI) / 180) * scale,
    );
    study.lookAt(0, 0, 0);
    study.updateProjectionMatrix();
    study.projectionMatrix.elements[13] = -28 / (size / 2);
    study.projectionMatrixInverse.copy(study.projectionMatrix).invert();
  } else {
    basis.rotation.set(Math.PI / 2, 0, Math.PI, "ZYX");
    outer.rotation.set(0, 0, THREE.MathUtils.degToRad(yaw));
    setCarMeshProjection(game.projectionMatrix, size / 2);
    game.projectionMatrixInverse.copy(game.projectionMatrix).invert();
  }
  for (const rig of rigs)
    for (const w of rig) {
      w.steer.quaternion
        .copy(w.steerRest)
        .multiply(
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            w.id === "F" ? steerRadians : 0,
          ),
        );
      const travel = wheelDistances?.[w.id] ?? distance;
      w.roll.quaternion
        .copy(w.rest)
        .multiply(new THREE.Quaternion().setFromAxisAngle(w.axis, -travel / w.radius));
    }
  bike.visible = !["bike-alone", "rider-alone"].includes(view);
  independentBike.visible = view === "bike-alone";
  rider.visible = !["bike-alone", "rider-hidden"].includes(view);
  for (const root of [bike, independentBike, rider])
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = wire
        ? wireMaterial
        : view === "ownership-mask"
          ? root === rider
            ? red
            : blue
          : originals.get(o);
      o.material.wireframe = wire;
      o.material.colorWrite = !(view === "visible-rider-mask" && root !== rider);
      o.renderOrder = root === rider ? 1 : 0;
    });
  outer.updateMatrixWorld(true);
  renderer.setRenderTarget(target);
  renderer.setClearColor(0, 0);
  renderer.clear();
  renderer.render(scene, mode === "study" ? study : game);
  const drawCalls = renderer.info.render.calls;
  renderer.readRenderTargetPixels(target, 0, 0, size, size, raw);
  if (wire) pixels.set(raw);
  else {
    outline.render(renderer, target);
    renderer.readRenderTargetPixels(outline.target, 0, 0, size, size, pixels);
  }
  for (let y = 0; y < size; y++)
    image.data.set(pixels.subarray((size - 1 - y) * size * 4, (size - y) * size * 4), y * size * 4);
  context.putImageData(image, 0, 0);
  let count = 0,
    edgePixels = 0;
  let minX = size,
    minY = size,
    maxX = -1,
    maxY = -1;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (image.data[(y * size + x) * 4 + 3]) {
        count++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        if (!x || !y || x === size - 1 || y === size - 1) edgePixels++;
      }
  document.querySelector("#yaw").value = String(yaw);
  document.querySelector("#mode").value = mode;
  document.querySelector("#view").value = view;
  document.querySelector("#wire").checked = wire;
  document.querySelector("#pose").textContent =
    `${view} · ${mode} ${yaw}° · ${size}px, fixed density80/4.6 · raw GLTF, shared review pending`;
  return {
    yaw,
    mode,
    view,
    wire,
    distance,
    wheelDistances,
    nativeSize: size,
    drawCalls,
    edgePixels,
    occupiedPixels: count,
    bounds: { minX, minY, maxX, maxY },
    png: canvas.toDataURL().split(",")[1],
    pixels: Array.from(image.data),
    rawPixels: Array.from(raw),
  };
}
for (const id of ["yaw", "mode", "view", "wire"])
  document.querySelector(`#${id}`).addEventListener("input", () =>
    render({
      yaw: Number(document.querySelector("#yaw").value),
      mode: document.querySelector("#mode").value,
      view: document.querySelector("#view").value,
      wire: document.querySelector("#wire").checked,
    }),
  );
document.querySelector("#zoom").addEventListener("input", (e) => {
  canvas.style.width = `${size * Number(e.target.value)}px`;
  canvas.style.height = "auto";
});
window.cycleRaw = {
  render,
  setNativeSize,
  state,
  bike,
  independentBike,
  rider,
  rigs,
  config,
  oneActualDepthTarget: true,
  CarMeshAssetUsed: false,
  sharedCycleQualification: "pending parent actual shared loader/browser review",
  dispose() {
    renderer.dispose();
    target.dispose();
    outline.dispose();
  },
};
render();
window.cycleRawReady = true;
