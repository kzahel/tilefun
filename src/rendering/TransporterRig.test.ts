import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
// @ts-expect-error pngjs has no bundled declarations
import { PNG } from "pngjs";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { expect, it } from "vitest";
import { required } from "../art/ArtCatalog.js";
import type { Spritesheet } from "../assets/Spritesheet.js";
import { TRANSPORTER } from "../traffic/CarTransporter.js";
import { TRANSPORTER_EXPECTATIONS as expected } from "../traffic/Transporter.fixture.js";
import { createVehicle } from "../traffic/Vehicle.js";
import { Camera } from "./Camera.js";
import { CarMeshAsset } from "./CarMeshAsset.js";
import { yawOrientation } from "./MeshPresentation.js";
import type { RasterSurface } from "./RasterSurface.js";
import type { SpriteItem } from "./SceneItem.js";
import { drawTransporterFallback } from "./TransporterFallback.js";

it("qualifies the real ramp endpoints, fixed body, all four rolling tires and absolute reset", async () => {
  const bytes = readFileSync("public/assets/models/vehicles/car-transporter-v2.glb");
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected.modelSha256);
  const loader = new GLTFLoader();
  loader.register(() => ({ name: "node-texture", loadTexture: async () => new THREE.Texture() }));
  const gltf = await loader.parseAsync(
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
    "",
  );
  const asset = new CarMeshAsset(gltf.scene, 1, { batch: true });
  try {
    const vehicle = createVehicle(expected.model, 0, 0);
    expect(vehicle.collider?.width).toBe(expected.bounds[0]);
    expect(vehicle.collider?.height).toBe(expected.bounds[1]);
    expect(vehicle.collider?.physicalHeight).toBe(expected.bounds[2]);
    asset.object.updateMatrixWorld(true);
    const bodyBounds = new THREE.Box3().setFromObject(asset.object, true);
    expect(bodyBounds.min.z).toBeCloseTo(0, 5);
    expect(bodyBounds.min.x).toBeGreaterThanOrEqual(-expected.bounds[0] / 2);
    expect(bodyBounds.max.x).toBeLessThanOrEqual(expected.bounds[0] / 2);
    expect(bodyBounds.min.y).toBeGreaterThanOrEqual(-expected.bounds[1] / 2);
    expect(bodyBounds.max.y).toBeLessThanOrEqual(expected.bounds[1] / 2);
    expect(bodyBounds.max.z).toBeLessThanOrEqual(expected.bounds[2]);
    expect(asset.meshCount).toBe(expected.draws);
    expect(
      gltf.parser.json.meshes
        .flatMap((m: { primitives: { indices: number }[] }) => m.primitives)
        .reduce(
          (sum: number, p: { indices: number }) =>
            sum + gltf.parser.json.accessors[p.indices].count / 3,
          0,
        ),
    ).toBe(expected.triangles);
    expect(asset.drawMeshCount).toBe(6);
    const body = required(asset.object.getObjectByName("Body_static"));
    const ramp = required(asset.object.getObjectByName("Transport_Loading_Ramp"));
    asset.object.updateMatrixWorld(true);
    const rest = ramp.matrixWorld.clone(),
      fixed = body.matrixWorld.clone();
    const tires = ["FL", "FR", "RL", "RR"].map((id) =>
      required(asset.object.getObjectByName(`Wheel_${id}_Roll`)),
    );
    const neutral = tires.map((w) => w.quaternion.clone());
    for (const deployed of [true, false, true, false]) {
      asset.setTransportRamp(deployed);
      asset.object.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(ramp);
      expect(body.matrixWorld.equals(fixed)).toBe(true);
      if (deployed) {
        expect(box.min.x).toBeGreaterThan(TRANSPORTER.toe - 1);
        expect(box.min.x).toBeLessThan(TRANSPORTER.toe + 0.5);
        expect(box.min.z).toBeGreaterThan(-2.1);
        expect(box.min.z).toBeLessThan(0.1);
        expect(box.max.z).toBeCloseTo(TRANSPORTER.height, 0);
      } else expect(ramp.matrixWorld.toArray()).toEqual(rest.toArray());
    }
    for (const travel of [20, -20, 0]) {
      asset.setTravel(travel);
      asset.object.updateMatrixWorld(true);
      for (const [i, wheel] of tires.entries()) {
        expect(wheel.userData.wheel_radius).toBeCloseTo(400 / 46, 6);
        if (travel) expect(wheel.quaternion.angleTo(required(neutral[i]))).toBeGreaterThan(0.1);
        else expect(wheel.quaternion.toArray()).toEqual(required(neutral[i]).toArray());
      }
      expect(body.matrixWorld.equals(fixed)).toBe(true);
    }
  } finally {
    asset.dispose();
  }
});

