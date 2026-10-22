import * as THREE from "three";
import {
  authoredVehicleForType,
  vehicleMeshHeightScale,
} from "../../src/rendering/AuthoredVehicleMeshes.ts";
import { loadCarMesh } from "../../src/rendering/CarMeshAsset.ts";
import { setCarMeshProjection } from "../../src/rendering/CarMeshProjection.ts";
import { CarPixelOutline } from "../../src/rendering/CarPixelOutline.ts";

async function initialize() {
  const fixture = await (await fetch("/fixture.json")).json();
  const { width, height, centerX, centerY } = fixture.viewport;
  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: false,
    preserveDrawingBuffer: true,
  });
  renderer.setSize(width, height);
  renderer.setPixelRatio(1);
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  document.body.append(renderer.domElement);
  const camera = new THREE.Camera();
  setCarMeshProjection(camera.projectionMatrix, width / 2);
  camera.projectionMatrix.elements[5] = -2 / height;
  camera.projectionMatrix.elements[9] = 2 / height;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  camera.position.set(centerX, centerY, 0);
  camera.updateMatrixWorld(true);
  const target = () => {
    const result = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });
    result.texture.colorSpace = THREE.SRGBColorSpace;
    result.texture.magFilter = result.texture.minFilter = THREE.NearestFilter;
    return result;
  };
  const output = target(),
    temporary = target();
  const outline = new CarPixelOutline();
  const scene = new THREE.Scene();
  const debug = new THREE.Scene();
  const blitScene = new THREE.Scene();
  const blitMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  blitScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blitMaterial));
  const blitCamera = new THREE.Camera();
  const groups = [];
  const labelValues = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
  const owned = new Set();
  const assets = [];
  const vehicleAssets = [];
  const alphaData = new Map();
  for (const record of fixture.cases[0].objects) {
    const item = record.item;
    let root, asset, texture;
    if (item.mesh) {
      const definition = authoredVehicleForType(record.entity.type);
      vehicleAssets.push({
        type: record.entity.type,
        assetId: definition.assetId,
        path: definition.path,
      });
      asset = await loadCarMesh(definition.path, definition.lateralScale, {
        batch: true,
        heightScale: vehicleMeshHeightScale(definition.vehicle),
        contactShadow: false,
        preserveParts: definition.batchPreserveParts ?? [],
      });
      assets.push(asset);
      root = asset.object;
    } else if (record.prop) {
      const c = record.prop.collider;
      const geometry = new THREE.BoxGeometry(c.width, c.height, c.zHeight);
      const material = new THREE.MeshBasicMaterial({
        color: record.key === "back-wall" ? "#bc986d" : "#9b744e",
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      owned.add(geometry);
      owned.add(material);
      root = new THREE.Mesh(geometry, material);
    } else {
      texture = await new THREE.TextureLoader().loadAsync(
        record.key === "person" ? "/person.png" : "/cat.png",
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      const canvas = document.createElement("canvas");
      canvas.width = texture.image.width;
      canvas.height = texture.image.height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(texture.image, 0, 0);
      alphaData.set(record.key, ctx.getImageData(0, 0, canvas.width, canvas.height));
      const geometry = new THREE.PlaneGeometry(item.spriteWidth, item.spriteHeight);
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
        toneMapped: false,
      });
      owned.add(texture);
      owned.add(geometry);
      owned.add(material);
      root = new THREE.Mesh(geometry, material);
      root.rotation.x = Math.PI / 2;
    }
    const label = labelValues[groups.length];
    const originals = new Map(),
      labels = new Map();
    root.traverse((node) => {
      if (!node.isMesh) return;
      node.userData.groupKey = record.key;
      node.userData.label = label;
      originals.set(node, node.material);
      const original = Array.isArray(node.material) ? node.material[0] : node.material;
      const material = texture
        ? new THREE.ShaderMaterial({
            uniforms: {
              image: { value: texture },
              transform: { value: texture.matrix },
              labelColor: { value: new THREE.Color(label) },
            },
            vertexShader:
              "uniform mat3 transform; varying vec2 tex; void main(){tex=(transform*vec3(uv,1.)).xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
            fragmentShader:
              "uniform sampler2D image; uniform vec3 labelColor; varying vec2 tex; void main(){if(texture2D(image,tex).a<0.5) discard; gl_FragColor=vec4(labelColor,1.);}",
            side: THREE.DoubleSide,
            toneMapped: false,
          })
        : new THREE.MeshBasicMaterial({ color: label, side: original.side, toneMapped: false });
      labels.set(node, material);
      owned.add(material);
    });
    root.name = record.key;
    scene.add(root);
    groups.push({ key: record.key, root, asset, texture, originals, labels, label });
  }
  const selectLabels = (enabled) => {
    for (const group of groups)
      for (const [node, material] of enabled ? group.labels : group.originals)
        node.material = material;
  };
  const show = (keys) => {
    for (const group of groups) group.root.visible = keys.has(group.key);
  };
  function raw() {
    const bottomUp = new Uint8Array(width * height * 4),
      pixels = new Uint8Array(bottomUp.length);
    renderer.readRenderTargetPixels(output, 0, 0, width, height, bottomUp);
    for (let y = 0; y < height; y++)
      pixels.set(
        bottomUp.subarray((height - y - 1) * width * 4, (height - y) * width * 4),
        y * width * 4,
      );
    return pixels;
  }
  function present(ink, overlay, transparent) {
    blitMaterial.map = ink ? outline.render(renderer, output) : output.texture;
    renderer.setRenderTarget(null);
    renderer.setClearColor(transparent ? 0 : 0x88a77b, transparent ? 0 : 1);
    renderer.clear();
    renderer.render(blitScene, blitCamera);
    if (overlay) renderer.render(debug, camera);
    return renderer.domElement.toDataURL("image/png");
  }
  function render(mode, labels, only, overlay = false) {
    selectLabels(labels);
    renderer.info.reset();
    renderer.setRenderTarget(output);
    renderer.setClearColor(0, 0);
    renderer.clear();
    if (mode === "local") {
      for (const group of groups) {
        show(new Set([group.key]));
        renderer.setRenderTarget(temporary);
        renderer.clear();
        renderer.render(scene, camera);
        blitMaterial.map = temporary.texture;
        renderer.setRenderTarget(output);
        renderer.render(blitScene, blitCamera);
      }
    } else {
      show(only ? new Set([only]) : new Set(groups.map((group) => group.key)));
      renderer.render(scene, camera);
    }
    const submissions = {
      drawCalls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
    };
    const pixels = raw();
    const png = present(!labels, overlay, labels);
    return { pixels, png, submissions };
  }
  function clearDebug() {
    debug.traverse((node) => {
      node.geometry?.dispose();
      node.material?.dispose();
    });
    debug.clear();
  }
  function wireBox(bounds, z, tall, color) {
    const box = new THREE.BoxGeometry(bounds.right - bounds.left, bounds.bottom - bounds.top, tall);
    const geometry = new THREE.EdgesGeometry(box);
    box.dispose();
    const line = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.7 }),
    );
    line.position.set(
      (bounds.right + bounds.left) / 2,
      (bounds.bottom + bounds.top) / 2,
      z + tall / 2,
    );
    debug.add(line);
  }
  function apply(snapshot) {
    clearDebug();
    const byKey = new Map(groups.map((group) => [group.key, group]));
    for (const record of snapshot.objects) {
      const group = byKey.get(record.key),
        item = record.item;
      if (item.mesh) {
        group.root.quaternion.set(...item.mesh.orientation);
        group.root.position.set(item.wx, item.wy, item.zOffset);
        group.asset.setTravel(item.mesh.wheelTravel ?? 0);
        group.asset.setEmergency(false, item.mesh.presentationTime ?? 0);
      } else if (record.prop) {
        const c = record.prop.collider,
          p = record.prop.position;
        group.root.position.set(
          p.wx + c.offsetX,
          p.wy + c.offsetY - c.height / 2,
          c.zBase + c.zHeight / 2,
        );
      } else {
        const image = group.texture.image;
        const columns = image.width / item.spriteWidth,
          rows = image.height / item.spriteHeight;
        group.texture.repeat.set(1 / columns, 1 / rows);
        group.texture.offset.set(item.frameCol / columns, 1 - (item.frameRow + 1) / rows);
        group.texture.updateMatrix();
        group.texture.needsUpdate = true;
        group.root.position.set(
          item.wx,
          item.wy,
          item.zOffset + item.spriteHeight / 2 - item.drawOffsetY,
        );
        group.root.scale.x = item.flipX ? -1 : 1;
        wireBox(
          {
            left: item.wx - item.spriteWidth / 2,
            right: item.wx + item.spriteWidth / 2,
            top: item.wy - 0.01,
            bottom: item.wy + 0.01,
          },
          item.zOffset - item.drawOffsetY,
          item.spriteHeight,
          0xffff00,
        );
      }
      const e = record.entity ?? record.prop,
        c = e.collider;
      if (c)
        wireBox(
          {
            left: e.position.wx + c.offsetX - c.width / 2,
            right: e.position.wx + c.offsetX + c.width / 2,
            top: e.position.wy + c.offsetY - c.height,
            bottom: e.position.wy + c.offsetY,
          },
          e.wz ?? c.zBase ?? 0,
          c.physicalHeight ?? c.zHeight,
          record.prop ? 0x66ff88 : 0x66bbff,
        );
    }
    groups.sort(
      (a, b) =>
        snapshot.objects.findIndex((record) => record.key === a.key) -
        snapshot.objects.findIndex((record) => record.key === b.key),
    );
    scene.updateMatrixWorld(true);
    debug.updateMatrixWorld(true);
  }
  const raycaster = new THREE.Raycaster();
  function rayCheck(solos, shared) {
    show(new Set(groups.map((group) => group.key)));
    selectLabels(false);
    let checked = 0,
      mismatches = 0,
      ambiguous = 0;
    const wrong = [];
    for (let index = 0; index < width * height; index++) {
      if (solos.filter((solo) => solo.pixels[index * 4 + 3]).length < 2) continue;
      const x = index % width,
        y = Math.floor(index / width);
      const near = new THREE.Vector3(((x + 0.5) / width) * 2 - 1, 1 - ((y + 0.5) / height) * 2, -1)
        .applyMatrix4(camera.projectionMatrixInverse)
        .add(camera.position);
      const far = new THREE.Vector3(((x + 0.5) / width) * 2 - 1, 1 - ((y + 0.5) / height) * 2, 1)
        .applyMatrix4(camera.projectionMatrixInverse)
        .add(camera.position);
      raycaster.set(near, far.sub(near).normalize());
      const hits = raycaster
        .intersectObjects(
          groups.map((group) => group.root),
          true,
        )
        .filter((hit) => {
          const data = alphaData.get(hit.object.userData.groupKey);
          if (!data) return true;
          const group = groups.find((group) => group.key === hit.object.userData.groupKey);
          const uv = group.texture.transformUv(hit.uv.clone());
          const px = Math.min(data.width - 1, Math.max(0, Math.floor(uv.x * data.width)));
          const py = Math.min(data.height - 1, Math.max(0, Math.floor(uv.y * data.height)));
          return data.data[(py * data.width + px) * 4 + 3] >= 128;
        });
      const first = hits[0],
        next = hits.find((hit) => hit.object.userData.groupKey !== first?.object.userData.groupKey);
      if (!first || (next && Math.abs(next.distance - first.distance) < 1e-6)) {
        ambiguous++;
        continue;
      }
      checked++;
      const actual =
        (shared[index * 4] << 16) | (shared[index * 4 + 1] << 8) | shared[index * 4 + 2];
      if (actual !== first.object.userData.label) {
        mismatches++;
        if (wrong.length < 8) wrong.push({ x, y, actual, expected: first.object.userData.label });
      }
    }
    return { checked, mismatches, ambiguous, wrong };
  }
  window.sharedWorld = {
    ready: true,
    vehicleAssets,
    async capture(id) {
      const snapshot = fixture.cases.find((entry) => entry.id === id);
      apply(snapshot);
      const solo = groups.map((group) => ({
        key: group.key,
        label: group.label,
        ...render("world", true, group.key),
      }));
      const localIds = render("local", true),
        worldIds = render("world", true);
      const oracle = rayCheck(solo, worldIds.pixels);
      const local = render("local", false),
        world = render("world", false);
      const localDebug = render("local", false, null, true),
        worldDebug = render("world", false, null, true);
      return {
        id,
        name: snapshot.name,
        playerZ: snapshot.playerZ,
        oracle,
        order: groups.map((group) => group.key),
        labels: groups.map((group) => ({ key: group.key, label: group.label })),
        captures: {
          local: local.png,
          world: world.png,
          localDebug: localDebug.png,
          worldDebug: worldDebug.png,
          localIds: localIds.png,
          worldIds: worldIds.png,
        },
        solo: solo.map(({ key, label, png }) => ({ key, label, png })),
        submissions: { local: local.submissions, world: world.submissions },
      };
    },
    dispose() {
      clearDebug();
      for (const asset of assets) asset.dispose();
      for (const resource of owned) resource.dispose();
      blitScene.children[0].geometry.dispose();
      blitMaterial.dispose();
      outline.dispose();
      output.dispose();
      temporary.dispose();
      renderer.dispose();
    },
  };
}
void initialize().catch((error) => {
  window.sharedWorldError = String(error);
});
