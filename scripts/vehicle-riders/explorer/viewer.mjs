import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CarMeshAsset } from "../../../src/rendering/CarMeshAsset.ts";
import { setCarMeshProjection } from "../../../src/rendering/CarMeshProjection.ts";
import { CarPixelOutline } from "../../../src/rendering/CarPixelOutline.ts";

async function start() {
  const config = window.riderOffline?.config ?? (await fetch("rider.json").then((r) => r.json()));
  const assetURL = (id, path) => window.riderOffline?.assets[id] ?? path;
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
  renderer.setSize(224, 224);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  const source = new THREE.WebGLRenderTarget(224, 224, { depthBuffer: true });
  source.texture.colorSpace = THREE.SRGBColorSpace;
  source.texture.magFilter = source.texture.minFilter = THREE.NearestFilter;
  source.texture.generateMipmaps = false;
  const outline = new CarPixelOutline();
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 1000);
  const gameCamera = new THREE.Camera();
  const loader = new GLTFLoader();
  const carGLTF = await loader.loadAsync(
    assetURL("car", `/tilefun/${config.carControl.glb.replace(/^public\//, "")}`),
  );
  const car = new CarMeshAsset(carGLTF.scene, 1, { batch: true });
  const normalized = car.object.children[0].children[0];
  const carRoot = normalized.children[0];
  const riderGLTF = await loader.loadAsync(assetURL("rider", "rider.glb"));
  const rider = riderGLTF.scene;
  rider.position.fromArray(config.socketTranslationGLTFWorld);
  normalized.add(rider);
  rider.traverse((o) => {
    if (!o.isMesh) return;
    o.material.toneMapped = false;
    for (const value of Object.values(o.material))
      if (value instanceof THREE.Texture) {
        value.magFilter = value.minFilter = THREE.NearestFilter;
        value.generateMipmaps = false;
        value.needsUpdate = true;
      }
  });
  scene.add(car.object);
  const state = { yaw: 45, mode: "study", view: "combined", wire: false };
  const canvas = document.querySelector("#native");
  const ctx = canvas.getContext("2d");
  const pixels = new Uint8Array(224 * 224 * 4);
  const image = ctx.createImageData(224, 224);
  function render(yaw = state.yaw, mode = state.mode, view = state.view, wire = state.wire) {
    Object.assign(state, { yaw, mode, view, wire });
    const s = config.worldScale;
    if (mode === "study") {
      normalized.rotation.set(0, 0, 0);
      car.object.rotation.set(0, THREE.MathUtils.degToRad(yaw), 0);
      camera.left = camera.bottom = -3.6 * s * (224 / 128);
      camera.right = camera.top = 3.6 * s * (224 / 128);
      camera.position.set(
        0,
        12 * Math.sin((50 * Math.PI) / 180) * s,
        12 * Math.cos((50 * Math.PI) / 180) * s,
      );
      camera.lookAt(0, 0, 0);
      camera.updateProjectionMatrix();
      camera.projectionMatrix.elements[13] = -28 / 112;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    } else {
      normalized.rotation.set(Math.PI / 2, 0, Math.PI, "ZYX");
      car.object.rotation.set(0, 0, THREE.MathUtils.degToRad(yaw));
      setCarMeshProjection(gameCamera.projectionMatrix, 112);
      gameCamera.projectionMatrixInverse.copy(gameCamera.projectionMatrix).invert();
    }
    carRoot.visible = view !== "rider";
    rider.visible = view !== "bare";
    for (const root of [carRoot, rider])
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.material.wireframe = wire;
        o.material.colorWrite = !(view === "visible-mask" && root === carRoot);
        o.renderOrder = root === carRoot ? 0 : 1;
      });
    car.setTravel(0);
    renderer.setRenderTarget(source);
    renderer.setClearColor(0, 0);
    renderer.clear();
    renderer.render(scene, mode === "study" ? camera : gameCamera);
    const raw = new Uint8Array(pixels.length);
    renderer.readRenderTargetPixels(source, 0, 0, 224, 224, raw);
    const rawOccupied = raw.filter((v, i) => i % 4 === 3 && v > 0).length;
    outline.render(renderer, source);
    renderer.readRenderTargetPixels(outline.target, 0, 0, 224, 224, pixels);
    for (let y = 0; y < 224; y++)
      image.data.set(pixels.subarray((223 - y) * 224 * 4, (224 - y) * 224 * 4), y * 224 * 4);
    ctx.putImageData(image, 0, 0);
    let edgePixels = 0;
    for (let y = 0; y < 224; y++)
      for (let x = 0; x < 224; x++)
        if ((x === 0 || y === 0 || x === 223 || y === 223) && image.data[(y * 224 + x) * 4 + 3])
          edgePixels++;
    document.querySelector("#yaw").value = String(yaw);
    document.querySelector("#mode").value = mode;
    document.querySelector("#view").value = view;
    document.querySelector("#wire").checked = wire;
    document.querySelector("#pose").textContent =
      `${view} · ${mode} · ${yaw}° · fixed224 / radius112`;
    return {
      yaw,
      mode,
      view,
      wire,
      edgePixels,
      rawOccupied,
      png: canvas.toDataURL().split(",")[1],
    };
  }
  for (const id of ["yaw", "mode", "view", "wire"])
    document
      .querySelector(`#${id}`)
      .addEventListener("input", () =>
        render(
          Number(document.querySelector("#yaw").value),
          document.querySelector("#mode").value,
          document.querySelector("#view").value,
          document.querySelector("#wire").checked,
        ),
      );
  document
    .querySelector("#zoom")
    .addEventListener(
      "change",
      (e) => (canvas.style.width = canvas.style.height = `${224 * Number(e.target.value)}px`),
    );
  document.querySelector("#identity").src = assetURL(
    "identity",
    "/tilefun/demos/pixel-characters/person-32.png",
  );
  window.riderControl = {
    render,
    config,
    singleDepthTarget: true,
    normalizedSharedParent: rider.parent === normalized,
    dispose() {
      car.dispose();
      renderer.dispose();
      source.dispose();
      outline.dispose();
    },
  };
  render();
  window.riderReady = true;
}
start().catch((error) => {
  document.querySelector("#pose").textContent = error.message;
  throw error;
});
