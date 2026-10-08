import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const scene = new THREE.Scene();
scene.background = new THREE.Color("#e5e9ed");
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(640, 640, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.getElementById("canvas").append(renderer.domElement);
const camera = new THREE.OrthographicCamera(-0.7, 0.7, 0.7, -0.7, 0.01, 10);
camera.up.set(0, 1, 0);
const controls = new OrbitControls(camera, renderer.domElement);
scene.add(new THREE.HemisphereLight(0xffffff, 0x8591a0, 2));
const light = new THREE.DirectionalLight(0xffffff, 2);
light.position.set(2, 4, 3);
scene.add(light);
const bytes = Uint8Array.from(atob(window.meshBase64), (c) => c.charCodeAt(0));
new GLTFLoader().parse(
  bytes.buffer,
  "",
  (gltf) => {
    const model = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(model);
    model.position.sub(bounds.getCenter(new THREE.Vector3()));
    scene.add(model);
    const longest = Math.max(...bounds.getSize(new THREE.Vector3()).toArray());
    camera.left = -longest * 0.7;
    camera.right = longest * 0.7;
    camera.top = longest * 0.7;
    camera.bottom = -longest * 0.7;
    camera.updateProjectionMatrix();
    const views = {
      front: [0, 0, 3],
      back: [0, 0, -3],
      side: [3, 0, 0],
      top: [0, 3, 0],
      oblique: [2, 2, 3],
      opposite: [-2, 2, -3],
    };
    window.setView = (name) => {
      camera.up.set(0, 1, 0);
      if (name === "top") camera.up.set(0, 0, -1);
      camera.position.set(...views[name]);
      controls.target.set(0, 0, 0);
      camera.lookAt(0, 0, 0);
      controls.update();
      renderer.render(scene, camera);
    };
    document.getElementById("views").onchange = (e) => window.setView(e.target.value);
    document.getElementById("wire").onchange = (e) =>
      model.traverse((o) => {
        if (o.isMesh)
          for (const material of Array.isArray(o.material) ? o.material : [o.material])
            material.wireframe = e.target.checked;
      });
    window.setView("oblique");
    window.ready = true;
    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });
  },
  (error) => {
    window.failure = String(error);
  },
);
