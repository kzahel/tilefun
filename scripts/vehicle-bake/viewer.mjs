import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CarMeshAsset } from "../../src/rendering/CarMeshAsset.ts";
import { setCarMeshProjection } from "../../src/rendering/CarMeshProjection.ts";
import { CarPixelOutline } from "../../src/rendering/CarPixelOutline.ts";
import { createWheelRig } from "../authored-assets/runtime/wheel-rig.mjs";

const state = {
  candidate: null,
  asset: null,
  yaw: 45,
  distance: 0,
  mode: "study",
  wireframe: false,
  playing: false,
};
const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
renderer.setSize(128, 128);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
const scene = new THREE.Scene();
const source = new THREE.WebGLRenderTarget(128, 128, { depthBuffer: true });
source.texture.colorSpace = THREE.SRGBColorSpace;
source.texture.magFilter = source.texture.minFilter = THREE.NearestFilter;
source.texture.generateMipmaps = false;
const outline = new CarPixelOutline();
const camera = new THREE.OrthographicCamera(-3.6, 3.6, 3.6, -3.6, 0.01, 1000);
const gameCamera = new THREE.Camera();
const canvas = document.querySelector("#low");
const ctx = canvas.getContext("2d");
const pixels = new Uint8Array(128 * 128 * 4);
const image = ctx.createImageData(128, 128);
const stats = document.querySelector("#stats");
let manifest;
let loadVersion = 0;

function url(path) {
  return window.vehicleBakeOffline?.assets[path] ?? path;
}

async function load(candidate) {
  const version = ++loadVersion;
  const gltf = await new GLTFLoader().loadAsync(url(candidate.glb));
  if (version !== loadVersion) {
    new CarMeshAsset(gltf.scene, 1).dispose();
    return;
  }
  const asset = new CarMeshAsset(gltf.scene, 1, { batch: true });
  let triangles = 0,
    vertices = 0,
    primitives = 0;
  asset.object.traverse((node) => {
    if (!node.isMesh) return;
    triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
    vertices += node.geometry.attributes.position.count;
    primitives += Math.max(1, node.geometry.groups.length);
  });
  state.asset?.dispose();
  state.asset = asset;
  state.candidate = candidate;
  document.querySelector("#candidate").value = candidate.id;
  state.stats = {
    triangles,
    vertices,
    primitives,
    sourceMeshes: asset.meshCount,
    drawMeshes: asset.drawMeshCount,
  };
  state.distance = 0;
  stats.textContent = `${triangles.toLocaleString()} triangles · ${asset.drawMeshCount} draw meshes · one unlit atlas`;
  document.querySelector("#method").textContent = candidate.method ?? candidate.title;
  document.querySelector("#model").href = url(candidate.glb);
  document.querySelector("#atlas").href = url(candidate.atlas);
  document.querySelector("#report").href = url(candidate.report);
  for (const id of ["model", "atlas", "report"]) document.querySelector(`#${id}`).hidden = false;
  if (window.vehicleBakeOffline) {
    for (const [id, name] of [
      ["model", "model.glb"],
      ["atlas", "atlas.png"],
      ["report", "report.json"],
    ])
      document.querySelector(`#${id}`).download = `${candidate.id}-${name}`;
  }
  draw();
}

function draw() {
  if (!state.asset) return;
  const object = state.asset.object;
  const normalized = object.children[0].children[0];
  const s = 80 / 4.6;
  if (state.mode === "study") {
    normalized.rotation.set(0, 0, 0);
    object.rotation.set(0, THREE.MathUtils.degToRad(state.yaw), 0);
    camera.left = camera.bottom = -3.6 * s;
    camera.right = camera.top = 3.6 * s;
    camera.position.set(
      0,
      12 * Math.sin((50 * Math.PI) / 180) * s,
      12 * Math.cos((50 * Math.PI) / 180) * s,
    );
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    // Constant screen registration: source's ground origin at native (64,92).
    camera.projectionMatrix.elements[13] = -28 / 64;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  } else {
    normalized.rotation.set(Math.PI / 2, 0, Math.PI, "ZYX");
    object.rotation.set(0, 0, THREE.MathUtils.degToRad(state.yaw));
    setCarMeshProjection(gameCamera.projectionMatrix, 64);
    gameCamera.projectionMatrixInverse.copy(gameCamera.projectionMatrix).invert();
  }
  object.traverse((node) => {
    if (!node.isMesh) return;
    for (const mat of Array.isArray(node.material) ? node.material : [node.material]) {
      if (mat.wireframe !== state.wireframe) {
        mat.wireframe = state.wireframe;
        mat.needsUpdate = true;
      }
    }
  });
  state.asset.setTravel(state.distance);
  scene.add(object);
  renderer.setRenderTarget(source);
  renderer.setClearColor(0, 0);
  renderer.clear();
  renderer.render(scene, state.mode === "study" ? camera : gameCamera);
  const calls = renderer.info.render.calls;
  outline.render(renderer, source);
  renderer.readRenderTargetPixels(outline.target, 0, 0, 128, 128, pixels);
  for (let y = 0; y < 128; y++) {
    image.data.set(pixels.subarray((127 - y) * 512, (128 - y) * 512), y * 512);
  }
  ctx.putImageData(image, 0, 0);
  scene.remove(object);
  state.stats.bodyDrawCalls = calls;
  document.querySelector("#angle-value").textContent = `${state.yaw.toFixed(1)}°`;
  document.querySelector("#angle").value = String(state.yaw);
  const frame = ((Math.round(state.yaw / 45) % 8) + 8) % 8;
  document.querySelector("#reference").src = url(`reference/view-${frame}.png`);
  document.querySelector("#reference-angle").textContent = `Chosen art target · ${frame * 45}°`;
  document.querySelector("#projection-note").textContent =
    state.mode === "study"
      ? "Same 50° authoring camera, fixed scale and anchor as the chosen target."
      : "Actual shared game projection and pixel-outline shader; ground centered at (64,64). Target art retains its authoring camera.";
}

