import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { setCarMeshProjection } from "../../src/rendering/CarMeshProjection.ts";

async function initialize() {
  const size = 128;
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    alpha: true,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(size, size);
  renderer.setPixelRatio(1);
  renderer.setClearColor(0, 0);
  renderer.autoClear = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.append(renderer.domElement);
  const camera = new THREE.Camera();
  setCarMeshProjection(camera.projectionMatrix, size / 2);
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  const target = new THREE.WebGLRenderTarget(size, size, { depthBuffer: true });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  target.texture.magFilter = target.texture.minFilter = THREE.NearestFilter;
  const blitScene = new THREE.Scene();
  blitScene.add(
    new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({
        map: target.texture,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    ),
  );
  const blitCamera = new THREE.Camera();
  const texture = await new THREE.TextureLoader().loadAsync("/person.png");
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.repeat.set(0.25, 0.25);
  texture.offset.set(0, 0.75);
  const actor = new THREE.Mesh(
    new THREE.PlaneGeometry(32, 32),
    new THREE.MeshBasicMaterial({
      map: texture,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  actor.rotation.x = Math.PI / 2;
  const bed = new THREE.Group();
  function box(width, depth, height, x, y, z, color) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, depth, height),
      new THREE.MeshBasicMaterial({ color, toneMapped: false, side: THREE.DoubleSide }),
    );
    mesh.position.set(x, y, z);
    bed.add(mesh);
  }
  box(44, 32, 2, 0, 16, 0, "#e2c391");
  box(44, 2, 20, 0, 0, 11, "#608b9f");
  box(44, 2, 20, 0, 32, 11, "#386176");
  box(2, 32, 20, -22, 16, 11, "#4e798d");
  box(2, 32, 20, 22, 16, 11, "#4e798d");
  bed.position.set(0, -16, 6);
  const scene = new THREE.Scene();
  scene.add(bed, actor);
  function read() {
    const gl = renderer.getContext();
    const bottomUp = new Uint8Array(size * size * 4);
    gl.readPixels(0, 0, size, size, gl.RGBA, gl.UNSIGNED_BYTE, bottomUp);
    const data = new Uint8Array(bottomUp.length);
    for (let y = 0; y < size; y++)
      data.set(bottomUp.subarray((size - y - 1) * size * 4, (size - y) * size * 4), y * size * 4);
    return data;
  }
  function capture(mode) {
    renderer.setRenderTarget(null);
    renderer.clear();
    actor.material.depthTest = true;
    if (mode === "isolated") {
      actor.visible = false;
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(blitScene, blitCamera);
      actor.visible = true;
      bed.visible = false;
      actor.material.depthTest = false;
      renderer.render(scene, camera);
      actor.material.depthTest = true;
      bed.visible = true;
    } else if (mode === "local") {
      renderer.setRenderTarget(target);
      renderer.clear();
      renderer.render(scene, camera);
      renderer.setRenderTarget(null);
      renderer.render(blitScene, blitCamera);
    } else {
      renderer.render(scene, camera);
    }
    return { pixels: read(), png: renderer.domElement.toDataURL("image/png") };
  }
  const raycaster = new THREE.Raycaster();
  function oracle(solo, floor, shared) {
    let hidden = 0,
      visible = 0,
      mismatches = 0,
      ambiguous = 0;
    const failures = [];
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const index = (y * size + x) * 4;
        if (!solo[index + 3]) continue;
        const near = new THREE.Vector3(
          ((x + 0.5) / size) * 2 - 1,
          1 - ((y + 0.5) / size) * 2,
          -1,
        ).applyMatrix4(camera.projectionMatrixInverse);
        const far = new THREE.Vector3(
          ((x + 0.5) / size) * 2 - 1,
          1 - ((y + 0.5) / size) * 2,
          1,
        ).applyMatrix4(camera.projectionMatrixInverse);
        raycaster.set(near, far.sub(near).normalize());
        const spriteHit = raycaster.intersectObject(actor)[0];
        const wallHit = raycaster.intersectObject(bed, true)[0];
        if (!spriteHit || (wallHit && Math.abs(wallHit.distance - spriteHit.distance) < 1e-6)) {
          ambiguous++;
          continue;
        }
        const occluded = wallHit && wallHit.distance < spriteHit.distance;
        if (occluded) hidden++;
        else visible++;
        const expected = occluded ? floor : solo;
        if (
          [0, 1, 2, 3].some(
            (channel) => Math.abs(expected[index + channel] - shared[index + channel]) > 1,
          )
        ) {
          mismatches++;
          if (failures.length < 8)
            failures.push({
              x,
              y,
              expected: [...expected.slice(index, index + 4)],
              actual: [...shared.slice(index, index + 4)],
              spriteDistance: spriteHit.distance,
              wallDistance: wallHit?.distance,
            });
        }
      }
    return {
      hiddenActorPixels: hidden,
      visibleActorPixels: visible,
      rayOracleMismatches: mismatches,
      ambiguous,
      failures,
    };
  }
  window.compare3d = async (heading, tilt) => {
    bed.quaternion.setFromEuler(
      new THREE.Euler((tilt * Math.PI) / 180, 0, (heading * Math.PI) / 180, "ZYX"),
    );
    bed.updateMatrixWorld(true);
    actor.position.copy(bed.localToWorld(new THREE.Vector3(0, 16, 1)));
    actor.position.z += 11; // 32px cell, source foot anchor at row 27.
    scene.updateMatrixWorld(true);
    bed.visible = false;
    const solo = capture("world");
    bed.visible = true;
    actor.visible = false;
    const floor = capture("world");
    actor.visible = true;
    const isolated = capture("isolated"),
      local = capture("local"),
      world = capture("world");
    const difference = (a, b) => {
      let pixels = 0;
      for (let i = 0; i < a.length; i += 4)
        if ([0, 1, 2, 3].some((c) => a[i + c] !== b[i + c])) pixels++;
      return pixels;
    };
    return {
      heading,
      tilt,
      ...oracle(solo.pixels, floor.pixels, world.pixels),
      isolatedVersusSharedPixels: difference(isolated.pixels, world.pixels),
      localVersusWorldPixels: difference(local.pixels, world.pixels),
      captures: { isolated: isolated.png, local: local.png, world: world.png },
    };
  };
  window.inspectAnimatedSource = async () => {
    const gltf = await new GLTFLoader().loadAsync("/tiger.glb");
    const root = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(root);
    const dimensions = bounds.getSize(new THREE.Vector3());
    root.scale.setScalar(30 / dimensions.y);
    const normalized = new THREE.Group();
    normalized.rotation.x = Math.PI / 2; // glTF Y-up -> game Z-up.
    normalized.add(root);
    const modelScene = new THREE.Scene();
    modelScene.add(normalized);
    const mixer = new THREE.AnimationMixer(root);
    for (const clip of gltf.animations) mixer.clipAction(clip).play();
    const samples = [];
    let before;
    for (const time of [0, 0.375]) {
      mixer.setTime(time);
      modelScene.updateMatrixWorld(true);
      renderer.setRenderTarget(null);
      renderer.clear();
      renderer.info.reset();
      renderer.render(modelScene, camera);
      const pixels = read();
      const changedPixels = before
        ? pixels.reduce((sum, value, i) => sum + (value !== before[i] ? 1 : 0), 0)
        : 0;
      samples.push({
        time,
        drawCalls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        changedChannels: changedPixels,
        png: renderer.domElement.toDataURL("image/png"),
      });
      before = pixels;
    }
    mixer.stopAllAction();
    mixer.uncacheRoot(root);
    const materials = new Set();
    const skeletons = new Set();
    root.traverse((node) => {
      if (!node.isMesh) return;
      if (node.isSkinnedMesh) skeletons.add(node.skeleton);
      node.geometry.dispose();
      for (const material of Array.isArray(node.material) ? node.material : [node.material])
        materials.add(material);
    });
    for (const material of materials) material.dispose();
    for (const skeleton of skeletons) skeleton.dispose();
    return { animations: gltf.animations.length, samples };
  };
  window.dispose3d = () => {
    texture.dispose();
    target.dispose();
    for (const tree of [scene, blitScene])
      tree.traverse((node) => {
        if (node.isMesh) {
          node.geometry.dispose();
          node.material.dispose();
        }
      });
    renderer.dispose();
  };
  window.comparisonReady = true;
}
void initialize().catch((error) => {
  window.comparisonError = String(error);
});
