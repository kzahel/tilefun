import { readFileSync } from "node:fs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { expect, it } from "vitest";
import { createConstructionCargo, WRECKING_BALL } from "../entities/ConstructionCargo.js";
import { required } from "../shared/required.js";
import { nextExcavatorPose } from "../traffic/Excavator.js";
import { CRANE_REST, craneLinkage } from "../traffic/MobileCrane.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { authoredCargoForType } from "./AuthoredCargoMeshes.js";
import { applyMeshInstance, fitMeshHolder } from "./AuthoredMeshPose.js";
import { authoredVehicleForType } from "./AuthoredVehicleMeshes.js";
import { CarMeshAsset } from "./CarMeshAsset.js";
import { collectWorldSprites } from "./collectScene.js";
import { poseOrientation } from "./MeshPresentation.js";
import { SceneFrame } from "./SceneFrame.js";
import { WRECKING_BALL_CENTER_Z, WRECKING_BALL_SHEAR } from "./WreckingBallProjection.js";

async function load(model: { path: string; lateralScale: number }, cargo = false) {
  const data = readFileSync(`public/${model.path}`);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: "node-texture", loadTexture: async () => new THREE.Texture() }));
  const gltf = await loader.parseAsync(
    data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    "",
  );
  const asset = new CarMeshAsset(gltf.scene, model.lateralScale, { batch: true, cargo });
  asset.setPhysical(true);
  return asset;
}

function extent(asset: CarMeshAsset, measure: (point: THREE.Vector3) => number) {
  asset.object.updateMatrixWorld(true);
  let max = 0;
  const point = new THREE.Vector3();
  asset.object.traverseVisible((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const positions = node.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld);
      max = Math.max(max, measure(point));
    }
  });
  return max;
}

// A chassis rotation can align any vertex with the y-z projection axis.
const rotatedExtent = (point: THREE.Vector3) => Math.SQRT2 * point.length();

it("fits the wrecking ball at every rotation, including rotation about its base", async () => {
  const model = required(authoredCargoForType(WRECKING_BALL));
  const asset = await load(model, true);
  try {
    expect(extent(asset, rotatedExtent)).toBeLessThan(model.radius);
  } finally {
    asset.dispose();
  }
});

it("keeps the actual ball round around its projected centre in top-down draws", async () => {
  const model = required(authoredCargoForType(WRECKING_BALL));
  const asset = await load(model, true);
  const holder = new THREE.Group();
  holder.add(asset.object);
  holder.position.set(24, 9, 42);
  try {
    for (const [yaw, pitch, roll] of [
      [0, 0, 0],
      [1.25, -0.9, 0.7],
      [-2.1, 0.5, 2.2],
    ] as const) {
      const mesh = { ...model, physical: true, orientation: poseOrientation(yaw, pitch, roll) };
      applyMeshInstance(asset, mesh);
      const center = new THREE.Vector3(0, 0, WRECKING_BALL_CENTER_Z)
        .applyQuaternion(asset.object.quaternion)
        .add(holder.position);
      const width = () => extent(asset, (point) => Math.abs(point.x - center.x));
      const height = () =>
        extent(asset, (point) => Math.abs(point.y - point.z - center.y + center.z));
      fitMeshHolder(holder, asset, mesh, true);
      holder.updateMatrixWorld(true);
      expect(height() / width()).toBeCloseTo(1, 2);
      const drawnCenter = asset.object.localToWorld(
        new THREE.Vector3(0, 0, WRECKING_BALL_CENTER_Z),
      );
      expect(drawnCenter.distanceTo(center)).toBeLessThan(1e-8);
      fitMeshHolder(holder, asset, mesh, false);
      holder.updateMatrixWorld(true);
      expect(height() / width()).toBeCloseTo(Math.SQRT2, 2);
    }
  } finally {
    asset.dispose();
  }
});

it("fits the extended crane through a full slew and includes the cable to a culled load", async () => {
  const crane = createVehicle("mobile-crane", 0, 0);
  const model = required(authoredVehicleForType(crane.type));
  const asset = await load(model);
  try {
    let raised = CRANE_REST;
    for (let i = 0; i < 5; i++) raised = nextExcavatorPose(raised, "stick-out");
    for (let pitch = 0; pitch <= 60; pitch += 12) {
      let pose = raised;
      for (let yaw = 0; yaw < 360; yaw += 15) {
        asset.setExcavator(pose);
        expect(extent(asset, rotatedExtent), `pitch ${pitch}°, slew ${yaw}°`).toBeLessThan(
          model.radius,
        );
        pose = nextExcavatorPose(pose, "swing-right");
      }
      raised = nextExcavatorPose(raised, "boom-up");
    }

    for (let i = 0; i < 6; i++) raised = nextExcavatorPose(raised, "swing-left");
    for (let i = 0; i < 4; i++) raised = nextExcavatorPose(raised, "bucket-curl");
    const tip = craneLinkage(raised).tip;
    const ball = createConstructionCargo(WRECKING_BALL, tip.x, tip.y - 130);
    ball.id = 1;
    ball.wz = tip.z - required(ball.collider?.physicalHeight);
    crane.vehicleExcavator = raised;
    crane.vehicleCraneLoadId = ball.id;
    const frame = new SceneFrame();
    const items = frame.begin(false);
    collectWorldSprites({
      entities: [crane, ball],
      props: [],
      world: { getHeightAt: () => 0 },
      alpha: 1,
      cull: { left: -100, right: 100, top: -100, bottom: 100 },
      items,
      frame,
    });
    expect(items).toHaveLength(1);
    const item = required(items[0]);
    if (item.kind !== "sprite") throw Error("Missing crane sprite");
    const mesh = required(item.mesh);
    expect(mesh.craneCableEnd).toMatchObject({ z: tip.z, wrecking: true });
    expect(mesh.craneCableEnd?.topDown).toMatchObject({
      y: tip.y - 130 + WRECKING_BALL_CENTER_Z * WRECKING_BALL_SHEAR,
      z: tip.z - WRECKING_BALL_CENTER_Z * WRECKING_BALL_SHEAR,
    });
    expect(mesh.radius).toBeGreaterThan(model.radius);
    applyMeshInstance(asset, mesh);
    expect(extent(asset, ({ x, y, z }) => Math.max(Math.abs(x), Math.abs(y - z)))).toBeLessThan(
      mesh.radius,
    );
  } finally {
    asset.dispose();
  }
});