it("keeps every ramp fallback and normal-game sprite inside its native frame", () => {
  for (const [path, width, height, cols, rows] of [
    ["car-transporter-v2", 192, 224, 1, 4],
    ["car-transporter-ramp-v2", 384, 384, 4, 2],
  ] as const) {
    const bytes = readFileSync(`public/assets/vehicles/${path}.png`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      rows === 4 ? expected.spriteSha256 : expected.rampSha256,
    );
    const png = PNG.sync.read(bytes);
    expect([png.width, png.height]).toEqual([width * cols, height * rows]);
    for (let row = 0; row < rows; row++)
      for (let col = 0; col < cols; col++) {
        let count = 0;
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const alpha = png.data[((row * height + y) * png.width + col * width + x) * 4 + 3];
            if (alpha) {
              count++;
              expect(x, `${path} left`).toBeGreaterThan(0);
              expect(x).toBeLessThan(width - 1);
              expect(y).toBeGreaterThan(0);
              expect(y).toBeLessThan(height - 1);
            }
          }
        expect(count).toBeGreaterThan(500);
      }
  }
});

it("keeps the cardinal carrier and loaded car aligned through a heading-switch boundary", () => {
  const yaw = (46 * Math.PI) / 180;
  const item: SpriteItem = {
    kind: "sprite",
    sortKey: 0,
    wx: 0,
    wy: 0,
    zOffset: 0,
    sheetKey: "vehicle-v1:car-transporter",
    frameCol: 0,
    frameRow: 3,
    spriteWidth: 192,
    spriteHeight: 224,
    flipX: false,
    drawOffsetY: 80,
    hasShadow: false,
    shadowFeetWy: 0,
    shadowWidth: 0,
    shadowTerrainZ: 0,
    flashHidden: false,
    mesh: { assetId: "car-transporter-authored-v2", orientation: yawOrientation(yaw), radius: 192 },
  };
  item.towGroup = {
    ...item,
    wx: -21 * Math.cos(yaw),
    wy: -21 * Math.sin(yaw),
    zOffset: 24.65,
    sheetKey: "vehicle-v1:beetle",
    mesh: { assetId: "beetle-authored-v1", orientation: yawOrientation(yaw), radius: 80 },
  };
  let sourceX = -1;
  let shown: SpriteItem | undefined;
  const surface = {
    globalAlpha: 1,
    save() {},
    restore() {},
    drawImage(...args: unknown[]) {
      sourceX = args[1] as number;
    },
  } as unknown as RasterSurface;
  const sheets = new Map([["car-transporter-ramp-v2", { image: {} } as unknown as Spritesheet]]);
  expect(
    drawTransporterFallback(surface, new Camera(), item, sheets, (_ctx, _camera, car) => {
      shown = car;
    }),
  ).toBe(true);
  expect(sourceX).toBe(3 * 384);
  expect(shown?.frameRow).toBe(3);
  expect(shown?.wx).toBeCloseTo(-21, 6);
  expect(shown?.wy).toBeCloseTo(0, 6);
});