async function start() {
  manifest =
    window.vehicleBakeOffline?.manifest ?? (await fetch("manifest.json").then((r) => r.json()));
  const select = document.querySelector("#candidate");
  for (const candidate of manifest.candidates) {
    const option = document.createElement("option");
    option.value = candidate.id;
    option.textContent = `${candidate.title}${candidate.id === manifest.recommended ? " · recommended" : ""}`;
    select.append(option);
  }
  const requested = new URLSearchParams(location.search).get("candidate");
  const selected =
    manifest.candidates.find((c) => c.id === requested) ??
    manifest.candidates.find((c) => c.id === manifest.recommended) ??
    manifest.candidates[0];
  if (!selected) throw Error("Candidates are still being prepared.");
  select.value = selected.id;
  await load(selected);
  select.addEventListener("change", () =>
    load(manifest.candidates.find((c) => c.id === select.value)).catch(showError),
  );
  document.querySelector("#angle").addEventListener("input", (event) => {
    state.yaw = Number(event.target.value);
    draw();
  });
  document.querySelector("#projection").addEventListener("change", (event) => {
    state.mode = event.target.value;
    draw();
  });
  document.querySelector("#wireframe").addEventListener("change", (event) => {
    state.wireframe = event.target.checked;
    draw();
  });
  document
    .querySelector("#zoom")
    .addEventListener("change", (event) =>
      document.documentElement.style.setProperty("--zoom", event.target.value),
    );
  document.querySelector("#play").addEventListener("click", (event) => {
    state.playing = !state.playing;
    event.target.textContent = state.playing ? "Pause rotation" : "Rotate + roll";
    event.target.setAttribute("aria-pressed", String(state.playing));
  });
  window.vehicleBake = {
    manifest,
    state,
    load,
    auditRig() {
      state.asset.setTravel(0);
      const rig = createWheelRig(state.asset.object, THREE);
      state.asset.object.updateMatrixWorld(true);
      const baseline = new Map();
      state.asset.object.traverse((node) => {
        if (node.isMesh) baseline.set(node, node.matrixWorld.toArray());
      });
      const checked = [];
      for (const wheel of rig.wheels) {
        const moving = new Set();
        wheel.roll.traverse((node) => moving.add(node));
        const center = wheel.roll.getWorldPosition(new THREE.Vector3());
        rig.setWheelTravel(wheel.id, (wheel.radius * Math.PI) / 2);
        state.asset.object.updateMatrixWorld(true);
        if (Math.abs(wheel.roll.quaternion.angleTo(wheel.restRoll) - Math.PI / 2) > 1e-6)
          throw Error(`Incorrect roll phase: ${wheel.id}`);
        if (wheel.roll.getWorldPosition(new THREE.Vector3()).distanceTo(center) > 1e-6)
          throw Error(`Wheel pivot moved: ${wheel.id}`);
        let changed = 0;
        state.asset.object.traverse((node) => {
          if (!node.isMesh) return;
          const prior = baseline.get(node);
          const differs = node.matrixWorld.elements.some((v, i) => Math.abs(v - prior[i]) > 1e-6);
          if (differs && !moving.has(node))
            throw Error(`Independent wheel moved fixed geometry: ${wheel.id}/${node.name}`);
          if (differs) changed++;
        });
        if (!changed) throw Error(`Wheel contains no moving meshes: ${wheel.id}`);
        rig.setTravel(0);
        checked.push({
          id: wheel.id,
          radius: wheel.radius,
          quarterTurn: true,
          pivotFixed: true,
          independent: true,
        });
      }
      for (const distance of [17, -17, 0, 17, 0]) {
        state.asset.setTravel(distance);
        for (const wheel of rig.wheels) {
          const expected = wheel.restRoll
            .clone()
            .multiply(
              new THREE.Quaternion().setFromAxisAngle(wheel.axis, -distance / wheel.radius),
            );
          if (wheel.roll.quaternion.angleTo(expected) > 1e-6)
            throw Error(`Runtime distance phase mismatch: ${wheel.id}`);
        }
      }
      state.distance = 0;
      draw();
      return { wheels: checked, forwardReverseAbsoluteReset: true };
    },
    pose(yaw, distance = 0, mode = "study", wireframe = false) {
      Object.assign(state, { yaw, distance, mode, wireframe });
      draw();
      return { pixels: Array.from(image.data), stats: state.stats };
    },
  };
  window.vehicleBakeReady = true;
  document.querySelector("#status").textContent =
    "Actual textured GLB · shared engine asset, batching and outline components · no screen-space repaint";
  let previous = performance.now();
  function tick(now) {
    const dt = Math.min(0.1, (now - previous) / 1000);
    previous = now;
    if (state.playing) {
      state.yaw = (state.yaw + dt * 35) % 360;
      state.distance += dt * 12;
      draw();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  addEventListener("pagehide", () => {
    state.asset?.dispose();
    outline.dispose();
    source.dispose();
    renderer.dispose();
  });
}
function showError(error) {
  document.querySelector("#status").textContent = error.message;
  console.error(error);
}
start().catch(showError);
