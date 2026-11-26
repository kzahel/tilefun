import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export async function showCat() {
  const canvas = document.querySelector("canvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0xd4e2dd);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-2, 2, 1.62, -1.62, .01, 100);
  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.minZoom = .5;
  controls.maxZoom = 2.8;
  controls.maxPolarAngle = Math.PI * .55;
  controls.target.set(0, 1.15, 0);
  const look = (degrees, elevation) => {
    const a = THREE.MathUtils.degToRad(degrees), e = THREE.MathUtils.degToRad(elevation);
    camera.position.set(7*Math.sin(a)*Math.cos(e), 1.15+7*Math.sin(e), 7*Math.cos(a)*Math.cos(e));
    camera.zoom = 1;
    camera.updateProjectionMatrix();
    controls.update();
  };
  const angles = { "Three-quarter": [29,12], Front: [0,5], Side: [90,5], Back: [180,8], Above: [32,48] };
  look(...angles["Three-quarter"]);
  const gltf = await new GLTFLoader().parseAsync(
    Uint8Array.from(atob(document.querySelector("#mesh").textContent), c => c.charCodeAt(0)).buffer, "");
  scene.add(gltf.scene);
  scene.add(new THREE.HemisphereLight(0xfffffc,0xe3dfef,2.38));
  const key = new THREE.DirectionalLight(0xfffdf7,1.22);
  key.position.set(-3,6,5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xfff5ee,.62);
  rim.position.set(3,4,-4);
  scene.add(rim);
  // A soft contact shadow stays under the grounded walk cycle from any direction.
  const texture = document.createElement("canvas");
  texture.width = texture.height = 128;
  const ctx = texture.getContext("2d");
  const gradient = ctx.createRadialGradient(64,64,2,64,64,64);
  for (const [stop, alpha] of [[0,.39],[.28,.31],[.62,.12],[1,0]]) {
    gradient.addColorStop(stop, `rgba(46,58,73,${alpha})`);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0,0,128,128);
  const shadowMap = new THREE.CanvasTexture(texture);
  shadowMap.colorSpace = THREE.SRGBColorSpace;
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.55,1.52),
    new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));
  shadow.rotation.x = -Math.PI/2;
  scene.add(shadow);
  const mixer = new THREE.AnimationMixer(gltf.scene);
  const clips = new Map(gltf.animations.map(clip => [clip.name,mixer.clipAction(clip)]));
  let active;
  function animate(name) {
    if (active !== name) {
      mixer.stopAllAction();
      clips.get(name).reset().play();
      active = name;
    }
    document.querySelectorAll("[data-clip]").forEach(b => b.setAttribute("aria-pressed",String(b.dataset.clip === name)));
  }
  function choose(view) {
    look(...angles[view]);
    document.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-pressed",String(b.dataset.view === view)));
  }
  controls.addEventListener("start", () => document.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-pressed","false")));
  document.querySelectorAll("[data-clip]").forEach(b => b.onclick = () => animate(b.dataset.clip));
  document.querySelectorAll("[data-view]").forEach(b => b.onclick = () => choose(b.dataset.view));
  choose("Three-quarter");
  animate("Idle");
  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w,h,false);
    const half = Math.max(1.55,1.18*h/w);
    camera.left = -half*w/h;
    camera.right = -camera.left;
    camera.top = half;
    camera.bottom = -half;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(size).observe(canvas);
  size();
  let previous = performance.now();
  if (location.hash === "#capture") {
    window.previewFrame = ({angle,elevation,time,clip}) => {
      look(angle,elevation);
      animate(clip);
      mixer.setTime(time);
      renderer.render(scene,camera);
      return canvas.toDataURL().split(",")[1];
    };
  } else {
    renderer.setAnimationLoop(now => {
      mixer.update(Math.min(.1,(now-previous)/1000));
      previous = now;
      renderer.render(scene,camera);
    });
  }
  document.querySelector("#loading").hidden = true;
}
showCat().catch(error => {
  document.querySelector("#loading").textContent = "The 3D preview needs WebGL 2. Open the turntable video to see the model.";
  console.error(error);
});
