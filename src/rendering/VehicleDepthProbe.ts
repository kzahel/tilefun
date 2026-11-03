import * as THREE from "three";
import { required } from "../art/ArtCatalog.js";
import { PIXEL_SCALE } from "../config/constants.js";
import { Direction } from "../entities/Entity.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { authoredVehicleForType, vehicleMeshHeightScale } from "./AuthoredVehicleMeshes.js";
import { Camera } from "./Camera.js";
import { loadCarMesh } from "./CarMeshAsset.js";
import { collectScene } from "./collectScene.js";
import { GpuRenderBackend } from "./GpuRenderBackend.js";
import { poseOrientation } from "./MeshPresentation.js";
import { SceneFrame } from "./SceneFrame.js";

/** Production cached image+depth composition versus actual geometry in one depth
 * target. Solo production colors retain individual outlines; the independent
 * common-scene object-ID pass decides which object's pixels should be visible. */
export async function probeVehicleDepth() {
  const width = 256,
    height = 256;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const gpu = new GpuRenderBackend(canvas);
  gpu.worldRaster = true;
  gpu.surface.enableWorldComposition();
  gpu.meshes.setEnabled(true);
  const readback = document.createElement("canvas");
  readback.width = width;
  readback.height = height;
  const read = required(readback.getContext("2d", { willReadFrequently: true }));
  const camera = new Camera();
  camera.setViewport(width, height);
  camera.zoom = 1 / PIXEL_SCALE;
  const frame = new SceneFrame();
  const blue = createVehicle("compact-1", 40, -36, Direction.Right),
    truck = createVehicle("dump-truck", 0, 0, Direction.Right);
  blue.id = 1;
  truck.id = 2;
  blue.bodyRotation = poseOrientation(0.5);
  truck.bodyRotation = poseOrientation(0);
  const entities = [blue, truck];
  const definitions = entities.map((e) => required(authoredVehicleForType(e.type)));
  const references = await Promise.all(
    definitions.map((d) =>
      loadCarMesh(d.path, d.lateralScale, {
        batch: true,
        heightScale: vehicleMeshHeightScale(d.vehicle),
        contactShadow: true,
        preserveParts: d.batchPreserveParts ?? [],
      }),
    ),
  );
  const target = new THREE.WebGLRenderTarget(width, height, { depthBuffer: true });
  target.texture.colorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene(),
    lens = new THREE.Camera();
  lens.projectionMatrix.set(
    2 / width,
    0,
    0,
    0,
    0,
    -2 / height,
    2 / height,
    0,
    0,
    -1 / 1024,
    -1 / 1024,
    0,
    0,
    0,
    0,
    1,
  );
  lens.projectionMatrixInverse.copy(lens.projectionMatrix).invert();
  const ids = [
    new THREE.MeshBasicMaterial({ color: 0xff0000, toneMapped: false, side: THREE.DoubleSide }),
    new THREE.MeshBasicMaterial({ color: 0x0000ff, toneMapped: false, side: THREE.DoubleSide }),
  ];
  const world = { getHeightAt: () => 0, getChunkIfLoaded: () => undefined, getRoadAt: () => 0 };
  const items = () =>
    collectScene(
      entities,
      [],
      world,
      camera,
      camera.getVisibleChunkRange(),
      1,
      { collectElevationItems: () => [] },
      [],
      false,
      undefined,
      undefined,
      frame,
    )
      .filter((i) => i.kind === "sprite")
      .map((i) => ({ ...i, hasShadow: false }))
      .sort(
        (a, b) =>
          definitions.findIndex((d) => d.assetId === a.mesh?.assetId) -
          definitions.findIndex((d) => d.assetId === b.mesh?.assetId),
      );
  const pixels = (order: readonly number[]) => {
    const sprites = items();
    gpu.beginFrame();
    gpu.submit(camera, { kind: "clear", color: "#112233" });
    gpu.submit(camera, { kind: "scene", items: sprites, order });
    gpu.surface.presentWorld(0, 0);
    read.clearRect(0, 0, width, height);
    read.drawImage(canvas, 0, 0);
    return read.getImageData(0, 0, width, height).data;
  };
  try {
    for (let attempts = 0; attempts < 1000; attempts++) {
      pixels([0, 1]);
      if (definitions.every((d) => gpu.meshes.ready.has(d.assetId))) break;
      if (attempts === 999) throw Error("Vehicle depth probe assets did not load");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    const reports = [];
    for (const pose of ["behind", "above", "rolled"] as const) {
      blue.wz = pose === "above" ? 40 : 0;
      blue.position.wy = pose === "above" ? 0 : -36;
      blue.bodyRotation =
        pose === "rolled" ? poseOrientation(0.5, 0.35, 0.7) : poseOrientation(0.5);
      const solos = [pixels([0]), pixels([1])];
      const forward = pixels([0, 1]),
        reverse = pixels([1, 0]),
        cached = pixels([0, 1]);
      const renderer = gpu.surface.renderer;
      renderer.setRenderTarget(target);
      renderer.setScissorTest(false);
      renderer.setClearColor(0, 0);
      renderer.clear();
      for (const [index, asset] of references.entries()) {
        const entity = required(entities[index]);
        asset.setPhysical(true);
        asset.setTravel(0);
        asset.object.quaternion.set(...required(entity.bodyRotation));
        asset.object.position.set(entity.position.wx, entity.position.wy, entity.wz ?? 0);
        asset.setTransportRamp(false);
        asset.setTowLift(false);
        asset.setDumpBed(0, 0);
        asset.setEmergency(false, 0);
        scene.add(asset.object);
        scene.overrideMaterial = required(ids[index]);
        renderer.render(scene, lens);
        scene.remove(asset.object);
      }
      const mask = new Uint8Array(width * height * 4);
      renderer.readRenderTargetPixels(target, 0, 0, width, height, mask);
      renderer.setRenderTarget(null);
      let orderErrors = 0,
        cacheErrors = 0,
        oracleErrors = 0,
        overlap = 0;
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const p = (y * width + x) * 4,
            m = ((height - 1 - y) * width + x) * 4;
          for (let channel = 0; channel < 4; channel++) {
            if (forward[p + channel] !== reverse[p + channel]) orderErrors++;
            if (forward[p + channel] !== cached[p + channel]) cacheErrors++;
          }
          const background = (a: Uint8ClampedArray) =>
            a[p] === 17 && a[p + 1] === 34 && a[p + 2] === 51;
          if (background(required(solos[0])) || background(required(solos[1]))) continue;
          overlap++;
          const owner = mask[m] === 255 ? 0 : mask[m + 2] === 255 ? 1 : undefined;
          if (owner === undefined) {
            oracleErrors++;
            continue;
          }
          const expected = required(solos[owner]);
          if (
            [0, 1, 2, 3].some((c) => Math.abs((forward[p + c] ?? 0) - (expected[p + c] ?? 0)) > 1)
          )
            oracleErrors++;
        }
      reports.push({ pose, overlap, orderErrors, cacheErrors, oracleErrors });
    }
    return { reports, imageHits: gpu.meshes.images.hits };
  } finally {
    gpu.dispose();
    frame.clear();
    for (const asset of references) asset.dispose();
    for (const id of ids) id.dispose();
    target.dispose();
  }
}
